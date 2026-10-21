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
