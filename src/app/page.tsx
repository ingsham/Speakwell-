import Link from "next/link";
import { ArrowRight, AudioLines, HeartHandshake, MessageCircle, Mic2, ShieldCheck, Users, Waves } from "lucide-react";
import { scenarios } from "@/lib/scenarios";

const experiences = [
  {
    number: "01",
    icon: AudioLines,
    title: "Live audio rooms",
    text: "Drop into a welcoming group, listen first, and speak when you feel ready. No camera required.",
    href: "/rooms",
    action: "Explore rooms",
    tone: "bg-[#E7F0FF] text-[#284D88]",
    status: "Being built",
  },
  {
    number: "02",
    icon: HeartHandshake,
    title: "One-to-one connection",
    text: "Meet people at your pace. Start with a message, accept an invitation, and build trust over time.",
    href: "/connections",
    action: "Find your people",
    tone: "bg-[#FCE9E3] text-[#914D3B]",
    status: "Available now",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "Community feed",
    text: "Share a small win, ask a question, or tell your story with people who understand.",
    href: "/feed",
    action: "Visit the feed",
    tone: "bg-[#E5F3E5] text-[#245C43]",
    status: "Available now",
  },
];

export default function Home() {
  return (
    <main className="pb-16">
      <section className="relative overflow-hidden border-b border-forest/10 bg-[#F1F5EF]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-lime/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[#DCE9F4]/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/80 px-3 py-1.5 text-sm font-medium text-forest">
              <span className="h-2 w-2 rounded-full bg-[#5D956B]" /> A place to belong, not to perform
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-forest sm:text-6xl">You deserve to be heard.<br /><span className="text-[#718078]">At your own pace.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#53635A] sm:text-lg">Speakwell is a supportive space for people who stammer to meet people who understand, practise everyday conversations, and feel less alone. There is no perfect way to speak here.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary">Find your people <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <Link href="/practice" className="btn btn-ghost bg-white/70">Try a practice session</Link>
            </div>
            <p className="mt-5 text-sm text-muted">Speak slowly. Pause. Start again. You belong here.</p>
          </div>
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] border border-white bg-white/85 p-5 shadow-[0_24px_80px_-38px_rgba(23,63,53,.35)] sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted">A little reminder</p><h2 className="mt-1 text-xl font-semibold text-forest">Connection before perfection.</h2></div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/70 text-forest"><Waves className="h-6 w-6" aria-hidden /></div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-[#F4F7F2] p-4"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-forest"><Users className="h-4 w-4" aria-hidden /></span><div><p className="font-medium text-ink">You don't have to explain yourself</p><p className="mt-1 text-sm leading-5 text-muted">Meet people who already understand.</p></div></div>
                <div className="flex items-start gap-3 rounded-2xl bg-[#F4F7F2] p-4"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-forest"><Mic2 className="h-4 w-4" aria-hidden /></span><div><p className="font-medium text-ink">Your voice, your choice</p><p className="mt-1 text-sm leading-5 text-muted">Listen first, use audio, or write instead.</p></div></div>
                <div className="flex items-start gap-3 rounded-2xl bg-[#F4F7F2] p-4"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-forest"><ShieldCheck className="h-4 w-4" aria-hidden /></span><div><p className="font-medium text-ink">Respect is the starting point</p><p className="mt-1 text-sm leading-5 text-muted">Clear boundaries, consent, and ways to report harm.</p></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-20" aria-labelledby="ways-to-connect">
        <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">Find your kind of connection</p><h2 id="ways-to-connect" className="mt-2 text-3xl font-semibold tracking-tight text-forest sm:text-4xl">Three ways to feel less alone.</h2><p className="mt-3 leading-7 text-muted">Some days you may want to listen. Other days, you may want to talk one-to-one or share something with the community. Start wherever feels right.</p></div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {experiences.map(({ number, icon: Icon, title, text, href, action, tone, status }) => (
            <article key={title} className="group flex min-h-[300px] flex-col rounded-2xl border border-forest/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:p-7">
              <div className="flex items-start justify-between gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-6 w-6" aria-hidden /></span><span className="text-sm font-semibold text-[#A0AAA3]">{number}</span></div>
              <h3 className="mt-6 text-xl font-semibold text-forest">{title}</h3><p className="mt-2 flex-1 leading-6 text-muted">{text}</p>
              <div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs font-medium text-muted">{status}</span><Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline">{action}<ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-6" aria-labelledby="practice-situations">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.16em] text-muted">When you're ready</p><h2 id="practice-situations" className="mt-2 text-2xl font-semibold text-forest sm:text-3xl">Practise real-life moments.</h2><p className="mt-2 text-muted">A little space to try things out, with no grades and no pressure.</p></div><Link href="/practice" className="btn btn-ghost">All practice activities <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{scenarios.slice(0, 8).map((s) => <Link key={s.slug} href={`/practice/${s.slug}`} className="rounded-2xl border border-forest/10 bg-white p-4 transition hover:border-forest/30 hover:bg-mint/50"><span className="text-2xl" aria-hidden>{s.emoji}</span><p className="mt-3 text-sm font-semibold text-forest">{s.title}</p><span className="mt-1 block text-xs text-muted">Practise at your pace</span></Link>)}</div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-6"><div className="flex flex-col gap-4 rounded-3xl bg-forest px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-9 sm:py-10"><div className="max-w-2xl"><h2 className="text-2xl font-semibold">You don't have to do this alone.</h2><p className="mt-2 leading-6 text-white/75">Take one small step today. Read a story, send a message, or simply show up.</p></div><Link href="/signup" className="btn shrink-0 bg-lime text-forest hover:bg-white">Join Speakwell <ArrowRight className="h-4 w-4" aria-hidden /></Link></div></section>

      <footer className="mx-auto mt-16 max-w-6xl border-t border-forest/10 px-6 pt-7 text-center text-sm text-muted"><nav aria-label="Footer" className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2"><Link href="/about" className="hover:text-forest hover:underline">About</Link><Link href="/guidelines" className="hover:text-forest hover:underline">Community guidelines</Link><Link href="/privacy" className="hover:text-forest hover:underline">Privacy</Link><Link href="/terms" className="hover:text-forest hover:underline">Terms</Link><Link href="/contact" className="hover:text-forest hover:underline">Contact</Link></nav><p>Speakwell is a peer-support and practice tool. It does not diagnose or replace professional speech therapy.</p><p className="mt-3">© Speakwell</p></footer>
    </main>
  );
}
