import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDashboard } from "@/lib/github/dashboard";

export default async function RepositoryPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const data = await loadDashboard();
  const item = data.repositories.find((entry) => entry.repository.owner.toLowerCase() === owner.toLowerCase() && entry.repository.name.toLowerCase() === repo.toLowerCase());
  if (!item) notFound();

  const month = item.metrics.month;
  return <main className="shell">
    <nav className="border-b hairline pb-5"><Link href="/" className="mono muted text-xs transition-colors hover:text-[var(--accent)]">← SIGNAL ROOM</Link></nav>
    <header className="enter mt-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="eyebrow">Repository detail</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-6xl">{item.repository.name}</h1><p className="muted mt-4 text-sm">{item.repository.owner} · {item.repository.private ? "Private" : "Public"} · {item.repository.language ?? "No primary language"}</p></div>
      <a className="control chip inline-flex w-fit items-center hover:border-[var(--accent)] hover:text-white" href={item.repository.url} target="_blank" rel="noreferrer">Open on GitHub ↗</a>
    </header>
    <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["30d commits", month.commits], ["Changed lines", month.changedLines], ["Active days", month.activeDays], ["Activity score", month.score.toFixed(1)]].map(([label, value]) => <div key={label} className="panel p-5"><p className="muted text-xs">{label}</p><p className="metric-value mt-2 text-3xl font-semibold">{new Intl.NumberFormat("en-US").format(Number(value))}</p></div>)}
    </section>
    <section className="panel mt-10 overflow-hidden">
      <div className="flex items-end justify-between border-b hairline p-5 sm:p-7"><div><p className="eyebrow">Commit stream</p><h2 className="mt-2 text-lg font-semibold">Recent 30 days</h2></div><span className="mono muted text-xs">{item.commits.length} entries</span></div>
      {item.commits.length === 0 ? <p className="muted p-12 text-center text-sm">期間内のcommitはありません。</p> : <div>{item.commits.map((commit) => <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer" className="group block border-b hairline p-5 transition-colors last:border-0 hover:bg-white/[.035] sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row"><p className="max-w-3xl text-sm font-medium leading-6 transition-colors group-hover:text-[var(--accent)]">{commit.message}</p><time className="mono muted shrink-0 text-xs">{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(commit.authoredAt))}</time></div><div className="mono mt-3 flex flex-wrap gap-4 text-xs"><code className="muted">{commit.sha.slice(0, 7)}</code><span className="text-[var(--accent)]">+{commit.additions}</span><span className="text-[var(--red)]">−{commit.deletions}</span><span className="muted">{commit.changedFiles} files</span></div></a>)}</div>}
    </section>
  </main>;
}
