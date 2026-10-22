export const metadata = { title: "Contact · Speakwell" };
export default function Contact() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold text-forest">Contact</h1>
      <div className="card mt-6 space-y-3 leading-relaxed">
        <p>To report a person, post, comment or community, use the <strong>Report</strong> link next to it. Moderators review every report.</p>
        <p className="text-sm text-muted">Founder: add a support email address here before launch.</p>
      </div>
    </main>
  );
}
