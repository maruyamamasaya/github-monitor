"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePreferences } from "@/features/preferences/preferences-provider";
import type { RepositoryActivity } from "@/types/activity";

export function RepositoryDetail({ item }: { item: RepositoryActivity }) {
  const { locale } = usePreferences();
  const ja = locale === "ja";
  const month = item.metrics.month;
  const number = new Intl.NumberFormat(ja ? "ja-JP" : "en-US");
  const date = useMemo(() => new Intl.DateTimeFormat(ja ? "ja-JP" : "en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }), [ja]);
  const labels = ja ? ["直近30日間のコミット", "変更行数", "活動日数", "活動スコア"] : ["30d commits", "Changed lines", "Active days", "Activity score"];
  const values = [month.commits, month.changedLines, month.activeDays, month.score.toFixed(1)];

  return <main className="shell">
    <nav className="border-b hairline pb-5"><Link href="/" className="mono muted text-xs transition-colors hover:text-[var(--accent)]">← {ja ? "開発状況ダッシュボードへ戻る" : "SIGNAL ROOM"}</Link></nav>
    <header className="enter mt-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="eyebrow">{ja ? "リポジトリ詳細" : "Repository detail"}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-6xl">{item.repository.name}</h1><p className="muted mt-4 text-sm">{item.repository.owner} · {item.repository.private ? (ja ? "非公開" : "Private") : (ja ? "公開" : "Public")} · {item.repository.language ?? (ja ? "主要言語なし" : "No primary language")}</p></div>
      <a className="control chip inline-flex w-fit items-center hover:border-[var(--accent)] hover:text-[var(--text)]" href={item.repository.url} target="_blank" rel="noreferrer">{ja ? "GitHubで開く" : "Open on GitHub"} ↗</a>
    </header>
    <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">{labels.map((label, index) => <div key={label} className="panel p-5"><p className="muted text-xs">{label}</p><p className="metric-value mt-2 text-3xl font-semibold">{number.format(Number(values[index]))}</p></div>)}</section>
    <section className="panel mt-10 overflow-hidden">
      <div className="flex items-end justify-between border-b hairline p-5 sm:p-7"><div><p className="eyebrow">{ja ? "コミット一覧" : "Commit stream"}</p><h2 className="mt-2 text-lg font-semibold">{ja ? "最近30日間" : "Recent 30 days"}</h2></div><span className="mono muted text-xs">{item.commits.length} {ja ? "件" : "entries"}</span></div>
      {item.commits.length === 0 ? <p className="muted p-12 text-center text-sm">{ja ? "期間内のコミットはありません。" : "No commits in this period."}</p> : <div>{item.commits.map((commit) => <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer" className="group block border-b hairline p-5 transition-colors last:border-0 hover:bg-[var(--panel-hover)] sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row"><p className="max-w-3xl text-sm font-medium leading-6 transition-colors group-hover:text-[var(--accent)]">{commit.message}</p><time className="mono muted shrink-0 text-xs">{date.format(new Date(commit.authoredAt))}</time></div><div className="mono mt-3 flex flex-wrap gap-4 text-xs"><code className="muted">{commit.sha.slice(0, 7)}</code><span className="text-[var(--accent)]">+{commit.additions}</span><span className="text-[var(--red)]">−{commit.deletions}</span><span className="muted">{commit.changedFiles} {ja ? "ファイル" : "files"}</span></div></a>)}</div>}
    </section>
  </main>;
}
