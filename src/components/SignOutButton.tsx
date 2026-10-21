"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  async function out() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return <button onClick={out} className="btn btn-ghost">Log out</button>;
}
