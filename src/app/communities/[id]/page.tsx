import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getRole } from "@/lib/auth";
import { createPost, joinCommunity, leaveCommunity, decideJoinRequest, inviteToCommunity, setMemberRole, removeMember } from "@/app/actions";
import { Avatar, Flash, ReportForm } from "@/components/ui";
import PostCard, { POST_SELECT, asPosts } from "@/components/PostCard";

export default async function CommunityPage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const path = `/communities/${id}`;
  const { supabase, user } = await requireUser(path);
  const { data: c } = await supabase.from("communities").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [role, { data: members }, { data: me }] = await Promise.all([
    getRole(supabase, user.id),
    supabase.from("community_members").select("user_id,role,profiles(username,display_name)").eq("community_id", id).order("joined_at").limit(100),
    supabase.from("community_members").select("role").eq("community_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  const myRole = me?.role as "owner" | "moderator" | "member" | undefined;
  const canMod = myRole === "owner" || myRole === "moderator" || !!role;
  const isMember = !!myRole;

  const { data: posts } = (isMember || c.visibility === "public")
    ? await supabase.from("posts").select(POST_SELECT).eq("community_id", id).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(40)
    : { data: [] };
  const { data: requests } = canMod
    ? await supabase.from("community_join_requests").select("id,user_id,profiles(username,display_name)").eq("community_id", id).eq("status", "pending")
    : { data: [] };

  type Mem = { user_id: string; role: string; profiles: { username: string; display_name: string } | { username: string; display_name: string }[] | null };
  const one = <T,>(x: T | T[] | null) => (Array.isArray(x) ? x[0] : x);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/communities" className="text-sm text-forest underline">← Communities</Link>
      <Flash ok={sp.ok} error={sp.error} />
      <section className="card mt-3">
        <h1 className="text-2xl font-bold text-forest">{c.name}{c.removed && <span className="ml-2 text-sm text-coral">(removed)</span>}</h1>
        <p className="text-xs text-muted">{c.category ?? "General"} · {c.visibility === "public" ? "Open" : c.visibility === "private" ? "Approval needed" : "Invite only"} · {(members ?? []).length}+ members</p>
        {c.description && <p className="mt-3 whitespace-pre-wrap">{c.description}</p>}
        {c.guidelines && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-forest">Community guidelines</summary><p className="mt-2 whitespace-pre-wrap">{c.guidelines}</p></details>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isMember ? (myRole !== "owner" && (
            <form action={leaveCommunity}><input type="hidden" name="communityId" value={id} /><input type="hidden" name="back" value={path} /><button className="btn btn-ghost">Leave</button></form>))
            : (<form action={joinCommunity}><input type="hidden" name="communityId" value={id} /><input type="hidden" name="back" value={path} />
                <button className="btn btn-primary">{c.visibility === "private" ? "Request to join" : "Join"}</button></form>)}
          {myRole && <span className="rounded-full bg-mint px-3 py-1 text-xs text-forest">You are {myRole === "owner" ? "the owner" : myRole === "moderator" ? "a moderator" : "a member"}</span>}
          <ReportForm targetType="community" targetId={id} back={path} label="Report community" />
        </div>
      </section>

      {isMember && (
        <form action={createPost} className="card mt-6 space-y-3">
          <input type="hidden" name="back" value={path} /><input type="hidden" name="communityId" value={id} />
          <label htmlFor="body" className="text-sm font-medium">Post to {c.name}</label>
          <textarea id="body" name="body" required maxLength={3000} rows={3} className="field" />
          <button className="btn btn-primary">Post</button>
        </form>)}

      <div className="mt-6 space-y-4">
        {asPosts(posts).length === 0 && <p className="text-sm text-muted">{isMember || c.visibility === "public" ? "No posts yet." : "Join to see posts."}</p>}
        {asPosts(posts).map((p) => <PostCard key={p.id} post={p} me={user.id} back={path} canModerate={canMod} showCommunity={false} />)}
      </div>

      {canMod && (
        <section className="card mt-8" aria-labelledby="mod"><h2 id="mod" className="font-semibold">Moderation</h2>
          {(requests ?? []).length > 0 && (<div className="mt-3"><h3 className="text-sm font-semibold">Join requests</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {(requests as unknown as { id: string; profiles: Mem["profiles"] }[]).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2"><span>{one(r.profiles)?.display_name ?? "Someone"}</span>
                  <span className="flex gap-2">
                    <form action={decideJoinRequest}><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="approve" value="1" /><input type="hidden" name="back" value={path} /><button className="btn btn-primary">Approve</button></form>
                    <form action={decideJoinRequest}><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="approve" value="0" /><input type="hidden" name="back" value={path} /><button className="btn btn-ghost">Decline</button></form>
                  </span></li>))}
            </ul></div>)}
          <form action={inviteToCommunity} className="mt-4 flex gap-2">
            <input type="hidden" name="communityId" value={id} /><input type="hidden" name="back" value={path} />
            <label htmlFor="iu" className="sr-only">Invite by username</label>
            <input id="iu" name="username" placeholder="Invite by username" className="field" /><button className="btn btn-ghost">Invite</button>
          </form>
        </section>)}

      <section className="card mt-6" aria-labelledby="mem"><h2 id="mem" className="font-semibold">Members</h2>
        <ul className="mt-3 divide-y divide-forest/10 text-sm">
          {((members as unknown as Mem[]) ?? []).map((m) => {
            const pr = one(m.profiles);
            return (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2"><Avatar name={pr?.display_name ?? "?"} size={28} />
                  {pr ? <Link href={`/profile/${pr.username}`} className="hover:underline">{pr.display_name}</Link> : "Member"}
                  {m.role !== "member" && <span className="rounded-full bg-mint px-2 py-0.5 text-xs text-forest">{m.role}</span>}</span>
                {(myRole === "owner" || role === "admin") && m.role !== "owner" && (
                  <span className="flex gap-3">
                    <form action={setMemberRole}><input type="hidden" name="communityId" value={id} /><input type="hidden" name="userId" value={m.user_id} />
                      <input type="hidden" name="role" value={m.role === "moderator" ? "member" : "moderator"} /><input type="hidden" name="back" value={path} />
                      <button className="text-forest underline">{m.role === "moderator" ? "Remove moderator" : "Make moderator"}</button></form>
                    <form action={removeMember}><input type="hidden" name="communityId" value={id} /><input type="hidden" name="userId" value={m.user_id} /><input type="hidden" name="back" value={path} />
                      <button className="text-muted underline">Remove</button></form>
                  </span>)}
              </li>);
          })}
        </ul>
      </section>
    </main>
  );
}
