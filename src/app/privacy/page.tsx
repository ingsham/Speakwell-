import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Privacy Policy · Speakwell" };
export default function Page() {
  return <LegalPage settingKey="privacy" title="Privacy Policy" fallback={"Privacy Policy will be published here before launch. Practice recordings are made in your browser and are not uploaded."} />;
}
