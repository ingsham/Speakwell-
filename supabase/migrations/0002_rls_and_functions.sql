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
