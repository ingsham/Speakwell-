import Link from "next/link";
import { Mic, Users, MessageCircle, Heart } from "lucide-react";

const features = [
  { icon: Mic, title: "Practise your way", text: "Record yourself privately. Recordings stay on your device unless you choose to share." },
  { icon: Users, title: "Practice partners", text: "Invite people to practise together, with clear consent at every step." },
  { icon: MessageCircle, title: "Private messages", text: "Chat one-to-one once there is mutual connection. Block and report anytime." },
  { icon: Heart, title: "Communities", text: "Join or create groups with guidelines and moderators." },
];
export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold text-forest">Speakwell</span>
        <nav aria-label="Main" className="flex items-center gap-3">
          <Link href="/login" className="btn btn-ghost">Log in</Link>
          <Link href="/signup" className="btn btn-primary">Get started</Link>
        </nav>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-forest sm:text-5xl">Your voice. Your pace. Your people.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Everyone deserves space to speak. Speakwell is a safe, low-cost place for people who stammer to practise, connect and build confidence, with no pressure to be fluent.
        </p>
        <Link href="/signup" className="btn btn-primary mt-8">Start practising</Link>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-4" aria-label="Features">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card">
            <Icon className="mb-3 h-6 w-6 text-forest" aria-hidden />
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
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
