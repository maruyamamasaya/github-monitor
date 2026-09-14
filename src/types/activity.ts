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
  files?: CommitFileDetail[];
  url: string;
};

export type CommitFileStatus = "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged" | string;
export type CommitFileDetail = { filename: string; status: CommitFileStatus; additions: number; deletions: number; changes: number };
export type FileCategory = "code" | "test" | "docs" | "config" | "other";
export type CompositionItem = { category: FileCategory; changedLines: number; changedFiles: number; share: number };
export type DevelopmentSnapshot = { commits: number; additions: number; deletions: number; changedLines: number; meaningfulChangedLines: number; netLines: number; changedFiles: number; newFiles: number | null; activeRepositories: number; activeDays: number; testLines: number | null; testFiles: number | null; docsLines: number | null; docsFiles: number | null; fileDetailCoverage: number; coveredCommits: number; totalCommits: number };
export type DensityBreakdown = { volume: number; consistency: number; breadth: number; delivery: number; engineeringActivity: number };
export type DevelopmentDensity = { score: number; breakdown: DensityBreakdown; explanations: string[]; previousScore: number; delta: number };
export type GitActivitySessions = { count: number; medianMinutes: number; longestMinutes: number; commitsPerSession: number; observedWindowMinutes: number };
export type RepositoryDevelopmentScale = { repository: string; changedLines: number; meaningfulChangedLines: number; netLines: number; changedFiles: number; testLines: number | null; docsLines: number | null; commits: number; coverage: number };
export type DevelopmentPeriod = { snapshot: DevelopmentSnapshot; composition: CompositionItem[]; density: DevelopmentDensity; sessions: GitActivitySessions; repositories: RepositoryDevelopmentScale[]; summary: string; detailedSummary: string };
export type DevelopmentAnalysis = Record<PeriodKey, DevelopmentPeriod>;

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

export type DailyActivity = { date: string; commits: number; changedLines: number; changedFiles: number; score: number; activeRepositories: number };
export type RateLimit = { remaining: number; limit: number; resetAt: string };
export type ApiMetrics = { apiRequests: number; cacheHits: number; cacheHitRate: number; repositories: number; commitsLoaded: number; newCommitsFetched: number; commitDetailsFetched: number; fileDetailsBackfilled: number; syncDurationMs: number; syncMode: "cold" | "warm"; budgetRemaining: number };

export type MomentumBand = "HOT" | "STABLE" | "COOLING";
export type Momentum = { value: number; band: MomentumBand };
export type ComparisonRow = { key: string; label: string; current: number; previous: number; change: number | null; absolute: boolean };
export type FocusMetrics = { score: number; topShare: number; topThreeShare: number; activeRepositories: number };
export type CommitSizeBucket = { key: "XS" | "S" | "M" | "L" | "XL"; label: string; count: number };
export type DayHourCell = { day: number; slot: number; commits: number };
export type LanguageActivity = { language: string; score: number; share: number };
export type ChangeSeverity = "info" | "notable" | "strong";
export type ChangeCategory = "repository" | "activity" | "commit" | "pattern";
export type ChangeType = "activity-spike" | "activity-drop" | "inactive" | "large-commit" | "commit-burst" | "share-shift" | "focus-shift" | "time-shift" | "streak" | "new-activity" | "revived";
export type ChangeEvent = { id: string; type: ChangeType; category: ChangeCategory; severity: ChangeSeverity; repository?: string; title: string; description: string; value?: number; baseline?: number; detectedAt: string };
export type PulseLevel = "LOW" | "NORMAL" | "HIGH" | "VERY HIGH";
export type PulseStatus = { level: PulseLevel; todayCommits: number; activeRepositories: number; changePercent: number | null; baseline: number };
export type DayComparison = { label: string; today: number; yesterday: number; change: number | null };
export type ShareShift = { repository: string; current: number; previous: number; points: number };
export type TimeShare = { slot: number; recent: number; baseline: number; points: number };
export type WeekHighlights = { increase?: { repository: string; change: number }; decrease?: { repository: string; change: number }; stable?: { repository: string; change: number }; newlyActive: string[] };
export type AnomalyAnalysis = { pulse: PulseStatus; events: ChangeEvent[]; dayOverDay: DayComparison[]; shareShifts: ShareShift[]; timeShares: TimeShare[]; weekdayActivity: number[]; weekHighlights: WeekHighlights };
export type CockpitAnalysis = {
  summaries: Record<PeriodKey, Metrics>;
  activeDays: Record<PeriodKey, number>;
  streak: number;
  focus: Record<PeriodKey, FocusMetrics>;
  commitSizes: Record<PeriodKey, CommitSizeBucket[]>;
  dayHour: Record<PeriodKey, DayHourCell[]>;
  languages: Record<PeriodKey, LanguageActivity[]>;
  momentum: Record<string, Momentum>;
  weekComparison: ComparisonRow[];
  repositoryWeekChange: { repository: string; change: number | null }[];
  anomaly: AnomalyAnalysis;
  development: DevelopmentAnalysis;
};

export type DashboardData = {
  username: string;
  repositories: RepositoryActivity[];
  dailyActivity: DailyActivity[];
  analysis: CockpitAnalysis;
  rateLimit: RateLimit | null;
  apiMetrics: ApiMetrics;
  warnings: string[];
  generatedAt: string;
};
