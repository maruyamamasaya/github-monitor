import type { CommitActivity } from "@/types/activity";
import { toJstDateKey } from "./date-range";

export function groupAcquiredDays(commits: CommitActivity[]) {
  const groups = new Map<string, CommitActivity[]>();
  for (const commit of commits) {
    const day = toJstDateKey(commit.authoredAt);
    const group = groups.get(day) ?? [];
    group.push(commit); groups.set(day, group);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([day, items]) => ({
    day, commits: [...items].sort((a, b) => b.authoredAt.localeCompare(a.authoredAt)),
    repositories: new Set(items.map(commit => commit.repository)).size,
    additions: items.reduce((sum, commit) => sum + commit.additions, 0),
    deletions: items.reduce((sum, commit) => sum + commit.deletions, 0),
  }));
}
