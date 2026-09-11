import type { CommitActivity, DensityBreakdown, DevelopmentSnapshot } from "@/types/activity";
import { calculateSessions } from "./sessions";

export const DENSITY_WEIGHTS = { volume: .30, consistency: .25, breadth: .15, delivery: .15, engineeringActivity: .15 } as const;
export const DENSITY_THRESHOLDS = { commits: 180, meaningfulLines: 80_000, files: 800, activeDays: 20, repositories: 12, deliverySessions: 30, engineeringShare: .25 } as const;
const saturate = (value: number, target: number) => Math.min(1, Math.log1p(Math.max(0, value)) / Math.log1p(target));
const score = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100);

export function calculateVolumeScore(snapshot: DevelopmentSnapshot) { return score((saturate(snapshot.commits, DENSITY_THRESHOLDS.commits) + saturate(snapshot.meaningfulChangedLines, DENSITY_THRESHOLDS.meaningfulLines) + saturate(snapshot.changedFiles, DENSITY_THRESHOLDS.files)) / 3); }
export function calculateConsistencyScore(snapshot: DevelopmentSnapshot, commits: CommitActivity[], periodDays: number) {
  const active = Math.min(1, snapshot.activeDays / Math.min(DENSITY_THRESHOLDS.activeDays, periodDays));
  const sessions = calculateSessions(commits); const distribution = Math.min(1, sessions.count / Math.max(1, Math.min(snapshot.activeDays * 1.5, periodDays)));
  return score(active * .8 + distribution * .2);
}
export function calculateBreadthScore(snapshot: DevelopmentSnapshot, repositoryLines: number[]) {
  if (!snapshot.activeRepositories) return 0;
  const total = repositoryLines.reduce((a, b) => a + b, 0); const sorted = [...repositoryLines].sort((a,b)=>b-a);
  const top = total ? sorted[0] / total : 1; const top3 = total ? sorted.slice(0,3).reduce((a,b)=>a+b,0) / total : 1;
  const range = saturate(snapshot.activeRepositories, DENSITY_THRESHOLDS.repositories);
  return score(range * .55 + (1 - top) * .25 + (1 - top3) * .20);
}
export function calculateDeliveryScore(commits: CommitActivity[]) { if (!commits.length) return 0; const sessions = calculateSessions(commits); return score(.35 + saturate(sessions.count, DENSITY_THRESHOLDS.deliverySessions) * .65); }
export function calculateEngineeringActivityScore(snapshot: DevelopmentSnapshot, compositionLines: Record<string, number>) {
  if (!snapshot.commits) return 0;
  if (!snapshot.coveredCommits) return 50;
  const total = Object.values(compositionLines).reduce((a,b)=>a+b,0); const engineering = (compositionLines.test ?? 0) + (compositionLines.docs ?? 0) + (compositionLines.config ?? 0);
  const share = total ? engineering / total : 0; const deletionSignal = snapshot.changedLines ? snapshot.deletions / snapshot.changedLines : 0;
  return score(saturate(share, DENSITY_THRESHOLDS.engineeringShare) * .8 + Math.min(1, deletionSignal / .35) * .2);
}
export function calculateDensity(snapshot: DevelopmentSnapshot, commits: CommitActivity[], repositoryLines: number[], compositionLines: Record<string, number>, periodDays = 30): { score: number; breakdown: DensityBreakdown } {
  const breakdown = { volume: calculateVolumeScore(snapshot), consistency: calculateConsistencyScore(snapshot, commits, periodDays), breadth: calculateBreadthScore(snapshot, repositoryLines), delivery: calculateDeliveryScore(commits), engineeringActivity: calculateEngineeringActivityScore(snapshot, compositionLines) };
  const total = Object.entries(DENSITY_WEIGHTS).reduce((sum, [key, weight]) => sum + breakdown[key as keyof DensityBreakdown] * weight, 0);
  return { score: Math.round(total), breakdown };
}
