import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("practice_sessions").select("id,custom_prompt,duration_seconds,confidence,created_at")
      .order("created_at", { ascending: false }).limit(200),
  ]);
  const all = sessions ?? [];
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = all.filter((s) => new Date(s.created_at).getTime() >= weekAgo).length;
  const minutes = Math.round(all.reduce((n, s) => n + s.duration_seconds, 0) / 60);
  const rated = all.filter((s) => s.confidence);
  const avg = rated.length ? (rated.reduce((n, s) => n + (s.confidence ?? 0), 0) / rated.length).toFixed(1) : "–";
  const stats = [
    { label: "Sessions", value: all.length },
    { label: "This week", value: thisWeek },
    { label: "Minutes practised", value: minutes },
    { label: "Avg. confidence", value: avg },
  ];
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Hello, {profile?.display_name ?? "there"}</h1>
      <p className="mt-1 text-muted">Progress is personal. It never has to mean perfect fluency.</p>
      <Link href="/practice" className="btn btn-primary mt-6">Start practising</Link>
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Your stats">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-forest">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </section>
      <section className="card mt-8" aria-labelledby="recent">
        <h2 id="recent" className="font-semibold">Recent sessions</h2>
        {all.length > 0 ? (
          <ul className="mt-3 divide-y divide-forest/10 text-sm">
            {all.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2">
                <span>{s.custom_prompt ?? "Practice"} <span className="text-muted">· {new Date(s.created_at).toLocaleDateString()}</span></span>
                <span className="text-muted">{Math.max(1, Math.round(s.duration_seconds / 60))} min{s.confidence ? ` · confidence ${s.confidence}/5` : ""}</span>
              </li>))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">No sessions yet. Pick a situation and your first one will show up here.</p>}
      </section>
    </main>
  );
}
