import Link from "next/link";
import { requireStaff, timeAgo } from "@/lib/auth";
import { adminResolveReport } from "@/app/actions";
import { Flash } from "@/components/ui";

type R = { id: string; reporter_id: string; target_type: string; target_id: string; reason: string; status: string; resolution_note: string | null; created_at: string };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ view?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff("/admin/reports", true);
  const view = sp.view === "resolved" ? "resolved" : "pending";
  const q = supabase.from("reports").select("id,reporter_id,target_type,target_id,reason,status,resolution_note,created_at").order("created_at", { ascending: false }).limit(50);
  const { data } = await (view === "pending" ? q.eq("status", "pending") : q.neq("status", "pending"));
  const reports = (data as R[]) ?? [];

  const byType = (t: string) => reports.filter((r) => r.target_type === t).map((r) => r.target_id);
  const [posts, comments, users, comms, reporters] = await Promise.all([
    byType("post").length ? supabase.from("posts").select("id,body,removed,community_id").in("id", byType("post")) : { data: [] },
    byType("comment").length ? supabase.from("comments").select("id,body,removed,post_id").in("id", byType("comment")) : { data: [] },
    byType("user").length ? supabase.from("profiles").select("id,username,display_name,suspended").in("id", byType("user")) : { data: [] },
    byType("community").length ? supabase.from("communities").select("id,name,removed").in("id", byType("community")) : { data: [] },
    reports.length ? supabase.from("profiles").select("id,display_name,username").in("id", [...new Set(reports.map((r) => r.reporter_id))]) : { data: [] },
  ]);
  const idx = <T extends { id: string }>(a: T[] | null) => new Map((a ?? []).map((x) => [x.id, x]));
  const P = idx(posts.data as { id: string; body: string; removed: boolean; community_id: string }[]);
  const C = idx(comments.data as { id: string; body: string; removed: boolean; post_id: string }[]);
  const U = idx(users.data as { id: string; username: string; display_name: string; suspended: boolean }[]);
  const M = idx(comms.data as { id: string; name: string; removed: boolean }[]);
  const RP = idx(reporters.data as { id: string; display_name: string; username: string }[]);

  const content = (r: R) => {
    if (r.target_type === "post") { const p = P.get(r.target_id); return p ? <><span className="font-medium">Post{p.removed ? " (removed)" : ""}: </span>“{p.body.slice(0, 300)}” <Link className="underline" href={`/communities/${p.community_id}`}>open community</Link></> : "Post no longer exists"; }
    if (r.target_type === "comment") { const c = C.get(r.target_id); return c ? <><span className="font-medium">Comment{c.removed ? " (removed)" : ""}: </span>“{c.body.slice(0, 300)}”</> : "Comment no longer exists"; }
    if (r.target_type === "user") { const u = U.get(r.target_id); return u ? <><span className="font-medium">User: </span><Link className="underline" href={`/profile/${u.username}`}>{u.display_name}</Link>{u.suspended ? " (suspended)" : ""}</> : "User not found"; }
    const m = M.get(r.target_id); return m ? <><span className="font-medium">Community: </span><Link className="underline" href={`/communities/${m.id}`}>{m.name}</Link></> : "Community not found";
  };

  return (
    <main className="py-8">
      <h1 className="text-3xl font-bold text-forest">Reports</h1>
      <p className="mt-1 text-sm text-muted">Review what was reported, decide, and record why. Private messages are not shown here.</p>
      <div className="mt-4 flex gap-2" role="tablist">
        <Link href="/admin/reports" className={`btn ${view === "pending" ? "btn-primary" : "btn-ghost"}`}>Pending</Link>
        <Link href="/admin/reports?view=resolved" className={`btn ${view === "resolved" ? "btn-primary" : "btn-ghost"}`}>Resolved</Link>
      </div>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      <ul className="space-y-4">
        {reports.length === 0 && <li className="card text-sm text-muted">{view === "pending" ? "No pending reports. 🎉" : "Nothing resolved yet."}</li>}
        {reports.map((r) => (
          <li key={r.id} className="card">
            <p className="text-xs text-muted">{r.target_type} report · {timeAgo(r.created_at)} · by {RP.get(r.reporter_id)?.display_name ?? "unknown"}</p>
            <p className="mt-2 text-sm">{content(r)}</p>
            <p className="mt-2 rounded-xl bg-mint p-3 text-sm"><span className="font-semibold">Reason given: </span>{r.reason}</p>
            {r.status === "pending" ? (
              <form action={adminResolveReport} className="mt-3 space-y-2">
                <input type="hidden" name="reportId" value={r.id} />
                <label htmlFor={`n-${r.id}`} className="text-xs font-medium">Your note (required, kept in the audit log)</label>
                <input id={`n-${r.id}`} name="note" required minLength={3} maxLength={500} className="field" />
                <div className="flex flex-wrap gap-2">
                  <button name="outcome" value="dismiss" className="btn btn-ghost">Dismiss</button>
                  <button name="outcome" value="action" className="btn btn-ghost">Mark as actioned</button>
                  {r.target_type !== "user" && <button name="outcome" value="remove" className="btn btn-primary">Remove content</button>}
                </div>
                {r.target_type === "user" && <p className="text-xs text-muted">To suspend a user, an admin uses the Users tab.</p>}
              </form>
            ) : <p className="mt-3 text-sm"><span className="font-semibold">{r.status}:</span> {r.resolution_note}</p>}
          </li>))}
      </ul>
    </main>
  );
}
