"use client";

import { usePreferences } from "@/features/preferences/preferences-provider";

export function RefreshStatus({ initial = false }: { initial?: boolean }) {
  const { locale } = usePreferences();
  return <div role="status" className="chip flex items-center gap-3 rounded-xl px-4 py-3 text-sm">
    <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    <div><p className="font-semibold">{locale === "ja" ? "更新中…" : "Refreshing…"}</p><p className="muted text-xs">{locale === "ja" ? (initial ? "開発活動データを読み込んでいます。" : "開発活動データを確認しています。表示中のデータは更新完了後に切り替わります。") : (initial ? "Loading development activity data." : "Checking development activity data. Current data stays visible until the refresh completes.")}</p></div>
  </div>;
}
