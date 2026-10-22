import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { joinCommunity, declineCommunityInvite } from "@/app/actions";
import { Flash } from "@/components/ui";

type C = { id: string; name: string; description: string | null; category: string | null; visibility: string };

export default async function Communities({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/communities");
  await supabase.rpc("join_general");
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 40);
  const [{ data: mem }, { data: invites }, { data: all }] = await Promise.all([
    supabase.from("community_members").select("community_id").eq("user_id", user.id),
    supabase.from("community_invitations").select("id,community_id,communities(id,name)").eq("invitee_id", user.id).eq("status", "pending"),
    (q ? supabase.from("communities").select("id,name,description,category,visibility").eq("removed", false).ilike("name", `%${q}%`)
       : supabase.from("communities").select("id,name,description,category,visibility").eq("removed", false))
      .neq("visibility", "invite_only").order("created_at", { ascending: false }).limit(60),
  ]);
  const joined = new Set((mem ?? []).map((m) => m.community_id as string));
  const list = (all as C[]) ?? [];
  const mine = list.filter((c) => joined.has(c.id));
  const others = list.filter((c) => !joined.has(c.id));
  type Inv = { id: string; community_id: string; communities: { id: string; name: string } | { id: string; name: string }[] | null };

  const Card = ({ c, member }: { c: C; member: boolean }) => (
    <li className="card flex flex-col p-4">
      <Link href={`/communities/${c.id}`} className="font-semibold text-forest hover:underline">{c.name}</Link>
      <p className="text-xs text-muted">{c.category ?? "General"} · {c.visibility === "private" ? "Approval needed" : "Open"}</p>
      {c.description && <p className="mt-2 line-clamp-3 text-sm">{c.description}</p>}
      <div className="mt-3">
        {member ? <Link href={`/communities/${c.id}`} className="btn btn-ghost">Open</Link> : (
          <form action={joinCommunity}><input type="hidden" name="communityId" value={c.id} /><input type="hidden" name="back" value="/communities" />
            <button className="btn btn-primary">{c.visibility === "private" ? "Request to join" : "Join"}</button></form>)}
      </div>
    </li>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-forest">Communities</h1>
        <Link href="/communities/new" className="btn btn-primary">Create a community</Link>
      </div>
      <p className="mt-1 text-muted">Groups with their own guidelines and moderators.</p>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>

      {((invites as unknown as Inv[]) ?? []).length > 0 && (
        <section className="card mb-6" aria-labelledby="inv"><h2 id="inv" className="font-semibold">Invitations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(invites as unknown as Inv[]).map((i) => {
              const c = Array.isArray(i.communities) ? i.communities[0] : i.communities;
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>You're invited to <strong>{c?.name ?? "a community"}</strong></span>
                  <span className="flex gap-2">
                    <form action={joinCommunity}><input type="hidden" name="communityId" value={i.community_id} /><input type="hidden" name="back" value={`/communities/${i.community_id}`} /><button className="btn btn-primary">Accept</button></form>
                    <form action={declineCommunityInvite}><input type="hidden" name="id" value={i.id} /><button className="btn btn-ghost">Decline</button></form>
                  </span>
                </li>);
            })}
          </ul></section>)}

      <form className="mb-6 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search communities</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search communities" className="field" /><button className="btn btn-ghost">Search</button>
      </form>

      {mine.length > 0 && (<section aria-labelledby="mine"><h2 id="mine" className="font-semibold">Your communities</h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mine.map((c) => <Card key={c.id} c={c} member />)}</ul></section>)}
      <section className="mt-8" aria-labelledby="disc"><h2 id="disc" className="font-semibold">Discover</h2>
        {others.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing new to join right now.</p> :
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{others.map((c) => <Card key={c.id} c={c} member={false} />)}</ul>}
      </section>
    </main>
  );
}
