import Link from "next/link";
import { requireUser, timeAgo } from "@/lib/auth";
import { markAllRead } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function Notifications({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/notifications");
  const { data } = await supabase.from("notifications").select("id,title,link,read,created_at,kind")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  const unread = (data ?? []).filter((n) => !n.read).length;
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-forest">Notifications</h1>
        {unread > 0 && <form action={markAllRead}><button className="btn btn-ghost">Mark all read</button></form>}
      </div>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      {(data ?? []).length === 0 ? <div className="card text-sm text-muted">Nothing yet. When someone follows you, messages you or invites you to practise, it shows up here.</div> : (
        <ul className="space-y-2">
          {data!.map((n) => {
            const inner = (<><span className={n.read ? "" : "font-semibold"}>{n.title}</span><span className="block text-xs text-muted">{timeAgo(n.created_at)}</span></>);
            return (
              <li key={n.id} className={`card flex items-start gap-3 p-4 ${n.read ? "opacity-75" : ""}`}>
                {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-coral" aria-label="Unread" />}
                {n.link && n.link.startsWith("/") ? <Link href={n.link} className="block hover:underline">{inner}</Link> : <div>{inner}</div>}
              </li>);
          })}
        </ul>)}
    </main>
  );
}
