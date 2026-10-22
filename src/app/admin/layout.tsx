import Link from "next/link";
import { requireStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireStaff("/admin", true);
  const tab = "rounded-full px-4 py-2 text-sm font-medium text-forest hover:bg-mint";
  return (
    <div className="mx-auto max-w-5xl px-6 pt-8">
      <p className="text-xs uppercase tracking-wide text-muted">{role === "admin" ? "Super admin" : "Moderator"} area</p>
      <nav aria-label="Admin" className="mt-2 flex flex-wrap gap-1 border-b border-forest/10 pb-3">
        <Link href="/admin" className={tab}>Overview</Link>
        <Link href="/admin/reports" className={tab}>Reports</Link>
        <Link href="/admin/communities" className={tab}>Communities</Link>
        {role === "admin" && <Link href="/admin/users" className={tab}>Users</Link>}
        {role === "admin" && <Link href="/admin/settings" className={tab}>Platform settings</Link>}
      </nav>
      {children}
    </div>
  );
}
