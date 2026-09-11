import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "github-monitor",
  description: "Your GitHub development activity, at a glance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
