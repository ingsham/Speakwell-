import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { adminSetCommunityRemoved, adminCreateGeneral } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function AdminCommunities({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, role } = await requireStaff("/admin/communities", true);
  const { data } = await supabase.from("communities").select("id,name,visibility,removed,created_at,category").order("created_at", { ascending: false }).limit(100);
  const { data: pending } = await supabase.from("reports").select("target_id").eq("target_type", "community").eq("status", "pending");
  const flagged = new Set((pending ?? []).map((p) => p.target_id as string));
  return (
    <main className="py-8">
      <h1 className="text-3xl font-bold text-forest">Communities</h1>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      {role === "admin" && (
        <form action={adminCreateGeneral} className="mb-4"><button className="btn btn-ghost">Create / repair “Speakwell Lounge”</button></form>)}
      <ul className="space-y-3">
        {(data ?? []).map((c) => (
          <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <Link href={`/communities/${c.id}`} className="font-semibold text-forest hover:underline">{c.name}</Link>
              <p className="text-xs text-muted">{c.category ?? "General"} · {c.visibility} · created {new Date(c.created_at).toLocaleDateString()}
                {flagged.has(c.id) && <span className="ml-2 rounded-full bg-coral/30 px-2 py-0.5 text-ink">reported</span>}
                {c.removed && <span className="ml-2 rounded-full bg-coral/30 px-2 py-0.5 text-ink">suspended</span>}</p>
            </div>
            <form action={adminSetCommunityRemoved}>
              <input type="hidden" name="communityId" value={c.id} /><input type="hidden" name="removed" value={c.removed ? "0" : "1"} />
              <button className="btn btn-ghost">{c.removed ? "Reinstate" : "Suspend community"}</button>
            </form>
          </li>))}
        {(data ?? []).length === 0 && <li className="text-sm text-muted">No communities yet.</li>}
      </ul>
      <p className="mt-6 text-xs text-muted">To appoint or remove a community's moderators, open the community and use its Members list.</p>
    </main>
  );
}
