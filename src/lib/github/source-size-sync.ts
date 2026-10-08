import { classifyFile, isMeaningfulFile } from "../analytics/development/file-classification";
import { SOURCE_CATEGORIES, type SourceCategory, type SourceSizeSummary, type SourceTotals } from "../../types/source-size";
import type { Repository } from "@/types/activity";

export const SOURCE_SIZE_BUDGET = 200;
export const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
type SourceFile = { path: string; sha: string; category: SourceCategory; size: number };
type TreeEntry = { path: string; sha: string; type: string; mode: string; size?: number };
export type SourceTree = { tree: TreeEntry[]; truncated: boolean };
export type SourceRepositoryCache = {
  branch: string; head: string | null; files: SourceFile[]; pendingTrees: { sha: string; prefix: string }[];
  treeComplete: boolean; excludedFiles: number; oversizedFiles: number;
  lastUpdatedAt: string | null; lastAttemptedAt: string | null; error: "fetch" | "empty" | "tree-limit" | null;
};
export type SourceSizeCache = {
  version: 1; repositories: Record<string, SourceRepositoryCache>; blobs: Record<string, number | null>;
  lastAttemptedAt: string | null; listedAt: string | null; requests: number; pauseReason: SourceSizeSummary["pauseReason"]; resetAt: string | null;
};
export type SourceSizeApi = {
  rate(): Promise<{ remaining: number; resetAt: string }>;
  repositories(request: <T>(task: () => Promise<T>) => Promise<T>): Promise<Repository[]>;
  head(repo: Repository): Promise<{ sha: string; treeSha: string }>;
  tree(repo: Repository, sha: string, recursive: boolean): Promise<SourceTree>;
  blob(repo: Repository, sha: string): Promise<{ content: string; encoding: string }>;
};
export const emptySourceSizeCache = (): SourceSizeCache => ({ version: 1, repositories: {}, blobs: {}, lastAttemptedAt: null, listedAt: null, requests: 0, pauseReason: null, resetAt: null });
const emptyTotals = (): SourceTotals => ({ code: 0, test: 0, docs: 0, config: 0 });
const known = (cache: SourceSizeCache, sha: string) => Object.hasOwn(cache.blobs, sha);

