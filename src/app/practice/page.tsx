import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Recorder from "@/components/Recorder";

export default async function Practice() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: exercises } = await supabase.from("practice_exercises").select("id,title,prompt,category").limit(20);
  const pick = exercises && exercises.length ? exercises[Math.floor(Math.random() * exercises.length)] : null;
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Practice studio</h1>
      <div className="card mt-6">
        <p className="text-xs uppercase tracking-wide text-muted">{pick?.category ?? "Free practice"}</p>
        <p className="mt-1 font-semibold">{pick?.title ?? "Say anything you like"}</p>
        <p className="mt-1 text-sm text-muted">{pick?.prompt ?? "No exercises are loaded yet. Run supabase/seed.sql, or just speak freely."}</p>
      </div>
      <div className="mt-6"><Recorder /></div>
    </main>
  );
}
