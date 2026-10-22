import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Terms of Service · Speakwell" };
export default function Page() {
  return <LegalPage settingKey="terms" title="Terms of Service" fallback={"Terms of Service will be published here before launch."} />;
}
