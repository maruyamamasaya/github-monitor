export type ScoreInput = {
  commits: number;
  activeDays: number;
  changedLines: number;
  changedFiles: number;
};

export function calculateActivityScore(input: ScoreInput): number {
  if (input.commits === 0) return 0;
  const score =
    input.commits * 4 +
    input.activeDays * 8 +
    Math.log2(input.changedLines + 1) * 3 +
    Math.log2(input.changedFiles + 1) * 2;
  return Math.round(score * 10) / 10;
}
