import "server-only";
import { cache } from "react";
import { aggregateDaily, aggregateMetrics } from "@/lib/analytics/aggregate";
import { analyzeCockpit } from "@/lib/analytics/cockpit";
import type { DashboardData, RateLimit, Repository, RepositoryActivity } from "@/types/activity";
import { getGitHubConfig, githubFetch } from "./client";
import { toCommitActivity, toRepository } from "./transform";
import { paginateCommits } from "./pagination";
import { createFileCommitCache, withCommitCacheLock } from "./commit-cache";
import { syncCommits } from "./incremental-sync";

type RawRepo = Parameters<typeof toRepository>[0];
type RawCommit = Parameters<typeof toCommitActivity>[0];

async function listRepositories(): Promise<{ repositories: Repository[]; requests: number }> {
  const all: Repository[] = [];
  let requests = 0;
  for (let page = 1; ; page++) {
    const batch = await githubFetch<RawRepo[]>(`/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=${page}`, 1800);
    requests++;
    all.push(...batch.map(toRepository));
    if (batch.length < 100) break;
  }
  const excluded = new Set((process.env.GITHUB_EXCLUDED_REPOS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
  const includeArchived = process.env.GITHUB_INCLUDE_ARCHIVED === "true";
  const includeForks = process.env.GITHUB_INCLUDE_FORKS === "true";
  return { repositories: all.filter((repo) => (includeArchived || !repo.archived) && (includeForks || !repo.fork) && !excluded.has(repo.name.toLowerCase()) && !excluded.has(repo.fullName.toLowerCase())), requests };
}

async function loadDashboardUncached(): Promise<DashboardData> {
  const startedAt = Date.now();
  const { username } = getGitHubConfig(); const now = new Date();
  const listed = await listRepositories();
  const repositories = listed.repositories;
  const warnings: string[] = [];
  let rateLimit: RateLimit | null = null;
  try {
    const rate = await githubFetch<{ rate: { remaining: number; limit: number; reset: number } }>("/rate_limit", 120);
    rateLimit = { remaining: rate.rate.remaining, limit: rate.rate.limit, resetAt: new Date(rate.rate.reset * 1000).toISOString() };
  } catch { warnings.push("GitHub API rate limitを取得できませんでした。"); }
  const synced = await withCommitCacheLock(() => syncCommits(repositories, rateLimit?.remaining ?? null, {
    async list(repo, since) {
      const owner = encodeURIComponent(repo.owner); const name = encodeURIComponent(repo.name);
      let requests = 0;
      const items = await paginateCommits((page) => { requests++; return githubFetch<RawCommit[]>(`/repos/${owner}/${name}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(since)}&per_page=100&page=${page}`); });
      return { items, requests };
    },
    async detail(repo, commit) {
      const raw = await githubFetch<RawCommit>(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits/${encodeURIComponent(commit.sha)}`);
      return toCommitActivity(raw, repo.fullName);
    },
  }, createFileCommitCache(), now));
  warnings.push(...synced.warnings);
  const activities: RepositoryActivity[] = repositories.map((repository) => {
    const commits = synced.commitsByRepository[repository.fullName] ?? [];
    return { repository, commits, metrics: { today: aggregateMetrics(commits, "today", now), week: aggregateMetrics(commits, "week", now), month: aggregateMetrics(commits, "month", now) } };
  });
  const commitsLoaded = activities.reduce((total, item) => total + item.commits.length, 0);
  const cacheAttempts = synced.metrics.cacheHits + synced.metrics.commitDetailsFetched;
  return { username, repositories: activities, dailyActivity: aggregateDaily(activities.flatMap((item) => item.commits), now), analysis: analyzeCockpit(activities, now), rateLimit, warnings, apiMetrics: { apiRequests: listed.requests + 1 + synced.metrics.apiRequests, cacheHits: synced.metrics.cacheHits, cacheHitRate: cacheAttempts ? synced.metrics.cacheHits / cacheAttempts * 100 : 0, repositories: repositories.length, commitsLoaded, newCommitsFetched: synced.metrics.newCommitsFetched, commitDetailsFetched: synced.metrics.commitDetailsFetched, syncDurationMs: Date.now() - startedAt, syncMode: synced.metrics.cold ? "cold" : "warm", budgetRemaining: synced.metrics.budgetRemaining }, generatedAt: now.toISOString() };
}

export const loadDashboard = cache(loadDashboardUncached);
