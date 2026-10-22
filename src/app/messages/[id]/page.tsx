import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ReportForm, Avatar } from "@/components/ui";
import { toggleBlock } from "@/app/actions";
import Chat from "@/components/Chat";

export default async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/messages/${id}`);
  const { data: parts } = await supabase.from("conversation_participants")
    .select("user_id,last_read_at,profiles(id,username,display_name)").eq("conversation_id", id);
  if (!parts?.some((p) => p.user_id === user.id)) notFound();
  const other = parts.find((p) => p.user_id !== user.id);
  const prof = (Array.isArray(other?.profiles) ? other?.profiles[0] : other?.profiles) as { id: string; username: string; display_name: string } | undefined;
  const { data: msgs } = await supabase.from("messages").select("id,sender_id,body,created_at").eq("conversation_id", id).order("created_at").limit(500);
  await supabase.from("conversation_participants").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", user.id);
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("link", `/messages/${id}`).eq("read", false);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/messages" className="text-sm text-forest underline">← All messages</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={prof?.display_name ?? "?"} />
          <div>
            {prof ? <Link href={`/profile/${prof.username}`} className="font-semibold text-forest hover:underline">{prof.display_name}</Link>
              : <span className="font-semibold">Unavailable user</span>}
          </div>
        </div>
        {prof && (
          <div className="flex gap-4 text-sm">
            <form action={toggleBlock}><input type="hidden" name="profileId" value={prof.id} /><input type="hidden" name="back" value="/messages" />
              <input type="hidden" name="blocked" value="0" /><button className="text-muted underline">Block</button></form>
            <ReportForm targetType="user" targetId={prof.id} back={`/messages/${id}`} label="Report" />
          </div>)}
      </div>
      <div className="mt-4">
        <Chat conversationId={id} me={user.id} initial={msgs ?? []} otherReadAt={other?.last_read_at ?? null} />
      </div>
    </main>
  );
}
