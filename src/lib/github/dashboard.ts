import "server-only";
import { cache } from "react";
import { aggregateDaily, aggregateMetrics } from "@/lib/analytics/aggregate";
import { analyzeCockpit } from "@/lib/analytics/cockpit";
import type { BranchScope, DashboardData, RateLimit, Repository, RepositoryActivity } from "@/types/activity";
import { getGitHubConfig, githubFetch } from "./client";
import { toCommitActivity, toRepository } from "./transform";
import path from "node:path";
import { listBranchCommits } from "./branch-commits";
import { createFileCommitCache, withCommitCacheLock } from "./commit-cache";
import { syncCommits } from "./incremental-sync";

type RawRepo = Parameters<typeof toRepository>[0];
type RawCommit = Parameters<typeof toCommitActivity>[0];

export async function listRepositories(fetchJson: typeof githubFetch = githubFetch): Promise<{ repositories: Repository[]; requests: number }> {
  const all: Repository[] = [];
  let requests = 0;
  for (let page = 1; ; page++) {
    const batch = await fetchJson<RawRepo[]>(`/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=${page}`, 1800);
    requests++;
    all.push(...batch.map(toRepository));
    if (batch.length < 100) break;
  }
  const excluded = new Set((process.env.GITHUB_EXCLUDED_REPOS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
  const includeArchived = process.env.GITHUB_INCLUDE_ARCHIVED === "true";
  const includeForks = process.env.GITHUB_INCLUDE_FORKS === "true";
  return { repositories: all.filter((repo) => (includeArchived || !repo.archived) && (includeForks || !repo.fork) && !excluded.has(repo.name.toLowerCase()) && !excluded.has(repo.fullName.toLowerCase())), requests };
}

async function loadDashboardUncached(branchScope: BranchScope = "default"): Promise<DashboardData> {
  const startedAt = Date.now();
  const { username, authors } = getGitHubConfig(); const now = new Date();
  const listed = await listRepositories();
  const repositories = listed.repositories;
  const warnings: string[] = [];
  let rateLimit: RateLimit | null = null;
  try {
    const rate = await githubFetch<{ rate: { remaining: number; limit: number; reset: number } }>("/rate_limit", 120);
    rateLimit = { remaining: rate.rate.remaining, limit: rate.rate.limit, resetAt: new Date(rate.rate.reset * 1000).toISOString() };
  } catch { warnings.push("GitHub API rate limitを取得できませんでした。"); }
  const synced = await withCommitCacheLock(async () => {
    const defaultStore = createFileCommitCache();
    const allStore = createFileCommitCache(path.join(process.cwd(), ".next", "cache", "github-monitor", "commits-all-branches.json"));
    const reusable = await (branchScope === "all" ? defaultStore : allStore).read();
    return syncCommits(repositories, rateLimit?.remaining ?? null, {
      async list(repo, since, context) {
        return listBranchCommits(repo, authors, since, branchScope, githubFetch, context);
      },
      async detail(repo, commit) {
        const raw = await githubFetch<RawCommit>(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits/${encodeURIComponent(commit.sha)}`);
        return toCommitActivity(raw, repo.fullName);
      },
    }, branchScope === "all" ? allStore : defaultStore, now, undefined, { authors, fullHistory: branchScope === "all", reusableDetails: reusable.repositories });
  });
  warnings.push(...synced.warnings);
  const excluded = new Set(synced.failedRepositories.filter((item) => item.excluded).map((item) => item.name));
  const includedRepositories = repositories.filter((repo) => !excluded.has(repo.fullName));
  const activities: RepositoryActivity[] = includedRepositories.map((repository) => {
    const commits = synced.commitsByRepository[repository.fullName] ?? [];
    return { repository, commits, metrics: { today: aggregateMetrics(commits, "today", now), week: aggregateMetrics(commits, "week", now), month: aggregateMetrics(commits, "month", now), quarter: aggregateMetrics(commits, "quarter", now) } };
  });
  const commitsLoaded = activities.reduce((total, item) => total + item.commits.length, 0);
  const cacheAttempts = synced.metrics.cacheHits + synced.metrics.commitDetailsFetched;
  return { username, syncStatus: synced.syncStatus, repositories: activities, dailyActivity: aggregateDaily(activities.flatMap((item) => item.commits), now), analysis: analyzeCockpit(activities, now), rateLimit, warnings, failedRepositories: synced.failedRepositories, apiMetrics: { apiRequests: listed.requests + 1 + synced.metrics.apiRequests, cacheHits: synced.metrics.cacheHits, cacheHitRate: cacheAttempts ? synced.metrics.cacheHits / cacheAttempts * 100 : 0, repositories: includedRepositories.length, commitsLoaded, newCommitsFetched: synced.metrics.newCommitsFetched, commitDetailsFetched: synced.metrics.commitDetailsFetched, fileDetailsBackfilled: synced.metrics.fileDetailsBackfilled, syncDurationMs: Date.now() - startedAt, syncMode: synced.metrics.cold ? "cold" : "warm", budgetRemaining: synced.metrics.budgetRemaining }, generatedAt: now.toISOString() };
}

export const loadDashboard = cache(loadDashboardUncached);
