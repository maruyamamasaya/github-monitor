import type { DailyActivity } from "@/types/activity";

export function DailyChart({ data }: { data: DailyActivity[] }) {
  const width = 900, height = 220, pad = 28;
  const max = Math.max(1, ...data.map((item) => item.commits));
  const points = data.map((item, i) => `${pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2)},${height - pad - (item.commits / max) * (height - pad * 2)}`).join(" ");
  return <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full" role="img" aria-label="過去30日のコミット数推移">
    {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={pad} x2={width-pad} y1={pad+ratio*(height-pad*2)} y2={pad+ratio*(height-pad*2)} stroke="#242b36" />)}
    <polyline fill="none" stroke="#3fb950" strokeWidth="3" strokeLinejoin="round" points={points} />
    {data.map((item, i) => <g key={item.date}><circle cx={pad+(i/Math.max(data.length-1,1))*(width-pad*2)} cy={height-pad-(item.commits/max)*(height-pad*2)} r="3" fill="#56d364"><title>{item.date}: {item.commits} commits</title></circle>{(i % 7 === 0 || i === data.length-1) && <text x={pad+(i/Math.max(data.length-1,1))*(width-pad*2)} y={height-5} fill="#8b949e" fontSize="10" textAnchor="middle">{item.date.slice(5)}</text>}</g>)}
  </svg></div>;
}
