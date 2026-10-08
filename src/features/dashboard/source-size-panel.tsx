"use client";

import { useState, useTransition } from "react";
import { refreshSourceSize } from "@/app/actions/source-size";
import { usePreferences } from "@/features/preferences/preferences-provider";
import { SOURCE_CATEGORIES, type SourceSizeSummary } from "@/types/source-size";

export function SourceSizePanel({ initialData }: { initialData: SourceSizeSummary }) {
  const { locale } = usePreferences();
  const ja = locale === "ja";
  const [data, setData] = useState(initialData);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const fmt = new Intl.NumberFormat(ja ? "ja-JP" : "en-US");
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(ja ? "ja-JP" : "en-US", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
  const labels = ja ? { code: "コード", test: "テスト", docs: "文書", config: "設定" } : { code: "Code", test: "Tests", docs: "Docs", config: "Config" };
  const update = () => startTransition(async () => {
    setFailed(false);
    try {
      const result = await refreshSourceSize();
      if (result.data) setData(result.data);
      setFailed(result.error);
    } catch { setFailed(true); }
  });
  const waiting = data.pauseReason === "quota" || data.pauseReason === "rate-limit";
  const measured = data.repositories.some(repo => repo.totalFiles !== null || repo.checkedFiles > 0);
  return <section className="panel mt-8 p-6 sm:p-8" aria-labelledby="source-size-title">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 id="source-size-title" className="text-lg font-semibold">{ja ? "現在の総コード量" : "Current source size"}</h2><p className="muted mt-1 text-xs leading-5">{ja ? "デフォルトブランチの保存済み総行数。期間・作者・全ブランチ表示の選択には連動しません。" : "Saved line counts on default branches, independent of period, author and branch filters."}</p></div>
      <button type="button" className="chip control" onClick={update} disabled={pending} aria-busy={pending}>{pending ? (ja ? "集計中…" : "Counting…") : !data.complete && data.pauseReason === "budget" ? (ja ? "コード量の続きを取得" : "Continue source count") : (ja ? "コード量を更新" : "Update source size")}</button>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">{SOURCE_CATEGORIES.map(category => <div key={category}><p className="muted text-xs">{labels[category]}</p><p className="metric-value mt-1 text-2xl font-semibold">{measured ? `${fmt.format(data.lines[category])}${data.complete ? "" : "+"}` : "—"}<span className="muted ml-2 text-xs font-normal">{ja ? "行" : "lines"}</span></p></div>)}</div>
    <div className="mt-4 text-xs leading-6" role="status" aria-live="polite">
      {pending ? <p>{ja ? "最新ファイルを確認しています。変更のない内容は再利用します。" : "Checking current files; unchanged content is reused."}</p> : !data.lastAttemptedAt ? <p>{ja ? "未集計です。「コード量を更新」で集計を開始します。" : "Not counted yet. Select Update source size to start."}</p> : <p>{data.complete ? (ja ? "集計完了" : "Complete") : (ja ? "部分集計（＋は取得済み分のみ）" : "Partial count (+ means fetched data only)")} · {ja ? "ファイル確認" : "Files checked"} {fmt.format(data.checkedFiles)} / {data.totalFiles === null ? (ja ? "総数確認中" : "total unknown") : fmt.format(data.totalFiles)}{data.totalFiles !== null && !data.complete && ` · ${ja ? "残り" : "remaining"} ${fmt.format(data.totalFiles - data.checkedFiles)}`}</p>}
      {data.lastAttemptedAt && <p className="muted">{ja ? "最終取得試行" : "Last fetch attempt"}: {date(data.lastAttemptedAt)} JST</p>}
      {!pending && data.pauseReason === "budget" && <p>{ja ? "負荷を抑えるため取得を区切りました。待たずに「コード量の続きを取得」を押せます。" : "The request budget ended. You can continue immediately."}</p>}
      {!pending && waiting && <p>{ja ? "GitHubの取得制限・利用枠の回復を待ってから更新してください。再試行の目安" : "Wait for GitHub restrictions/quota to recover. Retry after"}: {date(data.resetAt)} JST</p>}
      {(failed || data.pauseReason === "fetch") && <p className="text-amber-500">{ja ? "取得できませんでした。保存済みの値を表示しています。再試行してください。" : "Fetching failed. Saved values are shown; please retry."}</p>}
    </div>
    <p className="muted mt-3 text-xs leading-5">{ja ? "空行・コメントを含む物理行数です。生成物・依存ライブラリ・lockfile・画像などは対象外。2 MiBを超えるファイルも除外します。Repository間の共通コードは各Repositoryで数えます。" : "Physical lines include blanks/comments. Generated files, dependencies, lockfiles, binaries and files over 2 MiB are excluded. Shared code counts separately in each repository."}</p>
    {!!data.repositories.length && <details className="mt-4 border-t hairline pt-4"><summary className="cursor-pointer text-sm">{ja ? "リポジトリ別の内訳・更新日時" : "Repository breakdown and update times"}</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Repository</th>{SOURCE_CATEGORIES.map(category => <th key={category} className="p-2">{labels[category]}</th>)}<th className="p-2">{ja ? "取得状況" : "Status"}</th><th className="p-2">{ja ? "集計完了日時（JST）" : "Completed (JST)"}</th></tr></thead><tbody>{data.repositories.map(repo => <tr key={repo.repository} className="border-t hairline"><th className="p-2 font-normal">{repo.repository}<span className="muted block">{repo.branch}</span></th>{SOURCE_CATEGORIES.map(category => <td key={category} className="p-2">{repo.checkedFiles || repo.complete ? fmt.format(repo.lines[category]) : "—"}{!repo.complete && repo.checkedFiles > 0 ? "+" : ""}</td>)}<td className="p-2">{repo.error === "empty" ? (ja ? "空のリポジトリ" : "Empty repository") : repo.error === "tree-limit" ? (ja ? "ファイル一覧の上限" : "Tree limit") : repo.error ? (ja ? "取得失敗" : "Fetch failed") : repo.complete ? (ja ? "完了" : "Complete") : (ja ? "確認途中" : "Incomplete")}<span className="muted block">{repo.checkedFiles} / {repo.totalFiles ?? "?"}</span>{repo.oversizedFiles > 0 && <span className="muted block">{ja ? "サイズ上限で除外" : "Oversized excluded"}: {repo.oversizedFiles}</span>}</td><td className="p-2 whitespace-nowrap">{date(repo.lastUpdatedAt)}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
