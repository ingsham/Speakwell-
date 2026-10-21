import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Speakwell — Your voice. Your pace. Your people.",
  description: "A supportive community and practice space for people who stammer. Not a cure or medical service.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
