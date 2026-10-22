-- =====================================================================================
-- SPEAKWELL: ONE-STEP DATABASE SETUP.  Paste this whole file into Supabase > SQL Editor > Run.
-- It is safe to run more than once: it first removes any earlier (partial) Speakwell tables,
-- then rebuilds everything. WARNING: that deletes existing Speakwell data in the public schema.
-- Do not run it on a live site with real users; use the numbered migrations for upgrades instead.
-- =====================================================================================

-- 0. RESET (only Speakwell objects) ------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
do $$
declare t text; f record;
begin
  foreach t in array array['admin_audit_logs','moderation_actions','reports','notifications','reactions','comments',
    'posts','community_join_requests','community_invitations','community_members','communities','messages',
    'conversation_participants','conversations','practice_invitations','practice_goals','practice_sessions',
    'practice_exercises','blocks','follows','user_roles','user_preferences','profiles','announcements','platform_settings']
  loop execute format('drop table if exists public.%I cascade', t); end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
    'set_updated_at','is_admin','is_suspended','is_staff','handle_new_user','guard_profile_update','is_blocked_between',
    'is_conversation_member','community_role','can_read_community','can_read_post','post_is_public','respond_invitation',
    'start_conversation','messages_rate_limit','join_community','decide_join_request','add_owner_membership',
    'admin_set_suspended','admin_resolve_report','delete_my_account','admin_set_role','follow_counts','my_blocked',
    'setting_on','admin_set_setting','notify_follow','notify_message','notify_invitation','notify_comment','notify_like',
    'notify_share','guard_post_update','guard_community_update','set_member_role','join_general','admin_stats')
  loop execute format('drop function if exists %s cascade', f.sig); end loop;
end $$;

-- ===== 0001_core_schema =====
-- Speakwell core schema (Supabase / PostgreSQL). Run in order: 0001, 0002.
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- PROFILES ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text check (char_length(bio) <= 280),
  interests text[] not null default '{}',
  goals text,
  country text,
  timezone text,
  avatar_url text,
  is_public boolean not null default true,
  suspended boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notify_messages boolean not null default true,
  notify_invitations boolean not null default true,
  notify_followers boolean not null default true,
  show_activity boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Roles are server-controlled: no client INSERT/UPDATE policy exists.
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = auth.uid()), false);
$$;

-- SOCIAL ----------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index on public.follows (followee_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- PRACTICE ---------------------------------------------------------------
create table public.practice_exercises (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in
    ('warm-up','storytelling','conversation','reading','introduction','presentation','opinion')),
  title text not null,
  prompt text not null,
  suggested_seconds int not null default 120 check (suggested_seconds between 15 and 1800),
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Audio is NOT stored here. Recordings stay in the user's browser unless they explicitly share.
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid references public.practice_exercises(id) on delete set null,
  custom_prompt text check (char_length(custom_prompt) <= 300),
  duration_seconds int not null check (duration_seconds between 0 and 7200),
  completed boolean not null default true,
  confidence smallint check (confidence between 1 and 5),
  reflection text check (char_length(reflection) <= 1000),
  created_at timestamptz not null default now()
);
create index on public.practice_sessions (user_id, created_at desc);

create table public.practice_goals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_sessions int not null default 3 check (weekly_sessions between 1 and 21)
);

create table public.practice_invitations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(message) <= 280),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index one_pending_invite on public.practice_invitations (sender_id, recipient_id)
  where status = 'pending';
create trigger invites_updated before update on public.practice_invitations
  for each row execute function public.set_updated_at();

-- MESSAGING ---------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on public.conversation_participants (user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);

-- COMMUNITIES ----------------------------------------------------------------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null unique check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 600),
  category text,
  guidelines text check (char_length(guidelines) <= 2000),
  visibility text not null default 'public' check (visibility in ('public','private','invite_only')),
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger communities_updated before update on public.communities
  for each row execute function public.set_updated_at();

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index on public.community_members (user_id);

create table public.community_invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (community_id, invitee_id)
);
create table public.community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  pinned boolean not null default false,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.posts (community_id, pinned desc, created_at desc);
create trigger posts_updated before update on public.posts
  for each row execute function public.set_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1500),
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.comments (post_id, created_at);

