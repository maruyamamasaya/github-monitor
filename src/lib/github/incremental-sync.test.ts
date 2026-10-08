import { describe, expect, it, vi } from "vitest";
import type { CommitActivity, Repository } from "@/types/activity";
import type { CommitCache, CommitCacheStore } from "./commit-cache";
import { syncCommits } from "./incremental-sync";

const now = new Date("2026-09-11T06:00:00.000Z");
const repo = (pushedAt = "2026-09-11T05:00:00.000Z"): Repository => ({ id: 1, owner: "octo", name: "app", fullName: "octo/app", private: true, url: "https://github.com/octo/app", defaultBranch: "main", updatedAt: pushedAt, pushedAt, language: "TypeScript", archived: false, fork: false });
const commit = (sha: string): CommitActivity => ({ sha, repository: "octo/app", authoredAt: "2026-09-11T05:30:00.000Z", message: sha, additions: 2, deletions: 1, changedFiles: 1, url: `https://github.com/octo/app/commit/${sha}` });
function memoryStore(initial?: CommitCache) {
  let value: CommitCache = structuredClone(initial ?? { version: 1, repositories: {} });
  const store: CommitCacheStore = { read: vi.fn(async () => structuredClone(value)), write: vi.fn(async (next) => { value = structuredClone(next); }) };
  return { store, value: () => value };
}
const cached = (lastSyncedAt = "2026-09-11T05:00:00.000Z", lastCheckedAt = "2026-09-11T05:00:00.000Z"): CommitCache => ({ version: 1, lastFileDetailBackfillAt: now.toISOString(), repositories: { "octo/app": { commits: { old: commit("old") }, lastSyncedAt, lastCheckedAt } } });

