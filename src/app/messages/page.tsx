import Link from "next/link";
import { requireUser, timeAgo } from "@/lib/auth";
import { Avatar, Flash } from "@/components/ui";

export default async function Messages({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/messages");
  const { data: mine } = await supabase.from("conversation_participants")
    .select("conversation_id,last_read_at").eq("user_id", user.id);
  const ids = (mine ?? []).map((m) => m.conversation_id as string);
  const readAt = new Map((mine ?? []).map((m) => [m.conversation_id as string, m.last_read_at as string]));

  type Other = { conversation_id: string; profiles: { username: string; display_name: string } | { username: string; display_name: string }[] | null };
  let others: Other[] = []; let last = new Map<string, { body: string; created_at: string; sender_id: string }>();
  if (ids.length) {
    const [o, m] = await Promise.all([
      supabase.from("conversation_participants").select("conversation_id,profiles(username,display_name)").in("conversation_id", ids).neq("user_id", user.id),
      supabase.from("messages").select("conversation_id,body,created_at,sender_id").in("conversation_id", ids).order("created_at", { ascending: false }).limit(300),
    ]);
    others = (o.data as unknown as Other[]) ?? [];
    for (const row of m.data ?? []) if (!last.has(row.conversation_id)) last.set(row.conversation_id, row);
  }
  const rows = ids.map((id) => {
    const o = others.find((x) => x.conversation_id === id);
    const prof = Array.isArray(o?.profiles) ? o?.profiles[0] : o?.profiles;
    const l = last.get(id);
    return { id, name: prof?.display_name ?? "Unavailable user", l, unread: !!l && l.sender_id !== user.id && l.created_at > (readAt.get(id) ?? "") };
  }).sort((a, b) => (b.l?.created_at ?? "").localeCompare(a.l?.created_at ?? ""));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Messages</h1>
      <p className="mt-1 text-sm text-muted">Private, one-to-one. You can message someone once they follow you or accept a practice invitation. Find people in <Link href="/discover" className="underline">Discover</Link>.</p>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      {rows.length === 0 ? <div className="card mt-4 text-sm text-muted">No conversations yet.</div> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/messages/${r.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-md">
                <Avatar name={r.name} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><span className={`font-semibold text-forest ${r.unread ? "" : "font-medium"}`}>{r.name}</span>
                    {r.l && <span className="text-xs text-muted">{timeAgo(r.l.created_at)}</span>}</span>
                  <span className={`block truncate text-sm ${r.unread ? "font-semibold" : "text-muted"}`}>{r.l ? r.l.body : "No messages yet"}</span>
                </span>
                {r.unread && <span className="h-2.5 w-2.5 rounded-full bg-coral" aria-label="Unread" />}
              </Link>
            </li>))}
        </ul>)}
    </main>
  );
}
