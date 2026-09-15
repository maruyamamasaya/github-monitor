"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePreferences } from "@/features/preferences/preferences-provider";
import type { ChangeCategory, ChangeEvent, DashboardData, PeriodKey } from "@/types/activity";
import { DailyChart, type TrendMetric } from "./daily-chart";

const periods: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 Days" },
  { key: "month", label: "30 Days" },
];
type SortKey = "commits" | "changedLines" | "changedFiles" | "activeDays" | "score" | "momentum" | "pushedAt";

const ui = {
  en: { tagline: "Read what you are focused on now through change, concentration, and continuity.", period: "Time range", primary: "Primary signal", baseline: "vs prior 7-day avg", activity: "activity", commits: "commits", zero: "New activity from a zero baseline", activeRepos: "active repos", focusScore: "focus score", recent: "Recent changes", signals: "signals", empty: "No notable changes for this filter.", snapshot: "Period snapshot", aggregate: "aggregate", trajectoryFocus: "Trajectory & focus", velocity: "Velocity and allocation of effort", trajectory: "Activity trajectory", repoShare: "Repository share", activityScore: "Activity score", rhythm: "Rhythm & momentum", pattern: "90-day behavioral pattern", map: "90-day activity map", hover: "Hover for daily detail", less: "LESS", more: "MORE", momentum: "Repository momentum", prior: "7d / prior avg", matrix: "Repository matrix", sort: "repositories · select a heading to sort", profile: "Behavioral profile", diagnostics: "Supporting diagnostics", commitSize: "Commit size", dayHour: "Day × hour", activePattern: "Active day pattern", language: "Language activity", wow: "Week over week", generated: "Generated", unavailable: "unavailable", partial: "Partial data", failed: "repository requests failed" },
  ja: { tagline: "変更量・集中度・継続性から、いま注力している開発を把握します。", period: "集計期間", primary: "本日の概況", baseline: "直前7日間の日平均比", activity: "の活動量", commits: "コミット", zero: "直前7日間に活動がない状態から、新しい活動がありました", activeRepos: "活動中のリポジトリ", focusScore: "集中度", recent: "注目すべき変化", signals: "件", empty: "この条件に該当する大きな変化はありません。", snapshot: "期間別の活動概要", aggregate: "の集計", trajectoryFocus: "活動推移と注力度", velocity: "開発ペースとリポジトリごとの配分", trajectory: "活動量の推移", repoShare: "リポジトリ別の活動構成", activityScore: "活動スコア", rhythm: "開発リズムと勢い", pattern: "直近90日間の活動傾向", map: "直近90日間の活動記録", hover: "各日にカーソルを合わせると詳細を表示します", less: "少", more: "多", momentum: "リポジトリの勢い", prior: "直近7日間 / それ以前の週平均", matrix: "リポジトリ別の活動一覧", sort: "件 · 見出しを選ぶと並べ替えられます", profile: "開発活動の傾向", diagnostics: "コミットの規模・時間帯・言語・前週比", commitSize: "コミット規模", dayHour: "曜日・時間帯別のコミット", activePattern: "曜日別の活動傾向", language: "言語別の活動量", wow: "前週との比較", generated: "更新日時", unavailable: "取得できませんでした", partial: "一部のデータのみ表示しています", failed: "件のリポジトリ取得に失敗しました" },
} as const;

const periodDays: Record<PeriodKey, number> = { today: 1, week: 7, month: 30 };

