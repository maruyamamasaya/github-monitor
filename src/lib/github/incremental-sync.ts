import type { BranchScanProgress, CommitActivity, Repository } from "@/types/activity";
import type { BranchHeadSnapshot, CachedRepository, CommitCacheStore } from "./commit-cache";
import { ACTIVE_SYNC_TTL_MS, COMMIT_DETAIL_CONCURRENCY, FILE_DETAIL_BACKFILL_BATCH, FILE_DETAIL_BACKFILL_MIN_REMAINING, FILE_DETAIL_BACKFILL_TTL_MS, HISTORY_DAYS, INACTIVE_AFTER_DAYS, INACTIVE_SYNC_TTL_MS, LOW_RATE_LIMIT_REMAINING, MAX_REQUESTS_PER_SYNC, REPOSITORY_CONCURRENCY, SYNC_OVERLAP_DAYS } from "./sync-config";

export type CommitSummary = { sha: string; authoredAt?: string };
export type ListContext = { reserveRequest(): boolean; branchHeads?: Record<string, BranchHeadSnapshot>; onBranchProgress?(progress: BranchScanProgress): void };
export type SyncApi = { list(repo: Repository, since: string, context: ListContext): Promise<{ items: CommitSummary[]; requests: number; complete?: boolean }>; detail(repo: Repository, summary: CommitSummary): Promise<CommitActivity> };
export type SyncMetrics = { apiRequests: number; cacheHits: number; newCommitsFetched: number; commitDetailsFetched: number; fileDetailsBackfilled: number; budgetRemaining: number; cold: boolean };

