import { requireUser } from "@/lib/auth";
import { Avatar, Flash } from "@/components/ui";
import Link from "next/link";

type P = { id: string; username: string; display_name: string; bio: string | null; interests: string[] };

function List({ people, empty }: { people: P[]; empty: string }) {
  if (!people.length) return <p className="mt-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {people.map((p) => (
        <li key={p.id}>
          <Link href={`/profile/${p.username}`} className="card flex h-full items-start gap-3 p-4 transition hover:shadow-md">
            <Avatar name={p.display_name} />
            <span className="min-w-0">
              <span className="block font-semibold text-forest">{p.display_name}</span>
              <span className="block text-xs text-muted">@{p.username}</span>
              {p.bio && <span className="mt-1 line-clamp-2 block text-sm">{p.bio}</span>}
              {p.interests?.length > 0 && <span className="mt-1 block text-xs text-muted">{p.interests.slice(0, 4).join(" · ")}</span>}
            </span>
          </Link>
        </li>))}
    </ul>
  );
}

export default async function Discover({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/discover");
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 40);
  const cols = "id,username,display_name,bio,interests";
  const { data: me } = await supabase.from("profiles").select("interests").eq("id", user.id).single();

  let results: P[] = [];
  if (q) {
    const { data } = await supabase.from("profiles").select(cols).neq("id", user.id)
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(24);
    results = (data as P[]) ?? [];
  }
  let similar: P[] = [];
  if (me?.interests?.length) {
    const { data } = await supabase.from("profiles").select(cols).neq("id", user.id).overlaps("interests", me.interests).limit(12);
    similar = (data as P[]) ?? [];
  }
  const { data: newest } = await supabase.from("profiles").select(cols).neq("id", user.id).order("created_at", { ascending: false }).limit(12);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Discover people</h1>
      <p className="mt-1 text-muted">Follow people you'd like to practise or chat with.</p>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      <form className="mt-2 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search by name or username</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name or username" className="field" />
        <button className="btn btn-primary">Search</button>
      </form>
      {q && (<section aria-labelledby="res" className="mt-8"><h2 id="res" className="font-semibold">Results for "{q}"</h2>
        <List people={results} empty="No one found." /></section>)}
      <section aria-labelledby="sim" className="mt-8">
        <h2 id="sim" className="font-semibold">People with similar interests</h2>
        {me?.interests?.length ? <List people={similar} empty="No matches yet. Check back as more people join." />
          : <p className="mt-3 text-sm text-muted">Add interests in <Link href="/settings" className="underline">Settings</Link> to see suggestions.</p>}
      </section>
      <section aria-labelledby="new" className="mt-8"><h2 id="new" className="font-semibold">New members</h2>
        <List people={(newest as P[]) ?? []} empty="You're the first one here. Invite a friend!" /></section>
    </main>
  );
}
