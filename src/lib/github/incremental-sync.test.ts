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
