"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type Locale = "en" | "ja";
export type Theme = "dark" | "light";

type Preferences = {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("github-monitor-theme");
    const initialTheme: Theme = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLocaleState(initialLocale);
      setThemeState(initialTheme);
      document.documentElement.lang = initialLocale;
      document.documentElement.dataset.theme = initialTheme;
    });
    return () => { cancelled = true; };
  }, [initialLocale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("github-monitor-locale", next);
    document.documentElement.lang = next;
  };
  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem("github-monitor-theme", next);
    document.documentElement.dataset.theme = next;
  };

  return <PreferencesContext value={{ locale, theme, setLocale, setTheme }}>
    {children}
    <PreferencesControls />
  </PreferencesContext>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}

function PreferencesControls() {
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const pathname = usePathname();
  const isJapanese = locale === "ja";
  return <aside className="preferences" aria-label={isJapanese ? "表示設定" : "Display settings"}>
    <a className="preference-button" href={`/preferences/locale/${isJapanese ? "en" : "ja"}?returnTo=${encodeURIComponent(pathname)}`} onClick={() => setLocale(isJapanese ? "en" : "ja")} aria-label={isJapanese ? "英語に切り替える" : "Switch to Japanese"}>
      <span aria-hidden="true">文</span><span>{isJapanese ? "English" : "日本語"}</span>
    </a>
    <button className="preference-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? (isJapanese ? "ライトモードに切り替える" : "Switch to light mode") : (isJapanese ? "ダークモードに切り替える" : "Switch to dark mode")}>
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? (isJapanese ? "ライト" : "Light") : (isJapanese ? "ダーク" : "Dark")}</span>
    </button>
  </aside>;
}
