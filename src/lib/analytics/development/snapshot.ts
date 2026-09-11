import type { CommitActivity, CompositionItem, DevelopmentSnapshot, FileCategory, RepositoryDevelopmentScale } from "@/types/activity";
import { toJstDateKey } from "../date-range";
import { classifyFile, fileChangedLines, isMeaningfulFile } from "./file-classification";

const categories: FileCategory[] = ["code", "test", "docs", "config", "other"];

export function buildSnapshot(commits: CommitActivity[]): { snapshot: DevelopmentSnapshot; composition: CompositionItem[] } {
  const covered = commits.filter((commit) => Array.isArray(commit.files));
  const files = covered.flatMap((commit) => commit.files ?? []); const meaningful = files.filter((file) => isMeaningfulFile(file.filename));
  const knownMeaningful = meaningful.reduce((sum, file) => sum + fileChangedLines(file), 0);
  const uncoveredRaw = commits.filter((commit) => !Array.isArray(commit.files)).reduce((sum, commit) => sum + commit.additions + commit.deletions, 0);
  const additions = commits.reduce((sum,c)=>sum+c.additions,0), deletions = commits.reduce((sum,c)=>sum+c.deletions,0);
  const coverage = commits.length ? covered.length / commits.length * 100 : 100;
  const linesByCategory = Object.fromEntries(categories.map((category) => [category, meaningful.filter((file)=>classifyFile(file.filename)===category).reduce((sum,file)=>sum+fileChangedLines(file),0)])) as Record<FileCategory,number>;
  const filesByCategory = Object.fromEntries(categories.map((category) => [category, meaningful.filter((file)=>classifyFile(file.filename)===category).length])) as Record<FileCategory,number>;
  const classifiedTotal = Object.values(linesByCategory).reduce((a,b)=>a+b,0);
  const snapshot: DevelopmentSnapshot = { commits: commits.length, additions, deletions, changedLines: additions + deletions, meaningfulChangedLines: knownMeaningful + uncoveredRaw, netLines: additions - deletions, changedFiles: commits.reduce((sum,c)=>sum+c.changedFiles,0), newFiles: covered.length ? files.filter((file)=>file.status==="added").length : null, activeRepositories: new Set(commits.map(c=>c.repository)).size, activeDays: new Set(commits.map(c=>toJstDateKey(c.authoredAt))).size, testLines: covered.length ? linesByCategory.test : null, testFiles: covered.length ? filesByCategory.test : null, docsLines: covered.length ? linesByCategory.docs : null, docsFiles: covered.length ? filesByCategory.docs : null, fileDetailCoverage: Math.round(coverage * 10) / 10, coveredCommits: covered.length, totalCommits: commits.length };
  return { snapshot, composition: categories.map((category)=>({category,changedLines:linesByCategory[category],changedFiles:filesByCategory[category],share:classifiedTotal?Math.round(linesByCategory[category]/classifiedTotal*1000)/10:0})) };
}

export function buildRepositoryScale(repository: string, commits: CommitActivity[]): RepositoryDevelopmentScale {
  const { snapshot } = buildSnapshot(commits);
  return { repository, changedLines:snapshot.changedLines, meaningfulChangedLines:snapshot.meaningfulChangedLines, netLines:snapshot.netLines, changedFiles:snapshot.changedFiles, testLines:snapshot.testLines, docsLines:snapshot.docsLines, commits:snapshot.commits, coverage:snapshot.fileDetailCoverage };
}
