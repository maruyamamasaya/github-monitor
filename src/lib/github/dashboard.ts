import "server-only";
import { cache } from "react";
import { aggregateDaily, aggregateMetrics } from "@/lib/analytics/aggregate";
import { getJstStart } from "@/lib/analytics/date-range";
import type { CommitActivity, DashboardData, RateLimit, Repository, RepositoryActivity } from "@/types/activity";
import { getGitHubConfig, githubFetch, mapWithConcurrency } from "./client";
import { toCommitActivity, toRepository } from "./transform";

type RawRepo = Parameters<typeof toRepository>[0];
type RawCommit = Parameters<typeof toCommitActivity>[0];

async function listRepositories(): Promise<Repository[]> {
  const all: Repository[] = [];
  for (let page = 1; ; page++) {
    const batch = await githubFetch<RawRepo[]>(`/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=${page}`);
    all.push(...batch.map(toRepository));
    if (batch.length < 100) break;
  }
  const excluded = new Set((process.env.GITHUB_EXCLUDED_REPOS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
  const includeArchived = process.env.GITHUB_INCLUDE_ARCHIVED === "true";
  const includeForks = process.env.GITHUB_INCLUDE_FORKS === "true";
  return all.filter((repo) => (includeArchived || !repo.archived) && (includeForks || !repo.fork) && !excluded.has(repo.name.toLowerCase()) && !excluded.has(repo.fullName.toLowerCase()));
}

async function getCommits(repo: Repository, username: string, since: string): Promise<CommitActivity[]> {
  const owner = encodeURIComponent(repo.owner); const name = encodeURIComponent(repo.name);
  const summaries = await githubFetch<RawCommit[]>(`/repos/${owner}/${name}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(since)}&per_page=100`);
  const details = await mapWithConcurrency(summaries, 6, (commit) => githubFetch<RawCommit>(`/repos/${owner}/${name}/commits/${encodeURIComponent(String(commit.sha))}`));
  return details.flatMap((result) => result.status === "fulfilled" ? [toCommitActivity(result.value, repo.fullName)] : []);
}

async function loadDashboardUncached(): Promise<DashboardData> {
  const { username } = getGitHubConfig(); const now = new Date();
  const repositories = await listRepositories();
  const results = await mapWithConcurrency(repositories, 4, (repo) => getCommits(repo, username, getJstStart("month", now).toISOString()));
  const warnings: string[] = [];
  const activities: RepositoryActivity[] = repositories.map((repository, index) => {
    const result = results[index];
    const commits = result.status === "fulfilled" ? result.value : [];
    if (result.status === "rejected") warnings.push(`${repository.fullName} の活動を取得できませんでした。`);
    return { repository, commits, metrics: { today: aggregateMetrics(commits, "today", now), week: aggregateMetrics(commits, "week", now), month: aggregateMetrics(commits, "month", now) } };
  });
  let rateLimit: RateLimit | null = null;
  try {
    const rate = await githubFetch<{ rate: { remaining: number; limit: number; reset: number } }>("/rate_limit");
    rateLimit = { remaining: rate.rate.remaining, limit: rate.rate.limit, resetAt: new Date(rate.rate.reset * 1000).toISOString() };
  } catch { warnings.push("GitHub API rate limitを取得できませんでした。"); }
  return { username, repositories: activities, dailyActivity: aggregateDaily(activities.flatMap((item) => item.commits), now), rateLimit, warnings, generatedAt: now.toISOString() };
}

export const loadDashboard = cache(loadDashboardUncached);
