import type { DailyActivity } from "@/types/activity";
import { memo } from "react";

export type TrendMetric = "commits" | "changedLines" | "changedFiles" | "score";

const trendDateFormatters = {
  en: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short" }),
  ja: new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short" }),
};

export function formatTrendDate(date: string, locale: "en" | "ja") {
  return trendDateFormatters[locale].format(new Date(`${date}T00:00:00+09:00`));
}

export function trendLabelIndices(length: number, width = 900, pad = 28, minimumSpacing = 160): number[] {
  if (length === 0) return [];
  const step = (width - pad * 2) / Math.max(length - 1, 1);
  const labels = [length - 1];
  for (let index = length - 2; index >= 0; index--) {
    if ((labels[labels.length - 1] - index) * step >= minimumSpacing) labels.push(index);
  }
  return labels;
}

export const DailyChart = memo(function DailyChart({ data, metric, locale }: { data: DailyActivity[]; metric: TrendMetric; locale: "en" | "ja" }) {
  const width=900,height=220,pad=28; const max=Math.max(1,...data.map(d=>d[metric]));
  const x=(i:number)=>pad+(i/Math.max(data.length-1,1))*(width-pad*2); const y=(v:number)=>height-pad-(v/max)*(height-pad*2);
  const points=data.map((d,i)=>`${x(i)},${y(d[metric])}`).join(" ");
  const dateLabels = data.map((d) => formatTrendDate(d.date, locale));
  const visibleLabels = new Set(trendLabelIndices(data.length, width, pad));
  const area=`${pad},${height-pad} ${points} ${width-pad},${height-pad}`;
  return <div className="scroll-fade overflow-x-auto" dir="rtl"><svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[620px]" style={{ direction: "ltr" }} role="img" aria-label={`${data.length}日間の${metric}推移`}>
    <defs><linearGradient id="activity-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".2"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(r=><line key={r} x1={pad} x2={width-pad} y1={pad+r*(height-pad*2)} y2={pad+r*(height-pad*2)} stroke="var(--line)" strokeDasharray="3 7" />)}
    <polygon fill="url(#activity-area)" points={area}/>
    <polyline fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points}/>
    {data.map((d,i)=>{ const dateLabel=dateLabels[i]; return <g key={d.date}><title>{`${dateLabel}: ${d[metric]}`}</title><circle cx={x(i)} cy={y(d[metric])} r="3" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" aria-label={`${dateLabel}: ${d[metric]}`}/>{visibleLabels.has(i)&&<text x={x(i)} y={height-3} fill={i===data.length-1 ? "var(--text)" : "var(--muted)"} fontSize="11" fontWeight={i===data.length-1 ? "700" : undefined} fontFamily="ui-monospace, monospace" textAnchor={i===0?"start":i===data.length-1?"end":"middle"}>{dateLabel}</text>}</g>;})}
  </svg></div>;
});
