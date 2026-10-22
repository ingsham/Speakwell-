import { requireStaff } from "@/lib/auth";
import { adminSetSetting, adminCreateAnnouncement, adminToggleAnnouncement, adminSaveExercise, adminToggleExercise } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff("/admin/settings");
  const [{ data: settings }, { data: ann }, { data: ex }] = await Promise.all([
    supabase.from("platform_settings").select("key,value"),
    supabase.from("announcements").select("id,title,body,kind,active,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("practice_exercises").select("id,title,category,is_active,is_demo").order("created_at", { ascending: false }).limit(50),
  ]);
  const S = Object.fromEntries((settings ?? []).map((s) => [s.key as string, s.value as string]));
  const on = (k: string) => (S[k] ?? "true") === "true";
  const text = (k: string, label: string) => (
    <form action={adminSetSetting} className="card space-y-2" key={k}>
      <input type="hidden" name="key" value={k} />
      <label htmlFor={k} className="font-semibold">{label}</label>
      <textarea id={k} name="value" rows={6} defaultValue={S[k] ?? ""} className="field" />
      <button className="btn btn-primary">Save</button>
    </form>);
  const flag = (k: string, label: string, hint: string) => (
    <form action={adminSetSetting} className="flex flex-wrap items-center justify-between gap-3 py-3" key={k}>
      <input type="hidden" name="key" value={k} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="value" defaultChecked={on(k)} /><span><span className="font-medium">{label}</span><span className="block text-xs text-muted">{hint}</span></span></label>
      <button className="btn btn-ghost">Save</button>
    </form>);
  return (
    <main className="space-y-8 py-8">
      <div><h1 className="text-3xl font-bold text-forest">Platform settings</h1><div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div></div>

      <section aria-labelledby="f"><h2 id="f" className="font-semibold">Features</h2>
        <div className="card mt-3 divide-y divide-forest/10 py-0">
          {flag("community_creation_enabled", "Members can create communities", "Switch off to stop new communities (existing ones stay).")}
          {flag("messaging_enabled", "Private messaging", "Switch off during an incident to stop all new messages.")}
        </div></section>

      <section aria-labelledby="a"><h2 id="a" className="font-semibold">Announcements</h2>
        <form action={adminCreateAnnouncement} className="card mt-3 space-y-2">
          <input name="title" required maxLength={120} placeholder="Title" aria-label="Announcement title" className="field" />
          <textarea name="body" maxLength={1000} rows={2} placeholder="Details (optional)" aria-label="Announcement details" className="field" />
          <div className="flex flex-wrap gap-2"><select name="kind" aria-label="Type" className="field w-auto"><option value="info">Announcement</option><option value="maintenance">Maintenance notice</option></select>
            <button className="btn btn-primary">Publish</button></div>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {(ann ?? []).map((a) => (
            <li key={a.id} className="card flex items-center justify-between gap-3 p-3">
              <span><strong>{a.title}</strong> <span className="text-muted">· {a.kind} · {a.active ? "live" : "hidden"}</span></span>
              <form action={adminToggleAnnouncement}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="active" value={a.active ? "0" : "1"} />
                <button className="btn btn-ghost">{a.active ? "Hide" : "Show"}</button></form>
            </li>))}
        </ul></section>

      <section aria-labelledby="g"><h2 id="g" className="font-semibold">Community guidelines, terms &amp; privacy</h2>
        <div className="mt-3 space-y-4">
          {text("guidelines", "Community guidelines (shown at /guidelines)")}
          {text("terms", "Terms of Service (shown at /terms)")}
          {text("privacy", "Privacy Policy (shown at /privacy)")}
        </div>
        <p className="mt-2 text-xs text-muted">Have these reviewed by a qualified person before launch.</p></section>

      <section aria-labelledby="e"><h2 id="e" className="font-semibold">Free-practice exercises</h2>
        <form action={adminSaveExercise} className="card mt-3 grid gap-2 sm:grid-cols-2">
          <input name="title" required placeholder="Title" aria-label="Exercise title" className="field" />
          <select name="category" aria-label="Category" className="field">
            {["warm-up", "storytelling", "conversation", "reading", "introduction", "presentation", "opinion"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea name="prompt" required rows={2} placeholder="Prompt shown to the user" aria-label="Prompt" className="field sm:col-span-2" />
          <input name="seconds" type="number" min={15} max={1800} defaultValue={120} aria-label="Suggested seconds" className="field" />
          <button className="btn btn-primary">Add exercise</button>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {(ex ?? []).map((e) => (
            <li key={e.id} className="card flex items-center justify-between gap-3 p-3">
              <span>{e.title} <span className="text-muted">· {e.category}{e.is_demo ? " · demo" : ""} · {e.is_active ? "active" : "hidden"}</span></span>
              <form action={adminToggleExercise}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="active" value={e.is_active ? "0" : "1"} />
                <button className="btn btn-ghost">{e.is_active ? "Hide" : "Show"}</button></form>
            </li>))}
        </ul></section>
    </main>
  );
}
