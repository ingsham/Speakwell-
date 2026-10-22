# Speakwell: Your voice. Your pace. Your people.

A supportive practice and community app for people who stammer. It is a peer-support and practice tool, **not** a cure, diagnosis or replacement for speech therapy.

> **Status: early foundation (v0.1). Nothing here has been installed, built or tested yet.** See "What exists" and "Not built yet".

## What exists
- Next.js (App Router) + TypeScript + Tailwind project config, security headers, route-protecting middleware
- Landing page; Sign up and Log in (real Supabase Auth, email confirmation callback)
- Dashboard (reads real sessions) and Practice studio (browser-only recording: timer, playback, download, delete; nothing uploaded)
- `supabase/migrations/0001_core_schema.sql`: 23 tables, constraints, indexes, triggers, auto-profile on signup
- `supabase/migrations/0004_social_feed.sql`: profile posts (public / followers-only), reposts, like and share notifications, fix for community updates
- `supabase/migrations/0003_social_admin_extras.sql`: moderator role, follower counts, notification triggers, announcements, platform settings, admin stats, default community, moderation guards
- `supabase/migrations/0002_rls_and_functions.sql`: RLS on every table, race-safe functions for invitations, conversations (messaging rule), community joining, join requests, admin suspend / report resolution with audit log, account deletion, message rate limit
- `supabase/seed.sql`: clearly labelled demo exercises
- Vitest validation tests (`src/tests/validation.test.ts`)

## Features
- Eight guided practice scenarios (casual conversation, classroom, job interview, phone call, shopping, doctor, public speaking, meeting someone new) with private recording, confidence rating and saved progress
- Profiles, edit profile, interests, follow / unfollow, follower counts, Discover (search + similar interests)
- Private messages (live updates, read status), notifications with unread badge
- Facebook/LinkedIn-style feed: post to everyone or followers only, like, comment, share (repost) and copy link, with notifications
- Communities with their own posts (public / approval / invite-only), community moderators
- Practice invitations (accept / decline / complete)
- Block and report anywhere; blocked list in Settings
- Admin area: overview analytics, users (suspend, roles), reports queue, communities, platform settings, announcements, exercises
- Roles: super admin, moderator (platform), community owner / moderator (per community)
- Public pages: About, Guidelines, Privacy, Terms, Contact (guidelines/terms/privacy are editable in Admin)

## Not built yet
Live voice/video calls, forgot / reset password pages, Playwright tests, RLS tests against a live Supabase project.

## Messaging rule
You can start a private conversation only if the recipient follows you or you have an accepted practice invitation with them. Either person can reply afterwards unless one blocks the other. Enforced in SQL (`start_conversation`).

## Run locally
1. Install Git and Node.js LTS.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key.
4. In the Supabase SQL editor run `0001_core_schema.sql`, then `0002_rls_and_functions.sql`, then `0003_social_admin_extras.sql`, then `0004_social_feed.sql`, then `seed.sql`.
   **Easier:** paste the single file `supabase/setup_all.sql` instead. It does all of the above and is safe to re-run on an empty/new project (it deletes existing Speakwell tables first).
5. In Supabase > Authentication > URL Configuration set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.
6. `npm run dev`

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## First admin
Sign up, copy your user ID from Supabase > Authentication > Users, then run in the SQL editor:
`insert into public.user_roles (user_id, role) values ('YOUR-USER-UUID', 'admin');`
Then visit Admin > Communities and press "Create / repair Speakwell Lounge" so everyone is auto-joined to a default community. After that, assign moderators from Admin > Users.
In Supabase > Authentication > Sign In / Providers > Email you can switch off "Confirm email" while testing.
There is no public admin flag and no service-role key in this codebase.

## Deploy
Push to GitHub, import the repo in Vercel, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON`, `NEXT_PUBLIC_SITE_URL`, then add your production URL to Supabase redirect URLs. Free tiers have limits that can change; check Supabase and Vercel pricing pages.

## Limitations
Live voice/video calls are not implemented (they would need signalling infrastructure). Plan: voice-note exchange and text chat. Founder must write the Privacy Policy and Terms and review legal obligations before launch.

## Speakwell connection-first redesign (initial UI phase)

This working branch begins the connection-first redesign while preserving the existing Supabase flows:

- The home page now presents live audio rooms, one-to-one connections, and the community feed as three core experiences.
- Main navigation now includes Live rooms and Connections.
- `/connections` brings existing practice invitations, messages, and Discover into one place and reads current counts from the signed-in user's existing Supabase records.
- `/rooms` explains the intended audio-first room experience and clearly marks live audio as in development. It does not pretend a real-time provider is connected or request microphone access.

### Not yet implemented

LiveKit rooms and private audio calls are not wired up yet. Before adding tables or migrations, inspect the live database schema and reconcile it with this project snapshot. The next phase should add the minimum required schema incrementally, then implement authenticated server-side token creation, room membership and host controls, invitation-to-call flow, block/report enforcement, and real-device tests. Do not run `supabase/setup_all.sql` against the existing production database as a shortcut.

## Speakwell audio connections (migration 0005)

This build adds audio-first live rooms, speaker requests and host approvals, private call invitations, and optional voice notes on feed posts. It is additive: it does not require deleting or rebuilding existing tables.

### Before deploying

1. Apply `supabase/migrations/0005_connection_audio.sql` once to the intended Supabase project after the existing migrations. Do **not** rerun `supabase/setup_all.sql` against a working database.
2. In Supabase Storage, verify the private `speakwell-voice-notes` bucket exists after migration. The migration adds row-level policies for user uploads and post-audience-based reads. Voice-note playback uses short-lived signed URLs.
3. Add the following environment variables to your local `.env.local` and deployment provider. Do not commit `.env.local` or share the secret values:
   - `NEXT_PUBLIC_LIVEKIT_URL` (the LiveKit WebSocket URL, usually `wss://...livekit.cloud`)
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
4. Create the LiveKit project and credentials at https://cloud.livekit.io/. The app creates short-lived room-scoped tokens server-side. The API secret must never use a `NEXT_PUBLIC_` prefix.
5. Install dependencies with `npm install`, then run `npm run typecheck`, `npm test`, and `npm run build` before deploying.

### Important behavior

- Room participation and speaking permission are separate. Listeners connect with publish permission disabled; only a host or approved speaker receives a token that can publish audio. After the host approves a request, the participant should refresh the room page and reconnect to receive updated permission.
- Private call invitations must be accepted before a token is issued. Invitations expire after 24 hours. The camera stays off until a participant explicitly enables it; the app does not record sessions.
- Voice notes are optional, limited to 60 seconds and 10 MB in the browser UI, and stored in a private bucket. Access to the signed playback URL is governed by the related post's visibility.
- Apply the migration and test with two separate accounts before inviting real users. Also verify microphone permission, browser audio playback, blocked-user cases, and RLS behavior in your own Supabase project.
