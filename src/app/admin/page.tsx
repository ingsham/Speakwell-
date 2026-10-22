import { requireStaff, timeAgo } from "@/lib/auth";

type Stats = {
  total_users: number; suspended_users: number; active_users_7d: number; communities: number; posts_7d: number;
  sessions_total: number; sessions_7d: number; reports_pending: number; reports_resolved: number;
  new_users_by_day: { day: string; count: number }[];
};

export default async function AdminHome() {
  const { supabase, role } = await requireStaff("/admin", true);
  const { data, error } = await supabase.rpc("admin_stats");
  const s = data as Stats | null;
  const { data: audit } = role === "admin"
    ? await supabase.from("admin_audit_logs").select("id,action,target_type,created_at,detail").order("created_at", { ascending: false }).limit(10)
    : { data: [] };
  const tiles = s ? [
    ["Registered users", s.total_users], ["Active (7 days)", s.active_users_7d], ["Suspended", s.suspended_users],
    ["Communities", s.communities], ["Posts (7 days)", s.posts_7d], ["Practice sessions", s.sessions_total],
    ["Sessions (7 days)", s.sessions_7d], ["Reports pending", s.reports_pending], ["Reports resolved", s.reports_resolved],
  ] : [];
  const max = Math.max(1, ...(s?.new_users_by_day ?? []).map((d) => d.count));
  return (
    <main className="py-8">
      <h1 className="text-3xl font-bold text-forest">Overview</h1>
      <p className="mt-1 text-sm text-muted">Aggregate numbers only. Recordings, private messages and practice notes are never shown here.</p>
      {error && <p role="alert" className="mt-4 text-sm text-coral">Couldn't load stats. Run migration 0003 in Supabase.</p>}
      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Key numbers">
        {tiles.map(([label, v]) => (<div key={label as string} className="card p-4"><p className="text-2xl font-bold text-forest">{v as number}</p><p className="text-xs text-muted">{label}</p></div>))}
      </section>
      {s && (
        <section className="card mt-6" aria-labelledby="nu"><h2 id="nu" className="font-semibold">New registrations, last 14 days</h2>
          <div className="mt-4 flex h-32 items-end gap-1">
            {s.new_users_by_day.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-muted">{d.count}</span>
                <div className="w-full rounded-t bg-forest" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} title={`${d.day}: ${d.count}`} />
              </div>))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{s.new_users_by_day[0]?.day}</span><span>{s.new_users_by_day.at(-1)?.day}</span></div>
        </section>)}
      {role === "admin" && (
        <section className="card mt-6" aria-labelledby="au"><h2 id="au" className="font-semibold">Recent admin activity</h2>
          {(audit ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">Nothing yet.</p> : (
            <ul className="mt-3 divide-y divide-forest/10 text-sm">
              {audit!.map((a) => (<li key={a.id} className="flex justify-between gap-3 py-2"><span>{a.action.replaceAll("_", " ")}{a.target_type ? ` · ${a.target_type}` : ""}</span><span className="text-muted">{timeAgo(a.created_at)}</span></li>))}
            </ul>)}
        </section>)}
    </main>
  );
}
