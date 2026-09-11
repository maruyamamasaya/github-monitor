export type PeriodKey = "today" | "week" | "month";

export type Repository = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  url: string;
  defaultBranch: string;
  updatedAt: string;
  pushedAt: string | null;
  language: string | null;
  archived: boolean;
  fork: boolean;
};

export type CommitActivity = {
  sha: string;
  repository: string;
  authoredAt: string;
  message: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
};

export type Metrics = {
  commits: number;
  activeDays: number;
  additions: number;
  deletions: number;
  changedLines: number;
  changedFiles: number;
  score: number;
};

export type RepositoryActivity = {
  repository: Repository;
  commits: CommitActivity[];
  metrics: Record<PeriodKey, Metrics>;
};

export type DailyActivity = { date: string; commits: number };
export type RateLimit = { remaining: number; limit: number; resetAt: string };

export type DashboardData = {
  username: string;
  repositories: RepositoryActivity[];
  dailyActivity: DailyActivity[];
  rateLimit: RateLimit | null;
  warnings: string[];
  generatedAt: string;
};
