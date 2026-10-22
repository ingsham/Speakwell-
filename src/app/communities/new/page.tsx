import { requireUser } from "@/lib/auth";
import { createCommunity } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function NewCommunity({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requireUser("/communities/new");
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Create a community</h1>
      <p className="mt-1 text-sm text-muted">You become its owner and moderator. Platform guidelines still apply.</p>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      <form action={createCommunity} className="card space-y-4">
        <div><label htmlFor="n" className="text-sm font-medium">Name</label><input id="n" name="name" required minLength={3} maxLength={60} className="field" /></div>
        <div><label htmlFor="d" className="text-sm font-medium">Description</label><textarea id="d" name="description" maxLength={600} rows={3} className="field" /></div>
        <div><label htmlFor="c" className="text-sm font-medium">Category</label><input id="c" name="category" maxLength={40} placeholder="e.g. Job interviews, Students, Parents" className="field" /></div>
        <div><label htmlFor="g" className="text-sm font-medium">Community guidelines</label><textarea id="g" name="guidelines" maxLength={2000} rows={4} className="field" /></div>
        <div><label htmlFor="v" className="text-sm font-medium">Who can join?</label>
          <select id="v" name="visibility" className="field"><option value="public">Anyone can join</option><option value="private">Members need approval</option><option value="invite_only">Invite only (hidden)</option></select></div>
        <button className="btn btn-primary">Create community</button>
      </form>
    </main>
  );
}