create table public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'like' check (kind in ('like','support')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

-- NOTIFICATIONS / MODERATION ---------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','comment','community')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'pending' check (status in ('pending','dismissed','actioned')),
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.reports (status, created_at desc);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- NEW USER TRIGGER: creates a profile + preferences from signup metadata ----
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  base := lower(regexp_replace(split_part(new.email,'@',1), '[^a-z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'user' || base; end if;
  candidate := left(base, 20);
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1; candidate := left(base, 18) || n::text;
  end loop;
  insert into public.profiles (id, username, display_name)
    values (new.id, candidate, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), candidate));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 0002_rls_and_functions =====
-- RLS + race-safe server functions. Run after 0001.

-- helpers --------------------------------------------------------------
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create or replace function public.is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_participants where conversation_id=cid and user_id=auth.uid());
$$;
create or replace function public.community_role(cid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from community_members where community_id=cid and user_id=auth.uid();
$$;
create or replace function public.can_read_community(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from communities c where c.id=cid and not c.removed and c.visibility='public')
      or exists (select 1 from community_members m where m.community_id=cid and m.user_id=auth.uid());
$$;

-- enable RLS everywhere ------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['profiles','user_preferences','user_roles','follows','blocks','practice_exercises',
   'practice_sessions','practice_goals','practice_invitations','conversations','conversation_participants',
   'messages','communities','community_members','community_invitations','community_join_requests','posts',
   'comments','reactions','notifications','reports','moderation_actions','admin_audit_logs']
  loop execute format('alter table public.%I enable row level security', t); end loop; end $$;

-- profiles: public profiles readable by signed-in users; owner edits own row.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or (is_public and not suspended and not is_blocked_between(id, auth.uid())) or is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Stop users changing their own suspension flag.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.suspended is distinct from old.suspended and not public.is_admin() then
    raise exception 'not allowed'; end if;
  return new; end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

create policy prefs_own on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_roles: users may only see their own role; NO write policies => only SQL editor / service role.
create policy roles_read_own on public.user_roles for select to authenticated using (user_id = auth.uid());

-- follows / blocks
create policy follows_read on public.follows for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not is_suspended() and not is_blocked_between(follower_id, followee_id));
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- practice
create policy exercises_read on public.practice_exercises for select to authenticated
  using (is_active or is_admin());
create policy exercises_admin_write on public.practice_exercises for all to authenticated
  using (is_admin()) with check (is_admin());
create policy sessions_own on public.practice_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy goals_own on public.practice_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- invitations: parties can read; sender creates (as self, status pending); status changes via function below.
create policy invites_read on public.practice_invitations for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy invites_insert on public.practice_invitations for insert to authenticated
  with check (sender_id = auth.uid() and status = 'pending' and not is_suspended()
              and not is_blocked_between(sender_id, recipient_id));

