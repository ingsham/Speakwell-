import type { Db } from "@/lib/auth";

type Person = { username: string; display_name: string } | null;
export type PostRow = {
  id: string; body: string; created_at: string; pinned: boolean; visibility: string;
  author_id: string; shared_post_id: string | null;
  author: Person;
  community: { id: string; name: string; visibility: string } | null;
  shared: { id: string; body: string; created_at: string; author: Person } | null;
  reactions: { user_id: string; kind: string }[];
  comments: { id: string; body: string; created_at: string; author_id: string; author: Person }[];
};

export const POST_SELECT =
  "id,body,created_at,pinned,visibility,author_id,shared_post_id," +
  "author:profiles!author_id(username,display_name)," +
  "community:communities!community_id(id,name,visibility)," +
  "shared:shared_post_id(id,body,created_at,author:profiles!author_id(username,display_name))," +
  "reactions(user_id,kind)," +
  "comments(id,body,created_at,author_id,author:profiles!author_id(username,display_name))";

export const asPosts = (d: unknown): PostRow[] => (d ?? []) as PostRow[];

/** How many times each post has been shared (reposted). */
export async function shareCounts(supabase: Db, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const { data } = await supabase.from("posts").select("shared_post_id").in("shared_post_id", ids);
  for (const r of data ?? []) out.set(r.shared_post_id as string, (out.get(r.shared_post_id as string) ?? 0) + 1);
  return out;
}
