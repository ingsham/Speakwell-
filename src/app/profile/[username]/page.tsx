import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, UserPlus, Mic } from "lucide-react";
import { requireUser, getRole } from "@/lib/auth";
import { toggleFollow, toggleBlock, startConversation, sendInvitation } from "@/app/actions";
import { Avatar, Flash, ReportForm } from "@/components/ui";
import PostCard, { POST_SELECT, asPosts } from "@/components/PostCard";

export default async function Profile({ params, searchParams }:
  { params: Promise<{ username: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { username } = await params; const sp = await searchParams;
  const path = `/profile/${username}`;
  const { supabase, user } = await requireUser(path);
  const { data: p } = await supabase.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
  if (!p) notFound();
  const mine = p.id === user.id;
  const [role, counts, iFollow, followsMe, posts] = await Promise.all([
    getRole(supabase, user.id),
    supabase.rpc("follow_counts", { uid: p.id }),
    supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("followee_id", p.id).maybeSingle(),
    supabase.from("follows").select("follower_id").eq("follower_id", p.id).eq("followee_id", user.id).maybeSingle(),
    supabase.from("posts").select(POST_SELECT).eq("author_id", p.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const c = (counts.data as { followers: number; following: number }[] | null)?.[0] ?? { followers: 0, following: 0 };
  const following = !!iFollow.data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Flash ok={sp.ok} error={sp.error} />
      <section className="card">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={p.display_name} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-forest">{p.display_name}</h1>
            <p className="text-sm text-muted">@{p.username}{p.country ? ` · ${p.country}` : ""}{p.suspended ? " · suspended" : ""}</p>
            <p className="mt-1 text-sm"><strong>{c.followers}</strong> followers · <strong>{c.following}</strong> following</p>
          </div>
        </div>
        {p.bio && <p className="mt-4 whitespace-pre-wrap">{p.bio}</p>}
        {p.goals && <p className="mt-3 text-sm"><span className="font-semibold">Goals: </span>{p.goals}</p>}
        {p.interests?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Interests">
            {p.interests.map((i: string) => <li key={i} className="rounded-full bg-mint px-3 py-1 text-xs text-forest">{i}</li>)}
          </ul>)}

        {mine ? (
          <div className="mt-5"><Link href="/settings" className="btn btn-ghost">Edit profile</Link></div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <form action={toggleFollow}>
              <input type="hidden" name="profileId" value={p.id} /><input type="hidden" name="back" value={path} />
              <input type="hidden" name="following" value={following ? "1" : "0"} />
              <button className={following ? "btn btn-ghost" : "btn btn-primary"}><UserPlus className="h-4 w-4" aria-hidden />{following ? "Following" : "Follow"}</button>
            </form>
            <form action={startConversation}>
              <input type="hidden" name="profileId" value={p.id} /><input type="hidden" name="back" value={path} />
              <button className="btn btn-ghost"><MessageCircle className="h-4 w-4" aria-hidden />Message</button>
            </form>
            <details className="text-sm">
              <summary className="btn btn-ghost cursor-pointer list-none"><Mic className="h-4 w-4" aria-hidden />Invite to practise</summary>
              <form action={sendInvitation} className="mt-2 w-72 max-w-full space-y-2 rounded-xl border border-forest/10 bg-white p-3">
                <input type="hidden" name="profileId" value={p.id} /><input type="hidden" name="back" value={path} />
                <label htmlFor="inv" className="block text-xs font-medium">Optional note</label>
                <textarea id="inv" name="message" maxLength={280} rows={3} className="field" placeholder="Fancy practising a phone call together?" />
                <button className="btn btn-primary w-full">Send invitation</button>
              </form>
            </details>
          </div>)}
        {!mine && (
          <>
            <p className="mt-3 text-xs text-muted">
              {followsMe.data ? "They follow you, so you can message them." : "You can message someone once they follow you, or after a practice invitation is accepted."}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <form action={toggleBlock}><input type="hidden" name="profileId" value={p.id} /><input type="hidden" name="back" value="/settings" />
                <input type="hidden" name="blocked" value="0" /><button className="text-muted underline">Block</button></form>
              <ReportForm targetType="user" targetId={p.id} back={path} label="Report user" />
              {role && <Link href="/admin/users" className="text-forest underline">Open in admin</Link>}
            </div>
          </>)}
      </section>

      <h2 className="mt-8 text-lg font-semibold text-forest">Posts</h2>
      <div className="mt-3 space-y-4">
        {asPosts(posts.data).length
          ? asPosts(posts.data).map((post) => <PostCard key={post.id} post={post} me={user.id} back={path} canModerate={!!role} />)
          : <p className="text-sm text-muted">No posts to show.</p>}
      </div>
    </main>
  );
}
