import type { DailyActivity } from "@/types/activity";

export type TrendMetric = "commits" | "changedLines" | "changedFiles" | "score";
export function DailyChart({ data, metric }: { data: DailyActivity[]; metric: TrendMetric }) {
  const width=900,height=190,pad=24; const max=Math.max(1,...data.map(d=>d[metric]));
  const x=(i:number)=>pad+(i/Math.max(data.length-1,1))*(width-pad*2); const y=(v:number)=>height-pad-(v/max)*(height-pad*2);
  const points=data.map((d,i)=>`${x(i)},${y(d[metric])}`).join(" ");
  return <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full" role="img" aria-label={`${data.length}日間の${metric}推移`}>
    {[0,.25,.5,.75,1].map(r=><line key={r} x1={pad} x2={width-pad} y1={pad+r*(height-pad*2)} y2={pad+r*(height-pad*2)} stroke="#242b36" />)}
    <polyline fill="none" stroke="#3fb950" strokeWidth="2.5" strokeLinejoin="round" points={points}/>
    {data.map((d,i)=><g key={d.date}><circle cx={x(i)} cy={y(d[metric])} r="2.5" fill="#56d364" aria-label={`${d.date}: ${d[metric]}`}/>{(i%14===0||i===data.length-1)&&<text x={x(i)} y={height-3} fill="#8b949e" fontSize="9" textAnchor="middle">{d.date.slice(5)}</text>}</g>)}
  </svg></div>;
}
