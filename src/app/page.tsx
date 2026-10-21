import Link from "next/link";
import { Mic, Users, MessageCircle, Heart } from "lucide-react";
import { scenarios } from "@/lib/scenarios";

const features = [
  { icon: Mic, title: "Practise your way", text: "Guided real-life scenarios. Record yourself privately; recordings stay on your device.", live: true },
  { icon: Users, title: "Practice partners", text: "Invite people to practise together, with clear consent at every step.", live: false },
  { icon: MessageCircle, title: "Private messages", text: "Chat one-to-one once there is mutual connection. Block and report anytime.", live: false },
  { icon: Heart, title: "Communities", text: "Join or create groups with guidelines and moderators.", live: false },
];
export default function Home() {
  return (
    <main>
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-forest sm:text-5xl">Your voice. Your pace. Your people.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Everyone deserves space to speak. Speakwell is a safe, low-cost place for people who stammer to practise, connect and build confidence, with no pressure to be fluent.
        </p>
        <Link href="/signup" className="btn btn-primary mt-8">Start practising</Link>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-4" aria-label="Features">
        {features.map(({ icon: Icon, title, text, live }) => (
          <div key={title} className="card">
            <Icon className="mb-3 h-6 w-6 text-forest" aria-hidden />
            <h2 className="font-semibold">{title}{!live && <span className="ml-2 rounded-full bg-mint px-2 py-0.5 align-middle text-xs font-medium text-forest">Coming soon</span>}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16" aria-labelledby="sc">
        <h2 id="sc" className="text-2xl font-bold text-forest">Practise real situations</h2>
        <p className="mt-1 text-muted">Eight guided scenarios, free to use.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {scenarios.map((s) => (
            <Link key={s.slug} href={`/practice/${s.slug}`} className="card p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="text-2xl" aria-hidden>{s.emoji}</span>
              <p className="mt-2 text-sm font-semibold text-forest">{s.title}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-xl2 bg-mint p-6 text-sm text-forest">
          Speakwell is a peer-support and practice tool. It does not cure stammering, diagnose, or replace professional speech therapy.
        </div>
      </section>
      <footer className="border-t border-forest/10 py-8 text-center text-sm text-muted">
        © Speakwell · Guidelines, Privacy and Terms pages are still to be written.
      </footer>
    </main>
  );
}