const daysBefore = (date: Date, days: number) => new Date(date.getTime() - days * 86_400_000);
async function eachWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  async function worker() { while (cursor < items.length) await task(items[cursor++]); }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function syncCommits(repositories: Repository[], rateRemaining: number | null, api: SyncApi, store: CommitCacheStore, now = new Date(), maxRequests = MAX_REQUESTS_PER_SYNC, options: { authors?: string[]; fullHistory?: boolean; reusableDetails?: Record<string, CachedRepository> } = {}) {
  const cache = await store.read();
  if (options.authors) {
    const authors = [...new Set(options.authors.map(author => author.toLowerCase()))].sort();
    if (JSON.stringify(cache.authors ?? (authors.length === 1 ? authors : [])) !== JSON.stringify(authors)) {
      for (const state of Object.values(cache.repositories)) {
        state.lastSyncedAt = null; state.lastCheckedAt = null; state.partial = true;
        state.branchHeads = {}; state.branchProgress = undefined; state.lastFailure = null;
      }
    }
    cache.authors = authors;
  }
  const cold = Object.keys(cache.repositories).length === 0;
  const metrics: SyncMetrics = { apiRequests: 0, cacheHits: 0, newCommitsFetched: 0, commitDetailsFetched: 0, fileDetailsBackfilled: 0, budgetRemaining: maxRequests, cold };
  const warnings: string[] = [];
  let deferredByBudget = false;
  let detailFailures = 0;
  const lowRate = rateRemaining !== null && rateRemaining < LOW_RATE_LIMIT_REMAINING;
  let rateBlocked = false;

  // Unstarted repositories precede partial scans so large branch sets cannot
  // consume every subsequent request budget before smaller repositories run.
  const queue = options.fullHistory ? [...repositories].sort((a, b) => {
    const priority = (repo: Repository) => {
      const state = cache.repositories[repo.fullName];
      if (state?.lastSyncedAt && !state.partial) return 2;
      return state && (Object.keys(state.commits).length || Object.keys(state.branchHeads ?? {}).length) ? 1 : 0;
    };
    return priority(a) - priority(b) || new Date(cache.repositories[a.fullName]?.lastAttemptedAt ?? 0).getTime() - new Date(cache.repositories[b.fullName]?.lastAttemptedAt ?? 0).getTime();
  }) : repositories;
  await eachWithConcurrency(queue, REPOSITORY_CONCURRENCY, async (repo) => {
    const current: CachedRepository = cache.repositories[repo.fullName] ?? { commits: {}, lastSyncedAt: null, lastCheckedAt: null };
    cache.repositories[repo.fullName] = current;
    const inactive = repo.pushedAt ? daysBefore(now, INACTIVE_AFTER_DAYS).getTime() > new Date(repo.pushedAt).getTime() : true;
    const ttl = inactive ? INACTIVE_SYNC_TTL_MS : ACTIVE_SYNC_TTL_MS;
    const fresh = !current.partial && current.lastCheckedAt && now.getTime() - new Date(current.lastCheckedAt).getTime() < ttl;
    const conflictCooldown = current.lastFailure?.status === 409 && now.getTime() - new Date(current.lastFailure.at).getTime() < INACTIVE_SYNC_TTL_MS;
    const rateCooldown = (current.lastFailure?.status === 403 || current.lastFailure?.status === 429) && now.getTime() - new Date(current.lastFailure.at).getTime() < 60_000;
    if (fresh || conflictCooldown || rateCooldown || lowRate || rateBlocked || metrics.budgetRemaining <= 0) {
      metrics.cacheHits += Object.keys(current.commits).length;
      return;
    }
    current.lastAttemptedAt = now.toISOString();
    const since = !options.fullHistory && current.lastSyncedAt ? daysBefore(new Date(current.lastSyncedAt), SYNC_OVERLAP_DAYS) : daysBefore(now, HISTORY_DAYS);
    let summaries: CommitSummary[];
    let listingComplete = true;
    let reserved = 0;
    if (options.fullHistory) current.branchHeads ??= {};
    try {
      const result = await api.list(repo, since.toISOString(), { branchHeads: current.branchHeads, onBranchProgress(progress) { current.branchProgress = progress; }, reserveRequest() {
        if (rateBlocked || metrics.budgetRemaining <= 0) return false;
        metrics.budgetRemaining--; metrics.apiRequests++; reserved++;
        return true;
      } });
      summaries = result.items;
      listingComplete = result.complete !== false;
      metrics.apiRequests += Math.max(0, result.requests - reserved);
      metrics.budgetRemaining -= Math.max(0, result.requests - reserved);
    }
    catch (error) {
      const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : null;
      if (status === 403 || status === 429) rateBlocked = true;
      current.lastFailure = { status, at: now.toISOString() };
      if (status !== 409) warnings.push(`${repo.fullName} の差分同期に失敗したためcacheを表示しています。${status !== null ? ` (GitHub API ${status})` : ""}`);
      return;
    }
    current.lastFailure = null;
    const unique = [...new Map(summaries.map((item) => [item.sha, item])).values()];
    if ((options.fullHistory || !current.lastSyncedAt) && listingComplete) {
      const reachable = new Set(unique.map((item) => item.sha));
      current.commits = Object.fromEntries(Object.entries(current.commits).filter(([sha]) => reachable.has(sha)));
    }
    const unknown = unique.filter((summary) => {
      const reusable = options.reusableDetails?.[repo.fullName]?.commits[summary.sha];
      if (reusable && (!current.commits[summary.sha] || (!current.commits[summary.sha].files && reusable.files))) current.commits[summary.sha] = reusable;
      if (current.commits[summary.sha]) { metrics.cacheHits++; return false; }
      return true;
    });
    const selected = unknown.slice(0, Math.max(0, metrics.budgetRemaining));
    metrics.apiRequests += selected.length;
    metrics.budgetRemaining -= selected.length;
    metrics.newCommitsFetched += selected.length;
    if (selected.length < unknown.length) deferredByBudget = true;
    let repositoryDetailFailures = 0;
    await eachWithConcurrency(selected, COMMIT_DETAIL_CONCURRENCY, async (summary) => {
      if (rateBlocked) { repositoryDetailFailures++; metrics.apiRequests--; metrics.budgetRemaining++; metrics.newCommitsFetched--; return; }
      try { current.commits[summary.sha] = await api.detail(repo, summary); metrics.commitDetailsFetched++; }
      catch (error) {
        detailFailures++; repositoryDetailFailures++;
        if (error instanceof Error && "status" in error && (error.status === 403 || error.status === 429)) {
          rateBlocked = true;
          current.lastFailure = { status: error.status, at: now.toISOString() };
        }
      }
    });
    const complete = listingComplete && selected.length === unknown.length && repositoryDetailFailures === 0;
    current.partial = !complete;
    current.lastCheckedAt = listingComplete && (current.lastSyncedAt || complete) ? now.toISOString() : null;
    if (complete) current.lastSyncedAt = now.toISOString();
    const cutoff = daysBefore(now, HISTORY_DAYS).getTime();
    current.commits = Object.fromEntries(Object.entries(current.commits).filter(([, commit]) => new Date(commit.authoredAt).getTime() >= cutoff));
  });
  const lastBackfill = cache.lastFileDetailBackfillAt ? new Date(cache.lastFileDetailBackfillAt).getTime() : 0;
  const canBackfill = !cold && !lowRate && !rateBlocked && (rateRemaining === null || rateRemaining >= FILE_DETAIL_BACKFILL_MIN_REMAINING) && now.getTime() - lastBackfill >= FILE_DETAIL_BACKFILL_TTL_MS;
  if (canBackfill && metrics.budgetRemaining > 0) {
    const repositoryByName = new Map(repositories.map((repo) => [repo.fullName, repo]));
    const candidates = Object.entries(cache.repositories).filter(([repository, cachedRepo]) => repositoryByName.has(repository) && cachedRepo.lastFailure?.status !== 409).flatMap(([repository, cachedRepo]) => Object.values(cachedRepo.commits).filter((commit) => !Array.isArray(commit.files)).map((commit) => ({ repository, commit }))).sort((a, b) => new Date(b.commit.authoredAt).getTime() - new Date(a.commit.authoredAt).getTime()).slice(0, Math.min(FILE_DETAIL_BACKFILL_BATCH, metrics.budgetRemaining));
    cache.lastFileDetailBackfillAt = now.toISOString();
    await eachWithConcurrency(candidates, REPOSITORY_CONCURRENCY, async ({ repository, commit }) => {
      const repo = repositoryByName.get(repository); if (!repo) return;
      metrics.apiRequests++; metrics.budgetRemaining--;
      try { cache.repositories[repository].commits[commit.sha] = await api.detail(repo, { sha: commit.sha }); metrics.commitDetailsFetched++; metrics.fileDetailsBackfilled++; }
      catch { detailFailures++; }
    });
  }
  if (deferredByBudget) warnings.push("API request budgetに達したためcommit detail取得を次回へ延期しました。");
  if (detailFailures) warnings.push(`${detailFailures}件のcommit detail取得に失敗したため次回同期で再試行します。`);
  if (lowRate) warnings.push(`GitHub rate limit remainingが${LOW_RATE_LIMIT_REMAINING}未満のためcached dataを使用しました。`);
  const partial = repositories.filter((repo) => cache.repositories[repo.fullName]?.lastFailure?.status !== 409 && (cache.repositories[repo.fullName]?.partial || (!cache.repositories[repo.fullName]?.lastSyncedAt && !cache.repositories[repo.fullName]?.lastFailure)));
  if (partial.length) warnings.push(`${partial.length}件のRepositoryはAPI取得上限・取得失敗により部分取得です（${partial.map((repo) => repo.fullName).join(", ")}）。表示は取得済みデータのみで、次回更新時に再試行します。`);
  const branchProgress = options.fullHistory ? partial.flatMap(repo => {
    const progress = cache.repositories[repo.fullName]?.branchProgress;
    return progress ? [{ repository: repo.fullName, ...progress }] : [];
  }) : [];
  await store.write(cache);
  const failedRepositories = repositories.flatMap((repo) => {
    const failure = cache.repositories[repo.fullName]?.lastFailure;
    return failure ? [{ name: repo.fullName, status: failure.status, at: failure.at, excluded: failure.status === 409 }] : [];
  });
  return { commitsByRepository: Object.fromEntries(repositories.map((repo) => [repo.fullName, Object.values(cache.repositories[repo.fullName]?.commits ?? {})])), metrics, warnings, failedRepositories, syncStatus: { pendingRepositories: partial.length, branchProgress, pauseReason: lowRate ? "quota" as const : rateBlocked || failedRepositories.some(item => item.status === 403 || item.status === 429) ? "rate-limit" as const : metrics.budgetRemaining <= 0 && partial.length > 0 ? "budget" as const : null, detailFailures } };
}
