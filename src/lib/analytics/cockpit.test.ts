import { describe, expect, it } from "vitest";
import { aggregateDayHour, analyzeCockpit, calculateFocus, calculateMomentum, classifyCommitSizes } from "./cockpit";
import { aggregateMetrics } from "./aggregate";
import type { CommitActivity, RepositoryActivity } from "@/types/activity";

const now=new Date("2026-09-11T03:00:00Z");
const commit=(date:string,lines:number,repo="o/r"):CommitActivity=>({sha:`${date}${repo}`,repository:repo,authoredAt:date,message:"x",additions:lines,deletions:0,changedFiles:1,url:"https://github.com/o/r"});
const repository=(name:string,commits:CommitActivity[]):RepositoryActivity=>({repository:{id:name.length,owner:"o",name,fullName:`o/${name}`,private:false,url:"https://github.com/o/r",defaultBranch:"main",updatedAt:now.toISOString(),pushedAt:now.toISOString(),language:"TypeScript",archived:false,fork:false},commits,metrics:{today:aggregateMetrics(commits,"today",now),week:aggregateMetrics(commits,"week",now),month:aggregateMetrics(commits,"month",now)}});

describe("cockpit analytics",()=>{
  it("classifies all commit sizes",()=>expect(classifyCommitSizes([commit(now.toISOString(),0),commit(now.toISOString(),10),commit(now.toISOString(),50),commit(now.toISOString(),200),commit(now.toISOString(),1000)]).map(b=>b.count)).toEqual([1,1,1,1,1]));
  it("handles zero prior momentum",()=>{expect(calculateMomentum([],now)).toEqual({value:0,band:"COOLING"});expect(calculateMomentum([commit(now.toISOString(),10)],now)).toEqual({value:4,band:"HOT"})});
  it("handles one repository focus",()=>expect(calculateFocus([aggregateMetrics([commit(now.toISOString(),10)],"week",now)])).toEqual({score:100,topShare:100,topThreeShare:100,activeRepositories:1}));
  it("aggregates JST weekday and hour",()=>{const cells=aggregateDayHour([commit("2026-09-10T15:30:00Z",1)]);expect(cells.find(c=>c.day===4&&c.slot===0)?.commits).toBe(1)});
  it("compares weeks and supports many repositories",()=>{const repos=Array.from({length:12},(_,i)=>repository(`r${i}`,[commit("2026-09-10T16:00:00Z",10,`o/r${i}`),commit("2026-09-01T16:00:00Z",5,`o/r${i}`)]));const result=analyzeCockpit(repos,now);expect(result.focus.week.activeRepositories).toBe(12);expect(result.weekComparison).toHaveLength(5);expect(result.repositoryWeekChange).toHaveLength(6)});
  it("returns stable zero metrics for no commits",()=>{const result=analyzeCockpit([repository("empty",[])],now);expect(result.focus.week.score).toBe(0);expect(result.weekComparison[0].change).toBe(0)});
});
