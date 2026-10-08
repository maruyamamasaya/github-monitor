import { describe, expect, it } from "vitest";
import type { CommitActivity, CommitFileDetail, RepositoryActivity } from "@/types/activity";
import { aggregateMetrics } from "./aggregate";
import { buildCodeScope } from "./code-scope";

const now = new Date("2026-10-07T06:00:00Z");
const file = (filename: string, additions = 10, deletions = 2): CommitFileDetail => ({ filename, status: "modified", additions, deletions, changes: additions + deletions });
const commit = (sha: string, authoredAt: string, files?: CommitFileDetail[]): CommitActivity => ({ sha, repository: "o/r", authoredAt, files, message: sha, additions: files?.reduce((sum, f) => sum + f.additions, 0) ?? 999, deletions: files?.reduce((sum, f) => sum + f.deletions, 0) ?? 0, changedFiles: files?.length ?? 1, url: `https://github.com/o/r/commit/${sha}` });
function repo(commits: CommitActivity[]): RepositoryActivity {
  return { repository: { id: 1, owner: "o", name: "r", fullName: "o/r", private: false, url: "https://github.com/o/r", defaultBranch: "main", updatedAt: now.toISOString(), pushedAt: now.toISOString(), language: "TypeScript", archived: false, fork: false }, commits, metrics: { today: aggregateMetrics(commits, "today", now), week: aggregateMetrics(commits, "week", now), month: aggregateMetrics(commits, "month", now), quarter: aggregateMetrics(commits, "quarter", now) } };
}

describe("code-only dashboard", () => {
  it("counts a mixed commit once while removing docs, tests, config and generated files from every metric", () => {
    const repositories = [repo([
      commit("mixed", "2026-10-07T01:00:00Z", [file("src/app.ts", 5, 3), file("notes/memo.md", 1000), file("src/app.test.ts"), file("next.config.ts"), file("generated/client.ts")]),
      commit("docs", "2026-10-06T01:00:00Z", [file("README.md", 500)]),
      commit("test", "2026-10-05T01:00:00Z", [file("tests/a.ts")]),
    ])];
    const before = structuredClone(repositories);
    const result = buildCodeScope(repositories, now);
    expect(result.repositories[0].metrics.month).toMatchObject({ commits: 1, additions: 5, deletions: 3, changedLines: 8, changedFiles: 1, activeDays: 1 });
    expect(result.analysis.development.month.snapshot).toMatchObject({ commits: 1, meaningfulChangedLines: 8, testLines: 0, docsLines: 0, activeDays: 1 });
    expect(result.analysis.development.month.sessions.count).toBe(1);
    expect(result.analysis.commitSizes.month.find((bucket) => bucket.key === "XS")?.count).toBe(1);
    expect(result.dailyActivity.at(-1)).toMatchObject({ commits: 1, changedLines: 8, changedFiles: 1 });
    expect(result.analysis.anomaly.pulse.todayCommits).toBe(1);
    expect(repositories).toEqual(before);
  });

  it("excludes unknown details and reports their count within each JST period", () => {
    const result = buildCodeScope([repo([
      commit("today", "2026-10-06T15:00:00Z"),
      commit("week", "2026-10-02T01:00:00Z"),
      commit("month", "2026-09-20T01:00:00Z"),
      commit("old", "2026-08-01T01:00:00Z"),
      commit("future", "2026-10-08T01:00:00Z"),
      commit("empty", now.toISOString(), []),
    ])], now);
    expect(result.unclassifiedCommits).toEqual({ today: 1, week: 2, month: 3, quarter: 4 });
    expect(result.analysis.summaries.month.commits).toBe(0);
    expect(result.analysis.focus.month.activeRepositories).toBe(0);
  });

  it("recomputes history and counts code changes at the JST day boundary", () => {
    const result = buildCodeScope([repo([
      commit("previous", "2026-10-06T14:59:59Z", [file("src/app.ts")]),
      commit("today", "2026-10-06T15:00:00Z", [file("src/app.ts")]),
      commit("docs", "2026-10-06T15:20:00Z", [file("memo.md")]),
    ])], now);
    expect(result.analysis.activeDays).toEqual({ today: 1, week: 2, month: 2, quarter: 2 });
    expect(result.analysis.summaries.today.commits).toBe(1);
    expect(result.analysis.development.week.sessions.count).toBe(1);
    expect(result.dailyActivity.slice(-2).map((day) => day.commits)).toEqual([1, 1]);
  });

  it("includes HTML and stylesheets but excludes minified assets and documentation paths", () => {
    const result = buildCodeScope([repo([commit("web", now.toISOString(), [file("index.html"), file("src/app.css"), file("src/theme.scss"), file("dist/app.js"), file("app.min.css"), file("docs/example.ts")])])], now);
    expect(result.repositories[0].metrics.today).toMatchObject({ commits: 1, changedFiles: 3, changedLines: 36 });
  });
});

