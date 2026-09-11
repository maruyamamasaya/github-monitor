import type { DevelopmentAnalysis, PeriodKey, RepositoryActivity } from "@/types/activity";
import { getJstStart } from "../date-range";
import { calculateDensity } from "./density-score";
import { calculateSessions } from "./sessions";
import { buildRepositoryScale, buildSnapshot } from "./snapshot";
import { buildDetailedSummary, buildProfileSummary } from "./summary";

const periods: PeriodKey[] = ["today","week","month"];
const days: Record<PeriodKey,number> = { today:1, week:7, month:30 };
export function analyzeDevelopment(repositories: RepositoryActivity[], now=new Date()): DevelopmentAnalysis {
  const all=repositories.flatMap(r=>r.commits);
  return Object.fromEntries(periods.map(period=>{
    const start=getJstStart(period,now); const commits=all.filter(c=>new Date(c.authoredAt)>=start&&new Date(c.authoredAt)<=now);
    const repoRows=repositories.map(r=>buildRepositoryScale(r.repository.fullName,r.commits.filter(c=>commits.includes(c)))).filter(r=>r.commits).sort((a,b)=>b.meaningfulChangedLines-a.meaningfulChangedLines);
    const {snapshot,composition}=buildSnapshot(commits); const compositionLines=Object.fromEntries(composition.map(item=>[item.category,item.changedLines]));
    const current=calculateDensity(snapshot,commits,repoRows.map(r=>r.meaningfulChangedLines),compositionLines,days[period]);
    const previousEnd=new Date(start.getTime()-1); const previousStart=new Date(start.getTime()-days[period]*86_400_000); const previous=all.filter(c=>new Date(c.authoredAt)>=previousStart&&new Date(c.authoredAt)<=previousEnd); const previousBuilt=buildSnapshot(previous); const prevRepos=[...new Set(previous.map(c=>c.repository))].map(repo=>buildRepositoryScale(repo,previous.filter(c=>c.repository===repo))); const previousDensity=calculateDensity(previousBuilt.snapshot,previous,prevRepos.map(r=>r.meaningfulChangedLines),Object.fromEntries(previousBuilt.composition.map(i=>[i.category,i.changedLines])),days[period]).score;
    const sessions=calculateSessions(commits); const explanations=[snapshot.commits?`${snapshot.commits} commits / ${snapshot.meaningfulChangedLines.toLocaleString("en-US")} meaningful lines`:"No commits in this period",`${snapshot.activeDays} / ${days[period]} active days`,`${snapshot.activeRepositories} repositories touched`,snapshot.coveredCommits?`${snapshot.fileDetailCoverage}% file-detail coverage`:"File detail unavailable"];
    return [period,{snapshot,composition,density:{...current,explanations,previousScore:previousDensity,delta:current.score-previousDensity},sessions,repositories:repoRows,summary:buildProfileSummary(snapshot,period),detailedSummary:buildDetailedSummary(snapshot,period,sessions.count)}];
  })) as DevelopmentAnalysis;
}
