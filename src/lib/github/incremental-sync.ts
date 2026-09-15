import type { CommitActivity, Repository } from "@/types/activity";
import type { CachedRepository, CommitCacheStore } from "./commit-cache";
import { ACTIVE_SYNC_TTL_MS, COMMIT_DETAIL_CONCURRENCY, FILE_DETAIL_BACKFILL_BATCH, FILE_DETAIL_BACKFILL_MIN_REMAINING, FILE_DETAIL_BACKFILL_TTL_MS, HISTORY_DAYS, INACTIVE_AFTER_DAYS, INACTIVE_SYNC_TTL_MS, LOW_RATE_LIMIT_REMAINING, MAX_REQUESTS_PER_SYNC, REPOSITORY_CONCURRENCY, SYNC_OVERLAP_DAYS } from "./sync-config";

export type CommitSummary = { sha: string };
export type SyncApi = { list(repo: Repository, since: string): Promise<{ items: CommitSummary[]; requests: number }>; detail(repo: Repository, summary: CommitSummary): Promise<CommitActivity> };
export type SyncMetrics = { apiRequests: number; cacheHits: number; newCommitsFetched: number; commitDetailsFetched: number; fileDetailsBackfilled: number; budgetRemaining: number; cold: boolean };

const daysBefore = (date: Date, days: number) => new Date(date.getTime() - days * 86_400_000);
async function eachWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  async function worker() { while (cursor < items.length) await task(items[cursor++]); }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function syncCommits(repositories: Repository[], rateRemaining: number | null, api: SyncApi, store: CommitCacheStore, now = new Date(), maxRequests = MAX_REQUESTS_PER_SYNC) {
  const cache = await store.read();
  const cold = Object.keys(cache.repositories).length === 0;
  const metrics: SyncMetrics = { apiRequests: 0, cacheHits: 0, newCommitsFetched: 0, commitDetailsFetched: 0, fileDetailsBackfilled: 0, budgetRemaining: maxRequests, cold };
  const warnings: string[] = [];
  let deferredByBudget = false;
  let detailFailures = 0;
  const lowRate = rateRemaining !== null && rateRemaining < LOW_RATE_LIMIT_REMAINING;

  await eachWithConcurrency(repositories, REPOSITORY_CONCURRENCY, async (repo) => {
    const current: CachedRepository = cache.repositories[repo.fullName] ?? { commits: {}, lastSyncedAt: null, lastCheckedAt: null };
    cache.repositories[repo.fullName] = current;
    const inactive = repo.pushedAt ? daysBefore(now, INACTIVE_AFTER_DAYS).getTime() > new Date(repo.pushedAt).getTime() : true;
    const ttl = inactive ? INACTIVE_SYNC_TTL_MS : ACTIVE_SYNC_TTL_MS;
    const fresh = current.lastCheckedAt && now.getTime() - new Date(current.lastCheckedAt).getTime() < ttl;
    const conflictCooldown = current.lastFailure?.status === 409 && now.getTime() - new Date(current.lastFailure.at).getTime() < INACTIVE_SYNC_TTL_MS;
    if (fresh || conflictCooldown || lowRate || metrics.budgetRemaining <= 0) {
      metrics.cacheHits += Object.keys(current.commits).length;
      return;
    }
    const since = current.lastSyncedAt ? daysBefore(new Date(current.lastSyncedAt), SYNC_OVERLAP_DAYS) : daysBefore(now, HISTORY_DAYS);
    let summaries: CommitSummary[];
    try {
      const result = await api.list(repo, since.toISOString());
      summaries = result.items;
      metrics.apiRequests += result.requests;
      metrics.budgetRemaining -= result.requests;
    }
    catch (error) {
      const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : null;
      current.lastFailure = { status, at: now.toISOString() };
      if (status !== 409) warnings.push(`${repo.fullName} の差分同期に失敗したためcacheを表示しています。${status !== null ? ` (GitHub API ${status})` : ""}`);
      return;
    }
    current.lastFailure = null;
    const unique = [...new Map(summaries.map((item) => [item.sha, item])).values()];
    const unknown = unique.filter((summary) => {
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
      try { current.commits[summary.sha] = await api.detail(repo, summary); metrics.commitDetailsFetched++; }
      catch { detailFailures++; repositoryDetailFailures++; }
    });
    const complete = selected.length === unknown.length && repositoryDetailFailures === 0;
    current.lastCheckedAt = current.lastSyncedAt || complete ? now.toISOString() : null;
    if (complete) current.lastSyncedAt = now.toISOString();
    const cutoff = daysBefore(now, HISTORY_DAYS).getTime();
    current.commits = Object.fromEntries(Object.entries(current.commits).filter(([, commit]) => new Date(commit.authoredAt).getTime() >= cutoff));
  });
  const lastBackfill = cache.lastFileDetailBackfillAt ? new Date(cache.lastFileDetailBackfillAt).getTime() : 0;
  const canBackfill = !cold && !lowRate && (rateRemaining === null || rateRemaining >= FILE_DETAIL_BACKFILL_MIN_REMAINING) && now.getTime() - lastBackfill >= FILE_DETAIL_BACKFILL_TTL_MS;
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
  await store.write(cache);
  const failedRepositories = repositories.flatMap((repo) => {
    const failure = cache.repositories[repo.fullName]?.lastFailure;
    return failure ? [{ name: repo.fullName, status: failure.status, at: failure.at, excluded: failure.status === 409 }] : [];
  });
  return { commitsByRepository: Object.fromEntries(repositories.map((repo) => [repo.fullName, Object.values(cache.repositories[repo.fullName]?.commits ?? {})])), metrics, warnings, failedRepositories };
}
