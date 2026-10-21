"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Recorder from "./Recorder";
import type { Scenario } from "@/lib/scenarios";

export default function ScenarioPractice({ scenario }: { scenario: Scenario }) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const total = useRef(0);
  const step = scenario.steps[i];
  const last = i === scenario.steps.length - 1;

  async function save() {
    setState("saving");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setState("error");
    const { error } = await supabase.from("practice_sessions").insert({
      user_id: user.id, custom_prompt: scenario.title,
      duration_seconds: Math.min(7200, total.current), confidence,
    });
    setState(error ? "error" : "saved");
  }

  if (done) {
    return (
      <div className="card mt-6 text-center">
        <p className="text-2xl">🎉</p>
        <h2 className="mt-2 text-xl font-bold text-forest">Scenario complete</h2>
        <p className="mt-1 text-sm text-muted">You practised for about {Math.max(1, Math.round(total.current / 60))} min. Well done for showing up.</p>
        <p className="mt-5 text-sm font-medium">How confident did you feel?</p>
        <div className="mt-2 flex justify-center gap-2" role="group" aria-label="Confidence from 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setConfidence(n)} aria-pressed={confidence === n}
              className={`h-10 w-10 rounded-full border text-sm font-semibold ${confidence === n ? "border-forest bg-forest text-white" : "border-forest/20 text-forest hover:bg-mint"}`}>{n}</button>
          ))}
        </div>
        {state === "saved" ? (
          <p role="status" className="mt-5 text-sm text-forest">Saved to your progress.</p>
        ) : (
          <button onClick={save} disabled={state === "saving"} className="btn btn-primary mt-5">{state === "saving" ? "Saving…" : "Save to my progress"}</button>
        )}
        {state === "error" && <p role="alert" className="mt-3 text-sm text-coral">Couldn't save. Check you're logged in and try again.</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/practice" className="btn btn-ghost">Try another scenario</Link>
          <Link href="/dashboard" className="btn btn-ghost">See my progress</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-wide text-muted">Step {i + 1} of {scenario.steps.length}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mint" aria-hidden>
        <div className="h-full bg-forest transition-all" style={{ width: `${((i + 1) / scenario.steps.length) * 100}%` }} />
      </div>
      <div className="card mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">They say</p>
        <p className="mt-1 text-lg font-semibold text-forest">“{step.them}”</p>
        <p className="mt-4 rounded-xl bg-mint p-3 text-sm text-forest"><span className="font-semibold">Your turn: </span>{step.hint}</p>
      </div>
      <div className="mt-4">
        {/* key resets the recorder for each step */}
        <Recorder key={i} onFinished={(s) => { total.current += s; }} />
      </div>
      <div className="mt-5 flex justify-between">
        <button onClick={() => setI((n) => n - 1)} disabled={i === 0} className="btn btn-ghost disabled:opacity-40">Back</button>
        {last
          ? <button onClick={() => setDone(true)} className="btn btn-primary">Finish</button>
          : <button onClick={() => setI((n) => n + 1)} className="btn btn-primary">Next line</button>}
      </div>
    </div>
  );
}
