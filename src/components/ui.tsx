import Link from "next/link";
import { submitReport } from "@/app/actions";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p role={error ? "alert" : "status"}
       className={`mb-4 rounded-xl px-4 py-3 text-sm ${error ? "bg-coral/15 text-ink" : "bg-mint text-forest"}`}>
      {error ?? ok}
    </p>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-lime font-bold text-forest">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function PersonLink({ username, name, sub }: { username: string; name: string; sub?: string }) {
  return (
    <Link href={`/profile/${username}`} className="flex items-center gap-3 hover:underline">
      <Avatar name={name} />
      <span><span className="block font-semibold text-forest">{name}</span>
        <span className="block text-xs text-muted">{sub ?? `@${username}`}</span></span>
    </Link>
  );
}

/** Collapsible report form. Works without JavaScript. */
export function ReportForm({ targetType, targetId, back, label = "Report" }:
  { targetType: "user" | "post" | "comment" | "community"; targetId: string; back: string; label?: string }) {
  return (
    <details className="inline-block text-sm">
      <summary className="cursor-pointer list-none text-muted underline">{label}</summary>
      <form action={submitReport} className="mt-2 w-72 max-w-full space-y-2 rounded-xl border border-forest/10 bg-white p-3">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="back" value={back} />
        <label className="block text-xs font-medium" htmlFor={`r-${targetId}`}>What's wrong?</label>
        <textarea id={`r-${targetId}`} name="reason" required minLength={3} maxLength={500} rows={3} className="field" />
        <button className="btn btn-primary w-full">Send report</button>
      </form>
    </details>
  );
}

export const PageShell = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) =>
  <main className={`mx-auto ${wide ? "max-w-5xl" : "max-w-3xl"} px-6 py-10`}>{children}</main>;
