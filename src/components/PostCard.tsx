import Link from "next/link";
import { Heart, MessageCircle, Pin, Repeat2, Globe, Users } from "lucide-react";
import { addComment, deleteComment, deletePost, setPostFlag, toggleLike, sharePost } from "@/app/actions";
import { Avatar, ReportForm } from "./ui";
import CopyLink from "./CopyLink";
import { timeAgo } from "@/lib/auth";
import type { PostRow } from "@/lib/posts";

export { POST_SELECT, asPosts } from "@/lib/posts";
export type { PostRow } from "@/lib/posts";

export default function PostCard({ post, me, back, canModerate, showCommunity = true, shares = 0, maxComments = 3 }:
  { post: PostRow; me: string; back: string; canModerate?: boolean; showCommunity?: boolean; shares?: number; maxComments?: number }) {
  const likes = post.reactions.filter((r) => r.kind === "like");
  const liked = likes.some((r) => r.user_id === me);
  const comments = [...post.comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const shown = maxComments > 0 ? comments.slice(-maxComments) : comments;
  const name = post.author?.display_name ?? "Someone";
  const isRepost = !!post.shared_post_id;
  const canShare = isRepost || (post.community ? post.community.visibility === "public" : post.visibility === "public");
  const permalink = `/post/${post.id}`;
  const target = isRepost && post.shared ? post.shared : null;

  return (
    <article className="card" aria-label={`Post by ${name}`}>
      <div className="flex items-start gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {post.author ? <Link href={`/profile/${post.author.username}`} className="font-semibold text-forest hover:underline">{name}</Link>
              : <span className="font-semibold">{name}</span>}
            {isRepost && <span className="text-muted"> shared a post</span>}
            {showCommunity && post.community && <> <span className="text-muted">in</span> <Link href={`/communities/${post.community.id}`} className="text-forest underline">{post.community.name}</Link></>}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Link href={permalink} className="hover:underline">{timeAgo(post.created_at)}</Link>
            {!post.community && (post.visibility === "followers"
              ? <><span aria-hidden>·</span><Users className="h-3 w-3" aria-hidden /><span>Followers</span></>
              : <><span aria-hidden>·</span><Globe className="h-3 w-3" aria-hidden /><span>Everyone</span></>)}
            {post.pinned && <span className="ml-2 inline-flex items-center gap-1 text-forest"><Pin className="h-3 w-3" aria-hidden />Pinned</span>}
          </p>
          {post.body && <p className="mt-2 whitespace-pre-wrap break-words">{post.body}</p>}
          {isRepost && (
            <div className="mt-3 rounded-xl border border-forest/15 bg-canvas p-3 text-sm">
              {target ? (<>
                <p className="text-xs text-muted">
                  {target.author ? <Link href={`/profile/${target.author.username}`} className="font-semibold text-forest hover:underline">{target.author.display_name}</Link> : "Someone"}
                  {" · "}<Link href={`/post/${target.id}`} className="hover:underline">{timeAgo(target.created_at)}</Link>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words">{target.body}</p>
              </>) : <p className="text-muted">The original post is no longer available.</p>}
            </div>)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-forest/10 pt-3 text-sm">
        <form action={toggleLike}>
          <input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
          <input type="hidden" name="liked" value={liked ? "1" : "0"} />
          <button aria-pressed={liked} className={`inline-flex items-center gap-1 ${liked ? "font-semibold text-forest" : "text-muted"} hover:text-forest`}>
            <Heart className={`h-4 w-4 ${liked ? "fill-coral text-coral" : ""}`} aria-hidden />{liked ? "Liked" : "Like"} · {likes.length}
          </button>
        </form>
        <Link href={permalink} className="inline-flex items-center gap-1 text-muted hover:text-forest">
          <MessageCircle className="h-4 w-4" aria-hidden />Comment · {comments.length}
        </Link>
        {canShare ? (
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted hover:text-forest"><Repeat2 className="h-4 w-4" aria-hidden />Share · {shares}</summary>
            <form action={sharePost} className="absolute left-0 z-10 mt-2 w-72 max-w-[85vw] space-y-2 rounded-xl border border-forest/10 bg-white p-3 shadow-md">
              <input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
              <label htmlFor={`s-${post.id}`} className="text-xs font-medium">Add a thought (optional)</label>
              <textarea id={`s-${post.id}`} name="body" rows={2} maxLength={3000} className="field" />
              <button className="btn btn-primary w-full">Share to my profile</button>
            </form>
          </details>
        ) : <span className="text-muted" title="Posts in private spaces can't be reshared"><Repeat2 className="inline h-4 w-4" aria-hidden /> Not shareable</span>}
        {canShare && <CopyLink path={permalink} title={`Post by ${name}`} />}
        {post.author_id !== me && <ReportForm targetType="post" targetId={post.id} back={back} />}
        {(post.author_id === me || canModerate) && (
          <form action={deletePost}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
            <button className="text-muted underline">Delete</button></form>)}
        {canModerate && post.community && (
          <form action={setPostFlag}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="back" value={back} />
            <input type="hidden" name="flag" value="pinned" /><input type="hidden" name="value" value={post.pinned ? "0" : "1"} />
            <button className="text-muted underline">{post.pinned ? "Unpin" : "Pin"}</button></form>)}
      </div>

      {comments.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-forest/10 pt-4">
          {shown.length < comments.length && <li><Link href={permalink} className="text-sm text-forest underline">View all {comments.length} comments</Link></li>}
          {shown.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <Avatar name={c.author?.display_name ?? "?"} size={28} />
              <div className="min-w-0 flex-1 rounded-xl bg-canvas px-3 py-2">
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
