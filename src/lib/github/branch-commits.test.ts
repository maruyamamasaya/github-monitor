import { describe, expect, it, vi } from "vitest";
import type { Repository } from "@/types/activity";
import { listBranchCommits } from "./branch-commits";
import type { BranchHeadSnapshot } from "./commit-cache";

const repo: Repository = { id: 1, owner: "o", name: "r", fullName: "o/r", defaultBranch: "main", private: false, url: "https://github.com/o/r", updatedAt: "2026-10-07T00:00:00Z", pushedAt: null, language: null, archived: false, fork: false };
const since = "2026-07-09T00:00:00Z";
function budget(max = 200) { let remaining = max; return { reserveRequest() { if (!remaining) return false; remaining--; return true; } }; }
const fetcher = (handler: (path: string) => unknown) => { const calls = vi.fn(handler); return { calls, fetch: async <T>(path: string) => calls(path) as T }; };

describe("branch commit listing", () => {
  it("reports branch progress across batches, counting aliases and leaving incomplete totals unknown", async () => {
    const api = fetcher(path => path.includes("/branches?") ? [{ name: "main", commit: { sha: "a" } }, { name: "alias", commit: { sha: "a" } }, { name: "work", commit: { sha: "b" } }] : []);
    const branchHeads: Record<string, BranchHeadSnapshot> = {};
    const onBranchProgress = vi.fn();
    await listBranchCommits(repo, "octo", since, "all", api.fetch, { ...budget(2), branchHeads, onBranchProgress });
    expect(onBranchProgress).toHaveBeenLastCalledWith({ completedBranches: 2, totalBranches: 3 });
    await listBranchCommits(repo, "octo", since, "all", api.fetch, { ...budget(2), branchHeads, onBranchProgress });
    expect(onBranchProgress).toHaveBeenLastCalledWith({ completedBranches: 3, totalBranches: 3 });
    const paginated = fetcher(() => Array.from({ length: 100 }, (_, i) => ({ name: `b${i}`, commit: { sha: "a" } })));
    await listBranchCommits(repo, "octo", since, "all", paginated.fetch, { ...budget(1), branchHeads, onBranchProgress });
    expect(onBranchProgress).toHaveBeenLastCalledWith({ completedBranches: 100, totalBranches: null });
  });
  it("persists completed head scans so the next budget-limited sync progresses instead of starting over", async () => {
    const api = fetcher((path) => path.includes("/branches?") ? [{ name: "main", commit: { sha: "a" } }, { name: "work", commit: { sha: "b" } }] : [{ sha: path.includes("sha=a") ? "main-commit" : "work-commit" }]);
    const branchHeads: Record<string, BranchHeadSnapshot> = {};
    const first = await listBranchCommits(repo, "octo", since, "all", api.fetch, { ...budget(2), branchHeads });
    expect(first.complete).toBe(false); expect(branchHeads.a).toBeDefined(); expect(branchHeads.b).toBeUndefined();
    const second = await listBranchCommits(repo, "octo", since, "all", api.fetch, { ...budget(2), branchHeads });
    expect(second.complete).toBe(true); expect(second.items).toEqual([{ sha: "main-commit" }, { sha: "work-commit" }]);
    const third = await listBranchCommits(repo, "octo", since, "all", api.fetch, { ...budget(1), branchHeads });
    expect(third.complete).toBe(true); expect(third.requests).toBe(1);
  });

  it("filters expired cached head entries and drops snapshots of deleted branch tips", async () => {
    const api = fetcher(() => [{ name: "main", commit: { sha: "tip" } }]);
    const branchHeads: Record<string, BranchHeadSnapshot> = { tip: { since, items: [{ sha: "expired", authoredAt: since }, { sha: "current", authoredAt: "2026-10-01T00:00:00Z" }] }, deleted: { since, items: [{ sha: "deleted" }] } };
    const result = await listBranchCommits(repo, "octo", "2026-07-10T00:00:00Z", "all", api.fetch, { ...budget(1), branchHeads });
    expect(result.items.map((item) => item.sha)).toEqual(["current"]); expect(branchHeads.deleted).toBeUndefined(); expect(result.complete).toBe(true);
  });
  it("walks all pushed branch tips, skips identical tips and deduplicates shared SHAs", async () => {
    const api = fetcher((path) => {
      if (path.includes("/branches?")) return [{ name: "feature/x", commit: { sha: "feature-tip" } }, { name: "main", commit: { sha: "main-tip" } }, { name: "alias", commit: { sha: "feature-tip" } }];
      return path.includes("sha=main-tip") ? [{ sha: "shared" }] : [{ sha: "shared" }, { sha: "unmerged" }];
    });
    const result = await listBranchCommits(repo, "octo", since, "all", api.fetch, budget());
    expect(result).toEqual({ items: [{ sha: "shared" }, { sha: "unmerged" }], requests: 3, complete: true });
    expect(api.calls.mock.calls[1][0]).toContain("sha=main-tip");
    expect(api.calls.mock.calls[2][0]).toContain("author=octo");
  });

  it("paginates branch lists and commit histories", async () => {
    const api = fetcher((path) => {
      const page = new URL(`https://api.github.com${path}`).searchParams.get("page");
      if (path.includes("/branches?")) return page === "1" ? Array.from({ length: 100 }, (_, i) => ({ name: `b${i}`, commit: { sha: "tip" } })) : [{ name: "last", commit: { sha: "other" } }];
      if (path.includes("sha=other")) return [{ sha: "last" }];
      return page === "1" ? Array.from({ length: 100 }, (_, i) => ({ sha: `c${i}` })) : [{ sha: "c100" }];
    });
    const result = await listBranchCommits(repo, "octo", since, "all", api.fetch, budget());
    expect(result.requests).toBe(5); expect(result.items).toHaveLength(102); expect(result.complete).toBe(true);
  });

  it("reserves the budget before dispatch and marks unfinished scans as partial", async () => {
    const api = fetcher((path) => path.includes("/branches?") ? [{ name: "main", commit: { sha: "a" } }, { name: "work", commit: { sha: "b" } }] : [{ sha: "shared" }]);
    const result = await listBranchCommits(repo, "octo", since, "all", api.fetch, budget(2));
    expect(api.calls).toHaveBeenCalledTimes(2); expect(result.complete).toBe(false); expect(result.items).toEqual([{ sha: "shared" }]);
  });

  it("uses only the encoded default branch without listing branches in default mode", async () => {
    const api = fetcher(() => []);
    const result = await listBranchCommits({ ...repo, defaultBranch: "release/x" }, "user+name", since, "default", api.fetch, budget());
    expect(result.complete).toBe(true); expect(api.calls).toHaveBeenCalledOnce();
    expect(api.calls.mock.calls[0][0]).toContain("sha=release%2Fx");
    expect(api.calls.mock.calls[0][0]).toContain("author=user%2Bname");
  });

  it("caps unique commits at 1000 and explicitly reports truncation", async () => {
    const api = fetcher((path) => Array.from({ length: 100 }, (_, i) => ({ sha: `${new URL(`https://api.github.com${path}`).searchParams.get("page")}-${i}` })));
    const result = await listBranchCommits(repo, "octo", since, "default", api.fetch, budget());
    expect(result.items).toHaveLength(1000); expect(result.requests).toBe(10); expect(result.complete).toBe(false);
  });
});

it("combines authors once per SHA and never caches a partially scanned author set", async () => {
 const api = fetcher(path => path.includes("/branches?") ? [{name:"main",commit:{sha:"tip"}}] : [{sha:"shared"}, {sha:path.includes("author=first") ? "a" : "b"}]);
 const branchHeads: Record<string, BranchHeadSnapshot> = {};
 const partial = await listBranchCommits(repo, ["first","second"], since, "all", api.fetch, {...budget(2),branchHeads});
 expect(partial.complete).toBe(false); expect(branchHeads.tip).toBeUndefined();
 const result = await listBranchCommits(repo, ["first","second","first"], since, "all", api.fetch, {...budget(3),branchHeads});
 expect(result.complete).toBe(true); expect(result.items.map(x=>x.sha)).toEqual(["shared","a","b"]);
 const reused = await listBranchCommits(repo, ["first","second"], since, "all", api.fetch, {...budget(1),branchHeads});
 expect(reused.requests).toBe(1); expect(reused.items).toEqual(result.items);
});
