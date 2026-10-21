import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function NavBar() {
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = !!user;
  } catch { /* env missing or no session: show logged-out nav */ }

  const link = "rounded-full px-3 py-2 text-sm font-medium text-forest hover:bg-mint";
  return (
    <header className="border-b border-forest/10 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-3">
        <Link href="/" className="text-xl font-bold text-forest">Speakwell</Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <Link href="/" className={link}>Home</Link>
          <Link href="/practice" className={link}>Practise</Link>
          {signedIn && <Link href="/dashboard" className={link}>My progress</Link>}
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
