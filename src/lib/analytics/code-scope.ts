import type { DashboardData, PeriodKey, RepositoryActivity } from "@/types/activity";
import { aggregateDaily, aggregateMetrics } from "./aggregate";
import { analyzeCockpit } from "./cockpit";
import { isWithinPeriod } from "./date-range";
import { classifyFile, isMeaningfulFile } from "./development/file-classification";

export type CodeScopeData = Pick<DashboardData, "repositories" | "dailyActivity" | "analysis"> & {
  unclassifiedCommits: Record<PeriodKey, number>;
};

export function buildCodeScope(repositories: RepositoryActivity[], now: Date): CodeScopeData {
  const periods: PeriodKey[] = ["today", "week", "month", "quarter"];
  const unknown = repositories.flatMap((item) => item.commits).filter((commit) => !Array.isArray(commit.files));
  const filtered = repositories.map(({ repository, commits }): RepositoryActivity => {
    const codeCommits = commits.flatMap((commit) => {
      const files = commit.files?.filter((file) => isMeaningfulFile(file.filename) && classifyFile(file.filename) === "code") ?? [];
      if (!files.length) return [];
      return [{ ...commit, files, additions: files.reduce((sum, file) => sum + file.additions, 0), deletions: files.reduce((sum, file) => sum + file.deletions, 0), changedFiles: files.length }];
    });
    return { repository, commits: codeCommits, metrics: {
      today: aggregateMetrics(codeCommits, "today", now),
      week: aggregateMetrics(codeCommits, "week", now),
      month: aggregateMetrics(codeCommits, "month", now),
      quarter: aggregateMetrics(codeCommits, "quarter", now),
    } };
  });
  return {
    repositories: filtered,
    dailyActivity: aggregateDaily(filtered.flatMap((item) => item.commits), now),
    analysis: analyzeCockpit(filtered, now),
    unclassifiedCommits: Object.fromEntries(periods.map((period) => [period, unknown.filter((commit) => isWithinPeriod(commit.authoredAt, period, now)).length])) as Record<PeriodKey, number>,
  };
}
