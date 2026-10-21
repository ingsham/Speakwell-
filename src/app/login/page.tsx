"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return setError("Email or password is incorrect, or your email is not yet confirmed.");
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-forest">Welcome back</h1>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4" noValidate>
        <div><label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" className="field" /></div>
        <div><label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" className="field" /></div>
        {error && <p role="alert" className="text-sm text-coral">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="mt-4 text-center text-sm">New here? <Link href="/signup" className="font-semibold text-forest underline">Create an account</Link></p>
    </main>
  );
}
