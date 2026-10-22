-- Speakwell audio connections. Additive migration: does not alter or delete existing data.
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  description text check (char_length(description) <= 500),
  topic text not null default 'Open conversation' check (char_length(topic) <= 60),
  visibility text not null default 'public' check (visibility in ('public','private')),
  status text not null default 'active' check (status in ('active','ended')),
  capacity smallint not null default 12 check (capacity between 2 and 30),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists live_rooms_active_created_idx on public.live_rooms(status, visibility, created_at desc);

create table if not exists public.live_room_participants (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'listener' check (role in ('host','speaker','listener')),
  speaking_request text not null default 'none' check (speaking_request in ('none','requested')),
  status text not null default 'joined' check (status in ('joined','left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id,user_id)
);
create index if not exists live_room_participants_user_idx on public.live_room_participants(user_id,status);

create table if not exists public.call_invitations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(message) <= 280),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired','ended')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (sender_id <> recipient_id)
);
create index if not exists call_invitations_recipient_idx on public.call_invitations(recipient_id,status,created_at desc);
create index if not exists call_invitations_sender_idx on public.call_invitations(sender_id,status,created_at desc);
create unique index if not exists one_pending_audio_call on public.call_invitations(sender_id,recipient_id) where status='pending';

create table if not exists public.live_room_invitations (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.live_rooms(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 check(sender_id<>recipient_id)
);
create unique index if not exists one_pending_room_invite on public.live_room_invitations(room_id,recipient_id) where status='pending';
create index if not exists room_invites_recipient_idx on public.live_room_invitations(recipient_id,status,created_at desc);

create or replace function public.can_read_live_room(room_uuid uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.live_rooms r where r.id=room_uuid and (
  r.visibility='public' or r.creator_id=auth.uid()
  or exists(select 1 from public.live_room_participants p where p.room_id=r.id and p.user_id=auth.uid() and p.status='joined')
  or exists(select 1 from public.live_room_invitations i where i.room_id=r.id and i.recipient_id=auth.uid() and i.status in ('pending','accepted'))
 )); $$;
create or replace function public.is_live_room_public(room_uuid uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.live_rooms r where r.id=room_uuid and r.status='active' and r.visibility='public'); $$;
create or replace function public.can_read_live_room_participants(room_uuid uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.live_rooms r where r.id=room_uuid and (
  (r.status='active' and r.visibility='public') or r.creator_id=auth.uid()
  or exists(select 1 from public.live_room_participants p where p.room_id=r.id and p.user_id=auth.uid() and p.status='joined')
  or exists(select 1 from public.live_room_invitations i where i.room_id=r.id and i.recipient_id=auth.uid() and i.status='accepted')
 )); $$;
revoke all on function public.can_read_live_room(uuid) from public;
revoke all on function public.is_live_room_public(uuid) from public;
revoke all on function public.can_read_live_room_participants(uuid) from public;
grant execute on function public.can_read_live_room(uuid) to authenticated;
grant execute on function public.is_live_room_public(uuid) to authenticated;
grant execute on function public.can_read_live_room_participants(uuid) to authenticated;

alter table public.live_rooms enable row level security;
alter table public.live_room_participants enable row level security;
alter table public.call_invitations enable row level security;
alter table public.live_room_invitations enable row level security;

drop policy if exists live_rooms_read on public.live_rooms;
create policy live_rooms_read on public.live_rooms for select to authenticated using (public.can_read_live_room(id));
drop policy if exists live_rooms_create on public.live_rooms;
create policy live_rooms_create on public.live_rooms for insert to authenticated
with check (creator_id=auth.uid() and not public.is_suspended() and status='active');
drop policy if exists live_rooms_host_update on public.live_rooms;
create policy live_rooms_host_update on public.live_rooms for update to authenticated
using (creator_id=auth.uid() or public.is_admin()) with check (creator_id=auth.uid() or public.is_admin());

drop policy if exists live_participants_read on public.live_room_participants;
create policy live_participants_read on public.live_room_participants for select to authenticated
using (user_id=auth.uid() or public.can_read_live_room_participants(room_id) or public.is_admin());
drop policy if exists live_participants_join on public.live_room_participants;
create policy live_participants_join on public.live_room_participants for insert to authenticated
with check (user_id=auth.uid() and role='listener' and speaking_request='none' and status='joined' and exists (select 1 from public.live_rooms r where r.id=room_id and r.status='active' and r.visibility='public') and not public.is_suspended());
drop policy if exists live_participants_self_update on public.live_room_participants;
-- Participant role changes must go through the SECURITY DEFINER moderation functions below.
drop policy if exists live_participants_host_insert on public.live_room_participants;
create policy live_participants_host_insert on public.live_room_participants for insert to authenticated
with check (exists (select 1 from public.live_rooms r where r.id=room_id and r.creator_id=auth.uid()) and user_id=auth.uid() and role='host' and status='joined');


drop policy if exists room_invites_read on public.live_room_invitations;
create policy room_invites_read on public.live_room_invitations for select to authenticated
using (sender_id=auth.uid() or recipient_id=auth.uid() or exists(select 1 from public.live_rooms r where r.id=room_id and r.creator_id=auth.uid()));
drop policy if exists room_invites_send on public.live_room_invitations;
create policy room_invites_send on public.live_room_invitations for insert to authenticated
with check (sender_id=auth.uid() and status='pending' and not public.is_suspended() and not public.is_blocked_between(sender_id,recipient_id)
 and exists(select 1 from public.live_rooms r where r.id=room_id and r.creator_id=auth.uid() and r.status='active'));
drop policy if exists room_invites_response on public.live_room_invitations;

drop policy if exists call_invites_read on public.call_invitations;
create policy call_invites_read on public.call_invitations for select to authenticated
using (sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists call_invites_send on public.call_invitations;
create policy call_invites_send on public.call_invitations for insert to authenticated
with check (sender_id=auth.uid() and status='pending' and expires_at > now() and not public.is_suspended() and not public.is_blocked_between(sender_id,recipient_id));
drop policy if exists call_invites_recipient_response on public.call_invitations;


create or replace function public.respond_room_invitation(inv_uuid uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or new_status not in ('accepted','declined') then raise exception 'Invalid invitation response'; end if;
 update public.live_room_invitations set status=new_status,responded_at=now()
 where id=inv_uuid and recipient_id=auth.uid() and status='pending';
 if not found then raise exception 'This room invitation is no longer available'; end if;
end; $$;
revoke all on function public.respond_room_invitation(uuid,text) from public;
grant execute on function public.respond_room_invitation(uuid,text) to authenticated;

create or replace function public.respond_call_invitation(inv_uuid uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if new_status='accepted' or new_status='declined' then
  update public.call_invitations set status=new_status,responded_at=now()
  where id=inv_uuid and recipient_id=auth.uid() and status='pending' and expires_at>now();
 elsif new_status='cancelled' then
  update public.call_invitations set status='cancelled',responded_at=now()
  where id=inv_uuid and sender_id=auth.uid() and status='pending';
 else raise exception 'Invalid invitation response'; end if;
 if not found then raise exception 'This call invitation is no longer available'; end if;
end; $$;
revoke all on function public.respond_call_invitation(uuid,text) from public;
grant execute on function public.respond_call_invitation(uuid,text) to authenticated;

create or replace function public.end_call_invitation(inv_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.call_invitations set status='ended',responded_at=now()
 where id=inv_uuid and (sender_id=auth.uid() or recipient_id=auth.uid()) and status='accepted';
 if not found then raise exception 'This call is no longer active'; end if;
end; $$;
revoke all on function public.end_call_invitation(uuid) from public;
grant execute on function public.end_call_invitation(uuid) to authenticated;

create or replace function public.join_live_room(room_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.live_rooms%rowtype; current_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if public.is_suspended() then raise exception 'Suspended accounts cannot join rooms'; end if;
 select * into r from public.live_rooms as room where room.id=room_uuid and room.status='active' and (room.visibility='public' or room.creator_id=auth.uid() or exists(select 1 from public.live_room_invitations i where i.room_id=room.id and i.recipient_id=auth.uid() and i.status='accepted')) for update;
 if not found then raise exception 'This room is not available to join. Private rooms require an accepted invitation.'; end if;
 if exists(select 1 from public.live_room_participants p where p.room_id=room_uuid and p.status='joined' and p.user_id<>auth.uid() and public.is_blocked_between(p.user_id,auth.uid())) then raise exception 'You cannot join this room while a blocked member is present'; end if;
 select count(*) into current_count from public.live_room_participants where room_id=room_uuid and status='joined' and user_id<>auth.uid();
 if current_count >= r.capacity then raise exception 'This room is full'; end if;
 insert into public.live_room_participants as existing(room_id,user_id,role,status,speaking_request,joined_at,left_at)
 values(room_uuid,auth.uid(),case when r.creator_id=auth.uid() then 'host' else 'listener' end,'joined','none',now(),null)
 on conflict(room_id,user_id) do update set
  role=case when existing.role='host' and r.creator_id=auth.uid() then 'host' else 'listener' end,
  status='joined',speaking_request='none',joined_at=now(),left_at=null;
end; $$;
revoke all on function public.join_live_room(uuid) from public;
grant execute on function public.join_live_room(uuid) to authenticated;

create or replace function public.request_room_speaker(room_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.live_room_participants set speaking_request='requested'
 where room_id=room_uuid and user_id=auth.uid() and status='joined' and role='listener';
 if not found then raise exception 'Join the room as a listener first'; end if;
end; $$;
revoke all on function public.request_room_speaker(uuid) from public;
grant execute on function public.request_room_speaker(uuid) to authenticated;

create or replace function public.decide_room_speaker(room_uuid uuid, target_user uuid, approve boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists (select 1 from public.live_rooms where id=room_uuid and (creator_id=auth.uid() or public.is_admin())) then raise exception 'Only the room host can manage speaking requests'; end if;
 if approve then
  update public.live_room_participants set role='speaker', speaking_request='none' where room_id=room_uuid and user_id=target_user and status='joined' and speaking_request='requested';
 else
  update public.live_room_participants set speaking_request='none' where room_id=room_uuid and user_id=target_user and status='joined';
 end if;
end; $$;
revoke all on function public.decide_room_speaker(uuid,uuid,boolean) from public;
grant execute on function public.decide_room_speaker(uuid,uuid,boolean) to authenticated;

create or replace function public.leave_live_room(room_uuid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.live_room_participants set status='left', left_at=now() where room_id=room_uuid and user_id=auth.uid() and status='joined';
end; $$;
revoke all on function public.leave_live_room(uuid) from public;
grant execute on function public.leave_live_room(uuid) to authenticated;

-- Optional voice notes on feed posts. Files stay in a private bucket; access follows post visibility.
alter table public.posts add column if not exists audio_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('speakwell-voice-notes','speakwell-voice-notes',false,10485760,array['audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do nothing;
drop policy if exists speakwell_voice_upload_own on storage.objects;
create policy speakwell_voice_upload_own on storage.objects for insert to authenticated
with check (bucket_id='speakwell-voice-notes' and (storage.foldername(name))[1]=auth.uid()::text and not public.is_suspended());
drop policy if exists speakwell_voice_read_authorized on storage.objects;
create policy speakwell_voice_read_authorized on storage.objects for select to authenticated
using (bucket_id='speakwell-voice-notes' and (
 (storage.foldername(name))[1]=auth.uid()::text
 or public.can_read_post(((storage.foldername(name))[2])::uuid)
));
drop policy if exists speakwell_voice_update_own on storage.objects;
create policy speakwell_voice_update_own on storage.objects for update to authenticated
using (bucket_id='speakwell-voice-notes' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='speakwell-voice-notes' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists speakwell_voice_delete_own on storage.objects;
create policy speakwell_voice_delete_own on storage.objects for delete to authenticated
using (bucket_id='speakwell-voice-notes' and (storage.foldername(name))[1]=auth.uid()::text);
