import type { CommitActivity, GitActivitySessions } from "@/types/activity";

export const SESSION_GAP_MINUTES = 90;

export function calculateSessions(commits: CommitActivity[], gapMinutes = SESSION_GAP_MINUTES): GitActivitySessions {
  const sorted = [...commits].sort((a, b) => new Date(a.authoredAt).getTime() - new Date(b.authoredAt).getTime());
  if (!sorted.length) return { count: 0, medianMinutes: 0, longestMinutes: 0, commitsPerSession: 0, observedWindowMinutes: 0 };
  const groups: CommitActivity[][] = [];
  for (const commit of sorted) {
    const current = groups.at(-1); const previous = current?.at(-1);
    if (!current || !previous || new Date(commit.authoredAt).getTime() - new Date(previous.authoredAt).getTime() >= gapMinutes * 60_000) groups.push([commit]);
    else current.push(commit);
  }
  const durations = groups.map((group) => Math.round((new Date(group.at(-1)!.authoredAt).getTime() - new Date(group[0].authoredAt).getTime()) / 60_000)).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const medianMinutes = durations.length % 2 ? durations[middle] : Math.round((durations[middle - 1] + durations[middle]) / 2);
  return { count: groups.length, medianMinutes, longestMinutes: Math.max(...durations), commitsPerSession: Math.round(sorted.length / groups.length * 10) / 10, observedWindowMinutes: durations.reduce((sum, value) => sum + value, 0) };
}
