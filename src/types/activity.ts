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

export type DailyActivity = { date: string; commits: number; changedLines: number; changedFiles: number; score: number; activeRepositories: number };
export type RateLimit = { remaining: number; limit: number; resetAt: string };

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
};

export type DashboardData = {
  username: string;
  repositories: RepositoryActivity[];
  dailyActivity: DailyActivity[];
  analysis: CockpitAnalysis;
  rateLimit: RateLimit | null;
  warnings: string[];
  generatedAt: string;
};