// Physical text lines, including blanks/comments, without a phantom line after a final newline.
export function countSourceLines(bytes: Uint8Array): number | null {
  let text: string;
  try {
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch { return null; }
  if (text.includes("\0")) return null;
  if (!text.length) return 0;
  const normalized = text.replace(/\r\n?/g, "\n");
  return normalized.split("\n").length - Number(normalized.endsWith("\n"));
}

export function summarizeSourceSize(cache: SourceSizeCache): SourceSizeSummary {
  const repositories = Object.entries(cache.repositories).map(([repository, state]) => {
    const lines = emptyTotals();
    let checkedFiles = 0;
    let binaryFiles = 0;
    for (const file of state.files) {
      if (!known(cache, file.sha)) continue;
      checkedFiles++;
      const count = cache.blobs[file.sha];
      if (count === null) binaryFiles++; else lines[file.category] += count;
    }
    return { repository, branch: state.branch, lines, checkedFiles, totalFiles: state.treeComplete ? state.files.length : null,
      complete: state.treeComplete && checkedFiles === state.files.length && (!state.error || state.error === "empty"),
      lastUpdatedAt: state.lastUpdatedAt, lastAttemptedAt: state.lastAttemptedAt,
      excludedFiles: state.excludedFiles + binaryFiles, oversizedFiles: state.oversizedFiles, error: state.error };
  }).sort((a, b) => a.repository.localeCompare(b.repository));
  const lines = emptyTotals();
  for (const repo of repositories) for (const category of SOURCE_CATEGORIES) lines[category] += repo.lines[category];
  return { repositories, lines, checkedFiles: repositories.reduce((sum, repo) => sum + repo.checkedFiles, 0),
    totalFiles: cache.listedAt && repositories.every(repo => repo.totalFiles !== null) ? repositories.reduce((sum, repo) => sum + repo.totalFiles!, 0) : null,
    complete: cache.listedAt !== null && repositories.every(repo => repo.complete),
    lastAttemptedAt: cache.lastAttemptedAt, requests: cache.requests, pauseReason: cache.pauseReason, resetAt: cache.resetAt };
}

class BudgetReached extends Error {}

export async function syncSourceSize(cache: SourceSizeCache, api: SourceSizeApi, now = new Date(), budget = SOURCE_SIZE_BUDGET): Promise<SourceSizeSummary> {
  // Quota/secondary-limit pauses are shared by every repository in this batch.
  if (cache.pauseReason === "rate-limit" && cache.resetAt && new Date(cache.resetAt) > now) return summarizeSourceSize(cache);
  cache.requests = 0; cache.pauseReason = null; cache.resetAt = null;
  cache.lastAttemptedAt = now.toISOString();
  const request = async <T>(task: () => Promise<T>) => {
    if (cache.requests >= budget) throw new BudgetReached();
    cache.requests++;
    return task();
  };
  const stop = (error: unknown) => {
    if (error instanceof BudgetReached) { cache.pauseReason = "budget"; return true; }
    const status = error instanceof Error && "status" in error ? error.status : null;
    if (status === 403 || status === 429) {
      cache.pauseReason = "rate-limit"; cache.resetAt = new Date(now.getTime() + 60_000).toISOString(); return true;
    }
    return false;
  };
  let repositories: Repository[];
  try {
    const rate = await request(() => api.rate());
    if (rate.remaining < 500) { cache.pauseReason = "quota"; cache.resetAt = rate.resetAt; return summarizeSourceSize(cache); }
    repositories = await api.repositories(request);
    cache.listedAt = now.toISOString();
  } catch (error) {
    if (!stop(error)) cache.pauseReason = "fetch";
    return summarizeSourceSize(cache);
  }
  const included = new Set(repositories.map(repo => repo.fullName));
  for (const name of Object.keys(cache.repositories)) if (!included.has(name)) delete cache.repositories[name];
  for (const repo of repositories) cache.repositories[repo.fullName] ??= {
    branch: repo.defaultBranch, head: null, files: [], pendingTrees: [], treeComplete: false,
    excludedFiles: 0, oversizedFiles: 0, lastUpdatedAt: null, lastAttemptedAt: null, error: null,
  };
  const queue = [...repositories].sort((a, b) => {
    const rank = (name: string) => {
      const state = cache.repositories[name];
      return state.error === "empty" ? 2 : state.head === null ? 0 : state.treeComplete && state.files.every(file => known(cache, file.sha)) && !state.error ? 2 : 1;
    };
    return rank(a.fullName) - rank(b.fullName) || (cache.repositories[a.fullName].lastAttemptedAt ?? "").localeCompare(cache.repositories[b.fullName].lastAttemptedAt ?? "");
  });
  for (const repo of queue) {
    if (cache.requests >= budget) { cache.pauseReason = "budget"; break; }
    let state = cache.repositories[repo.fullName];
    state.lastAttemptedAt = now.toISOString(); state.error = null;
    try {
      const head = await request(() => api.head(repo));
      if (state.head !== head.sha || state.branch !== repo.defaultBranch) {
        // New target replaces the old manifest; blob counts survive renames/edits/deletions.
        state = cache.repositories[repo.fullName] = { ...state, branch: repo.defaultBranch, head: head.sha,
          files: [], pendingTrees: [{ sha: head.treeSha, prefix: "" }], treeComplete: false, excludedFiles: 0, oversizedFiles: 0, lastUpdatedAt: null };
        const tree = await request(() => api.tree(repo, head.treeSha, true));
        if (!tree.truncated) { addEntries(state, tree.tree, ""); state.pendingTrees = []; state.treeComplete = true; }
      }
      while (state.pendingTrees.length) {
        const next = state.pendingTrees[0];
        const tree = await request(() => api.tree(repo, next.sha, false));
        if (tree.truncated) { state.error = "tree-limit"; break; }
        addEntries(state, tree.tree, next.prefix);
        state.pendingTrees.shift();
        for (const entry of tree.tree) if (entry.type === "tree" && isMeaningfulFile(`${next.prefix}${entry.path}/placeholder.ts`)) state.pendingTrees.push({ sha: entry.sha, prefix: `${next.prefix}${entry.path}/` });
      }
      if (!state.pendingTrees.length) state.treeComplete = true;
      for (const file of state.files) {
        if (known(cache, file.sha)) continue;
        try {
          const blob = await request(() => api.blob(repo, file.sha));
          if (blob.encoding !== "base64") throw new Error("Unsupported blob encoding");
          cache.blobs[file.sha] = countSourceLines(Buffer.from(blob.content, "base64"));
        } catch (error) {
          if (stop(error)) throw error;
          state.error = "fetch";
        }
      }
      if (state.treeComplete && !state.error && state.files.every(file => known(cache, file.sha))) state.lastUpdatedAt = now.toISOString();
    } catch (error) {
      if (stop(error)) break;
      const status = error instanceof Error && "status" in error ? error.status : null;
      state.error = status === 409 ? "empty" : "fetch";
      if (status === 409) { state.files = []; state.pendingTrees = []; state.treeComplete = true; state.lastUpdatedAt = now.toISOString(); }
    }
  }
  // Counts are cheap to retain, but unreachable blobs should not accumulate forever.
  const reachable = new Set(Object.values(cache.repositories).flatMap(state => state.files.map(file => file.sha)));
  if (Object.values(cache.repositories).every(state => state.treeComplete)) {
    for (const sha of Object.keys(cache.blobs)) if (!reachable.has(sha)) delete cache.blobs[sha];
  }
  return summarizeSourceSize(cache);
}

function addEntries(state: SourceRepositoryCache, entries: TreeEntry[], prefix: string) {
  for (const entry of entries) {
    if (entry.type === "tree") continue;
    const path = `${prefix}${entry.path}`;
    const category = classifyFile(path);
    if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode) || !isMeaningfulFile(path) || category === "other") { state.excludedFiles++; continue; }
    if ((entry.size ?? 0) > MAX_SOURCE_FILE_BYTES) { state.oversizedFiles++; continue; }
    state.files.push({ path, sha: entry.sha, category, size: entry.size ?? 0 });
  }
}
