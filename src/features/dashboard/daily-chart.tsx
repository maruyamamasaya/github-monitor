import type { DailyActivity } from "@/types/activity";

export type TrendMetric = "commits" | "changedLines" | "changedFiles" | "score";
export function DailyChart({ data, metric }: { data: DailyActivity[]; metric: TrendMetric }) {
  const width=900,height=220,pad=28; const max=Math.max(1,...data.map(d=>d[metric]));
  const x=(i:number)=>pad+(i/Math.max(data.length-1,1))*(width-pad*2); const y=(v:number)=>height-pad-(v/max)*(height-pad*2);
  const points=data.map((d,i)=>`${x(i)},${y(d[metric])}`).join(" ");
  const area=`${pad},${height-pad} ${points} ${width-pad},${height-pad}`;
  return <div className="scroll-fade overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[620px]" role="img" aria-label={`${data.length}日間の${metric}推移`}>
    <defs><linearGradient id="activity-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".2"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(r=><line key={r} x1={pad} x2={width-pad} y1={pad+r*(height-pad*2)} y2={pad+r*(height-pad*2)} stroke="var(--line)" strokeDasharray="3 7" />)}
    <polygon fill="url(#activity-area)" points={area}/>
    <polyline fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points}/>
    {data.map((d,i)=><g key={d.date}><circle cx={x(i)} cy={y(d[metric])} r="3" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" aria-label={`${d.date}: ${d[metric]}`}/>{(i%14===0||i===data.length-1)&&<text x={x(i)} y={height-3} fill="var(--muted)" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="middle">{d.date.slice(5)}</text>}</g>)}
  </svg></div>;
}
