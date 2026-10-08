import Link from "next/link";
import { cookies } from "next/headers";
import path from "node:path";
import { createFileCommitCache } from "@/lib/github/commit-cache";

export const dynamic = "force-dynamic";

export default async function AcquiredDataPage({ searchParams }: { searchParams: Promise<{ branches?: string; repository?: string; page?: string }> }) {
  const params = await searchParams;
  const scope = params.branches === "all" ? "all" : "default";
  const ja = (await cookies()).get("github-monitor-locale")?.value !== "en";
  const cache = await createFileCommitCache(scope === "all" ? path.join(process.cwd(), ".next", "cache", "github-monitor", "commits-all-branches.json") : undefined).read();
  const excluded = new Set((process.env.GITHUB_EXCLUDED_REPOS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean));
  const names = Object.keys(cache.repositories).filter(name => !excluded.has(name.toLowerCase()) && !excluded.has(name.split("/")[1]?.toLowerCase())).sort();
  const selected = params.repository && names.includes(params.repository) ? params.repository : names[0];
  const state = selected ? cache.repositories[selected] : undefined;
  const commits = Object.values(state?.commits ?? {}).sort((a, b) => b.authoredAt.localeCompare(a.authoredAt));
  const pages = Math.max(1, Math.ceil(commits.length / 50));
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pages) : 1;
  const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(ja ? "ja-JP" : "en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
  const href = (nextPage: number) => `/data?${new URLSearchParams({ branches: scope, repository: selected ?? "", page: String(nextPage) })}`;
  const status = !state ? "—" : state.lastFailure?.status === 409 ? (ja ? "集計対象外" : "Excluded") : state.lastFailure ? (ja ? "取得失敗・保存済みデータ" : "Fetch failed; saved data") : state.partial || !state.lastSyncedAt ? (ja ? "確認途中" : "Incomplete") : (ja ? "取得完了" : "Complete");

  return <main className="shell min-h-screen py-8 sm:py-12">
    <Link href={scope === "all" ? "/?branches=all" : "/"} prefetch={false} className="muted text-sm">← {ja ? "ダッシュボードへ戻る" : "Back to dashboard"}</Link>
    <h1 className="mt-6 text-2xl font-semibold">{ja ? "取得済みデータ" : "Fetched data"}</h1>
    <p className="muted mt-2 text-sm leading-6">{ja ? "保存済みのcommitと取得状況を確認できます。更新・続きの取得はダッシュボードで行ってください。" : "Inspect saved commits and fetching status. Refresh or continue fetching from the dashboard."}</p>
    <nav className="mt-4 flex flex-wrap gap-3" aria-label={ja ? "ブランチ対象" : "Branch scope"}>
      {(["default", "all"] as const).map(value => <Link key={value} href={`/data?${new URLSearchParams({ branches: value, ...(selected ? { repository: selected } : {}) })}`} className="chip control" aria-current={scope === value ? "page" : undefined} data-active={scope === value}>{ja ? value === "all" ? "全ブランチ" : "デフォルトブランチ" : value === "all" ? "All branches" : "Default branch"}</Link>)}
    </nav>
    {!names.length ? <p className="panel mt-6 p-6">{ja ? "この対象の保存済みデータはありません。ダッシュボードで取得してください。" : "No saved data for this scope. Fetch data from the dashboard."}</p> : <>
      <form action="/data" className="mt-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="branches" value={scope} />
        <label className="grid min-w-0 gap-2 text-sm">{ja ? "リポジトリ" : "Repository"}<select name="repository" defaultValue={selected} className="control chip max-w-full">{names.map(name => <option key={name} value={name}>{name} ({Object.keys(cache.repositories[name].commits).length})</option>)}</select></label>
        <button className="chip control" type="submit">{ja ? "表示" : "Show"}</button>
      </form>
      <section className="panel mt-6 p-5 text-sm leading-6" aria-label={ja ? "取得状況" : "Fetching status"}>
        <h2 className="break-words font-semibold">{selected}</h2>
        <p className="mt-2">{status} · {ja ? `保存済みcommit ${commits.length}件` : `${commits.length} saved commits`}</p>
        <p className="muted">{ja ? "最終同期完了" : "Last completed sync"}: {date(state?.lastSyncedAt)} JST</p>
        <p className="muted">{ja ? "最終取得試行" : "Last fetch attempt"}: {date(state?.lastAttemptedAt)} JST</p>
        {scope === "all" && state?.branchProgress && <p>{ja ? "ブランチ確認" : "Branches checked"}: {state.branchProgress.completedBranches} / {state.branchProgress.totalBranches ?? (ja ? "総数未確定" : "total unknown")}{state.branchProgress.totalBranches !== null && ` (${ja ? "残り" : "remaining"} ${state.branchProgress.totalBranches - state.branchProgress.completedBranches})`}</p>}
        {state?.lastFailure && <p>{ja ? "前回の取得エラー" : "Last fetch error"}: {state.lastFailure.status === null ? (ja ? "通信エラーなど" : "Network or other error") : `GitHub API ${state.lastFailure.status}`} · {date(state.lastFailure.at)} JST</p>}
      </section>
      <section className="panel mt-6 overflow-hidden p-5">
        <h2 className="font-semibold">{ja ? "commit一覧（新しい順）" : "Commits (newest first)"}</h2>
        <p className="muted mt-1 text-xs">{ja ? "日時は作者日時・JST。件数は保存済み分のみです。" : "Dates use author time in JST. Counts include saved data only."}</p>
        {!commits.length ? <p className="muted mt-4 text-sm">{ja ? "取得済みcommitはありません。確認途中の場合は未取得の可能性があります。" : "No saved commits. Fetching may still be incomplete."}</p> : <ul className="mt-4 divide-y divide-[var(--line)]">{commits.slice((page - 1) * 50, page * 50).map(commit => <li key={commit.sha} className="py-3">
          <a href={commit.url} target="_blank" rel="noreferrer" className="block break-words text-sm font-medium hover:text-[var(--accent)]">{commit.message.split("\n")[0]}</a>
          <p className="muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs"><span>{date(commit.authoredAt)} JST</span><span className="mono">{commit.sha.slice(0, 7)}</span><span>+{commit.additions} / −{commit.deletions}</span><span>{commit.changedFiles} {ja ? "ファイル" : "files"}</span></p>
        </li>)}</ul>}
        <nav className="mt-4 flex flex-wrap items-center gap-4 text-sm" aria-label={ja ? "commit一覧のページ" : "Commit pages"}>
          {page > 1 && <Link href={href(page - 1)} className="control chip">{ja ? "前へ" : "Previous"}</Link>}
          <span className="muted">{page} / {pages}</span>
          {page < pages && <Link href={href(page + 1)} className="control chip">{ja ? "次へ" : "Next"}</Link>}
        </nav>
      </section>
    </>}
  </main>;
}
