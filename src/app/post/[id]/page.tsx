import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getRole } from "@/lib/auth";
import { Flash } from "@/components/ui";
import PostCard from "@/components/PostCard";
import { POST_SELECT, asPosts, shareCounts } from "@/lib/posts";

export default async function PostPage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireUser(`/post/${id}`);
  const [{ data }, role, shares] = await Promise.all([
    supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle(),
    getRole(supabase, user.id), shareCounts(supabase, [id]),
  ]);
  const post = asPosts(data ? [data] : [])[0];
  if (!post) notFound();
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("link", `/post/${id}`).eq("read", false);
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/feed" className="text-sm text-forest underline">← Back to feed</Link>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      <PostCard post={post} me={user.id} back={`/post/${id}`} canModerate={!!role || false} shares={shares.get(id) ?? 0} maxComments={0} />
    </main>
  );
}
