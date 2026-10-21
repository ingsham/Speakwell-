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
  const scenario = slug === "free" ? free : bySlug(slug);
  if (!scenario) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/practice/${slug}`);
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/practice" className="text-sm text-forest underline">← All situations</Link>
      <h1 className="mt-3 text-3xl font-bold text-forest"><span aria-hidden>{scenario.emoji}</span> {scenario.title}</h1>
      <p className="mt-2 text-muted">{scenario.setting}</p>
      <ScenarioPractice scenario={scenario} />
    </main>
  );
}
