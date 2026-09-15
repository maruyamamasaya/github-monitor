import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { PreferencesProvider } from "@/features/preferences/preferences-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "github-monitor",
  description: "Your GitHub development activity, at a glance.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await cookies()).get("github-monitor-locale")?.value === "en" ? "en" : "ja";
  return <html lang={locale} suppressHydrationWarning>
    <body>
      <Script id="display-preferences" strategy="beforeInteractive">{`try{const t=localStorage.getItem('github-monitor-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark')}catch{}`}</Script>
      <PreferencesProvider initialLocale={locale}>{children}</PreferencesProvider>
    </body>
  </html>;
}
