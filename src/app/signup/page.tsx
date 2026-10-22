"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validation";

type Values = { displayName: string; email: string; password: string };

export default function SignupPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Values>();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(values: Values) {
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) return setMsg({ ok: false, text: parsed.error.issues[0].message });
    const { data, error } = await createClient().auth.signUp({
      email: parsed.data.email, password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName },
                 emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      const m = error.message.toLowerCase();
      const text = m.includes("rate limit") ? "Too many sign-up emails were sent. Try again in an hour, or ask the site owner to turn off email confirmation."
        : m.includes("already") ? "That email is already registered. Try logging in."
        : m.includes("password") ? error.message
        : m.includes("fetch") || m.includes("network") ? "Couldn't reach the server. The site's Supabase settings may be wrong."
        : `We couldn't create that account (${error.message}).`;
      return setMsg({ ok: false, text });
    }
    if (data.session) { router.replace("/dashboard"); router.refresh(); return; } // email confirmation is off
    setMsg({ ok: true, text: "Check your email to confirm your account." });
  }
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-forest">Create your account</h1>
      <p className="mt-1 text-sm text-muted">You never have to share that you stammer.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="card mt-6 space-y-4" noValidate>
        <div><label htmlFor="dn" className="text-sm font-medium">Display name</label>
          <input id="dn" className="field" {...register("displayName")} /></div>
        <div><label htmlFor="em" className="text-sm font-medium">Email</label>
          <input id="em" type="email" autoComplete="email" className="field" {...register("email")} /></div>
        <div><label htmlFor="pw" className="text-sm font-medium">Password</label>
          <input id="pw" type="password" autoComplete="new-password" className="field" {...register("password")} /></div>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-forest" : "text-coral"}`}>{msg.text}</p>}
        <button className="btn btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Sign up"}</button>
      </form>
      <p className="mt-4 text-center text-sm">Already registered? <Link href="/login" className="font-semibold text-forest underline">Log in</Link></p>
    </main>
  );
}
