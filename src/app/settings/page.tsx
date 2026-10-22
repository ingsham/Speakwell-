import { requireUser } from "@/lib/auth";
import { updateProfile, toggleBlock, deleteMyAccount } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/settings");
  const [{ data: p }, { data: prefs }, { data: goal }, { data: blocked }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("practice_goals").select("weekly_sessions").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("my_blocked"),
  ]);
  const b = (blocked as { id: string; username: string; display_name: string }[] | null) ?? [];
  const chk = (v: boolean | undefined) => v ?? true;
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Settings</h1>
      <p className="mt-1 text-muted">You choose what others see. Nothing here asks whether you stammer.</p>
      <div className="mt-6"><Flash ok={sp.ok} error={sp.error} /></div>
      <form action={updateProfile} className="card space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div><label htmlFor="dn" className="text-sm font-medium">Display name</label>
          <input id="dn" name="displayName" required maxLength={60} defaultValue={p?.display_name} className="field" /></div>
        <div><label htmlFor="un" className="text-sm font-medium">Username</label>
          <input id="un" name="username" required pattern="[a-z0-9_]{3,24}" defaultValue={p?.username} className="field" />
          <p className="mt-1 text-xs text-muted">3–24 characters: lowercase letters, numbers, underscores.</p></div>
        <div><label htmlFor="bio" className="text-sm font-medium">Bio</label>
          <textarea id="bio" name="bio" maxLength={280} rows={3} defaultValue={p?.bio ?? ""} className="field" /></div>
        <div><label htmlFor="in" className="text-sm font-medium">Interests</label>
          <input id="in" name="interests" defaultValue={(p?.interests ?? []).join(", ")} placeholder="music, football, cooking" className="field" />
          <p className="mt-1 text-xs text-muted">Separate with commas. Used to suggest people with similar interests.</p></div>
        <div><label htmlFor="go" className="text-sm font-medium">Goals</label>
          <textarea id="go" name="goals" maxLength={500} rows={2} defaultValue={p?.goals ?? ""} className="field" /></div>
        <div><label htmlFor="co" className="text-sm font-medium">Country (optional)</label>
          <input id="co" name="country" maxLength={60} defaultValue={p?.country ?? ""} className="field" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={p?.is_public ?? true} />
          Show my profile to other members (turn off to hide it from Discover and search)</label>

        <h2 className="pt-2 font-semibold">Practice</h2>
        <div><label htmlFor="wk" className="text-sm font-medium">Weekly goal (sessions)</label>
          <input id="wk" name="weekly" type="number" min={1} max={21} defaultValue={goal?.weekly_sessions ?? 3} className="field w-28" /></div>

        <h2 className="pt-2 font-semibold">Notifications</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nMessages" defaultChecked={chk(prefs?.notify_messages)} />New messages</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nInvites" defaultChecked={chk(prefs?.notify_invitations)} />Practice invitations</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nFollowers" defaultChecked={chk(prefs?.notify_followers)} />New followers</label>
        <button className="btn btn-primary">Save changes</button>
      </form>

      <section className="card mt-6" aria-labelledby="bl">
        <h2 id="bl" className="font-semibold">Blocked people</h2>
        {b.length === 0 ? <p className="mt-2 text-sm text-muted">You haven't blocked anyone.</p> : (
          <ul className="mt-3 divide-y divide-forest/10 text-sm">
            {b.map((x) => (
              <li key={x.id} className="flex items-center justify-between py-2">
                <span>{x.display_name} <span className="text-muted">@{x.username}</span></span>
                <form action={toggleBlock}><input type="hidden" name="profileId" value={x.id} /><input type="hidden" name="back" value="/settings" />
                  <input type="hidden" name="blocked" value="1" /><button className="btn btn-ghost">Unblock</button></form>
              </li>))}
          </ul>)}
      </section>

      <section className="card mt-6 border-coral/40" aria-labelledby="del">
        <h2 id="del" className="font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted">Removes your profile, posts, messages and sessions permanently. If you own a community, transfer or remove it first.</p>
        <form action={deleteMyAccount} className="mt-3">
          <button className="btn btn-ghost border-coral text-ink" >Delete my account</button>
        </form>
      </section>
    </main>
  );
}
