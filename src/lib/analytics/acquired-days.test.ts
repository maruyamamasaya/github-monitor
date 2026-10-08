import { expect, it } from "vitest";
import { groupAcquiredDays } from "./acquired-days";
import type { CommitActivity } from "@/types/activity";

const commit = (repository: string, authoredAt: string): CommitActivity => ({ repository, authoredAt, sha: "shared", message: "change", additions: 3, deletions: 1, changedFiles: 1, url: "https://github.com/o/r/commit/shared" });
it("groups author dates at JST midnight across repositories without merging shared SHAs", () => {
  const days = groupAcquiredDays([commit("o/a", "2026-10-07T14:59:59Z"), commit("o/a", "2026-10-07T15:00:00Z"), commit("o/b", "2026-10-08T00:00:00Z")]);
  expect(days.map(day => day.day)).toEqual(["2026-10-08", "2026-10-07"]);
  expect(days[0]).toMatchObject({ repositories: 2, additions: 6, deletions: 2 });
  expect(days[0].commits.map(item => item.repository)).toEqual(["o/b", "o/a"]);
  expect(groupAcquiredDays([])).toEqual([]);
});
