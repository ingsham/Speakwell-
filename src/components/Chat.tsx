"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Msg = { id: string; sender_id: string; body: string; created_at: string };

export default function Chat({ conversationId, me, initial, otherReadAt }:
  { conversationId: string; me: string; initial: Msg[]; otherReadAt: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [seenAt, setSeenAt] = useState<string | null>(otherReadAt);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const sb = useRef(createClient());

  const markRead = useCallback(() => {
    void sb.current.from("conversation_participants").update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId).eq("user_id", me);
  }, [conversationId, me]);

  const refresh = useCallback(async () => {
    const [m, p] = await Promise.all([
      sb.current.from("messages").select("id,sender_id,body,created_at").eq("conversation_id", conversationId).order("created_at").limit(500),
      sb.current.from("conversation_participants").select("last_read_at").eq("conversation_id", conversationId).neq("user_id", me).maybeSingle(),
    ]);
    if (m.data) {
      setMsgs((cur) => (m.data.length !== cur.length || m.data.at(-1)?.id !== cur.at(-1)?.id ? m.data : cur));
      if (m.data.at(-1) && m.data.at(-1)!.sender_id !== me) markRead();
    }
    if (p.data) setSeenAt(p.data.last_read_at);
  }, [conversationId, me, markRead]);

  useEffect(() => {
    const client = sb.current;
    const channel = client.channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => { void refresh(); })
      .subscribe();
    const poll = setInterval(() => { void refresh(); }, 8000); // fallback if realtime is unavailable
    return () => { clearInterval(poll); void client.removeChannel(channel); };
  }, [conversationId, refresh]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null);
    const { error } = await sb.current.from("messages").insert({ conversation_id: conversationId, sender_id: me, body });
    setBusy(false);
    if (error) return setErr(error.message.includes("slow down") ? "You're sending messages too quickly." : "Couldn't send. You may be blocked, or messaging is switched off.");
    setText(""); void refresh();
  }

  const lastMine = [...msgs].reverse().find((m) => m.sender_id === me);
  return (
    <div className="card flex h-[65vh] flex-col p-0">
      <div className="flex-1 space-y-2 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.length === 0 && <p className="text-center text-sm text-muted">Say hello. Take your time.</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-forest text-white" : "bg-mint text-ink"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-muted"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine && lastMine?.id === m.id && (seenAt && seenAt >= m.created_at ? " · Seen" : " · Sent")}
                </p>
              </div>
            </div>);
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-forest/10 p-3">
        <label htmlFor="msg" className="sr-only">Message</label>
        <input id="msg" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Write a message…" className="field" autoComplete="off" />
        <button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
      </form>
      {err && <p role="alert" className="px-4 pb-3 text-sm text-coral">{err}</p>}
    </div>
  );
}
