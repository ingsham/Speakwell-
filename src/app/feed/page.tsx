import Link from "next/link";
import { requireUser, getRole } from "@/lib/auth";
import { createPost } from "@/app/actions";
import { Flash } from "@/components/ui";
import PostCard, { POST_SELECT, asPosts } from "@/components/PostCard";

export default async function Feed({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/feed");
  await supabase.rpc("join_general"); // everyone belongs to the Speakwell Lounge (no-op until an admin exists)
  const [{ data: mem }, role] = await Promise.all([
    supabase.from("community_members").select("community_id,communities(id,name,removed)").eq("user_id", user.id),
    getRole(supabase, user.id),
  ]);
  type M = { community_id: string; communities: { id: string; name: string; removed: boolean } | { id: string; name: string; removed: boolean }[] | null };
  const mine = ((mem as unknown as M[]) ?? [])
    .map((m) => (Array.isArray(m.communities) ? m.communities[0] : m.communities))
    .filter((c): c is { id: string; name: string; removed: boolean } => !!c && !c.removed);
  const ids = mine.map((c) => c.id);

  const { data: posts } = ids.length
    ? await supabase.from("posts").select(POST_SELECT).in("community_id", ids).order("created_at", { ascending: false }).limit(40)
    : { data: [] };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Feed</h1>
      <p className="mt-1 text-muted">Wins, questions and encouragement from the communities you've joined.</p>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>

      {mine.length === 0 ? (
        <div className="card text-sm">You haven't joined a community yet. <Link href="/communities" className="font-semibold text-forest underline">Browse communities</Link> to start seeing posts.</div>
      ) : (
        <form action={createPost} className="card space-y-3">
          <input type="hidden" name="back" value="/feed" />
          <label htmlFor="body" className="text-sm font-medium">Share something</label>
          <textarea id="body" name="body" required maxLength={3000} rows={3} className="field" placeholder="A win, a question, or a word of encouragement…" />
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="cid" className="text-sm">Post in</label>
            <select id="cid" name="communityId" className="field w-auto">{mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button className="btn btn-primary ml-auto">Post</button>
          </div>
        </form>)}

      <div className="mt-6 space-y-4">
        {asPosts(posts).length === 0 && mine.length > 0 && <p className="text-sm text-muted">No posts yet. Be the first to share something.</p>}
        {asPosts(posts).map((p) => <PostCard key={p.id} post={p} me={user.id} back="/feed" canModerate={!!role} />)}
      </div>
    </main>
  );
}
