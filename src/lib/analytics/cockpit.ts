import type { CockpitAnalysis, CommitActivity, CommitSizeBucket, DayHourCell, FocusMetrics, LanguageActivity, Metrics, Momentum, PeriodKey, RepositoryActivity } from "@/types/activity";
import { aggregateMetrics } from "./aggregate";
import { getJstStart, toJstDateKey } from "./date-range";
import { buildAnomalyAnalysis } from "./anomaly/build-change-feed";
import { analyzeDevelopment } from "./development";

export const COMMIT_SIZE_BUCKETS = [
  { key: "XS", label: "0–9", min: 0, max: 9 }, { key: "S", label: "10–49", min: 10, max: 49 },
  { key: "M", label: "50–199", min: 50, max: 199 }, { key: "L", label: "200–999", min: 200, max: 999 },
  { key: "XL", label: "1000+", min: 1000, max: Infinity },
] as const;
export const MOMENTUM_THRESHOLDS = { hot: 1.5, stable: 0.65 } as const;

const empty = (): Metrics => ({ commits: 0, activeDays: 0, additions: 0, deletions: 0, changedLines: 0, changedFiles: 0, score: 0 });
const sumMetrics = (items: Metrics[]): Metrics => items.reduce((a, b) => ({ commits: a.commits+b.commits, activeDays: 0, additions:a.additions+b.additions, deletions:a.deletions+b.deletions, changedLines:a.changedLines+b.changedLines, changedFiles:a.changedFiles+b.changedFiles, score:a.score+b.score }), empty());
const selected = (commits: CommitActivity[], period: PeriodKey, now: Date) => commits.filter((c) => new Date(c.authoredAt) >= getJstStart(period, now) && new Date(c.authoredAt) <= now);

export function classifyCommitSizes(commits: CommitActivity[]): CommitSizeBucket[] {
  return COMMIT_SIZE_BUCKETS.map((bucket) => ({ key: bucket.key, label: bucket.label, count: commits.filter((c) => { const lines=c.additions+c.deletions; return lines>=bucket.min && lines<=bucket.max; }).length }));
}

export function calculateMomentum(commits: CommitActivity[], now = new Date()): Momentum {
  const recent = aggregateMetrics(commits, "week", now).score;
  const month = aggregateMetrics(commits, "month", now).score;
  const priorThreeWeekAverage = Math.max(0, month - recent) / 3;
  const value = priorThreeWeekAverage === 0 ? (recent > 0 ? 4 : 0) : recent / priorThreeWeekAverage;
  return { value: Math.round(value * 10) / 10, band: value >= MOMENTUM_THRESHOLDS.hot ? "HOT" : value >= MOMENTUM_THRESHOLDS.stable ? "STABLE" : "COOLING" };
}

export function calculateFocus(metrics: Metrics[]): FocusMetrics {
  const active = metrics.filter((m) => m.score > 0).sort((a,b)=>b.score-a.score); const total=active.reduce((s,m)=>s+m.score,0);
  const topShare = total ? active[0].score/total*100 : 0; const topThreeShare=total ? active.slice(0,3).reduce((s,m)=>s+m.score,0)/total*100 : 0;
  const score = total ? Math.round(Math.min(100, topShare*.65 + topThreeShare*.35)) : 0;
  return { score, topShare: Math.round(topShare), topThreeShare: Math.round(topThreeShare), activeRepositories: active.length };
}

