import type { SyncStatus } from "@/types/activity";

export function describeSyncStatus(status: SyncStatus, locale: "ja" | "en", failed = false) {
  const ja = locale === "ja";
  if (status.pauseReason === "quota") return {
    title: ja ? "GitHubの利用枠の回復を待っています" : "Waiting for GitHub quota to reset",
    explanation: ja ? "残りの利用枠が少ないため、保存済みデータを表示しています。" : "The remaining quota is low. Saved data is displayed.",
    action: ja ? "下の回復予定時刻を過ぎてから「最新情報に更新」を押してください。" : "Select Refresh after the reset time below.", retry: false,
  };
  if (status.pauseReason === "rate-limit") return {
    title: ja ? "GitHubが取得を制限しています" : "GitHub has limited requests",
    explanation: ja ? "取得を一時停止し、保存済みデータを表示しています。" : "Fetching is paused. Saved data is displayed.",
    action: ja ? "まず1分ほど待ってから「最新情報に更新」を押してください。制限が続く場合は、さらに時間を置いてください。" : "Wait at least a minute, then select Refresh. Wait longer if the restriction continues.", retry: false,
  };
  if (status.pauseReason === "budget") return {
    title: ja ? "データを数回に分けて取得しています" : "Fetching data in batches",
    explanation: ja ? `負荷を抑えるため、今回の取得を区切りました。残り${status.pendingRepositories}件のリポジトリは確認途中です。` : `This batch has finished to limit request load. ${status.pendingRepositories} repositories remain incomplete.`,
    action: ja ? "待つ必要はありません。「続きを取得」を押してください。取得済みデータは再利用します。" : "No waiting is required. Select Continue fetching; saved data will be reused.", retry: true,
  };
  if (failed || status.detailFailures > 0) return {
    title: ja ? "一部のデータを取得できませんでした" : "Some data could not be fetched",
    explanation: ja ? "取得できたデータと保存済みデータを表示しています。" : "Fetched and saved data are displayed.",
    action: ja ? "「再試行」を押してください。繰り返し失敗する場合は、詳細ログを確認してください。" : "Select Retry. Check the detailed log if fetching keeps failing.", retry: true,
  };
  return {
    title: ja ? "一部のデータは確認途中です" : "Some data is still being checked",
    explanation: ja ? "表示中の集計には、未取得のデータが含まれていない場合があります。" : "The totals may exclude data that has not been fetched yet.",
    action: ja ? "「再試行」を押してください。確認途中の状態が続く場合は、詳細ログを確認してください。" : "Select Retry. Check the detailed log if this continues.", retry: true,
  };
}