function localizeEvent(event: ChangeEvent, format: Intl.NumberFormat): { title: string; description: string } {
  const repository = event.repository ?? "全リポジトリ";
  const value = event.value ?? 0;
  const baseline = event.baseline ?? 0;
  switch (event.type) {
    case "activity-spike": return event.repository
      ? { title: `${repository} の活動量が急増`, description: `直近の週平均の ${value.toFixed(1)} 倍です` }
      : { title: "月間の活動量が増加", description: "前の30日間と比べて増加しています" };
    case "activity-drop": return event.repository
      ? { title: `${repository} の活動量が低下`, description: "直近の週平均を下回っています" }
      : { title: "月間の活動量が減少", description: "前の30日間と比べて減少しています" };
    case "inactive": return { title: `${repository} の活動が停滞`, description: "今月は活動がありましたが、直近7日間は動きが少ない状態です" };
    case "large-commit": return { title: `${repository} で大規模なコミット`, description: `${format.format(value)} 行を変更しました` };
    case "commit-burst": return { title: `${repository} でコミットが集中`, description: `${format.format(value)} 件のコミットが ${format.format(baseline)} 分以内に行われました` };
    case "new-activity": return { title: `${repository} で新しい開発活動`, description: "直近90日間で初めて活動を確認しました" };
    case "revived": return { title: `${repository} の開発活動が再開`, description: `${format.format(Math.floor(value))} 日ぶりに活動を確認しました` };
    case "share-shift": return { title: `${repository} の活動比率が変化`, description: `${format.format(baseline)}% から ${format.format(value)}% に変化しました` };
    case "focus-shift": return { title: value > baseline ? "開発対象がより集中" : "開発対象がより分散", description: `集中度が ${format.format(baseline)} から ${format.format(value)} に変化しました` };
    case "time-shift": return { title: "活動する時間帯に変化", description: `活動比率が ${format.format(baseline)}% から ${format.format(value)}% に変化しました` };
    case "streak": return event.id === "streak-ended"
      ? { title: `${format.format(value)} 日間の連続活動が終了`, description: "継続していた開発活動のパターンに変化がありました" }
      : { title: `${format.format(value)} 日間の連続活動を達成`, description: "連続して開発活動が記録されています" };
    default: return { title: event.title, description: event.description };
  }
}

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
  const { locale } = usePreferences();
  const text = ui[locale];
  const localizedPeriods: { key: PeriodKey; label: string }[] = periods.map((item, index) => ({ ...item, label: locale === "ja" ? ["今日", "7日間", "30日間"][index] : item.label }));
  const fmt = useMemo(() => new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US"), [locale]);
  const compact = useMemo(() => new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", { notation: "compact", maximumFractionDigits: 1 }), [locale]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }), [locale]);
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "short", day: "numeric", weekday: "short" }), [locale]);
  const dateFmt = (value: string | null) => value ? dateFormatter.format(new Date(value)) : "—";
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("commits");
  const [trendDays, setTrendDays] = useState<30 | 90>(30);
  const trendData = useMemo(() => data.dailyActivity.slice(-trendDays), [data.dailyActivity, trendDays]);
  const [sort, setSort] = useState<SortKey>("score");
  const [changeFilter, setChangeFilter] = useState<"all" | ChangeCategory>("all");
  const [copied, setCopied] = useState(false);
  const summary = data.analysis.summaries[period];
  const focus = data.analysis.focus[period];
  const momentum = data.analysis.momentum;
  const anomaly = data.analysis.anomaly;
  const development = data.analysis.development[period];
  const dev = development.snapshot;
  const partialSuffix = dev.fileDetailCoverage < 100 && dev.coveredCommits > 0 ? "+" : "";
  const localizedSummary = locale === "ja"
    ? `${localizedPeriods.find(item=>item.key===period)?.label}：実質変更 ${fmt.format(dev.meaningfulChangedLines)} 行・${fmt.format(dev.commits)} コミット・${fmt.format(dev.activeRepositories)} リポジトリ・活動 ${fmt.format(dev.activeDays)} 日`
    : development.summary;
  const detailedSummary = locale === "ja"
    ? `${localizedPeriods.find(item=>item.key===period)?.label}：\n実質変更行数 ${fmt.format(dev.meaningfulChangedLines)} 行\n追加 +${fmt.format(dev.additions)} / 削除 -${fmt.format(dev.deletions)} / 差分 ${dev.netLines >= 0 ? "+" : ""}${fmt.format(dev.netLines)} 行\n${fmt.format(dev.commits)} コミット\n${fmt.format(dev.changedFiles)} ファイルを変更\n${fmt.format(dev.activeRepositories)} リポジトリ\n活動日数 ${fmt.format(dev.activeDays)} 日\n推定作業セッション ${fmt.format(development.sessions.count)} 回`
    : development.detailedSummary;
  const copySummary = async () => { await navigator.clipboard.writeText(detailedSummary); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const duration = (minutes: number) => locale === "ja"
    ? (minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}` : `${minutes}分`)
    : (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`);

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
    return other > 0 ? [...top, { label: locale === "ja" ? "その他" : "Other", value: other, text: `${Math.round(other / total * 100)}%` }] : top;
  }, [data.repositories, locale, period]);

  const kpiLabels = locale === "ja" ? ["コミット", "変更行数", "変更ファイル", "活動リポジトリ", "活動日数", "1日あたりコミット", "上位リポジトリ比率", "連続活動日数"] : ["Commits", "Changed lines", "Files changed", "Active repos", "Active days", "Commits / day", "Top repo share", "Current streak"];
  const kpiValues = [fmt.format(summary.commits), compact.format(summary.changedLines), fmt.format(summary.changedFiles), String(focus.activeRepositories), String(data.analysis.activeDays[period]), data.analysis.activeDays[period] ? (summary.commits / data.analysis.activeDays[period]).toFixed(1) : "0", `${focus.topShare}%`, `${data.analysis.streak}${locale === "ja" ? "日" : "d"}`];
  const kpis: [string, string][] = kpiLabels.map((label, index) => [label, kpiValues[index]]);
  const filteredEvents = changeFilter === "all" ? anomaly.events : anomaly.events.filter((event) => event.category === changeFilter);
  const heat = data.dailyActivity;
  const maxHeat = Math.max(1, ...heat.map((day) => day.score));
  const slots = ["00–06", "06–12", "12–18", "18–24"];
  const days = locale === "ja" ? ["月", "火", "水", "木", "金", "土", "日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxHour = Math.max(1, ...data.analysis.dayHour[period].map((cell) => cell.commits));
  const maxWeekday = Math.max(1, ...anomaly.weekdayActivity);
  const pulseTone = anomaly.pulse.level === "VERY HIGH" ? "var(--orange)" : anomaly.pulse.level === "HIGH" ? "var(--accent)" : anomaly.pulse.level === "LOW" ? "var(--cyan)" : "var(--text)";
  const pulseLevel = locale === "ja" ? ({ "VERY HIGH": "非常に活発", HIGH: "活発", NORMAL: "通常", LOW: "低調" } as const)[anomaly.pulse.level] : anomaly.pulse.level;
  const tableHeaders = locale === "ja" ? ["今日", "7日", "30日", "コミット", "+", "−", "ファイル", "日数", "スコア", "勢い", "最終更新"] : ["Today", "7d", "30d", "Commits", "+", "−", "Files", "Days", "Score", "Momentum", "Last push"];

  return <main className="shell cockpit">
    <header className="enter flex flex-col gap-6 border-b hairline pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-4 flex items-center gap-2.5"><span className="status-dot h-2 w-2 rounded-full bg-[var(--accent)]" /><span className="eyebrow">{locale === "ja" ? "github monitor · 最新状況" : "github monitor · live signal"}</span></div>
        <h1 className="max-w-3xl text-3xl font-semibold leading-none tracking-[-.055em] sm:text-5xl">{locale === "ja" ? <>開発状況<br className="sm:hidden" />ダッシュボード</> : <>Development<br className="sm:hidden" /> signal room</>}</h1>
        <p className="muted mt-4 max-w-xl text-sm sm:text-base">{text.tagline}</p>
      </div>
      <div className="chip flex w-fit rounded-[10px] p-1" aria-label={text.period}>{localizedPeriods.map((item) => <button key={item.key} onClick={() => setPeriod(item.key)} aria-pressed={period === item.key} data-active={period === item.key} className="control">{item.label}</button>)}</div>
    </header>

    {data.warnings.length > 0 && <div className="warning mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">{text.partial} · {data.warnings.length} {locale === "ja" ? "件の警告" : "warnings"}<ul className="mt-2 list-disc pl-5">{data.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}

    <section className="enter enter-delay-1 mt-8">
      <SectionHeading index="00" title={locale === "ja" ? "開発状況サマリー" : "Development Snapshot"} sub={locale === "ja" ? "活動量と継続性の目安です。能力や品質を評価するものではありません" : "Activity volume and density — not ability or quality"} />
      <article className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="accent-rule absolute left-0 top-0 h-[2px] w-full" />
        <div className="relative z-10">
          <p className="eyebrow">{localizedPeriods.find(item=>item.key===period)?.label}</p>
          <p className="mt-4 max-w-5xl text-xl font-semibold tracking-[-.025em] sm:text-3xl">{locale === "ja" ? <>{fmt.format(dev.meaningfulChangedLines)} 行を実質変更 <span className="muted">·</span> {fmt.format(dev.commits)} コミット <span className="muted">·</span> {dev.activeRepositories} リポジトリ <span className="muted">·</span> 活動 {dev.activeDays} 日</> : <>{fmt.format(dev.meaningfulChangedLines)} lines changed <span className="muted">·</span> {fmt.format(dev.commits)} commits <span className="muted">·</span> {dev.activeRepositories} repositories <span className="muted">·</span> {dev.activeDays} active days</>}</p>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t hairline pt-6 sm:grid-cols-4 xl:grid-cols-8">
            {(locale === "ja" ? [["追加行数",`+${compact.format(dev.additions)}`],["削除行数",`−${compact.format(dev.deletions)}`],["行数の純増減",`${dev.netLines>=0?"+":"−"}${compact.format(Math.abs(dev.netLines))}`],["総変更行数",compact.format(dev.changedLines)],["実質変更行数",compact.format(dev.meaningfulChangedLines)],["変更ファイル",fmt.format(dev.changedFiles)],["新規ファイル",dev.newFiles===null?"—":`${fmt.format(dev.newFiles)}${partialSuffix}`],["詳細取得率",`${dev.fileDetailCoverage}%`]] : [["Added LOC",`+${compact.format(dev.additions)}`],["Deleted LOC",`−${compact.format(dev.deletions)}`],["Net LOC",`${dev.netLines>=0?"+":"−"}${compact.format(Math.abs(dev.netLines))}`],["Raw changed",compact.format(dev.changedLines)],["Meaningful LOC",compact.format(dev.meaningfulChangedLines)],["Files",fmt.format(dev.changedFiles)],["New files",dev.newFiles===null?"—":`${fmt.format(dev.newFiles)}${partialSuffix}`],["Coverage",`${dev.fileDetailCoverage}%`]]).map(([label,value])=><div key={label}><p className="muted text-xs">{label}</p><p className="metric-value mt-1 text-xl font-semibold">{value}</p></div>)}
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t hairline pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="mono muted text-xs sm:text-sm">{localizedSummary}</p><button onClick={copySummary} className="control chip w-fit">{copied ? (locale==="ja"?"コピーしました":"Copied") : (locale==="ja"?"概要をコピー":"Copy summary")}</button></div>
        </div>
      </article>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title={`${locale === "ja" ? "開発活動密度" : "Development Density"} ${development.density.score} / 100`} sub={`${locale==="ja"?"前期間":"Previous"} ${development.density.previousScore} · Δ ${development.density.delta>=0?"+":""}${development.density.delta}`}>
          <Bars items={Object.entries(development.density.breakdown).map(([key,value])=>({label:(locale === "ja" ? {volume:"活動量",consistency:"継続性",breadth:"対象の広がり",delivery:"作業のまとまり",engineeringActivity:"実装・保守の構成"} : {volume:"Volume",consistency:"Consistency",breadth:"Breadth",delivery:"Delivery",engineeringActivity:"Engineering Activity"})[key as keyof typeof development.density.breakdown],value,text:String(value),color:key==="volume"?"var(--accent)":"var(--cyan)"}))} />
          <div className="mt-5 grid gap-1 border-t hairline pt-4 text-xs">{(locale === "ja" ? [dev.commits ? `${fmt.format(dev.commits)} コミット / 実質変更 ${fmt.format(dev.meaningfulChangedLines)} 行` : "この期間のコミットはありません", `活動日数 ${dev.activeDays} / ${periodDays[period]} 日`, `${dev.activeRepositories} リポジトリで活動`, dev.coveredCommits ? `ファイル詳細の取得率 ${dev.fileDetailCoverage}%` : "ファイル詳細は未取得です"] : development.density.explanations).map(line=><span key={line} className="muted">{line}</span>)}</div>
        </Panel>
        <Panel title={locale === "ja" ? "変更内容の内訳" : "Change Composition"} sub={`${locale==="ja"?"取得済みのファイル詳細を集計":"covered file details"} · ${dev.fileDetailCoverage}%`}>
          <div className="mb-6 flex h-3 overflow-hidden rounded-full bg-white/[.05]">{development.composition.map((item,index)=><div key={item.category} title={`${item.category} ${item.share}%`} style={{width:`${item.share}%`,background:["var(--accent)","var(--cyan)","var(--violet)","var(--orange)","var(--faint)"][index]}} />)}</div>
          <div className="grid grid-cols-5 gap-2">{development.composition.map((item,index)=><div key={item.category}><span className="mb-2 block h-1 w-5 rounded" style={{background:["var(--accent)","var(--cyan)","var(--violet)","var(--orange)","var(--faint)"][index]}}/><p className="text-xs capitalize">{locale === "ja" ? ({code:"コード",test:"テスト",docs:"ドキュメント",config:"設定",other:"その他"} as const)[item.category] : item.category}</p><p className="mono mt-1 text-lg font-semibold">{item.share}%</p><p className="muted text-[.6875rem]">{compact.format(item.changedLines)} {locale === "ja" ? "行" : "LOC"}</p></div>)}</div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t hairline pt-4 text-xs"><span><i className="muted block not-italic">{locale === "ja" ? "テストの変更行数 / ファイル数" : "Test LOC / files"}</i><b>{dev.testLines===null?"—":`${compact.format(dev.testLines)}${partialSuffix}`} / {dev.testFiles===null?"—":`${dev.testFiles}${partialSuffix}`}</b></span><span><i className="muted block not-italic">{locale === "ja" ? "文書の変更行数 / ファイル数" : "Docs LOC / files"}</i><b>{dev.docsLines===null?"—":`${compact.format(dev.docsLines)}${partialSuffix}`} / {dev.docsFiles===null?"—":`${dev.docsFiles}${partialSuffix}`}</b></span></div>
        </Panel>
        <Panel title={locale === "ja" ? "推定作業セッション" : "Estimated Git Activity Sessions"} sub={locale === "ja" ? `${development.sessions.count} 回 · 1回あたり ${development.sessions.commitsPerSession} コミット` : `${development.sessions.count} sessions · ${development.sessions.commitsPerSession} commits/session`}>
          <div className="grid grid-cols-3 gap-4"><span><i className="muted block text-xs not-italic">{locale === "ja" ? "中央値" : "Median window"}</i><b className="metric-value mt-1 block text-2xl">{duration(development.sessions.medianMinutes)}</b></span><span><i className="muted block text-xs not-italic">{locale === "ja" ? "最長" : "Longest window"}</i><b className="metric-value mt-1 block text-2xl">{duration(development.sessions.longestMinutes)}</b></span><span><i className="muted block text-xs not-italic">{locale === "ja" ? "観測時間" : "Observed window"}</i><b className="metric-value mt-1 block text-2xl">{duration(development.sessions.observedWindowMinutes)}</b></span></div>
          <p className="muted mt-5 border-t hairline pt-4 text-xs">{locale === "ja" ? "コミット間隔が90分以上空いた場合に別セッションとして集計します。最初から最後のコミットまでの時間であり、実際の作業時間ではありません。" : "90+ minute gaps start a new session. Windows span first-to-last commit only; they are not coding time."}</p>
        </Panel>
        <Panel title={locale === "ja" ? "リポジトリ別の開発規模" : "Repository Development Scale"} sub={locale === "ja" ? `${development.repositories.length} 件で活動` : `${development.repositories.length} active`}>
          <div className="scroll-fade max-h-64 overflow-auto"><table className="w-full min-w-[650px] text-xs"><thead className="muted sticky top-0 bg-[var(--panel)]"><tr><th className="pb-2 text-left">{locale === "ja" ? "リポジトリ" : "Repository"}</th><th>{locale === "ja" ? "実質変更" : "Meaningful"}</th><th>{locale === "ja" ? "純増減" : "Net"}</th><th>{locale === "ja" ? "ファイル" : "Files"}</th><th>{locale === "ja" ? "テスト" : "Tests"}</th><th>{locale === "ja" ? "文書" : "Docs"}</th><th>{locale === "ja" ? "コミット" : "Commits"}</th></tr></thead><tbody>{development.repositories.map(repo=><tr key={repo.repository} className="border-t hairline"><td className="py-2.5 font-medium">{repo.repository}</td><td className="mono text-center">{compact.format(repo.meaningfulChangedLines)}</td><td className="mono text-center">{repo.netLines>=0?"+":"−"}{compact.format(Math.abs(repo.netLines))}</td><td className="mono text-center">{repo.changedFiles}</td><td className="mono text-center">{repo.testLines===null?"—":`${compact.format(repo.testLines)}${repo.coverage<100?"+":""}`}</td><td className="mono text-center">{repo.docsLines===null?"—":`${compact.format(repo.docsLines)}${repo.coverage<100?"+":""}`}</td><td className="mono text-center">{repo.commits}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    </section>

    <section className="enter enter-delay-1 mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <article className="panel relative min-h-[270px] p-6 sm:p-8">
        <div className="accent-rule absolute left-0 top-0 h-[2px] w-2/3" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-10">
          <div className="flex items-center justify-between"><span className="eyebrow">{text.primary}</span><span className="mono muted text-xs">{text.baseline}</span></div>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-sm font-medium uppercase tracking-[.18em]" style={{ color: pulseTone }}>{pulseLevel}{text.activity}</p><p className="metric-value mt-2 text-6xl font-semibold sm:text-7xl">{anomaly.pulse.todayCommits}<span className="ml-2 text-lg tracking-normal text-[var(--muted)]">{text.commits}</span></p><p className="muted mt-3 text-sm">{anomaly.pulse.changePercent === null ? text.zero : `${anomaly.pulse.changePercent >= 0 ? "+" : ""}${anomaly.pulse.changePercent}% · ${text.baseline} ${anomaly.pulse.baseline}/${locale === "ja" ? "日" : "day"}`}</p></div>
            <div className="grid grid-cols-2 gap-8 border-t hairline pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><div><p className="metric-value text-3xl font-semibold">{anomaly.pulse.activeRepositories}</p><p className="muted mt-1 text-xs">{text.activeRepos}</p></div><div><p className="metric-value text-3xl font-semibold">{focus.score}</p><p className="muted mt-1 text-xs">{text.focusScore}</p></div></div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t hairline pt-5 sm:grid-cols-4">{anomaly.dayOverDay.map((day, index) => <div key={day.label}><p className="muted text-xs">{locale === "ja" ? ["コミット", "変更行数", "変更ファイル", "活動リポジトリ"][index] : day.label}</p><p className="mono mt-1 text-sm">{compact.format(day.yesterday)} <span className="faint">→</span> <b>{compact.format(day.today)}</b></p></div>)}</div>
        </div>
      </article>

      <Panel title={text.recent} sub={`${filteredEvents.length} ${text.signals}`} className="min-h-[270px]">
        <div className="mb-4 flex flex-wrap gap-1.5">{(["all", "repository", "activity", "commit", "pattern"] as const).map((filter, index) => <button key={filter} onClick={() => setChangeFilter(filter)} aria-pressed={changeFilter === filter} data-active={changeFilter === filter} className="control chip min-h-0 px-2.5 py-1.5 text-[.6875rem] uppercase">{locale === "ja" ? ["すべて", "リポジトリ", "活動量", "コミット", "傾向"][index] : filter}</button>)}</div>
        <div className="space-y-1">{filteredEvents.length ? filteredEvents.slice(0, 5).map((event) => <div key={event.id} className="group flex min-w-0 gap-3 border-t hairline py-3 first:border-t-0">
          <span className="mono mt-0.5 text-[.6875rem]" style={{ color: event.severity === "strong" ? "var(--orange)" : event.severity === "notable" ? "var(--violet)" : "var(--cyan)" }}>0{event.severity === "strong" ? 3 : event.severity === "notable" ? 2 : 1}</span>
          <div className="min-w-0"><p className="truncate text-sm font-medium transition-colors group-hover:text-[var(--accent)]">{locale === "ja" ? localizeEvent(event, fmt).title : event.title}</p><p className="muted mt-0.5 truncate text-xs">{locale === "ja" ? localizeEvent(event, fmt).description : event.description}</p></div>
        </div>) : <p className="muted py-8 text-center text-sm">{text.empty}</p>}</div>
      </Panel>
    </section>

    <section className="enter enter-delay-2 mt-10">
      <SectionHeading index="01" title={text.snapshot} sub={`${localizedPeriods.find((item) => item.key === period)?.label} ${text.aggregate}`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">{kpis.map(([label, value], index) => <MetricCard key={label} label={label} value={value} featured={index === 0} />)}</div>
    </section>

    <section className="enter enter-delay-2 mt-12">
      <SectionHeading index="02" title={text.trajectoryFocus} sub={text.velocity} />
      <div className="grid gap-4 xl:grid-cols-[1.55fr_.65fr]">
        <Panel title={text.trajectory} sub={`${trendDays} ${locale === "ja" ? "日" : "days"}`}>
          <div className="mb-5 flex flex-wrap gap-1.5">{(["commits", "changedLines", "changedFiles", "score"] as TrendMetric[]).map((metric) => <button key={metric} onClick={() => setTrendMetric(metric)} data-active={trendMetric === metric} className="control chip min-h-0 py-1.5">{{ commits: locale === "ja" ? "コミット" : "Commits", changedLines: locale === "ja" ? "行数" : "Lines", changedFiles: locale === "ja" ? "ファイル" : "Files", score: locale === "ja" ? "スコア" : "Score" }[metric]}</button>)}<span className="ml-auto flex gap-1">{([30, 90] as const).map((daysCount) => <button key={daysCount} onClick={() => setTrendDays(daysCount)} data-active={trendDays === daysCount} className="control chip min-h-0 py-1.5">{daysCount}{locale === "ja" ? "日" : "D"}</button>)}</span></div>
          <DailyChart data={trendData} metric={trendMetric} locale={locale} />
        </Panel>
        <Panel title={text.repoShare} sub={text.activityScore}>
          <div className="mb-6 flex h-2 overflow-hidden rounded-full bg-white/[.04]">{shares.map((share, index) => <div key={share.label} title={`${share.label} ${share.text}`} style={{ width: share.text, background: ["var(--accent)", "var(--cyan)", "var(--violet)", "var(--orange)", "#5f7182", "#3b4652"][index] }} />)}</div>
          <Bars items={shares.map((share, index) => ({ ...share, color: ["var(--accent)", "var(--cyan)", "var(--violet)", "var(--orange)", "#5f7182", "#3b4652"][index] }))} />
          <div className="mt-6 grid grid-cols-3 border-t hairline pt-5 text-center"><span><b className="metric-value text-xl">{focus.score}</b><small className="muted mt-1 block text-xs">{locale === "ja" ? "集中度" : "Focus"}</small></span><span><b className="metric-value text-xl">{focus.topThreeShare}%</b><small className="muted mt-1 block text-xs">{locale === "ja" ? "上位3件" : "Top 3"}</small></span><span><b className="metric-value text-xl">{focus.activeRepositories}</b><small className="muted mt-1 block text-xs">{locale === "ja" ? "稼働数" : "Active"}</small></span></div>
        </Panel>
      </div>
    </section>

    <section className="enter enter-delay-3 mt-12">
      <SectionHeading index="03" title={text.rhythm} sub={text.pattern} />
      <div className="grid gap-4 xl:grid-cols-[1.55fr_.65fr]">
        <Panel title={text.map} sub={text.hover}>
          <div className="scroll-fade grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-2">{heat.map((day) => <div key={day.date} className="h-4 w-4 rounded-[3px] transition-transform hover:scale-125" title={locale === "ja" ? `${dayFormatter.format(new Date(`${day.date}T00:00:00+09:00`))} · ${day.commits} コミット · ${fmt.format(day.changedLines)} 行変更 · ${day.activeRepositories} リポジトリ` : `${dayFormatter.format(new Date(`${day.date}T00:00:00+09:00`))} · ${day.commits} commits · ${fmt.format(day.changedLines)} lines · ${day.activeRepositories} repos`} style={{ background: day.score ? `color-mix(in srgb, var(--accent) ${20 + day.score / maxHeat * 80}%, var(--panel-strong))` : "var(--panel-strong)" }} />)}</div>
          <div className="muted mono mt-3 flex items-center gap-2 text-[.6875rem]"><span>{text.less}</span><span className="h-2 w-2 bg-[var(--panel-strong)]" /><span className="h-2 w-2 bg-[color:color-mix(in_srgb,var(--accent)_35%,var(--panel-strong))]" /><span className="h-2 w-2 bg-[color:color-mix(in_srgb,var(--accent)_65%,var(--panel-strong))]" /><span className="h-2 w-2 bg-[var(--accent)]" /><span>{text.more}</span></div>
        </Panel>
        <Panel title={text.momentum} sub={text.prior}>
          <div className="grid grid-cols-3 gap-4">{(["HOT", "STABLE", "COOLING"] as const).map((band) => <div key={band}><p className="mono mb-3 text-[.6875rem] font-bold" style={{ color: band === "HOT" ? "var(--orange)" : band === "COOLING" ? "var(--cyan)" : "var(--accent)" }}>{locale === "ja" ? ({HOT:"上昇",STABLE:"安定",COOLING:"低下"} as const)[band] : band}</p>{rows.filter((row) => momentum[row.repository.fullName].band === band).slice(0, 3).map((row) => <div key={row.repository.id} className="mb-2.5"><p className="truncate text-xs">{row.repository.name}</p><p className="mono muted text-[.6875rem]">{momentum[row.repository.fullName].value}x</p></div>)}</div>)}</div>
        </Panel>
      </div>
    </section>

    <section className="mt-12">
      <SectionHeading index="04" title={text.matrix} sub={`${rows.length} ${text.sort}`} />
      <div className="panel scroll-fade overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead className="mono muted table-head text-[.6875rem] uppercase tracking-wider"><tr><th className="px-5 py-4">{locale === "ja" ? "リポジトリ" : "Repository"}</th>{[["commits"], ["commits"], ["commits"], ["commits"], [null], [null], ["changedFiles"], ["activeDays"], ["score"], ["momentum"], ["pushedAt"]].map(([key], index) => <th key={`${tableHeaders[index]}-${index}`} className="px-3 py-4"><button disabled={!key} onClick={() => key && setSort(key as SortKey)} className={key ? "hover:text-[var(--text)]" : ""}>{tableHeaders[index]}{sort === key ? " ↓" : ""}</button></th>)}</tr></thead>
          <tbody>{rows.map((row) => { const metrics = row.metrics[period]; const movement = momentum[row.repository.fullName]; return <tr key={row.repository.id} className="border-t hairline transition-colors hover:bg-white/[.035]"><td className="px-5 py-4"><Link href={`/repositories/${encodeURIComponent(row.repository.owner)}/${encodeURIComponent(row.repository.name)}`} className="text-sm font-semibold hover:text-[var(--accent)]">{row.repository.name}</Link><span className="muted ml-2">{row.repository.language ?? "—"}</span></td><td className="mono px-3">{row.metrics.today.commits}</td><td className="mono px-3">{row.metrics.week.commits}</td><td className="mono px-3">{row.metrics.month.commits}</td><td className="mono px-3">{metrics.commits}</td><td className="mono px-3 text-[var(--accent)]">+{metrics.additions}</td><td className="mono px-3 text-[var(--red)]">−{metrics.deletions}</td><td className="mono px-3">{metrics.changedFiles}</td><td className="mono px-3">{metrics.activeDays}</td><td className="mono px-3 font-bold">{metrics.score.toFixed(1)}</td><td className="mono px-3">{movement.value}x</td><td className="muted whitespace-nowrap px-3">{dateFmt(row.repository.pushedAt)}</td></tr>; })}</tbody>
        </table>
      </div>
    </section>

    <section className="mt-12">
      <SectionHeading index="05" title={text.profile} sub={text.diagnostics} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title={text.commitSize}><Bars items={data.analysis.commitSizes[period].map((bucket) => ({ label: `${bucket.key} · ${bucket.label}`, value: bucket.count, text: String(bucket.count) }))} /></Panel>
        <Panel title={text.dayHour}><div className="grid grid-cols-5 gap-1.5 text-center text-[.6875rem]"><span />{slots.map((slot) => <span key={slot} className="muted">{slot}</span>)}{days.flatMap((day, dayIndex) => [<span key={day} className="muted py-1.5 text-left">{day}</span>, ...data.analysis.dayHour[period].filter((cell) => cell.day === dayIndex).map((cell) => <span key={`${dayIndex}-${cell.slot}`} title={`${day} ${slots[cell.slot]}: ${cell.commits}`} className="rounded py-1.5" style={{ background: cell.commits ? `color-mix(in srgb, var(--cyan) ${18 + cell.commits / maxHour * 70}%, var(--panel-strong))` : "var(--panel-strong)" }}>{cell.commits}</span>)])}</div><div className="mt-5 border-t hairline pt-4"><p className="muted mb-2 text-xs">{text.activePattern}</p><div className="flex h-12 items-end gap-1.5">{days.map((day, index) => <div key={day} className="flex flex-1 flex-col items-center justify-end"><div className="w-full rounded-t-sm bg-[var(--cyan)]" style={{ height: `${Math.max(2, anomaly.weekdayActivity[index] / maxWeekday * 32)}px`, opacity: .35 + anomaly.weekdayActivity[index] / maxWeekday * .65 }} /><span className="muted mt-1 text-[.625rem]">{day}</span></div>)}</div></div></Panel>
        <Panel title={text.language}><Bars items={data.analysis.languages[period].map((language) => ({ label: locale === "ja" && language.language === "Other" ? "その他" : language.language, value: language.score, text: `${language.share}%`, color: "var(--violet)" }))} /></Panel>
        <Panel title={text.wow}><table className="w-full text-xs"><thead className="muted"><tr><th className="pb-2 text-left font-normal">{locale === "ja" ? "指標" : "Metric"}</th><th className="pb-2 font-normal">{locale === "ja" ? "今週" : "This"}</th><th className="pb-2 font-normal">{locale === "ja" ? "前週" : "Last"}</th><th className="pb-2 text-right font-normal">Δ</th></tr></thead><tbody>{data.analysis.weekComparison.map((row) => <tr key={row.key} className="border-t hairline"><td className="py-2.5">{locale === "ja" ? ({commits:"コミット",lines:"変更行数",files:"変更ファイル",days:"活動日数",repos:"活動リポジトリ"} as Record<string,string>)[row.key] : row.label}</td><td className="mono text-center">{compact.format(row.current)}</td><td className="mono text-center">{compact.format(row.previous)}</td><td className="mono text-right" style={{ color: (row.change ?? 0) >= 0 ? "var(--accent)" : "var(--red)" }}>{row.change === null ? (locale === "ja" ? "新規" : "NEW") : `${row.change >= 0 ? "+" : ""}${row.change}${row.absolute ? "" : "%"}`}</td></tr>)}</tbody></table><div className="mt-4 grid grid-cols-3 gap-2 border-t hairline pt-4 text-[.6875rem]">{[[locale === "ja" ? "増加" : "Increase", anomaly.weekHighlights.increase], [locale === "ja" ? "減少" : "Decrease", anomaly.weekHighlights.decrease], [locale === "ja" ? "安定" : "Stable", anomaly.weekHighlights.stable]].map(([label, value]) => { const highlight = value as { repository: string; change: number } | undefined; return <span key={label as string} className="truncate"><i className="muted block not-italic">{label as string}</i>{highlight?.repository ?? "—"}</span>; })}</div></Panel>
      </div>
    </section>

    <footer className="muted mono mt-12 border-t hairline pt-5 text-[.6875rem]">
      <div className="flex flex-col justify-between gap-2 sm:flex-row"><span>@{data.username} · {text.generated} {dateFmt(data.generatedAt)} {locale === "ja" ? "日本時間" : "JST"}</span><span>API {data.rateLimit ? `${fmt.format(data.rateLimit.remaining)} / ${fmt.format(data.rateLimit.limit)}` : text.unavailable}</span></div>
      <details className="mt-4"><summary className="cursor-pointer select-none hover:text-[var(--text)]">{locale === "ja" ? `開発者向け情報 · ${data.apiMetrics.syncMode === "cold" ? "全件" : "差分"}同期${data.failedRepositories.length ? ` · 取得失敗 ${data.failedRepositories.length}件` : ""}` : `Developer info · ${data.apiMetrics.syncMode} sync${data.failedRepositories.length ? ` · ${data.failedRepositories.length} failed` : ""}`}</summary><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">{(locale === "ja" ? [["APIリクエスト数", data.apiMetrics.apiRequests], ["キャッシュ利用数", data.apiMetrics.cacheHits], ["キャッシュ利用率", `${data.apiMetrics.cacheHitRate.toFixed(1)}%`], ["リポジトリ数", data.apiMetrics.repositories], ["読込コミット数", data.apiMetrics.commitsLoaded], ["新規コミット数", data.apiMetrics.newCommitsFetched], ["詳細取得数", data.apiMetrics.commitDetailsFetched], ["ファイル詳細補完数", data.apiMetrics.fileDetailsBackfilled], ["同期時間", `${data.apiMetrics.syncDurationMs}ms`]] : [["API Requests", data.apiMetrics.apiRequests], ["Cache Hits", data.apiMetrics.cacheHits], ["Hit Rate", `${data.apiMetrics.cacheHitRate.toFixed(1)}%`], ["Repositories", data.apiMetrics.repositories], ["Commits Loaded", data.apiMetrics.commitsLoaded], ["New Commits", data.apiMetrics.newCommitsFetched], ["Details Fetched", data.apiMetrics.commitDetailsFetched], ["File Backfilled", data.apiMetrics.fileDetailsBackfilled], ["Sync Duration", `${data.apiMetrics.syncDurationMs}ms`]]).map(([label, value]) => <span key={label}><i className="faint block not-italic">{label}</i><b className="text-[var(--text)]">{value}</b></span>)}</div>{data.failedRepositories.length > 0 && <div className="mt-4 border-t hairline pt-4"><p>{locale === "ja" ? "取得に失敗したリポジトリ" : "Repositories with failed sync"}</p><ul className="mt-2 space-y-1">{data.failedRepositories.map((item) => <li key={item.name}>{item.name} · {item.status === null ? (locale === "ja" ? "通信失敗" : "Request failed") : `GitHub API ${item.status}`} · {item.excluded ? (locale === "ja" ? "集計対象外（24時間後に再試行）" : "Excluded (retry after 24 hours)") : (locale === "ja" ? "キャッシュを使用" : "Using cache")} · {dateFmt(item.at)} JST</li>)}</ul></div>}</details>
    </footer>
  </main>;
}