describe("incremental commit sync", () => {
  it("persists branch progress and exposes it while pending even when quota pauses the next update", async () => {
    const memory = memoryStore();
    const api = { list: async (_repo: Repository, _since: string, context: import("./incremental-sync").ListContext) => {
      context.reserveRequest(); context.onBranchProgress?.({ completedBranches: 2, totalBranches: 5 });
      return { items: [], requests: 1, complete: false };
    }, detail: vi.fn() };
    const first = await syncCommits([repo()], 5000, api, memory.store, now, 1, { fullHistory: true });
    expect(first.syncStatus.branchProgress).toEqual([{ repository: "octo/app", completedBranches: 2, totalBranches: 5 }]);
    const paused = await syncCommits([repo()], 100, api, memory.store, now, 200, { fullHistory: true });
    expect(paused.syncStatus.branchProgress).toEqual(first.syncStatus.branchProgress);
  });
  it("prioritizes unstarted repositories before large partial scans", async () => {
    const initial = cached();
    initial.repositories["octo/app"].partial = true;
    initial.repositories["octo/app"].lastSyncedAt = null;
    const memory = memoryStore(initial);
    const calls: string[] = [];
    const result = await syncCommits([repo(), { ...repo(), fullName: "octo/second", name: "second" }, { ...repo(), fullName: "octo/third", name: "third" }], 5000, {
      list: async (repository, _since, context) => { calls.push(repository.fullName); context.reserveRequest(); return { items: [], requests: 1 }; }, detail: vi.fn(),
    }, memory.store, now, 2, { fullHistory: true });
    expect(calls).toEqual(["octo/second", "octo/third"]);
    expect(result.metrics.budgetRemaining).toBe(0);
    expect(memory.value().repositories["octo/second"].lastSyncedAt).toBe(now.toISOString());
    expect(memory.value().repositories["octo/app"].commits.old).toBeDefined();
  });

  it("rotates partial repositories using the oldest actual attempt first", async () => {
    const initial = cached();
    initial.repositories["octo/app"].partial = true;
    initial.repositories["octo/app"].lastAttemptedAt = now.toISOString();
    initial.repositories["octo/second"] = { ...structuredClone(initial.repositories["octo/app"]), lastAttemptedAt: "2026-09-10T00:00:00Z" };
    const calls: string[] = [];
    await syncCommits([repo(), { ...repo(), fullName: "octo/second", name: "second" }], 5000, {
      list: async (repository, _since, context) => { calls.push(repository.fullName); context.reserveRequest(); return { items: [], requests: 1, complete: false }; }, detail: vi.fn(),
    }, memoryStore(initial).store, now, 1, { fullHistory: true });
    expect(calls).toEqual(["octo/second"]);
  });
  it("reuses opposite-scope details only after their SHA was listed in the selected scope", async () => {
    const memory = memoryStore();
    const reusable = cached().repositories;
    reusable["octo/app"].commits.unmerged = commit("unmerged");
    const detail = vi.fn();
    const result = await syncCommits([repo()], 5000, { list: async () => ({ items: [{ sha: "old" }], requests: 1 }), detail }, memory.store, now, 200, { reusableDetails: reusable });
    expect(detail).not.toHaveBeenCalled();
    expect(result.commitsByRepository["octo/app"].map((item) => item.sha)).toEqual(["old"]);
  });

  it("rescans 90 days for all branches and removes commits reachable only from deleted branches", async () => {
    const memory = memoryStore(cached("2026-09-10T00:00:00Z", "2026-09-10T00:00:00Z"));
    const list = vi.fn(async (_repo: Repository, since: string) => { void since; return { items: [{ sha: "new" }], requests: 1 }; });
    const result = await syncCommits([repo()], 5000, { list, detail: async () => commit("new") }, memory.store, now, 200, { fullHistory: true });
    expect(result.commitsByRepository["octo/app"].map((item) => item.sha)).toEqual(["new"]);
    expect(memory.value().repositories["octo/app"].partial).toBe(false);
    expect(new Date(list.mock.calls[0][1]).getTime()).toBe(now.getTime() - 90 * 86_400_000);
  });

  it("retries pending details without waiting for the warm cache TTL and clears partial status", async () => {
    const memory = memoryStore();
    const list = vi.fn(async () => ({ items: [{ sha: "a" }, { sha: "b" }], requests: 1 }));
    const api = { list, detail: async (_repo: Repository, item: { sha: string }) => commit(item.sha) };
    await syncCommits([repo()], 5000, api, memory.store, now, 2);
    expect(memory.value().repositories["octo/app"].partial).toBe(true);
    const completed = await syncCommits([repo()], 5000, api, memory.store, new Date(now.getTime() + 1000), 200);
    expect(list).toHaveBeenCalledTimes(2);
    expect(completed.commitsByRepository["octo/app"]).toHaveLength(2);
    expect(memory.value().repositories["octo/app"].partial).toBe(false);
    expect(completed.warnings.join(" ")).not.toContain("部分取得");
  });

  it("keeps previous history on partial scans, does not advance the cursor and persists the warning", async () => {
    const initial = cached("2026-09-10T00:00:00Z", "2026-09-10T00:00:00Z");
    const memory = memoryStore(initial);
    const result = await syncCommits([repo()], 5000, { list: async (_repo, _since, context) => { context.reserveRequest(); return { items: [], requests: 1, complete: false }; }, detail: vi.fn() }, memory.store, now, 1, { fullHistory: true });
    expect(result.commitsByRepository["octo/app"]).toHaveLength(1);
    expect(result.metrics.apiRequests).toBe(1); expect(result.metrics.budgetRemaining).toBe(0);
    expect(memory.value().repositories["octo/app"].lastSyncedAt).toBe(initial.repositories["octo/app"].lastSyncedAt);
    expect(memory.value().repositories["octo/app"].lastCheckedAt).toBeNull();
    expect(result.warnings.join(" ")).toContain("部分取得");
  });

  it("shares list request reservations between concurrent repositories", async () => {
    const memory = memoryStore();
    let calls = 0;
    const result = await syncCommits([repo(), { ...repo(), name: "second", fullName: "octo/second" }], 5000, { list: async (_repo, _since, context) => { let requests = 0; while (context.reserveRequest()) { requests++; calls++; await Promise.resolve(); } return { items: [], requests, complete: false }; }, detail: vi.fn() }, memory.store, now, 3, { fullHistory: true });
    expect(calls).toBe(3); expect(result.metrics.apiRequests).toBe(3); expect(result.metrics.budgetRemaining).toBe(0);
  });
  it("performs a cold 90-day sync and removes duplicate SHAs", async () => {
    const memory = memoryStore();
    const list = vi.fn(async (repository: Repository, since: string) => { void repository; void since; return { items: [{ sha: "new" }, { sha: "new" }], requests: 1 }; });
    const detail = vi.fn(async () => commit("new"));
    const result = await syncCommits([repo()], 5000, { list, detail }, memory.store, now);
    expect(new Date(list.mock.calls[0][1]).getTime()).toBe(now.getTime() - 90 * 86_400_000);
    expect(detail).toHaveBeenCalledOnce();
    expect(result.metrics.cold).toBe(true);
    expect(result.commitsByRepository["octo/app"]).toHaveLength(1);
  });

  it("uses a fresh warm cache without any API call", async () => {
    const memory = memoryStore(cached(undefined, "2026-09-11T05:55:00.000Z"));
    const list = vi.fn(); const detail = vi.fn();
    const result = await syncCommits([repo()], 5000, { list, detail }, memory.store, now);
    expect(list).not.toHaveBeenCalled(); expect(detail).not.toHaveBeenCalled();
    expect(result.metrics.cacheHits).toBe(1); expect(result.metrics.cold).toBe(false);
  });

  it("requests the overlap window and fetches only a new commit detail", async () => {
    const memory = memoryStore(cached("2026-09-10T06:00:00.000Z", "2026-09-10T06:00:00.000Z"));
    const list = vi.fn(async (repository: Repository, since: string) => { void repository; void since; return { items: [{ sha: "old" }, { sha: "new" }], requests: 1 }; });
    const detail = vi.fn(async () => commit("new"));
    await syncCommits([repo()], 5000, { list, detail }, memory.store, now);
    expect(list.mock.calls[0][1]).toBe("2026-09-07T06:00:00.000Z");
    expect(detail).toHaveBeenCalledOnce(); expect(memory.value().repositories["octo/app"].commits).toHaveProperty("new");
  });

  it("checks an inactive repository only once per day", async () => {
    const memory = memoryStore(cached("2026-08-01T00:00:00.000Z", "2026-09-11T00:00:00.000Z"));
    const list = vi.fn();
    await syncCommits([repo("2026-07-01T00:00:00.000Z")], 5000, { list, detail: vi.fn() }, memory.store, now);
    expect(list).not.toHaveBeenCalled();
  });

  it("stops details at the API budget", async () => {
    const memory = memoryStore();
    const result = await syncCommits([repo()], 5000, { list: async () => ({ items: [{ sha: "a" }, { sha: "b" }], requests: 1 }), detail: async (_repo, item) => commit(item.sha) }, memory.store, now, 2);
    expect(result.metrics.commitDetailsFetched).toBe(1); expect(result.metrics.budgetRemaining).toBe(0);
  });

  it("uses cache and skips heavy sync when rate limit is low", async () => {
    const memory = memoryStore(cached(undefined, "2026-09-01T00:00:00.000Z"));
    const list = vi.fn();
    const result = await syncCommits([repo()], 499, { list, detail: vi.fn() }, memory.store, now);
    expect(list).not.toHaveBeenCalled(); expect(result.warnings.join(" ")).toContain("rate limit");
  });

  it("isolates a repository list failure and retains cached commits", async () => {
    const memory = memoryStore(cached(undefined, "2026-09-01T00:00:00.000Z"));
    const result = await syncCommits([repo()], 5000, { list: async () => { throw new Error("network"); }, detail: vi.fn() }, memory.store, now);
    expect(result.commitsByRepository["octo/app"]).toHaveLength(1); expect(result.warnings[0]).toContain("cache");
  });

  it("records a 409 repository, pauses retries for 24 hours, and restores it after a successful retry", async () => {
    const memory = memoryStore(cached(undefined, "2026-09-01T00:00:00.000Z"));
    const list = vi.fn().mockRejectedValueOnce(Object.assign(new Error("Conflict"), { status: 409 })).mockResolvedValue({ items: [], requests: 1 });
    const failed = await syncCommits([repo()], 5000, { list, detail: vi.fn() }, memory.store, now);
    expect(failed.warnings).toHaveLength(0);
    expect(failed.failedRepositories).toEqual([{ name: "octo/app", status: 409, at: now.toISOString(), excluded: true }]);
    await syncCommits([repo()], 5000, { list, detail: vi.fn() }, memory.store, new Date(now.getTime() + 60_000));
    expect(list).toHaveBeenCalledTimes(1);
    const recovered = await syncCommits([repo()], 5000, { list, detail: vi.fn() }, memory.store, new Date(now.getTime() + 86_400_000));
    expect(list).toHaveBeenCalledTimes(2);
    expect(recovered.failedRepositories).toHaveLength(0);
  });

  it("backfills at most five recent cached commits without listing again", async () => {
    const initial = cached(undefined, "2026-09-11T05:55:00.000Z");
    initial.lastFileDetailBackfillAt = "2026-09-11T04:00:00.000Z";
    initial.repositories["octo/app"].commits = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`sha-${index}`, { ...commit(`sha-${index}`), authoredAt: `2026-09-11T0${index}:00:00.000Z` }]));
    const memory = memoryStore(initial); const list = vi.fn();
    const detail = vi.fn(async (_repo: Repository, item: { sha: string }) => ({ ...commit(item.sha), files: [] }));
    const result = await syncCommits([repo()], 5000, { list, detail }, memory.store, now);
    expect(list).not.toHaveBeenCalled(); expect(detail).toHaveBeenCalledTimes(5);
    expect(result.metrics).toMatchObject({ apiRequests: 5, commitDetailsFetched: 5, fileDetailsBackfilled: 5 });
    expect(Object.values(memory.value().repositories["octo/app"].commits).filter((item) => Array.isArray(item.files))).toHaveLength(5);
  });

  it("skips backfill during its cooldown or below the conservative rate threshold", async () => {
    const recent = memoryStore(cached()); const detail = vi.fn();
    await syncCommits([repo()], 5000, { list: vi.fn(), detail }, recent.store, now);
    expect(detail).not.toHaveBeenCalled();
    const old = cached(); old.lastFileDetailBackfillAt = "2026-09-11T04:00:00.000Z";
    await syncCommits([repo()], 999, { list: vi.fn(), detail }, memoryStore(old).store, now);
    expect(detail).not.toHaveBeenCalled();
  });
});

