"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChangeCategory, DashboardData, PeriodKey } from "@/types/activity";
import { DailyChart, type TrendMetric } from "./daily-chart";

const periods: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 Days" },
  { key: "month", label: "30 Days" },
];
const fmt = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const dateFmt = (value: string | null) => value
  ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "—";

type SortKey = "commits" | "changedLines" | "changedFiles" | "activeDays" | "score" | "momentum" | "pushedAt";
const metricLabels: Record<TrendMetric, string> = { commits: "Commits", changedLines: "Lines", changedFiles: "Files", score: "Score" };

function SectionHeading({ index, title, sub }: { index: string; title: string; sub?: string }) {
  return <div className="mb-5 flex items-end justify-between gap-4">
    <div className="flex items-center gap-3"><span className="mono text-xs text-[var(--accent)]">{index}</span><h2 className="text-base font-semibold tracking-[-.01em]">{title}</h2></div>
    {sub && <span className="muted hidden text-xs sm:block">{sub}</span>}
  </div>;
}

function Panel({ title, sub, className = "", children }: { title: string; sub?: string; className?: string; children: React.ReactNode }) {
  return <article className={`panel min-w-0 p-5 ${className}`}>
    <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-[-.01em]">{title}</h3>
      {sub && <span className="muted text-right text-xs">{sub}</span>}
    </div>
    <div className="relative z-10">{children}</div>
  </article>;
}

