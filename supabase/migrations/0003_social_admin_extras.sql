-- Run after 0002. Adds: moderator role, follower counts, notifications, announcements, platform settings,
-- admin stats, a default community, moderation guards and a few helper functions.

-- ROLES -----------------------------------------------------------------
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('admin','moderator'));

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','moderator'));
$$;

create policy roles_read_admin on public.user_roles for select to authenticated using (is_admin());

create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if new_role not in ('admin','moderator','none') then raise exception 'invalid role'; end if;
  if target = auth.uid() and new_role <> 'admin' then raise exception 'you cannot remove your own admin role'; end if;
  if new_role = 'none' then delete from user_roles where user_id = target;
  else insert into user_roles (user_id, role) values (target, new_role)
       on conflict (user_id) do update set role = excluded.role, granted_at = now(); end if;
  insert into admin_audit_logs (admin_id, action, target_type, target_id, detail)
    values (auth.uid(), 'set_role', 'user', target, jsonb_build_object('role', new_role));
end $$;

-- Moderators can read what they need to moderate.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or (is_public and not suspended and not is_blocked_between(id, auth.uid())) or is_staff());
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated
  using ((not removed and can_read_community(community_id)) or is_staff());
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using ((not removed and can_read_post(post_id)) or is_staff());
drop policy if exists reports_read_own_or_admin on public.reports;
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or is_staff());
drop policy if exists audit_read on public.admin_audit_logs;
create policy audit_read on public.admin_audit_logs for select to authenticated using (is_admin());
drop policy if exists modactions_read on public.moderation_actions;
create policy modactions_read on public.moderation_actions for select to authenticated using (is_staff());

