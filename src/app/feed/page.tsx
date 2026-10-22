import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireUser, getRole } from "@/lib/auth";
import { createPost } from "@/app/actions";
import { Avatar, Flash } from "@/components/ui";
import PostCard from "@/components/PostCard";
import VoiceNoteRecorder from "@/components/VoiceNoteRecorder";
import { POST_SELECT, asPosts, shareCounts } from "@/lib/posts";

export default async function Feed({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const postId = randomUUID();
  const tab = sp.tab === "following" ? "following" : "everyone";
  const { supabase, user } = await requireUser("/feed");
  await supabase.rpc("join_general"); // everyone belongs to the Speakwell Lounge (no-op until an admin exists)
  const [{ data: mem }, { data: fol }, { data: me }, role] = await Promise.all([
    supabase.from("community_members").select("community_id,communities(id,name,removed)").eq("user_id", user.id),
    supabase.from("follows").select("followee_id").eq("follower_id", user.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    getRole(supabase, user.id),
  ]);
  type M = { community_id: string; communities: { id: string; name: string; removed: boolean } | { id: string; name: string; removed: boolean }[] | null };
  const mine = ((mem as unknown as M[]) ?? [])
    .map((m) => (Array.isArray(m.communities) ? m.communities[0] : m.communities))
    .filter((c): c is { id: string; name: string; removed: boolean } => !!c && !c.removed);
  const communityIds = mine.map((c) => c.id);
  const followIds = (fol ?? []).map((f) => f.followee_id as string);

  let query = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(40);
  if (tab === "following") {
    query = query.in("author_id", [user.id, ...followIds]);
  } else {
    query = communityIds.length ? query.or(`community_id.is.null,community_id.in.(${communityIds.join(",")})`) : query.is("community_id", null);
  }
  const { data: posts } = await query;
  const rows = asPosts(posts);
  const shares = await shareCounts(supabase, rows.map((p) => p.id));
  const tabCls = (t: string) => `rounded-full px-4 py-2 text-sm font-medium ${tab === t ? "bg-forest text-white" : "text-forest hover:bg-mint"}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="sr-only">Feed</h1>
      <Flash ok={sp.ok} error={sp.error} />
      <form action={createPost} className="card space-y-3">
        <input type="hidden" name="back" value={`/feed${tab === "following" ? "?tab=following" : ""}`} />
        <input type="hidden" name="postId" value={postId} />
        <div className="flex items-start gap-3">
          <Avatar name={me?.display_name ?? "?"} />
          <div className="flex-1">
            <label htmlFor="body" className="sr-only">Share something</label>
            <textarea id="body" name="body" maxLength={3000} rows={3} className="field" placeholder={`What's on your mind, ${me?.display_name ?? "friend"}? A win, a question, a challenge…`} />
          </div>
        </div>
        <VoiceNoteRecorder postId={postId} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="aud" className="text-muted">Audience</label>
            <select id="aud" name="audience" className="field w-auto py-1.5">
              <option value="public">🌍 Everyone</option>
              <option value="followers">👥 Followers only</option>
              {mine.map((c) => <option key={c.id} value={c.id}>💬 {c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary">Post</button>
        </div>
      </form>

      <div className="mt-6 flex gap-2" role="tablist" aria-label="Feed view">
        <Link href="/feed" className={tabCls("everyone")}>Everyone</Link>
        <Link href="/feed?tab=following" className={tabCls("following")}>Following</Link>
      </div>

      <div className="mt-4 space-y-4">
        {rows.length === 0 && (
          <div className="card text-sm text-muted">
            {tab === "following" ? <>Nothing from people you follow yet. Find people in <Link href="/discover" className="underline">Discover</Link>.</> : "No posts yet. Be the first to share something."}
          </div>)}
        {rows.map((p) => <PostCard key={p.id} post={p} me={user.id} back={`/feed${tab === "following" ? "?tab=following" : ""}`} canModerate={!!role} shares={shares.get(p.id) ?? 0} />)}
      </div>
    </main>
  );
}
