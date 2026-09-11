import { describe, expect, it } from "vitest";
import { toCommitActivity, toRepository } from "./transform";

describe("GitHub response transforms", () => {
  it("maps repository metadata", () => {
    const result = toRepository({ id: 1, owner: { login: "maruyamamasaya" }, name: "github-monitor", full_name: "maruyamamasaya/github-monitor", private: true, html_url: "https://github.com/maruyamamasaya/github-monitor", default_branch: "main", updated_at: "2026-09-11T00:00:00Z", pushed_at: null, language: "TypeScript", archived: false, fork: false });
    expect(result).toMatchObject({ id: 1, fullName: "maruyamamasaya/github-monitor", private: true, pushedAt: null });
  });
  it("maps commit stats and uses the subject line", () => {
    const result = toCommitActivity({ sha: "abc", html_url: "https://github.com/o/r/commit/abc", commit: { author: { date: "2026-09-11T00:00:00Z" }, message: "Subject\n\nBody" }, stats: { additions: 5, deletions: 2 }, files: [{ filename: "src/a.ts", status: "added", additions: 5, deletions: 0, changes: 5 }] }, "o/r");
    expect(result).toMatchObject({ sha: "abc", message: "Subject", additions: 5, deletions: 2, changedFiles: 1, files: [{ filename: "src/a.ts", status: "added", additions: 5 }] });
  });
});
