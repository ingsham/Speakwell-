import Link from "next/link";
import { requireUser, timeAgo } from "@/lib/auth";
import { respondInvitation } from "@/app/actions";
import { Flash } from "@/components/ui";
import { scenarios } from "@/lib/scenarios";

type Inv = {
  id: string; sender_id: string; recipient_id: string; message: string | null; status: string; created_at: string;
  sender: { username: string; display_name: string } | null; recipient: { username: string; display_name: string } | null;
};

export default async function Invitations({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/practice/invitations");
  const { data } = await supabase.from("practice_invitations")
    .select("id,sender_id,recipient_id,message,status,created_at,sender:profiles!sender_id(username,display_name),recipient:profiles!recipient_id(username,display_name)")
    .order("created_at", { ascending: false }).limit(50);
  const rows = (data as unknown as Inv[]) ?? [];
  const pick = (id: string) => scenarios[parseInt(id.slice(0, 4), 16) % scenarios.length];

  const act = (id: string, status: string, label: string, primary = false) => (
    <form action={respondInvitation} key={status}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} />
      <button className={primary ? "btn btn-primary" : "btn btn-ghost"}>{label}</button></form>);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Practice invitations</h1>
      <p className="mt-1 text-sm text-muted">Practise together at your own pace. Accepting an invitation also lets you message each other. To invite someone, open their profile from <Link href="/discover" className="underline">Discover</Link>.</p>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      {rows.length === 0 ? <div className="card text-sm text-muted">No invitations yet.</div> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const incoming = r.recipient_id === user.id;
            const them = incoming ? r.sender : r.recipient;
            const sc = pick(r.id);
            return (
              <li key={r.id} className="card p-4">
                <p className="text-sm">
                  {incoming ? "From " : "To "}
                  {them ? <Link href={`/profile/${them.username}`} className="font-semibold text-forest hover:underline">{them.display_name}</Link> : "someone"}
                  <span className="text-muted"> · {timeAgo(r.created_at)} · </span>
                  <span className="rounded-full bg-mint px-2 py-0.5 text-xs text-forest">{r.status}</span>
                </p>
                {r.message && <p className="mt-2 text-sm">“{r.message}”</p>}
                {(r.status === "accepted") && <p className="mt-2 text-sm text-muted">Suggested starter: <Link href={`/practice/${sc.slug}`} className="underline">{sc.emoji} {sc.title}</Link>. Take turns playing each side.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === "pending" && incoming && [act(r.id, "accepted", "Accept", true), act(r.id, "declined", "Decline")]}
                  {r.status === "pending" && !incoming && act(r.id, "cancelled", "Cancel invitation")}
                  {r.status === "accepted" && act(r.id, "completed", "Mark as done")}
                </div>
              </li>);
          })}
        </ul>)}
    </main>
  );
}
