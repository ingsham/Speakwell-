# Speakwell: Your voice. Your pace. Your people.

A supportive practice and community app for people who stammer. It is a peer-support and practice tool, **not** a cure, diagnosis or replacement for speech therapy.

> **Status: early foundation (v0.1). Nothing here has been installed, built or tested yet.** See "What exists" and "Not built yet".

## What exists
- Next.js (App Router) + TypeScript + Tailwind project config, security headers, route-protecting middleware
- Landing page; Sign up and Log in (real Supabase Auth, email confirmation callback)
- Dashboard (reads real sessions) and Practice studio (browser-only recording: timer, playback, download, delete; nothing uploaded)
- `supabase/migrations/0001_core_schema.sql`: 23 tables, constraints, indexes, triggers, auto-profile on signup
- `supabase/migrations/0002_rls_and_functions.sql`: RLS on every table, race-safe functions for invitations, conversations (messaging rule), community joining, join requests, admin suspend / report resolution with audit log, account deletion, message rate limit
- `supabase/seed.sql`: clearly labelled demo exercises
- Vitest validation tests (`src/tests/validation.test.ts`)

## Not built yet
Onboarding, settings/profile editing, discover/follow UI, invitations UI, messaging UI, notifications UI, communities UI, progress/history pages, admin UI pages, About/Guidelines/Privacy/Terms/Contact pages, forgot/reset password pages, Playwright tests, RLS tests against a live database. The database layer for most of these is done; the screens are not.

## Messaging rule
You can start a private conversation only if the recipient follows you or you have an accepted practice invitation with them. Either person can reply afterwards unless one blocks the other. Enforced in SQL (`start_conversation`).

## Run locally
1. Install Git and Node.js LTS.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key.
4. In the Supabase SQL editor run `0001_core_schema.sql`, then `0002_rls_and_functions.sql`, then `seed.sql`.
5. In Supabase > Authentication > URL Configuration set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.
6. `npm run dev`

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## First admin
Sign up, copy your user ID from Supabase > Authentication > Users, then run in the SQL editor:
`insert into public.user_roles (user_id, role) values ('YOUR-USER-UUID', 'admin');`
There is no public admin flag and no service-role key in this codebase.

## Deploy
Push to GitHub, import the repo in Vercel, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, then add your production URL to Supabase redirect URLs. Free tiers have limits that can change; check Supabase and Vercel pricing pages.

## Limitations
Live voice/video calls are not implemented (they would need signalling infrastructure). Plan: voice-note exchange and text chat. Founder must write the Privacy Policy and Terms and review legal obligations before launch.
