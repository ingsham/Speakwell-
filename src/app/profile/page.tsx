import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function MyProfile() {
  const { supabase, user } = await requireUser("/profile");
  const { data } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  redirect(data ? `/profile/${data.username}` : "/settings");
}
