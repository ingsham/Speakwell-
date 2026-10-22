import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function NavBar() {
  let signedIn = false, unread = 0, staff = false, suspended = false;
  let announcements: { id: string; title: string; body: string | null; kind: string }[] = [];
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      signedIn = true;
      const [n, r, p, a] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("suspended").eq("id", user.id).maybeSingle(),
        supabase.from("announcements").select("id,title,body,kind").eq("active", true).order("created_at", { ascending: false }).limit(2),
      ]);
      unread = n.count ?? 0; staff = !!r.data?.role; suspended = !!p.data?.suspended;
      announcements = a.data ?? [];
    }
  } catch { /* env missing, tables not created yet, or no session: show the logged-out nav */ }

  const link = "rounded-full px-3 py-2 text-sm font-medium text-forest hover:bg-mint";
  return (
    <header className="border-b border-forest/10 bg-white/70 backdrop-blur">
      {announcements.map((a) => (
        <p key={a.id} role="status" className={`px-6 py-2 text-center text-sm ${a.kind === "maintenance" ? "bg-coral/20" : "bg-lime/60"} text-ink`}>
          <strong>{a.title}</strong>{a.body ? ` · ${a.body}` : ""}
        </p>))}
      {suspended && <p role="alert" className="bg-coral/20 px-6 py-2 text-center text-sm text-ink">Your account is suspended. You can read but not post or message. Contact support if you think this is a mistake.</p>}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-3">
        <Link href="/" className="text-xl font-bold text-forest">Speakwell</Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <Link href="/" className={link}>Home</Link>
          <Link href="/practice" className={link}>Practise</Link>
          {signedIn && (<>
            <Link href="/feed" className={link}>Feed</Link>
            <Link href="/discover" className={link}>Discover</Link>
            <Link href="/communities" className={link}>Communities</Link>
            <Link href="/messages" className={link}>Messages</Link>
            <Link href="/notifications" className={link}>Alerts{unread > 0 && <span className="ml-1 rounded-full bg-coral px-1.5 py-0.5 text-xs text-white" aria-label={`${unread} unread`}>{unread}</span>}</Link>
            <Link href="/dashboard" className={link}>Progress</Link>
            <Link href="/profile" className={link}>Profile</Link>
            {staff && <Link href="/admin" className={link}>Admin</Link>}
          </>)}
          <span className="ml-2 flex items-center gap-2">
            {signedIn ? <SignOutButton /> : (<>
              <Link href="/login" className="btn btn-ghost">Log in</Link>
              <Link href="/signup" className="btn btn-primary">Get started</Link>
            </>)}
          </span>
        </nav>
      </div>
    </header>
  );
}
