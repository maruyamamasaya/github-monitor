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
  const counts = new Map<string, number>();
  for (const commit of commits) {
    const key = toJstDateKey(commit.authoredAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return getLastJstDateKeys(30, now).map((date) => ({ date, commits: counts.get(date) ?? 0 }));
}