export function aggregateDayHour(commits: CommitActivity[]): DayHourCell[] {
  const counts=new Map<string,number>();
  for(const c of commits){ const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",weekday:"short",hour:"numeric",hourCycle:"h23"}).formatToParts(new Date(c.authoredAt)); const day=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(parts.find(p=>p.type==="weekday")?.value??""); const hour=Number(parts.find(p=>p.type==="hour")?.value??0); const slot=Math.floor(hour/6); counts.set(`${day}-${slot}`,(counts.get(`${day}-${slot}`)??0)+1); }
  return Array.from({length:28},(_,i)=>({day:Math.floor(i/4),slot:i%4,commits:counts.get(`${Math.floor(i/4)}-${i%4}`)??0}));
}

function percentChange(current:number, previous:number){ return previous===0 ? (current===0?0:null) : Math.round((current-previous)/previous*100); }
export function analyzeCockpit(repositories: RepositoryActivity[], now=new Date()): CockpitAnalysis {
  const all=repositories.flatMap(r=>r.commits); const periods:PeriodKey[]=["today","week","month"];
  const summaries=Object.fromEntries(periods.map(p=>[p,sumMetrics(repositories.map(r=>r.metrics[p]))])) as Record<PeriodKey,Metrics>;
  const activeDays=Object.fromEntries(periods.map(p=>[p,new Set(selected(all,p,now).map(c=>toJstDateKey(c.authoredAt))).size])) as Record<PeriodKey,number>;
  const focus=Object.fromEntries(periods.map(p=>[p,calculateFocus(repositories.map(r=>r.metrics[p]))])) as Record<PeriodKey,FocusMetrics>;
  const commitSizes=Object.fromEntries(periods.map(p=>[p,classifyCommitSizes(selected(all,p,now))])) as Record<PeriodKey,CommitSizeBucket[]>;
  const dayHour=Object.fromEntries(periods.map(p=>[p,aggregateDayHour(selected(all,p,now))])) as Record<PeriodKey,DayHourCell[]>;
  const languages=Object.fromEntries(periods.map(p=>{ const rows=new Map<string,number>(); repositories.forEach(r=>rows.set(r.repository.language??"Other",(rows.get(r.repository.language??"Other")??0)+r.metrics[p].score)); const total=[...rows.values()].reduce((a,b)=>a+b,0); return [p,[...rows].map(([language,score])=>({language,score,share:total?Math.round(score/total*100):0})).sort((a,b)=>b.score-a.score).slice(0,6) satisfies LanguageActivity[]]; })) as Record<PeriodKey,LanguageActivity[]>;
  const momentum=Object.fromEntries(repositories.map(r=>[r.repository.fullName,calculateMomentum(r.commits,now)]));
  const currentStart=getJstStart("week",now); const previousStart=new Date(currentStart.getTime()-7*864e5); const current=all.filter(c=>new Date(c.authoredAt)>=currentStart); const previous=all.filter(c=>new Date(c.authoredAt)>=previousStart&&new Date(c.authoredAt)<currentStart); const cm=aggregateMetrics(current,"month",now); const pm=aggregateMetrics(previous,"month",now);
  const pairs:[string,string,keyof Metrics,boolean][]=[["commits","Commits","commits",false],["lines","Changed Lines","changedLines",false],["files","Files Changed","changedFiles",false],["days","Active Days","activeDays",true]];
  const weekComparison=pairs.map(([key,label,field,absolute])=>({key,label,current:cm[field],previous:pm[field],change:absolute?cm[field]-pm[field]:percentChange(cm[field],pm[field]),absolute}));
  const currRepos=new Set(current.map(c=>c.repository)).size,prevRepos=new Set(previous.map(c=>c.repository)).size; weekComparison.push({key:"repos",label:"Active Repos",current:currRepos,previous:prevRepos,change:currRepos-prevRepos,absolute:true});
  const repositoryWeekChange=repositories.map(r=>{const cur=r.commits.filter(c=>new Date(c.authoredAt)>=currentStart).length;const prev=r.commits.filter(c=>new Date(c.authoredAt)>=previousStart&&new Date(c.authoredAt)<currentStart).length;return{repository:r.repository.name,change:percentChange(cur,prev)}}).sort((a,b)=>(b.change??999)-(a.change??999)).slice(0,6);
  const days=new Set(all.map(c=>toJstDateKey(c.authoredAt))); let streak=0; const cursor=new Date(now); while(days.has(toJstDateKey(cursor))){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}
  const anomaly=buildAnomalyAnalysis(repositories,now,focus.week);
  return {summaries,activeDays,streak,focus,commitSizes,dayHour,languages,momentum,weekComparison,repositoryWeekChange,anomaly,development:analyzeDevelopment(repositories,now)};
}
