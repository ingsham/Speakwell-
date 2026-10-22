export const metadata = { title: "About · Speakwell" };
export default function About() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">About Speakwell</h1>
      <div className="card mt-6 space-y-3 leading-relaxed">
        <p>Speakwell is a free, supportive place for people who stammer to practise real-life conversations, meet others and build confidence at their own pace.</p>
        <p>You can rehearse situations like interviews and phone calls, record yourself privately, practise with a partner, join communities and chat with people you trust.</p>
        <p className="text-sm text-muted">Speakwell is a peer-support and practice tool. It does not cure stammering, diagnose, or replace professional speech therapy.</p>
      </div>
    </main>
  );
}
