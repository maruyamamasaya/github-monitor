import { describe, expect, it, vi } from "vitest";
import type { Repository } from "@/types/activity";
import { countSourceLines, emptySourceSizeCache, syncSourceSize, type SourceSizeApi, type SourceTree } from "./source-size-sync";

const now = new Date("2026-10-08T01:00:00Z");
const repo: Repository = { id: 1, owner: "o", name: "r", fullName: "o/r", defaultBranch: "main", private: false, url: "https://github.com/o/r", updatedAt: now.toISOString(), pushedAt: now.toISOString(), language: null, archived: false, fork: false };
const file = (path: string, sha = path, size = 10) => ({ path, sha, size, type: "blob", mode: "100644" });
function apiFor(tree: SourceTree): SourceSizeApi {
  return {
    rate: vi.fn(async () => ({ remaining: 5000, resetAt: "2026-10-08T02:00:00Z" })),
    repositories: async request => request(async () => [repo]),
    head: vi.fn(async () => ({ sha: "head", treeSha: "tree" })),
    tree: vi.fn(async () => tree),
    blob: vi.fn(async () => ({ content: Buffer.from("first\nsecond\n").toString("base64"), encoding: "base64" })),
  };
}

describe("source size", () => {
  it("never marks unlisted repositories complete when the initial quota check fails", async () => {
    const cache = emptySourceSizeCache();
    const api = apiFor({ truncated: false, tree: [] });
    api.rate = vi.fn(async () => ({ remaining: 0, resetAt: "2026-10-08T02:00:00Z" }));
    expect(await syncSourceSize(cache, api, now)).toMatchObject({ complete: false, totalFiles: null, pauseReason: "quota" });
  });
  it.each([["", 0], ["x", 1], ["x\n", 1], ["x\r\ny\r\n", 2], ["\n\n", 2], ["// comment\n\nx", 3]])("counts physical lines in %j", (value, count) => expect(countSourceLines(Buffer.from(value))).toBe(count));
  it("recognizes binary/invalid UTF-8 and decodes UTF-16", () => {
    expect(countSourceLines(Buffer.from([0xff, 0x80]))).toBeNull();
    expect(countSourceLines(Buffer.from("a\0b"))).toBeNull();
    expect(countSourceLines(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("a\r\nb\n", "utf16le")]))).toBe(2);
  });
  it("separates categories, counts duplicate paths independently, and excludes generated/large/symlink files", async () => {
    const cache = emptySourceSizeCache();
    const api = apiFor({ truncated: false, tree: [file("src/a.ts", "same"), file("src/b.ts", "same"), file("src/a.test.ts"), file("README.md"), file("tsconfig.json"), file("node_modules/a.ts"), file("package-lock.json"), file("photo.png"), file("huge.ts", "huge", 3 * 1024 * 1024), { ...file("link.ts"), mode: "120000" }] });
    const summary = await syncSourceSize(cache, api, now);
    expect(summary.lines).toEqual({ code: 4, test: 2, docs: 2, config: 2 });
    expect(api.blob).toHaveBeenCalledTimes(4);
    expect(summary.repositories[0]).toMatchObject({ complete: true, checkedFiles: 5, totalFiles: 5, oversizedFiles: 1, excludedFiles: 4 });
  });
  it("resumes budget-limited files and skips unchanged trees/blobs", async () => {
    const cache = emptySourceSizeCache();
    const api = apiFor({ truncated: false, tree: [file("a.ts"), file("b.ts")] });
    const first = await syncSourceSize(cache, api, now, 5);
    expect(first).toMatchObject({ complete: false, checkedFiles: 1, totalFiles: 2, pauseReason: "budget", requests: 5 });
    const second = await syncSourceSize(cache, api, now, 5);
    expect(second.complete).toBe(true); expect(api.tree).toHaveBeenCalledTimes(1); expect(api.blob).toHaveBeenCalledTimes(2);
    const third = await syncSourceSize(cache, api, now);
    expect(third.requests).toBe(3); expect(api.tree).toHaveBeenCalledTimes(1); expect(api.blob).toHaveBeenCalledTimes(2);
  });
  it("reuses renamed files and removes deleted files when the head changes", async () => {
    const cache = emptySourceSizeCache();
    const api = apiFor({ truncated: false, tree: [file("a.ts", "a"), file("b.ts", "b")] });
    await syncSourceSize(cache, api, now);
    api.head = vi.fn(async () => ({ sha: "new", treeSha: "new-tree" }));
    api.tree = vi.fn(async () => ({ truncated: false, tree: [file("renamed.ts", "a"), file("new.ts", "c")] }));
    await syncSourceSize(cache, api, now);
    expect(api.blob).toHaveBeenCalledTimes(3); expect(cache.blobs.b).toBeUndefined();
    expect(cache.repositories[repo.fullName].files.map(item => item.path)).toEqual(["renamed.ts", "new.ts"]);
  });
  it("persists a subtree queue for truncated recursive trees across budgets", async () => {
    const cache = emptySourceSizeCache();
    const api = apiFor({ truncated: true, tree: [file("discard.ts")] });
    api.tree = vi.fn(async (_repo, sha, recursive) => recursive ? { truncated: true, tree: [file("discard.ts")] } : sha === "tree" ? { truncated: false, tree: [{ path: "src", sha: "sub", type: "tree", mode: "040000" }] } : { truncated: false, tree: [file("a.ts")] });
    const first = await syncSourceSize(cache, api, now, 5);
    expect(first.totalFiles).toBeNull(); expect(cache.repositories[repo.fullName].pendingTrees).toEqual([{ sha: "sub", prefix: "src/" }]);
    const second = await syncSourceSize(cache, api, now);
    expect(second.complete).toBe(true); expect(second.lines.code).toBe(2);
    expect(cache.repositories[repo.fullName].files[0].path).toBe("src/a.ts");
    expect(api.tree).toHaveBeenCalledTimes(3);
  });
  it("guards low quota and secondary limits without losing counts", async () => {
    const cache = emptySourceSizeCache();
    const api = apiFor({ truncated: false, tree: [file("a.ts")] });
    await syncSourceSize(cache, api, now);
    api.rate = vi.fn(async () => ({ remaining: 499, resetAt: "2026-10-08T02:00:00Z" }));
    expect(await syncSourceSize(cache, api, now)).toMatchObject({ pauseReason: "quota", lines: { code: 2 } });
    expect(api.head).toHaveBeenCalledTimes(1);
    api.rate = vi.fn(async () => { throw Object.assign(new Error("restricted"), { status: 429 }); });
    expect((await syncSourceSize(cache, api, now)).pauseReason).toBe("rate-limit");
    await syncSourceSize(cache, api, now); expect(api.rate).toHaveBeenCalledTimes(1);
  });
  it("retries failed blobs and records empty repositories without an endless partial state", async () => {
    const cache = emptySourceSizeCache();
    const api = apiFor({ truncated: false, tree: [file("a.ts")] });
    const blob = api.blob;
    api.blob = vi.fn(async () => { throw new Error("failure"); });
    const first = await syncSourceSize(cache, api, now);
    expect(first.complete).toBe(false); expect(first.repositories[0].error).toBe("fetch");
    api.blob = blob;
    expect((await syncSourceSize(cache, api, now)).complete).toBe(true);
    api.head = vi.fn(async () => { throw Object.assign(new Error("empty"), { status: 409 }); });
    const empty = await syncSourceSize(cache, api, now);
    expect(empty.complete).toBe(true); expect(empty.lines.code).toBe(0); expect(empty.repositories[0].error).toBe("empty");
  });
});
