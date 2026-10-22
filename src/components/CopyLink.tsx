"use client";
import { useState } from "react";
import { Link2 } from "lucide-react";

export default function CopyLink({ path, title }: { path: string; title: string }) {
  const [done, setDone] = useState(false);
  async function go() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true); setTimeout(() => setDone(false), 2000);
    } catch { /* user cancelled or clipboard blocked */ }
  }
  return (
    <button type="button" onClick={go} className="inline-flex items-center gap-1 text-muted hover:text-forest">
      <Link2 className="h-4 w-4" aria-hidden />{done ? "Link copied" : "Copy link"}
    </button>
  );
}
