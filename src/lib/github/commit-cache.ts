import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CommitActivity } from "@/types/activity";

export type CachedRepository = { commits: Record<string, CommitActivity>; lastSyncedAt: string | null; lastCheckedAt: string | null };
export type CommitCache = { version: 1; repositories: Record<string, CachedRepository> };
export type CommitCacheStore = { read(): Promise<CommitCache>; write(cache: CommitCache): Promise<void> };

const empty = (): CommitCache => ({ version: 1, repositories: {} });
let cacheLock: Promise<unknown> = Promise.resolve();

export function withCommitCacheLock<T>(task: () => Promise<T>): Promise<T> {
  const run = cacheLock.then(task, task);
  cacheLock = run.then(() => undefined, () => undefined);
  return run;
}

export function createFileCommitCache(file = path.join(process.cwd(), ".next", "cache", "github-monitor", "commits.json")): CommitCacheStore {
  return {
    async read() {
      try {
        const parsed = JSON.parse(await fs.readFile(file, "utf8")) as CommitCache;
        return parsed.version === 1 && parsed.repositories ? parsed : empty();
      } catch { return empty(); }
    },
    async write(cache) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(cache), "utf8");
      await fs.rename(temporary, file);
    },
  };
}