create or replace function public.admin_resolve_report(rid uuid, dismiss boolean, note text, remove_content boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if coalesce(char_length(note),0) < 3 then raise exception 'a reason is required'; end if;
  select * into r from reports where id = rid for update;
  if not found then raise exception 'not found'; end if;
  if remove_content then
    if r.target_type = 'post' then update posts set removed = true where id = r.target_id;
    elsif r.target_type = 'comment' then update comments set removed = true where id = r.target_id;
    elsif r.target_type = 'community' then update communities set removed = true where id = r.target_id; end if;
  end if;
  update reports set status = case when dismiss then 'dismissed' else 'actioned' end,
    resolution_note = note, resolved_by = auth.uid() where id = rid;
  insert into moderation_actions (actor_id, target_type, target_id, action, reason)
    values (auth.uid(), r.target_type, r.target_id, case when dismiss then 'dismiss_report' else 'action_report' end, note);
  insert into admin_audit_logs (admin_id, action, target_type, target_id, detail)
    values (auth.uid(), 'resolve_report', r.target_type, r.target_id,
            jsonb_build_object('report', rid, 'dismissed', dismiss, 'removed', remove_content, 'note', note));
end $$;

-- FOLLOWS: counts for any profile (the follows table itself stays private) --------
create or replace function public.follow_counts(uid uuid) returns table(followers bigint, following bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from follows where followee_id = uid),
         (select count(*) from follows where follower_id = uid);
$$;

-- BLOCKS: list the people I blocked (their profiles are hidden by RLS once blocked) ----
create or replace function public.my_blocked() returns table(id uuid, username text, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name from blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc;
$$;

-- PLATFORM SETTINGS + ANNOUNCEMENTS -----------------------------------------
create table public.platform_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
create policy settings_read on public.platform_settings for select to anon, authenticated using (true);
insert into public.platform_settings (key, value) values
  ('community_creation_enabled', 'true'),
  ('messaging_enabled', 'true'),
  ('guidelines', E'Speakwell is a supportive space.\n\n1. Be kind. Never mock or imitate how someone speaks.\n2. No pressure. Nobody has to be fluent here.\n3. Respect privacy. Do not share other people''s information or recordings.\n4. No harassment, hate or spam.\n5. Report anything that feels unsafe. Moderators review every report.'),
  ('terms', 'Terms of Service: the founder must write and review these before launch.'),
  ('privacy', 'Privacy Policy: the founder must write and review this before launch.')
on conflict do nothing;

create or replace function public.setting_on(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value from platform_settings where key = k), 'true') = 'true';
$$;

create or replace function public.admin_set_setting(k text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if k not in ('community_creation_enabled','messaging_enabled','guidelines','terms','privacy') then raise exception 'unknown setting'; end if;
  insert into platform_settings (key, value) values (k, v)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into admin_audit_logs (admin_id, action, target_type, detail)
    values (auth.uid(), 'set_setting', 'setting', jsonb_build_object('key', k));
end $$;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text check (char_length(body) <= 1000),
  kind text not null default 'info' check (kind in ('info','maintenance')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy ann_read on public.announcements for select to authenticated using (active or is_admin());
create policy ann_admin on public.announcements for all to authenticated using (is_admin()) with check (is_admin());

-- Enforce the feature switches in the database, not just the UI.
drop policy if exists comm_insert on public.communities;
create policy comm_insert on public.communities for insert to authenticated
  with check (owner_id = auth.uid() and not is_suspended() and setting_on('community_creation_enabled'));
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and is_conversation_member(conversation_id) and not is_suspended()
    and setting_on('messaging_enabled')
    and not exists (select 1 from conversation_participants p
                    where p.conversation_id = messages.conversation_id and p.user_id <> auth.uid()
                      and is_blocked_between(p.user_id, auth.uid())));

-- NOTIFICATIONS (created by triggers, respecting each user's preferences) --------------
create or replace function public.notify_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text; un text;
begin
  if coalesce((select notify_followers from user_preferences where user_id = new.followee_id), true) then
    select display_name, username into nm, un from profiles where id = new.follower_id;
    insert into notifications (user_id, kind, title, link)
      values (new.followee_id, 'follow', nm || ' started following you', '/profile/' || un);
  end if;
  return new; end $$;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_follow();

create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; nm text;
begin
  select display_name into nm from profiles where id = new.sender_id;
  for r in select user_id from conversation_participants where conversation_id = new.conversation_id and user_id <> new.sender_id loop
    if coalesce((select notify_messages from user_preferences where user_id = r.user_id), true)
       and not exists (select 1 from notifications where user_id = r.user_id and kind = 'message'
                       and link = '/messages/' || new.conversation_id and not read) then
      insert into notifications (user_id, kind, title, link)
        values (r.user_id, 'message', 'New message from ' || nm, '/messages/' || new.conversation_id);
    end if;
  end loop;
  return new; end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_message();

create or replace function public.notify_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if coalesce((select notify_invitations from user_preferences where user_id = new.recipient_id), true) then
    select display_name into nm from profiles where id = new.sender_id;
    insert into notifications (user_id, kind, title, link)
      values (new.recipient_id, 'invitation', nm || ' invited you to practise', '/practice/invitations');
  end if;
  return new; end $$;
create trigger invitations_notify after insert on public.practice_invitations for each row execute function public.notify_invitation();

create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; nm text;
begin
  select author_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.author_id then
    select display_name into nm from profiles where id = new.author_id;
    insert into notifications (user_id, kind, title, link)
      values (owner, 'comment', nm || ' commented on your post', '/feed');
  end if;
  return new; end $$;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_comment();

-- COMMUNITIES -------------------------------------------------------------
create or replace function public.guard_post_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.pinned is distinct from old.pinned or new.removed is distinct from old.removed)
     and not (public.community_role(new.community_id) in ('owner','moderator') or public.is_staff()) then
    raise exception 'not allowed'; end if;
  return new; end $$;
create trigger posts_guard before update on public.posts for each row execute function public.guard_post_update();

create or replace function public.guard_community_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.removed is distinct from old.removed and not public.is_staff() then raise exception 'not allowed'; end if;
  return new; end $$;
create trigger communities_guard before update on public.communities for each row execute function public.guard_community_update();

create or replace function public.set_member_role(cid uuid, uid uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('moderator','member') then raise exception 'invalid role'; end if;
  if not (public.community_role(cid) = 'owner' or public.is_admin()) then raise exception 'not allowed'; end if;
  update community_members set role = new_role where community_id = cid and user_id = uid and role <> 'owner';
  insert into moderation_actions (actor_id, target_type, target_id, action, reason)
    values (auth.uid(), 'community', cid, 'set_member_role', new_role || ' for ' || uid);
end $$;

-- A default community everyone can join. Created lazily, owned by the first admin.
create or replace function public.join_general() returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; owner uuid;
begin
  if auth.uid() is null or public.is_suspended() then raise exception 'not allowed'; end if;
  select id into cid from communities where name = 'Speakwell Lounge' and not removed;
  if cid is null then
    select user_id into owner from user_roles where role = 'admin' order by granted_at limit 1;
    if owner is null then return null; end if;
    insert into communities (owner_id, name, description, category, guidelines, visibility)
      values (owner, 'Speakwell Lounge', 'Everyone is welcome. Share wins, questions and encouragement.', 'General',
              'Be kind. Never mock how anyone speaks. Report anything that feels unsafe.', 'public')
      returning id into cid;
  end if;
  insert into community_members (community_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

-- ADMIN STATS (aggregates only: never recordings, messages or private notes) --------------
create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'total_users', (select count(*) from profiles),
    'suspended_users', (select count(*) from profiles where suspended),
    'active_users_7d', (select count(distinct u) from (
        select user_id u from practice_sessions where created_at > now() - interval '7 days'
        union select sender_id from messages where created_at > now() - interval '7 days'
        union select author_id from posts where created_at > now() - interval '7 days') x),
    'new_users_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d::date, 'count',
        (select count(*) from profiles where created_at::date = d::date)) order by d)
        from generate_series(now() - interval '13 days', now(), interval '1 day') d), '[]'::jsonb),
    'communities', (select count(*) from communities where not removed),
    'posts_7d', (select count(*) from posts where created_at > now() - interval '7 days' and not removed),
    'sessions_total', (select count(*) from practice_sessions),
    'sessions_7d', (select count(*) from practice_sessions where created_at > now() - interval '7 days'),
    'reports_pending', (select count(*) from reports where status = 'pending'),
    'reports_resolved', (select count(*) from reports where status <> 'pending')
  ) into out;
  return out;
end $$;

-- GRANTS -------------------------------------------------------------------
revoke execute on function public.admin_set_role, public.admin_set_setting, public.follow_counts, public.my_blocked,
  public.set_member_role, public.join_general, public.admin_stats from public, anon;
grant execute on function public.admin_set_role, public.admin_set_setting, public.follow_counts, public.my_blocked,
  public.set_member_role, public.join_general, public.admin_stats to authenticated;
