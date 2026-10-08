export const SOURCE_CATEGORIES = ["code", "test", "docs", "config"] as const;
export type SourceCategory = typeof SOURCE_CATEGORIES[number];
export type SourceTotals = Record<SourceCategory, number>;
export type SourceSizeRepository = {
  repository: string; branch: string; lines: SourceTotals; checkedFiles: number; totalFiles: number | null;
  complete: boolean; lastUpdatedAt: string | null; lastAttemptedAt: string | null;
  excludedFiles: number; oversizedFiles: number; error: "fetch" | "empty" | "tree-limit" | null;
};
export type SourceSizeSummary = {
  repositories: SourceSizeRepository[]; lines: SourceTotals; checkedFiles: number; totalFiles: number | null;
  complete: boolean; lastAttemptedAt: string | null; requests: number;
  pauseReason: "budget" | "quota" | "rate-limit" | "fetch" | null; resetAt: string | null;
};