it("rescans history after adding an author while reusing existing details", async () => {
 const initial = cached(); initial.authors=["octo"]; initial.repositories["octo/app"].branchHeads={tip:{since:"2026-07-01",items:[]}};
 const memory=memoryStore(initial); const list=vi.fn(async (_repo: Repository, since: string) => ({items:[{sha:"old"},{sha:"additional"}],requests:1, since})); const detail=vi.fn(async (_repo: Repository, item: {sha:string})=>commit(item.sha));
 await syncCommits([repo()],5000,{list,detail},memory.store,now,20,{authors:["octo","second"]});
 expect(list).toHaveBeenCalledOnce(); expect(list.mock.calls[0][1]).toBe("2026-06-13T06:00:00.000Z");
 expect(detail).toHaveBeenCalledOnce(); expect(Object.keys(memory.value().repositories["octo/app"].commits)).toEqual(["old","additional"]);
 expect(memory.value().authors).toEqual(["octo","second"]);
 expect(memory.value().repositories["octo/app"].branchHeads).toEqual({});
});

it("does not report excluded 409 repositories as pending after an author change", async()=>{
 const memory=memoryStore(cached());
 const result=await syncCommits([repo()],5000,{list:vi.fn().mockRejectedValue(Object.assign(new Error("Conflict"),{status:409})),detail:vi.fn()},memory.store,now,20,{authors:["octo","second"]});
 expect(result.syncStatus.pendingRepositories).toBe(0); expect(result.warnings).toEqual([]); expect(result.failedRepositories[0].excluded).toBe(true);
});
