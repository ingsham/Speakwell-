# Speakwell connection-first redesign

This is an implementation build based on the existing Speakwell Next.js + Supabase project. Existing feed, practice, messaging, community, and moderation functionality has been retained.

## Added in this build

- Live room directory and room creation, with public rooms and private invite-only rooms.
- Room invitations, listener join, speaker requests, host approval/decline, room participant list, leave room, and host end-room controls.
- Private audio-call invitations from a profile, after practice, or from Connections; recipients can accept/decline; senders can cancel; either participant can end an accepted call.
- A server-side LiveKit token route. Room tokens are scoped to the specific room, and only hosts/approved speakers receive publish permission. Private call tokens are issued only for accepted invitations.
- Camera-free audio session UI using the LiveKit browser client.
- Optional 60-second voice notes on feed posts. Files are stored in a private Supabase Storage bucket; signed playback URLs rely on post access permissions.
- Room refresh for participant lists and speaker approvals; pending call invitation pages refresh while waiting.
- Additive SQL migration `supabase/migrations/0005_connection_audio.sql`.

## Required setup

1. Install packages with `npm install`.
2. Set the existing Supabase public environment variables from `.env.example`.
3. Apply migration `0005_connection_audio.sql` after the current Speakwell schema is present. For a brand-new Supabase project, initialise the base schema once first. Do not rerun setup scripts on an existing working database.
4. Create a LiveKit Cloud project and configure `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in local/deployment environment settings. Never expose the API secret to the browser or commit it.
5. Run `npm run typecheck`, `npm test`, and `npm run build`. Test with two accounts and browsers before opening it to real users.

## Validation status

The source and migration were prepared in this workspace, but a full Next.js build was not completed because dependencies could not be installed in this environment. The app has not been deployed or connected to a LiveKit project from here. Treat this as a development build and run the validation steps above before production deployment.
