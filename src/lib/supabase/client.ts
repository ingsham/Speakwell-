import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";
export function createClient() {
  const { url, anon } = getPublicEnv();
  return createBrowserClient(url, anon);
}