create or replace function public.respond_invitation(inv uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
declare r practice_invitations%rowtype;
begin
  select * into r from practice_invitations where id = inv for update;
  if not found then raise exception 'not found'; end if;
  if new_status in ('accepted','declined') then
    if r.recipient_id <> auth.uid() or r.status <> 'pending' then raise exception 'not allowed'; end if;
  elsif new_status = 'cancelled' then
    if r.sender_id <> auth.uid() or r.status <> 'pending' then raise exception 'not allowed'; end if;
  elsif new_status = 'completed' then
    if auth.uid() not in (r.sender_id, r.recipient_id) or r.status <> 'accepted' then raise exception 'not allowed'; end if;
  else raise exception 'invalid status'; end if;
  update practice_invitations set status = new_status where id = inv;
  insert into notifications (user_id, kind, title, link)
    values (case when auth.uid() = r.sender_id then r.recipient_id else r.sender_id end,
            'invitation_' || new_status, 'A practice invitation was ' || new_status, '/practice/invitations');
end $$;

-- messaging: conversations are created ONLY through this function, which enforces the rule:
-- initiator must be followed by the recipient OR have an accepted practice invitation; no blocks.
create or replace function public.start_conversation(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null or me = other or public.is_suspended() then raise exception 'not allowed'; end if;
  if public.is_blocked_between(me, other) then raise exception 'not allowed'; end if;
  select c.id into cid from conversations c
    where exists (select 1 from conversation_participants where conversation_id=c.id and user_id=me)
      and exists (select 1 from conversation_participants where conversation_id=c.id and user_id=other)
    limit 1;
  if cid is not null then return cid; end if;
  if not (exists (select 1 from follows where follower_id = other and followee_id = me)
       or exists (select 1 from practice_invitations
                  where status in ('accepted','completed')
                    and ((sender_id=me and recipient_id=other) or (sender_id=other and recipient_id=me))))
  then raise exception 'recipient must follow you or have accepted a practice invitation'; end if;
  insert into conversations default values returning id into cid;
  insert into conversation_participants (conversation_id, user_id) values (cid, me), (cid, other);
  return cid;
end $$;

create policy conv_read on public.conversations for select to authenticated using (is_conversation_member(id));
create policy cp_read on public.conversation_participants for select to authenticated
  using (is_conversation_member(conversation_id));
create policy cp_update_own on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy msg_read on public.messages for select to authenticated using (is_conversation_member(conversation_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and is_conversation_member(conversation_id) and not is_suspended()
    and not exists (select 1 from conversation_participants p
                    where p.conversation_id = messages.conversation_id and p.user_id <> auth.uid()
                      and is_blocked_between(p.user_id, auth.uid())));

-- simple anti-spam: max 30 messages per minute per user
create or replace function public.messages_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30
  then raise exception 'slow down'; end if;
  update conversations set last_message_at = now() where id = new.conversation_id;
  return new; end $$;
create trigger messages_rl before insert on public.messages
  for each row execute function public.messages_rate_limit();

-- communities ----------------------------------------------------------
create policy comm_read on public.communities for select to authenticated
  using (is_admin() or (not removed and visibility in ('public','private'))
         or exists (select 1 from community_members m where m.community_id = id and m.user_id = auth.uid()));
create policy comm_insert on public.communities for insert to authenticated
  with check (owner_id = auth.uid() and not is_suspended());
create policy comm_update on public.communities for update to authenticated
  using (community_role(id) in ('owner','moderator') or is_admin())
  with check (owner_id = (select owner_id from communities c where c.id = communities.id));

create policy cm_read on public.community_members for select to authenticated using (can_read_community(community_id));
create policy cm_leave on public.community_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner' or community_role(community_id) in ('owner','moderator') and role = 'member');

-- join/accept all go through functions (race-safe, enforce visibility)
create or replace function public.join_community(cid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c communities%rowtype;
begin
  select * into c from communities where id = cid and not removed for update;
  if not found or public.is_suspended() then raise exception 'not allowed'; end if;
  if exists (select 1 from community_members where community_id=cid and user_id=auth.uid()) then return 'member'; end if;
  if c.visibility = 'public' then
    insert into community_members (community_id, user_id) values (cid, auth.uid());
    return 'joined';
  elsif c.visibility = 'private' then
    insert into community_join_requests (community_id, user_id) values (cid, auth.uid())
      on conflict (community_id, user_id) do update set status='pending';
    return 'requested';
  elsif exists (select 1 from community_invitations where community_id=cid and invitee_id=auth.uid() and status='pending') then
    insert into community_members (community_id, user_id) values (cid, auth.uid());
    update community_invitations set status='accepted' where community_id=cid and invitee_id=auth.uid();
    return 'joined';
  else raise exception 'invitation required'; end if;
end $$;

create or replace function public.decide_join_request(req uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r community_join_requests%rowtype;
begin
  select * into r from community_join_requests where id=req and status='pending' for update;
  if not found or coalesce((select role from community_members where community_id=r.community_id and user_id=auth.uid()),'') not in ('owner','moderator')
  then raise exception 'not allowed'; end if;
  update community_join_requests set status = case when approve then 'approved' else 'rejected' end where id=req;
  if approve then insert into community_members (community_id, user_id) values (r.community_id, r.user_id) on conflict do nothing; end if;
  insert into notifications (user_id, kind, title, link) values (r.user_id, 'join_decision',
    case when approve then 'Your join request was approved' else 'Your join request was declined' end, '/communities/'||r.community_id);
end $$;

create or replace function public.add_owner_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into community_members (community_id, user_id, role) values (new.id, new.owner_id, 'owner'); return new; end $$;
create trigger communities_owner after insert on public.communities
  for each row execute function public.add_owner_membership();

create policy ci_read on public.community_invitations for select to authenticated
  using (invitee_id = auth.uid() or community_role(community_id) in ('owner','moderator'));
create policy ci_insert on public.community_invitations for insert to authenticated
  with check (inviter_id = auth.uid() and community_role(community_id) in ('owner','moderator') and status='pending');
create policy ci_decline on public.community_invitations for update to authenticated
  using (invitee_id = auth.uid()) with check (invitee_id = auth.uid() and status = 'declined');
create policy cjr_read on public.community_join_requests for select to authenticated
  using (user_id = auth.uid() or community_role(community_id) in ('owner','moderator'));

-- posts / comments / reactions (members only write; readable per community policy)
create policy posts_read on public.posts for select to authenticated
  using ((not removed and can_read_community(community_id)) or is_admin());
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and community_role(community_id) is not null and not is_suspended()
              and pinned = false and removed = false);
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid() or community_role(community_id) in ('owner','moderator') or is_admin())
  with check (author_id = auth.uid() or community_role(community_id) in ('owner','moderator') or is_admin());
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = auth.uid() or community_role(community_id) in ('owner','moderator') or is_admin());

create or replace function public.can_read_post(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts p where p.id = pid and can_read_community(p.community_id));
$$;
create policy comments_read on public.comments for select to authenticated
  using ((not removed and can_read_post(post_id)) or is_admin());
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and can_read_post(post_id) and not is_suspended() and removed = false
              and exists (select 1 from posts p where p.id = post_id and community_role(p.community_id) is not null));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or is_admin());