function Bars({ items }: { items: { label: string; value: number; text: string; color?: string }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <div className="space-y-3">{items.map((item) => <div key={item.label}>
    <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate">{item.label}</span><span className="mono muted tabular-nums">{item.text}</span></div>
    <div className="h-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${item.value / max * 100}%`, background: item.color ?? "var(--accent)" }} /></div>
  </div>)}</div>;
}

function MetricCard({ label, value, featured = false }: { label: string; value: string; featured?: boolean }) {
  return <div className={`panel panel-interactive relative px-4 py-4 ${featured ? "border-[color:rgb(183_243_74_/_25%)]" : ""}`}>
    <p className="muted text-xs font-medium">{label}</p>
    <p className={`metric-value mt-2 text-2xl font-semibold ${featured ? "text-[var(--accent)]" : ""}`}>{value}</p>
  </div>;
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("commits");
  const [trendDays, setTrendDays] = useState<30 | 90>(30);
  const [sort, setSort] = useState<SortKey>("score");
  const [changeFilter, setChangeFilter] = useState<"all" | ChangeCategory>("all");
  const summary = data.analysis.summaries[period];
  const focus = data.analysis.focus[period];
  const momentum = data.analysis.momentum;
  const anomaly = data.analysis.anomaly;

  const rows = useMemo(() => [...data.repositories].sort((a, b) => {
    if (sort === "momentum") return momentum[b.repository.fullName].value - momentum[a.repository.fullName].value;
    if (sort === "pushedAt") return String(b.repository.pushedAt).localeCompare(String(a.repository.pushedAt));
    return b.metrics[period][sort] - a.metrics[period][sort];
  }), [data.repositories, momentum, period, sort]);

  const shares = useMemo(() => {
    const active = [...data.repositories].filter((repository) => repository.metrics[period].score > 0).sort((a, b) => b.metrics[period].score - a.metrics[period].score);
    const total = active.reduce((sum, repository) => sum + repository.metrics[period].score, 0);
    const top = active.slice(0, 5).map((repository) => ({ label: repository.repository.name, value: repository.metrics[period].score, text: `${total ? Math.round(repository.metrics[period].score / total * 100) : 0}%` }));
    const other = active.slice(5).reduce((sum, repository) => sum + repository.metrics[period].score, 0);
    return other > 0 ? [...top, { label: "Other", value: other, text: `${Math.round(other / total * 100)}%` }] : top;
  }, [data.repositories, period]);

  const kpis: [string, string][] = [
    ["Commits", fmt.format(summary.commits)], ["Changed lines", compact.format(summary.changedLines)],
    ["Files changed", fmt.format(summary.changedFiles)], ["Active repos", String(focus.activeRepositories)],
    ["Active days", String(data.analysis.activeDays[period])], ["Commits / day", data.analysis.activeDays[period] ? (summary.commits / data.analysis.activeDays[period]).toFixed(1) : "0"],
    ["Top repo share", `${focus.topShare}%`], ["Current streak", `${data.analysis.streak}d`],
  ];
  const filteredEvents = changeFilter === "all" ? anomaly.events : anomaly.events.filter((event) => event.category === changeFilter);
  const heat = data.dailyActivity;
  const maxHeat = Math.max(1, ...heat.map((day) => day.score));
  const slots = ["00–06", "06–12", "12–18", "18–24"];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxHour = Math.max(1, ...data.analysis.dayHour[period].map((cell) => cell.commits));
  const maxWeekday = Math.max(1, ...anomaly.weekdayActivity);
  const pulseTone = anomaly.pulse.level === "VERY HIGH" ? "var(--orange)" : anomaly.pulse.level === "HIGH" ? "var(--accent)" : anomaly.pulse.level === "LOW" ? "var(--cyan)" : "var(--text)";

  return <main className="shell cockpit">
    <header className="enter flex flex-col gap-6 border-b hairline pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-4 flex items-center gap-2.5"><span className="status-dot h-2 w-2 rounded-full bg-[var(--accent)]" /><span className="eyebrow">github monitor · live signal</span></div>
        <h1 className="max-w-3xl text-3xl font-semibold leading-none tracking-[-.055em] sm:text-5xl">Development<br className="sm:hidden" /> signal room</h1>
        <p className="muted mt-4 max-w-xl text-sm sm:text-base">変化、集中度、継続性を横断して、いま何に注力しているかを読む。</p>
      </div>
      <div className="chip flex w-fit rounded-[10px] p-1" aria-label="集計期間">{periods.map((item) => <button key={item.key} onClick={() => setPeriod(item.key)} aria-pressed={period === item.key} data-active={period === item.key} className="control">{item.label}</button>)}</div>
    </header>

    {data.warnings.length > 0 && <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">Partial data · {data.warnings.length} repository request failed</div>}

    <section className="enter enter-delay-1 mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <article className="panel relative min-h-[270px] p-6 sm:p-8">
        <div className="accent-rule absolute left-0 top-0 h-[2px] w-2/3" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-10">
          <div className="flex items-center justify-between"><span className="eyebrow">Primary signal</span><span className="mono muted text-xs">vs prior 7-day avg</span></div>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-sm font-medium uppercase tracking-[.18em]" style={{ color: pulseTone }}>{anomaly.pulse.level} activity</p><p className="metric-value mt-2 text-6xl font-semibold sm:text-7xl">{anomaly.pulse.todayCommits}<span className="ml-2 text-lg tracking-normal text-[var(--muted)]">commits</span></p><p className="muted mt-3 text-sm">{anomaly.pulse.changePercent === null ? "New activity from a zero baseline" : `${anomaly.pulse.changePercent >= 0 ? "+" : ""}${anomaly.pulse.changePercent}% · baseline ${anomaly.pulse.baseline}/day`}</p></div>
            <div className="grid grid-cols-2 gap-8 border-t hairline pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><div><p className="metric-value text-3xl font-semibold">{anomaly.pulse.activeRepositories}</p><p className="muted mt-1 text-xs">active repos</p></div><div><p className="metric-value text-3xl font-semibold">{focus.score}</p><p className="muted mt-1 text-xs">focus score</p></div></div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t hairline pt-5 sm:grid-cols-4">{anomaly.dayOverDay.map((day) => <div key={day.label}><p className="muted text-xs">{day.label}</p><p className="mono mt-1 text-sm">{compact.format(day.yesterday)} <span className="faint">→</span> <b>{compact.format(day.today)}</b></p></div>)}</div>
        </div>
      </article>

      <Panel title="Recent changes" sub={`${filteredEvents.length} signals`} className="min-h-[270px]">
        <div className="mb-4 flex flex-wrap gap-1.5">{(["all", "repository", "activity", "commit", "pattern"] as const).map((filter) => <button key={filter} onClick={() => setChangeFilter(filter)} aria-pressed={changeFilter === filter} data-active={changeFilter === filter} className="control chip min-h-0 px-2.5 py-1.5 text-[.6875rem] uppercase">{filter}</button>)}</div>
        <div className="space-y-1">{filteredEvents.length ? filteredEvents.slice(0, 5).map((event) => <div key={event.id} className="group flex min-w-0 gap-3 border-t hairline py-3 first:border-t-0">
          <span className="mono mt-0.5 text-[.6875rem]" style={{ color: event.severity === "strong" ? "var(--orange)" : event.severity === "notable" ? "var(--violet)" : "var(--cyan)" }}>0{event.severity === "strong" ? 3 : event.severity === "notable" ? 2 : 1}</span>
          <div className="min-w-0"><p className="truncate text-sm font-medium transition-colors group-hover:text-[var(--accent)]">{event.title}</p><p className="muted mt-0.5 truncate text-xs">{event.description}</p></div>
        </div>) : <p className="muted py-8 text-center text-sm">No notable changes for this filter.</p>}</div>
      </Panel>
    </section>

    <section className="enter enter-delay-2 mt-10">
      <SectionHeading index="01" title="Period snapshot" sub={`${periods.find((item) => item.key === period)?.label} aggregate`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">{kpis.map(([label, value], index) => <MetricCard key={label} label={label} value={value} featured={index === 0} />)}</div>
    </section>

    <section className="enter enter-delay-2 mt-12">
      <SectionHeading index="02" title="Trajectory & focus" sub="Velocity and allocation of effort" />
      <div className="grid gap-4 xl:grid-cols-[1.55fr_.65fr]">
        <Panel title="Activity trajectory" sub={`${trendDays} days`}>
          <div className="mb-5 flex flex-wrap gap-1.5">{(["commits", "changedLines", "changedFiles", "score"] as TrendMetric[]).map((metric) => <button key={metric} onClick={() => setTrendMetric(metric)} data-active={trendMetric === metric} className="control chip min-h-0 py-1.5">{metricLabels[metric]}</button>)}<span className="ml-auto flex gap-1">{([30, 90] as const).map((daysCount) => <button key={daysCount} onClick={() => setTrendDays(daysCount)} data-active={trendDays === daysCount} className="control chip min-h-0 py-1.5">{daysCount}D</button>)}</span></div>
          <DailyChart data={data.dailyActivity.slice(-trendDays)} metric={trendMetric} />
        </Panel>
        <Panel title="Repository share" sub="Activity score">
          <div className="mb-6 flex h-2 overflow-hidden rounded-full bg-white/[.04]">{shares.map((share, index) => <div key={share.label} title={`${share.label} ${share.text}`} style={{ width: share.text, background: ["var(--accent)", "var(--cyan)", "var(--violet)", "var(--orange)", "#5f7182", "#3b4652"][index] }} />)}</div>
          <Bars items={shares.map((share, index) => ({ ...share, color: ["var(--accent)", "var(--cyan)", "var(--violet)", "var(--orange)", "#5f7182", "#3b4652"][index] }))} />
          <div className="mt-6 grid grid-cols-3 border-t hairline pt-5 text-center"><span><b className="metric-value text-xl">{focus.score}</b><small className="muted mt-1 block text-xs">Focus</small></span><span><b className="metric-value text-xl">{focus.topThreeShare}%</b><small className="muted mt-1 block text-xs">Top 3</small></span><span><b className="metric-value text-xl">{focus.activeRepositories}</b><small className="muted mt-1 block text-xs">Active</small></span></div>
        </Panel>
      </div>
    </section>

    <section className="enter enter-delay-3 mt-12">
      <SectionHeading index="03" title="Rhythm & momentum" sub="90-day behavioral pattern" />
      <div className="grid gap-4 xl:grid-cols-[1.55fr_.65fr]">
        <Panel title="90-day activity map" sub="Hover for daily detail">
          <div className="scroll-fade grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-2">{heat.map((day) => <div key={day.date} className="h-4 w-4 rounded-[3px] transition-transform hover:scale-125" title={`${day.date} · ${day.commits} commits · ${fmt.format(day.changedLines)} lines · ${day.activeRepositories} repos`} style={{ background: day.score ? `color-mix(in srgb, var(--accent) ${20 + day.score / maxHeat * 80}%, var(--panel-strong))` : "var(--panel-strong)" }} />)}</div>
          <div className="muted mono mt-3 flex items-center gap-2 text-[.6875rem]"><span>LESS</span><span className="h-2 w-2 bg-[var(--panel-strong)]" /><span className="h-2 w-2 bg-[color:color-mix(in_srgb,var(--accent)_35%,var(--panel-strong))]" /><span className="h-2 w-2 bg-[color:color-mix(in_srgb,var(--accent)_65%,var(--panel-strong))]" /><span className="h-2 w-2 bg-[var(--accent)]" /><span>MORE</span></div>
        </Panel>
        <Panel title="Repository momentum" sub="7d / prior avg">
          <div className="grid grid-cols-3 gap-4">{(["HOT", "STABLE", "COOLING"] as const).map((band) => <div key={band}><p className="mono mb-3 text-[.6875rem] font-bold" style={{ color: band === "HOT" ? "var(--orange)" : band === "COOLING" ? "var(--cyan)" : "var(--accent)" }}>{band}</p>{rows.filter((row) => momentum[row.repository.fullName].band === band).slice(0, 3).map((row) => <div key={row.repository.id} className="mb-2.5"><p className="truncate text-xs">{row.repository.name}</p><p className="mono muted text-[.6875rem]">{momentum[row.repository.fullName].value}x</p></div>)}</div>)}</div>
        </Panel>
      </div>
    </section>

    <section className="mt-12">
      <SectionHeading index="04" title="Repository matrix" sub={`${rows.length} repositories · select a heading to sort`} />
      <div className="panel scroll-fade overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead className="mono muted bg-black/20 text-[.6875rem] uppercase tracking-wider"><tr><th className="px-5 py-4">Repository</th>{[["Today", "commits"], ["7d", "commits"], ["30d", "commits"], ["Commits", "commits"], ["+", null], ["−", null], ["Files", "changedFiles"], ["Days", "activeDays"], ["Score", "score"], ["Momentum", "momentum"], ["Last push", "pushedAt"]].map(([label, key], index) => <th key={`${label}-${index}`} className="px-3 py-4"><button disabled={!key} onClick={() => key && setSort(key as SortKey)} className={key ? "hover:text-white" : ""}>{label}{sort === key ? " ↓" : ""}</button></th>)}</tr></thead>
          <tbody>{rows.map((row) => { const metrics = row.metrics[period]; const movement = momentum[row.repository.fullName]; return <tr key={row.repository.id} className="border-t hairline transition-colors hover:bg-white/[.035]"><td className="px-5 py-4"><Link href={`/repositories/${encodeURIComponent(row.repository.owner)}/${encodeURIComponent(row.repository.name)}`} className="text-sm font-semibold hover:text-[var(--accent)]">{row.repository.name}</Link><span className="muted ml-2">{row.repository.language ?? "—"}</span></td><td className="mono px-3">{row.metrics.today.commits}</td><td className="mono px-3">{row.metrics.week.commits}</td><td className="mono px-3">{row.metrics.month.commits}</td><td className="mono px-3">{metrics.commits}</td><td className="mono px-3 text-[var(--accent)]">+{metrics.additions}</td><td className="mono px-3 text-[var(--red)]">−{metrics.deletions}</td><td className="mono px-3">{metrics.changedFiles}</td><td className="mono px-3">{metrics.activeDays}</td><td className="mono px-3 font-bold">{metrics.score.toFixed(1)}</td><td className="mono px-3">{movement.value}x</td><td className="muted whitespace-nowrap px-3">{dateFmt(row.repository.pushedAt)}</td></tr>; })}</tbody>
        </table>
      </div>
    </section>

    <section className="mt-12">
      <SectionHeading index="05" title="Behavioral profile" sub="Supporting diagnostics" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Commit size"><Bars items={data.analysis.commitSizes[period].map((bucket) => ({ label: `${bucket.key} · ${bucket.label}`, value: bucket.count, text: String(bucket.count) }))} /></Panel>
        <Panel title="Day × hour"><div className="grid grid-cols-5 gap-1.5 text-center text-[.6875rem]"><span />{slots.map((slot) => <span key={slot} className="muted">{slot}</span>)}{days.flatMap((day, dayIndex) => [<span key={day} className="muted py-1.5 text-left">{day}</span>, ...data.analysis.dayHour[period].filter((cell) => cell.day === dayIndex).map((cell) => <span key={`${dayIndex}-${cell.slot}`} title={`${day} ${slots[cell.slot]}: ${cell.commits}`} className="rounded py-1.5" style={{ background: cell.commits ? `color-mix(in srgb, var(--cyan) ${18 + cell.commits / maxHour * 70}%, var(--panel-strong))` : "var(--panel-strong)" }}>{cell.commits}</span>)])}</div><div className="mt-5 border-t hairline pt-4"><p className="muted mb-2 text-xs">Active day pattern</p><div className="flex h-12 items-end gap-1.5">{days.map((day, index) => <div key={day} className="flex flex-1 flex-col items-center justify-end"><div className="w-full rounded-t-sm bg-[var(--cyan)]" style={{ height: `${Math.max(2, anomaly.weekdayActivity[index] / maxWeekday * 32)}px`, opacity: .35 + anomaly.weekdayActivity[index] / maxWeekday * .65 }} /><span className="muted mt-1 text-[.625rem]">{day}</span></div>)}</div></div></Panel>
        <Panel title="Language activity"><Bars items={data.analysis.languages[period].map((language) => ({ label: language.language, value: language.score, text: `${language.share}%`, color: "var(--violet)" }))} /></Panel>
        <Panel title="Week over week"><table className="w-full text-xs"><thead className="muted"><tr><th className="pb-2 text-left font-normal">Metric</th><th className="pb-2 font-normal">This</th><th className="pb-2 font-normal">Last</th><th className="pb-2 text-right font-normal">Δ</th></tr></thead><tbody>{data.analysis.weekComparison.map((row) => <tr key={row.key} className="border-t hairline"><td className="py-2.5">{row.label}</td><td className="mono text-center">{compact.format(row.current)}</td><td className="mono text-center">{compact.format(row.previous)}</td><td className="mono text-right" style={{ color: (row.change ?? 0) >= 0 ? "var(--accent)" : "var(--red)" }}>{row.change === null ? "NEW" : `${row.change >= 0 ? "+" : ""}${row.change}${row.absolute ? "" : "%"}`}</td></tr>)}</tbody></table><div className="mt-4 grid grid-cols-3 gap-2 border-t hairline pt-4 text-[.6875rem]">{[["Increase", anomaly.weekHighlights.increase], ["Decrease", anomaly.weekHighlights.decrease], ["Stable", anomaly.weekHighlights.stable]].map(([label, value]) => { const highlight = value as { repository: string; change: number } | undefined; return <span key={label as string} className="truncate"><i className="muted block not-italic">{label as string}</i>{highlight?.repository ?? "—"}</span>; })}</div></Panel>
      </div>
    </section>

    <footer className="muted mono mt-12 flex flex-col justify-between gap-2 border-t hairline pt-5 text-[.6875rem] sm:flex-row"><span>@{data.username} · Generated {dateFmt(data.generatedAt)} JST</span><span>API {data.rateLimit ? `${fmt.format(data.rateLimit.remaining)} / ${fmt.format(data.rateLimit.limit)}` : "unavailable"}</span></footer>
  </main>;
}
