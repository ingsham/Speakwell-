import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { adminSuspend, adminSetRole } from "@/app/actions";
import { Flash } from "@/components/ui";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireStaff("/admin/users");
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 40);
  const filter = sp.filter === "suspended" ? "suspended" : sp.filter === "staff" ? "staff" : "all";
  let query = supabase.from("profiles").select("id,username,display_name,created_at,suspended,is_public").order("created_at", { ascending: false }).limit(60);
  if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (filter === "suspended") query = query.eq("suspended", true);
  const [{ data: users }, { data: roles }] = await Promise.all([query, supabase.from("user_roles").select("user_id,role")]);
  const roleOf = new Map((roles ?? []).map((r) => [r.user_id as string, r.role as string]));
  const list = (users ?? []).filter((u) => filter !== "staff" || roleOf.has(u.id));
  const back = `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return (
    <main className="py-8">
      <h1 className="text-3xl font-bold text-forest">Users</h1>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search users</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search name or username" className="field max-w-xs" />
        <label htmlFor="f" className="sr-only">Filter</label>
        <select id="f" name="filter" defaultValue={filter} className="field w-auto"><option value="all">All</option><option value="suspended">Suspended</option><option value="staff">Staff</option></select>
        <button className="btn btn-primary">Apply</button>
      </form>
      <ul className="mt-6 space-y-3">
        {list.map((u) => {
          const r = roleOf.get(u.id);
          return (
            <li key={u.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/profile/${u.username}`} className="font-semibold text-forest hover:underline">{u.display_name}</Link>
                  <span className="text-sm text-muted"> @{u.username}</span>
                  {r && <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-xs text-forest">{r}</span>}
                  {u.suspended && <span className="ml-2 rounded-full bg-coral/30 px-2 py-0.5 text-xs">suspended</span>}
                  <p className="text-xs text-muted">Joined {new Date(u.created_at).toLocaleDateString()}{u.is_public ? "" : " · private profile"}</p>
                </div>
                {u.id !== user.id && (
                  <div className="flex flex-wrap items-end gap-3">
                    {!r && (
                      <form action={adminSuspend} className="flex items-end gap-2">
                        <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="suspend" value={u.suspended ? "0" : "1"} /><input type="hidden" name="back" value={back} />
                        <div><label htmlFor={`w-${u.id}`} className="block text-xs">Reason</label><input id={`w-${u.id}`} name="why" required minLength={3} className="field w-40" /></div>
                        <button className="btn btn-ghost">{u.suspended ? "Reinstate" : "Suspend"}</button>
                      </form>)}
                    <form action={adminSetRole} className="flex items-end gap-2">
                      <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="back" value={back} />
                      <div><label htmlFor={`r-${u.id}`} className="block text-xs">Role</label>
                        <select id={`r-${u.id}`} name="role" defaultValue={r ?? "none"} className="field w-auto"><option value="none">User</option><option value="moderator">Moderator</option><option value="admin">Super admin</option></select></div>
                      <button className="btn btn-ghost">Set</button>
                    </form>
                  </div>)}
              </div>
            </li>);
        })}
        {list.length === 0 && <li className="text-sm text-muted">No users found.</li>}
      </ul>
    </main>
  );
}