create policy reactions_read on public.reactions for select to authenticated using (can_read_post(post_id));
create policy reactions_write on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and can_read_post(post_id));
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- notifications: owner reads / marks read. Inserts happen only inside SECURITY DEFINER functions.
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports: anyone signed in can file one (as themselves); only admins read/resolve.
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'pending');
create policy reports_read_own_or_admin on public.reports for select to authenticated
  using (reporter_id = auth.uid() or is_admin());

-- admin functions: every action is permission-checked and audit-logged.
create or replace function public.admin_set_suspended(target uuid, suspend boolean, why text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if exists (select 1 from user_roles where user_id = target) then raise exception 'cannot suspend an admin'; end if;
  update profiles set suspended = suspend where id = target;
  insert into moderation_actions (actor_id, target_type, target_id, action, reason)
    values (auth.uid(), 'user', target, case when suspend then 'suspend' else 'reinstate' end, why);
  insert into admin_audit_logs (admin_id, action, target_type, target_id, detail)
    values (auth.uid(), case when suspend then 'suspend_user' else 'reinstate_user' end, 'user', target, jsonb_build_object('reason', why));
  insert into notifications (user_id, kind, title) values (target, 'moderation',
    case when suspend then 'Your account was suspended' else 'Your account was reinstated' end);
end $$;

create or replace function public.admin_resolve_report(rid uuid, dismiss boolean, note text, remove_content boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
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
  insert into admin_audit_logs (admin_id, action, target_type, target_id, detail)
    values (auth.uid(), 'resolve_report', r.target_type, r.target_id,
            jsonb_build_object('report', rid, 'dismissed', dismiss, 'removed', remove_content, 'note', note));
end $$;

create policy audit_read on public.admin_audit_logs for select to authenticated using (is_admin());
create policy modactions_read on public.moderation_actions for select to authenticated using (is_admin());

-- Account deletion: users call this; auth.users cascade removes profile and owned data.
-- Owned communities must be transferred/deleted first (owner_id is ON DELETE RESTRICT).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if exists (select 1 from communities where owner_id = auth.uid()) then
    raise exception 'transfer or delete your communities first'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- grants: lock function execution to signed-in users
revoke execute on function public.respond_invitation, public.start_conversation, public.join_community,
  public.decide_join_request, public.admin_set_suspended, public.admin_resolve_report, public.delete_my_account from public, anon;
grant execute on function public.respond_invitation, public.start_conversation, public.join_community,
  public.decide_join_request, public.admin_set_suspended, public.admin_resolve_report, public.delete_my_account to authenticated;

-- Realtime for chat + notifications
alter publication supabase_realtime add table public.messages, public.notifications;

-- ===== 0003_social_admin_extras =====
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

-- ===== 0004_social_feed =====
-- Run after 0003. Facebook/LinkedIn-style feed: personal posts (public or followers-only),
-- reposts ("share"), likes and comments with notifications. Community posts keep working.

alter table public.posts alter column community_id drop not null;
alter table public.posts add column if not exists visibility text not null default 'public'
  check (visibility in ('public','followers'));
alter table public.posts add column if not exists shared_post_id uuid references public.posts(id) on delete cascade;
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check
  check (char_length(body) <= 3000 and (char_length(body) >= 1 or shared_post_id is not null));
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_shared_idx on public.posts (shared_post_id) where shared_post_id is not null;
create index if not exists posts_created_idx on public.posts (created_at desc);

-- Is this post visible to everyone? (safe to repost)
create or replace function public.post_is_public(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p left join communities c on c.id = p.community_id
    where p.id = pid and not p.removed
      and ((p.community_id is null and p.visibility = 'public')
        or (p.community_id is not null and c.visibility = 'public' and not c.removed)));
$$;

create or replace function public.can_read_post(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p where p.id = pid and not p.removed and (
      (p.community_id is not null and public.can_read_community(p.community_id))
      or (p.community_id is null and (
            p.author_id = auth.uid()
            or (not public.is_blocked_between(p.author_id, auth.uid())
                and (p.visibility = 'public'
                     or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.author_id)))))));
$$;

drop policy if exists posts_read on public.posts;
-- Reads the row's own columns (not a lookup by id) so INSERT ... RETURNING works for the new row.
create policy posts_read on public.posts for select to authenticated
  using (public.is_staff() or (not removed and (
    (community_id is not null and public.can_read_community(community_id))
    or (community_id is null and (
          author_id = auth.uid()
          or (not public.is_blocked_between(author_id, auth.uid())
              and (visibility = 'public'
                   or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = posts.author_id))))))));

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and not is_suspended() and pinned = false and removed = false
    and (community_id is null or community_role(community_id) is not null)
    and (shared_post_id is null or (community_id is null and public.post_is_public(shared_post_id))));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and can_read_post(post_id) and not is_suspended() and removed = false
    and exists (select 1 from posts p where p.id = post_id
                and (p.community_id is null or community_role(p.community_id) is not null)));

