import type { DevelopmentSnapshot, PeriodKey } from "@/types/activity";

const labels: Record<PeriodKey,string> = { today: "Today", week: "Last 7 days", month: "Last 30 days" };
const number = new Intl.NumberFormat("en-US");
export function buildProfileSummary(snapshot: DevelopmentSnapshot, period: PeriodKey) {
  return `${labels[period]}: ${number.format(snapshot.meaningfulChangedLines)} lines changed · ${number.format(snapshot.commits)} commits · ${number.format(snapshot.activeRepositories)} repositories · ${number.format(snapshot.activeDays)} active days`;
}
export function buildDetailedSummary(snapshot: DevelopmentSnapshot, period: PeriodKey, sessions: number) {
  const sign=(value:number)=>`${value>=0?"+":""}${number.format(value)}`;
  return `${labels[period]}:\n${number.format(snapshot.meaningfulChangedLines)} meaningful lines changed\n+${number.format(snapshot.additions)} / -${number.format(snapshot.deletions)} / ${sign(snapshot.netLines)} net\n${number.format(snapshot.commits)} commits\n${number.format(snapshot.changedFiles)} files changed\n${number.format(snapshot.activeRepositories)} repositories\n${number.format(snapshot.activeDays)} active days\n${number.format(sessions)} Git activity sessions`;
}
