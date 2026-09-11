# Data Model

## Persistence Strategy

**Not applicable.** v1は外部DBを使わず、GitHubを正本、Next.js cacheを短期cacheとして扱う。ユーザー設定は環境変数で管理する。

## Runtime Models

- `Repository`: id、owner、name、visibility、URL、default branch、updated/pushed時刻、language、archived、fork。
- `CommitActivity`: SHA、Repository、author日時、message、additions、deletions、changedFiles、URL。
- `PeriodMetrics`: commits、activeDays、additions、deletions、changedLines、changedFiles、score。
- `RepositoryActivity`: RepositoryとToday/7/30 Days metrics、直近commit。
- `DashboardData`: Repository活動、30日daily series、summary、rate limit、warnings、generatedAt。

## Identity and Relations

- RepositoryはGitHub numeric idで一意。
- CommitはRepository idとSHAの組で一意。
- Repositoryは複数Commit Activityを持つ。

## Lifecycle and Retention

データはrequest時に取得され、cache期限後に再検証される。永続migration、backup、削除処理は不要。
