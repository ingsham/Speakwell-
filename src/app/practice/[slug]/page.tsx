import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bySlug, type Scenario } from "@/lib/scenarios";
import ScenarioPractice from "@/components/ScenarioPractice";

const free: Scenario = {
  slug: "free", emoji: "🎙️", title: "Free practice",
  blurb: "Speak about anything.", setting: "No script. Choose any topic and talk for as long as you like.",
  steps: [{ them: "Talk about anything you like.", hint: "Your day, a favourite place, or read something aloud. Pausing and repeating are fine." }],
};

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/practice/${slug}`);
  let scenario: Scenario | undefined = slug === "free" ? free : bySlug(slug);
  if (slug === "free") {
    const { data: ex } = await supabase.from("practice_exercises").select("title,prompt,category").eq("is_active", true).limit(50);
    if (ex && ex.length) {
      const e = ex[Math.floor(Math.random() * ex.length)];
      scenario = { ...free, title: e.title, setting: `Free practice · ${e.category}`, steps: [{ them: e.prompt, hint: "Speak for as long as you like. Pausing and repeating are fine." }] };
    }
  }
  if (!scenario) notFound();
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/practice" className="text-sm text-forest underline">← All situations</Link>
      <h1 className="mt-3 text-3xl font-bold text-forest"><span aria-hidden>{scenario.emoji}</span> {scenario.title}</h1>
      <p className="mt-2 text-muted">{scenario.setting}</p>
      <ScenarioPractice scenario={scenario} />
    </main>
  );
}
