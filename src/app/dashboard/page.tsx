import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("practice_sessions").select("id,duration_seconds,confidence,created_at")
      .order("created_at", { ascending: false }).limit(5),
  ]);
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Hello, {profile?.display_name ?? "there"}</h1>
      <p className="mt-1 text-muted">Progress is personal. It never has to mean perfect fluency.</p>
      <Link href="/practice" className="btn btn-primary mt-6">Start practising</Link>
      <section className="card mt-8" aria-labelledby="recent">
        <h2 id="recent" className="font-semibold">Recent sessions</h2>
        {sessions && sessions.length > 0 ? (
          <ul className="mt-3 divide-y divide-forest/10 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
                <span className="text-muted">{Math.round(s.duration_seconds / 60)} min{s.confidence ? ` · confidence ${s.confidence}/5` : ""}</span>
              </li>))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">No sessions yet. Your first one will show up here.</p>}
      </section>
    </main>
  );
}
