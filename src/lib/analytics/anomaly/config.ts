export const ANOMALY_THRESHOLDS = {
  strongSpike: 2,
  rising: 1.5,
  cooling: 0.75,
  strongDrop: 0.5,
  minimumBaselineScore: 18,
  minimumRecentScore: 18,
  inactivePriorScore: 45,
  inactiveRecentScore: 5,
  shareShiftPoints: 10,
  focusShiftPoints: 15,
  timeShiftPoints: 15,
  largeCommitFallbackLines: 1000,
  largeCommitMinimumSample: 8,
  largeCommitPercentile: 0.95,
  burstShortMinutes: 60,
  burstShortCount: 5,
  burstLongMinutes: 180,
  burstLongCount: 10,
  revivalGapDays: 30,
  maxFeedEvents: 8,
} as const;

export const SEVERITY_RANK = { strong: 3, notable: 2, info: 1 } as const;
