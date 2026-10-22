import Link from "next/link";
import { Heart, MessageCircle, Pin } from "lucide-react";
import { addComment, deleteComment, deletePost, setPostFlag, toggleLike } from "@/app/actions";
import { Avatar, ReportForm } from "./ui";
import { timeAgo } from "@/lib/auth";

export type PostRow = {
  id: string; body: string; created_at: string; pinned: boolean; author_id: string;
  author: { username: string; display_name: string } | null;
  community: { id: string; name: string } | null;
  reactions: { user_id: string; kind: string }[];
  comments: { id: string; body: string; created_at: string; author_id: string; author: { username: string; display_name: string } | null }[];
};

export const POST_SELECT =
  "id,body,created_at,pinned,author_id,author:profiles!author_id(username,display_name),community:communities!community_id(id,name),reactions(user_id,kind),comments(id,body,created_at,author_id,author:profiles!author_id(username,display_name))";

export default function PostCard({ post, me, back, canModerate, showCommunity = true }:
  { post: PostRow; me: string; back: string; canModerate?: boolean; showCommunity?: boolean }) {
  const likes = post.reactions.filter((r) => r.kind === "like");
  const liked = likes.some((r) => r.user_id === me);
  const comments = [...post.comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const name = post.author?.display_name ?? "Someone";
  return (
    <article className="card" aria-label={`Post by ${name}`}>
      <div className="flex items-start gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {post.author ? <Link href={`/profile/${post.author.username}`} className="font-semibold text-forest hover:underline">{name}</Link>
              : <span className="font-semibold">{name}</span>}
            <span className="text-muted"> · {timeAgo(post.created_at)}</span>
            {showCommunity && post.community && <> <span className="text-muted">in</span> <Link href={`/communities/${post.community.id}`} className="text-forest underline">{post.community.name}</Link></>}
            {post.pinned && <span className="ml-2 inline-flex items-center gap-1 text-xs text-forest"><Pin className="h-3 w-3" aria-hidden />Pinned</span>}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words">{post.body}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <form action={toggleLike}>
          <input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
          <input type="hidden" name="liked" value={liked ? "1" : "0"} />
          <button aria-pressed={liked} className={`inline-flex items-center gap-1 ${liked ? "font-semibold text-forest" : "text-muted"} hover:text-forest`}>
            <Heart className={`h-4 w-4 ${liked ? "fill-coral text-coral" : ""}`} aria-hidden />{likes.length} {likes.length === 1 ? "like" : "likes"}
          </button>
        </form>
        <span className="inline-flex items-center gap-1 text-muted"><MessageCircle className="h-4 w-4" aria-hidden />{comments.length}</span>
        {post.author_id !== me && <ReportForm targetType="post" targetId={post.id} back={back} />}
        {(post.author_id === me || canModerate) && (
          <form action={deletePost}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
            <button className="text-muted underline">Delete</button></form>)}
        {canModerate && (
          <form action={setPostFlag}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
            <input type="hidden" name="flag" value="pinned" /><input type="hidden" name="value" value={post.pinned ? "0" : "1"} />
            <button className="text-muted underline">{post.pinned ? "Unpin" : "Pin"}</button></form>)}
      </div>

      {comments.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-forest/10 pt-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <Avatar name={c.author?.display_name ?? "?"} size={28} />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-forest">{c.author?.display_name ?? "Someone"}</span>
                <span className="text-muted"> · {timeAgo(c.created_at)}</span>
                <p className="whitespace-pre-wrap break-words">{c.body}</p>
                <span className="flex gap-3 text-xs">
                  {c.author_id !== me && <ReportForm targetType="comment" targetId={c.id} back={back} />}
                  {(c.author_id === me || canModerate) && (
                    <form action={deleteComment}><input type="hidden" name="commentId" value={c.id} /><input type="hidden" name="back" value={back} />
                      <button className="text-muted underline">Delete</button></form>)}
                </span>
              </div>
            </li>))}
        </ul>)}

      <form action={addComment} className="mt-4 flex gap-2">
        <input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
        <label className="sr-only" htmlFor={`c-${post.id}`}>Write a comment</label>
        <input id={`c-${post.id}`} name="body" required maxLength={1500} placeholder="Write a kind comment…" className="field" />
        <button className="btn btn-ghost">Reply</button>
      </form>
    </article>
  );
}
export const asPosts = (d: unknown): PostRow[] => (d ?? []) as PostRow[];
