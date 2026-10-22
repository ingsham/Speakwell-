import { createClient } from "@/lib/supabase/server";

export default async function LegalPage({ settingKey, title, fallback }: { settingKey: string; title: string; fallback: string }) {
  let text = fallback;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("platform_settings").select("value").eq("key", settingKey).maybeSingle();
    if (data?.value) text = data.value;
  } catch { /* table not created yet or env missing: show fallback */ }
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">{title}</h1>
      <div className="card mt-6 whitespace-pre-wrap leading-relaxed">{text}</div>
    </main>
  );
}
