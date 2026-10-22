import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/practice", "/discover", "/profile", "/settings", "/messages",
  "/notifications", "/communities", "/progress", "/admin", "/feed"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const needsAuth = PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!url || !anon) return needsAuth ? NextResponse.redirect(new URL("/login", req.url)) : res;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser(); // verifies the JWT with Supabase
  if (needsAuth && !user) {
    const to = new URL("/login", req.url);
    to.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(to);
  }
  if (req.nextUrl.pathname.startsWith("/admin") && user) {
    // Defence in depth: RLS + SQL functions remain the real gate.
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (data?.role !== "admin" && data?.role !== "moderator") return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
