import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Community guidelines · Speakwell" };
export default function Page() {
  return <LegalPage settingKey="guidelines" title="Community guidelines" fallback={"Be kind. Never mock or imitate how someone speaks. No pressure to be fluent. Respect privacy. No harassment, hate or spam. Report anything that feels unsafe."} />;
}
