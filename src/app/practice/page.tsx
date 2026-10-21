import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scenarios } from "@/lib/scenarios";

export default async function Practice() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/practice");
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Choose a situation to practise</h1>
      <p className="mt-1 text-muted">Each one is a short, scripted conversation. Read their line, then reply your way. Recordings stay on your device.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((s) => (
          <Link key={s.slug} href={`/practice/${s.slug}`} className="card block transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="text-3xl" aria-hidden>{s.emoji}</span>
            <h2 className="mt-3 font-semibold text-forest">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.blurb}</p>
            <p className="mt-3 text-xs font-medium text-forest">{s.steps.length} steps →</p>
          </Link>
        ))}
        <Link href="/practice/free" className="card block border-dashed transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="text-3xl" aria-hidden>🎙️</span>
          <h2 className="mt-3 font-semibold text-forest">Free practice</h2>
          <p className="mt-1 text-sm text-muted">Just record yourself speaking about anything.</p>
        </Link>
      </div>
    </main>
  );
}
