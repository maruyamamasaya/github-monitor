import type { Metadata } from "next";
import Script from "next/script";
import { PreferencesProvider } from "@/features/preferences/preferences-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "github-monitor",
  description: "Your GitHub development activity, at a glance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <body>
      <Script id="display-preferences" strategy="beforeInteractive">{`try{const t=localStorage.getItem('github-monitor-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');document.documentElement.lang=localStorage.getItem('github-monitor-locale')==='ja'?'ja':'en'}catch{}`}</Script>
      <PreferencesProvider>{children}</PreferencesProvider>
    </body>
  </html>;
}