-- Notifications: likes, shares; comments now link to the post.
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; nm text;
begin
  select author_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.author_id then
    select display_name into nm from profiles where id = new.author_id;
    insert into notifications (user_id, kind, title, link)
      values (owner, 'comment', nm || ' commented on your post', '/post/' || new.post_id);
  end if;
  return new; end $$;

create or replace function public.notify_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; nm text;
begin
  select author_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.user_id
     and not exists (select 1 from notifications where user_id = owner and kind = 'like'
                     and link = '/post/' || new.post_id and not read) then
    select display_name into nm from profiles where id = new.user_id;
    insert into notifications (user_id, kind, title, link)
      values (owner, 'like', nm || ' liked your post', '/post/' || new.post_id);
  end if;
  return new; end $$;
drop trigger if exists reactions_notify on public.reactions;
create trigger reactions_notify after insert on public.reactions for each row execute function public.notify_like();

create or replace function public.notify_share() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; nm text;
begin
  if new.shared_post_id is null then return new; end if;
  select author_id into owner from posts where id = new.shared_post_id;
  if owner is not null and owner <> new.author_id then
    select display_name into nm from profiles where id = new.author_id;
    insert into notifications (user_id, kind, title, link)
      values (owner, 'share', nm || ' shared your post', '/post/' || new.id);
  end if;
  return new; end $$;
drop trigger if exists posts_notify_share on public.posts;
create trigger posts_notify_share after insert on public.posts for each row execute function public.notify_share();

-- Everything the app needs from the API role (RLS still decides what rows are visible).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.platform_settings to anon;
grant usage, select on all sequences in schema public to authenticated;

-- FIX: the original comm_update policy selected from `communities` inside its own check, which Postgres rejects
-- ("infinite recursion detected in policy"), so every community UPDATE failed. Ownership changes are blocked by a trigger instead.
drop policy if exists comm_update on public.communities;
create policy comm_update on public.communities for update to authenticated
  using (community_role(id) in ('owner','moderator') or is_admin())
  with check (community_role(id) in ('owner','moderator') or is_admin());

create or replace function public.guard_community_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.removed is distinct from old.removed and not public.is_staff() then raise exception 'not allowed'; end if;
  if new.owner_id is distinct from old.owner_id and not public.is_admin() then raise exception 'not allowed'; end if;
  return new; end $$;

-- ===== seed =====
-- DEMO CONTENT: sample exercises only (is_demo = true). Safe to delete.
insert into public.practice_exercises (category, title, prompt, suggested_seconds, is_demo) values
 ('warm-up','Gentle breathing','Breathe slowly, then say your name and one thing you enjoyed today. Pausing is welcome.',60,true),
 ('introduction','Introduce yourself','Tell a new friend who you are and what you like to do. Go at your own pace.',120,true),
 ('storytelling','A favourite place','Describe a place that makes you feel calm. What do you see and hear?',180,true),
 ('conversation','Ordering food','Practise ordering your favourite meal as if at a restaurant.',90,true),
 ('reading','Read aloud','Read any paragraph you like out loud. Repeat words or stop whenever you want.',120,true),
 ('opinion','Share an opinion','What is one thing you would change about your town? Explain why.',150,true),
 ('presentation','Mini presentation','Teach someone something you know well in two minutes.',120,true);
-- Bootstrap your FIRST ADMIN after signing up (replace the UUID with yours from Authentication > Users):
-- insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000000', 'admin');
