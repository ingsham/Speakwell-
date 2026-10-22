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
