import { describe, expect, it } from "vitest";
import { aggregateMetrics } from "../aggregate";
import type { CommitActivity, RepositoryActivity } from "@/types/activity";
import { buildAnomalyAnalysis, detectBurst } from "./build-change-feed";

const now=new Date("2026-09-11T03:00:00Z");
let sequence=0;
const commit=(date:string,lines=20,repo="o/r"):CommitActivity=>({sha:String(sequence++),repository:repo,authoredAt:date,message:"change",additions:lines,deletions:0,changedFiles:1,url:"https://github.com/o/r"});
const repo=(name:string,commits:CommitActivity[]):RepositoryActivity=>({repository:{id:sequence++,owner:"o",name,fullName:`o/${name}`,private:false,url:`https://github.com/o/${name}`,defaultBranch:"main",updatedAt:now.toISOString(),pushedAt:now.toISOString(),language:"TypeScript",archived:false,fork:false},commits,metrics:{today:aggregateMetrics(commits,"today",now),week:aggregateMetrics(commits,"week",now),month:aggregateMetrics(commits,"month",now)}});

describe("change and anomaly detection",()=>{
  it("detects a 60-minute commit burst",()=>{const items=Array.from({length:5},(_,i)=>commit(`2026-09-10T15:${String(i*5).padStart(2,"0")}:00Z`));expect(detectBurst(items)).toEqual({count:5,minutes:60})});
  it("does not report a sparse burst",()=>expect(detectBurst([commit("2026-09-10T01:00:00Z"),commit("2026-09-10T05:00:00Z")])).toBeNull());
  it("detects spikes without duplicating repository activity events",()=>{const prior=Array.from({length:3},(_,i)=>commit(`2026-08-${20+i}T10:00:00Z`,50,"o/spike"));const recent=Array.from({length:8},(_,i)=>commit(`2026-09-${String(5+(i%6)).padStart(2,"0")}T10:00:00Z`,100,"o/spike"));const result=buildAnomalyAnalysis([repo("spike",[...prior,...recent])],now);expect(result.events.some(e=>e.type==="activity-spike")).toBe(true);expect(result.events.filter(e=>e.id==="activity-o/spike")).toHaveLength(1)});
  it("detects recently inactive repositories",()=>{const older=Array.from({length:5},(_,i)=>commit(`2026-08-${25+i}T10:00:00Z`,200,"o/resting"));const result=buildAnomalyAnalysis([repo("resting",older)],now);expect(result.events.some(e=>e.type==="inactive")).toBe(true)});
  it("detects unusually large commits with a repository baseline",()=>{const history=Array.from({length:8},(_,i)=>commit(`2026-08-${15+i}T10:00:00Z`,20+i,"o/large"));const huge=commit("2026-09-10T10:00:00Z",2000,"o/large");const result=buildAnomalyAnalysis([repo("large",[...history,huge])],now);expect(result.events.some(e=>e.type==="large-commit"&&e.severity==="strong")).toBe(true)});
  it("calculates day-over-day, share, focus, time and weekday structures",()=>{const a=[...Array.from({length:8},(_,i)=>commit(`2026-09-${String(5+(i%6)).padStart(2,"0")}T16:00:00Z`,100,"o/a")),commit("2026-09-10T16:00:00Z",10,"o/a")];const b=Array.from({length:8},(_,i)=>commit(`2026-08-${25+(i%5)}T08:00:00Z`,100,"o/b"));const result=buildAnomalyAnalysis([repo("a",a),repo("b",b)],now);expect(result.dayOverDay).toHaveLength(4);expect(result.timeShares).toHaveLength(4);expect(result.weekdayActivity).toHaveLength(7);expect(result.shareShifts.length).toBeGreaterThan(0);expect(result.weekHighlights.newlyActive).toContain("a")});
  it("is stable with zero activity",()=>{const result=buildAnomalyAnalysis([repo("empty",[])],now);expect(result.pulse.level).toBe("NORMAL");expect(result.events).toEqual([]);expect(result.dayOverDay.every(d=>d.change===0)).toBe(true)});
});
