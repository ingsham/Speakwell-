import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createClient>>;
export type Role = "admin" | "moderator" | null;

export async function requireUser(next?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return { supabase, user };
}

export async function getRole(supabase: Db, userId: string): Promise<Role> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return data?.role === "admin" || data?.role === "moderator" ? data.role : null;
}

/** Page guard for the admin area: admins always, moderators only when allowModerator. */
export async function requireStaff(next: string, allowModerator = false) {
  const { supabase, user } = await requireUser(next);
  const role = await getRole(supabase, user.id);
  if (!role || (role === "moderator" && !allowModerator)) redirect("/dashboard");
  return { supabase, user, role };
}

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 604800) return `${Math.round(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
};
