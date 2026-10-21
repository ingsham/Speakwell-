"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Download } from "lucide-react";

type Status = "idle" | "recording" | "recorded" | "denied" | "unsupported";

/** Records in the browser only. Audio is never uploaded; it lives in memory until the page closes. */
export default function Recorder({ onFinished }: { onFinished?: (seconds: number) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); if (timer.current) clearInterval(timer.current); }, [url]);

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = []; elapsed.current = 0; setSeconds(0);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        setUrl(URL.createObjectURL(blob)); setStatus("recorded"); onFinished?.(elapsed.current);
      };
      rec.start(); recorder.current = rec; setStatus("recording");
      timer.current = setInterval(() => { elapsed.current += 1; setSeconds(elapsed.current); }, 1000);
    } catch { setStatus("denied"); }
  }
  function stop() { if (timer.current) clearInterval(timer.current); recorder.current?.stop(); }
  function discard() { if (url) URL.revokeObjectURL(url); setUrl(null); setStatus("idle"); setSeconds(0); }
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="card text-center">
      <p className="text-4xl font-bold tabular-nums text-forest">{mmss}</p>
      {status === "denied" && <p role="alert" className="mt-3 text-sm text-coral">Microphone access was blocked. Allow it in your browser settings and try again.</p>}
      {status === "unsupported" && <p role="alert" className="mt-3 text-sm text-coral">This browser can't record audio. Try a recent Chrome, Edge, Firefox or Safari.</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {status !== "recording" && status !== "recorded" && <button onClick={start} className="btn btn-primary"><Mic className="h-4 w-4" aria-hidden />Start recording</button>}
        {status === "recording" && <button onClick={stop} className="btn btn-primary"><Square className="h-4 w-4" aria-hidden />Stop</button>}
        {status === "recorded" && url && (<>
          <audio controls src={url} className="w-full" />
          <a href={url} download="speakwell-practice.webm" className="btn btn-ghost"><Download className="h-4 w-4" aria-hidden />Download</a>
          <button onClick={discard} className="btn btn-ghost"><Trash2 className="h-4 w-4" aria-hidden />Delete</button>
        </>)}
      </div>
      <p className="mt-4 text-xs text-muted">Pause, repeat words, or stop whenever you like. Your recording stays on this device and is not uploaded. Closing this page removes it unless you download it.</p>
    </div>
  );
}
