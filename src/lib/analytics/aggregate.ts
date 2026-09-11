import { calculateActivityScore } from "./activity-score";
import { getLastJstDateKeys, isWithinPeriod, toJstDateKey } from "./date-range";
import type { CommitActivity, DailyActivity, Metrics, PeriodKey } from "@/types/activity";

export function aggregateMetrics(commits: CommitActivity[], period: PeriodKey, now = new Date()): Metrics {
  const selected = commits.filter((commit) => isWithinPeriod(commit.authoredAt, period, now));
  const additions = selected.reduce((sum, commit) => sum + commit.additions, 0);
  const deletions = selected.reduce((sum, commit) => sum + commit.deletions, 0);
  const changedFiles = selected.reduce((sum, commit) => sum + commit.changedFiles, 0);
  const activeDays = new Set(selected.map((commit) => toJstDateKey(commit.authoredAt))).size;
  const base = { commits: selected.length, activeDays, additions, deletions, changedLines: additions + deletions, changedFiles };
  return { ...base, score: calculateActivityScore(base) };
}

export function aggregateDaily(commits: CommitActivity[], now = new Date()): DailyActivity[] {
  const byDay = new Map<string, CommitActivity[]>();
  for (const commit of commits) {
    const key = toJstDateKey(commit.authoredAt);
    byDay.set(key, [...(byDay.get(key) ?? []), commit]);
  }
  return getLastJstDateKeys(90, now).map((date) => {
    const items = byDay.get(date) ?? [];
    const changedLines = items.reduce((sum, item) => sum + item.additions + item.deletions, 0);
    const changedFiles = items.reduce((sum, item) => sum + item.changedFiles, 0);
    const repositories = new Set(items.map((item) => item.repository));
    return { date, commits: items.length, changedLines, changedFiles, score: calculateActivityScore({ commits: items.length, activeDays: items.length ? 1 : 0, changedLines, changedFiles }), activeRepositories: repositories.size };
  });
}
