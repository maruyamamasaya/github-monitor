import { describe, expect, it } from "vitest";
import type { CommitActivity, CommitFileDetail, DevelopmentSnapshot } from "@/types/activity";
import { calculateBreadthScore, calculateConsistencyScore, calculateDeliveryScore, calculateDensity, calculateEngineeringActivityScore, calculateVolumeScore } from "./density-score";
import { classifyFile, isMeaningfulFile } from "./file-classification";
import { calculateSessions } from "./sessions";
import { buildSnapshot } from "./snapshot";
import { buildProfileSummary } from "./summary";

const file=(filename:string,status="modified",additions=10,deletions=2):CommitFileDetail=>({filename,status,additions,deletions,changes:additions+deletions});
const commit=(sha:string,authoredAt:string,files?:CommitFileDetail[],repository="o/r"):CommitActivity=>({sha,repository,authoredAt,message:sha,additions:files?.reduce((s,f)=>s+f.additions,0)??10,deletions:files?.reduce((s,f)=>s+f.deletions,0)??2,changedFiles:files?.length??1,files,url:`https://github.com/o/r/${sha}`});
const blank:DevelopmentSnapshot={commits:0,additions:0,deletions:0,changedLines:0,meaningfulChangedLines:0,netLines:0,changedFiles:0,newFiles:null,activeRepositories:0,activeDays:0,testLines:null,testFiles:null,docsLines:null,docsFiles:null,fileDetailCoverage:100,coveredCommits:0,totalCommits:0};

describe("file classification and meaningful LOC",()=>{
  it.each([["src/app.ts","code"],["src/app.test.ts","test"],["__tests__/app.ts","test"],["AppTests/LoginTests.swift","test"],["README.md","docs"],["decisions/0001.md","docs"],["config/app.yml","config"],["asset.svg","other"]] as const)("classifies %s",(name,expected)=>expect(classifyFile(name)).toBe(expected));
  it.each(["package-lock.json","pnpm-lock.yaml","vendor/a.js","dist/app.min.js","public/font.woff2"])("excludes %s",name=>expect(isMeaningfulFile(name)).toBe(false));
  it("retains source",()=>expect(isMeaningfulFile("src/app.ts")).toBe(true));
});

describe("development snapshot",()=>{
  it("separates LOC and excludes lockfiles",()=>{const result=buildSnapshot([commit("a","2026-09-10T00:00:00Z",[file("src/a.ts","added",20,5),file("package-lock.json","modified",1000,500)])]).snapshot;expect(result).toMatchObject({additions:1020,deletions:505,changedLines:1525,netLines:515,meaningfulChangedLines:25,newFiles:1});});
  it("counts test and docs changes",()=>expect(buildSnapshot([commit("a","2026-09-10T00:00:00Z",[file("src/a.test.ts"),file("README.md","modified",8,1)])]).snapshot).toMatchObject({testLines:12,testFiles:1,docsLines:9,docsFiles:1}));
  it("marks partial detail coverage",()=>{const result=buildSnapshot([commit("a","2026-09-10T00:00:00Z",[file("src/a.ts","added")]),commit("b","2026-09-11T00:00:00Z")]).snapshot;expect(result).toMatchObject({fileDetailCoverage:50,newFiles:1,meaningfulChangedLines:24});});
  it("does not turn unavailable detail into zero",()=>expect(buildSnapshot([commit("a","2026-09-10T00:00:00Z")]).snapshot).toMatchObject({newFiles:null,testLines:null,docsLines:null,fileDetailCoverage:0}));
});

describe("density scores",()=>{
  const active={...blank,commits:60,changedFiles:200,meaningfulChangedLines:20_000,changedLines:24_000,deletions:4_000,activeDays:18,activeRepositories:6,coveredCommits:60,totalCommits:60};
  const commits=Array.from({length:18},(_,i)=>commit(String(i),`2026-08-${String(12+i).padStart(2,"0")}T00:00:00Z`,[file("src/a.ts")],`o/r${i%6}`));
  it("saturates volume",()=>{expect(calculateVolumeScore(active)).toBeGreaterThan(50);expect(calculateVolumeScore({...active,commits:1e6,changedFiles:1e6,meaningfulChangedLines:1e9})).toBe(100);});
  it("scores consistency",()=>expect(calculateConsistencyScore(active,commits,30)).toBeGreaterThan(70));
  it("handles one and many repositories",()=>expect(calculateBreadthScore({...active,activeRepositories:1},[100])).toBeLessThan(calculateBreadthScore(active,[20,20,20,20,10,10])));
  it("uses delivery fallback",()=>{expect(calculateDeliveryScore([])).toBe(0);expect(calculateDeliveryScore(commits)).toBeGreaterThan(35);});
  it("measures engineering activity without a quality claim",()=>expect(calculateEngineeringActivityScore(active,{code:70,test:10,docs:10,config:10,other:0})).toBeGreaterThan(50));
  it("combines weighted sub-scores and handles zero commits",()=>{expect(calculateDensity(active,commits,[20,20,20,20,10,10],{code:70,test:10,docs:10,config:10},30).score).toBeGreaterThan(0);expect(calculateDensity(blank,[],[],{},30).score).toBe(0);});
});

describe("sessions",()=>{
  it("splits at the 90-minute boundary",()=>expect(calculateSessions([commit("a","2026-09-11T00:00:00Z"),commit("b","2026-09-11T01:29:00Z"),commit("c","2026-09-11T02:59:00Z")])).toMatchObject({count:2,longestMinutes:89,commitsPerSession:1.5}));
  it("handles no commits",()=>expect(calculateSessions([]).count).toBe(0));
});

it("generates a profile summary",()=>expect(buildProfileSummary({...blank,meaningfulChangedLines:141284,commits:348,activeRepositories:19,activeDays:19},"month")).toBe("Last 30 days: 141,284 lines changed · 348 commits · 19 repositories · 19 active days"));
