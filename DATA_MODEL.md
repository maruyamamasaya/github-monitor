# Data Model

## Persistence Strategy

GitHubを正本とし、`.next/cache/github-monitor/commits.json`へversioned JSON形式でcommit detailと同期状態を保存する。SHAをRepository内の一意keyとし、手動migrationは不要。30〜50 Repository規模ではnative dependencyを追加するSQLiteより導入・運用が軽いためJSONを採用し、store interfaceにより将来のSQLite移行余地を保つ。

## Runtime Models

- `Repository`: id、owner、name、visibility、URL、default branch、updated/pushed時刻、language、archived、fork。
- `CommitActivity`: SHA、Repository、author日時、message、additions、deletions、changedFiles、任意のfile detail（filename/status/additions/deletions/changes）、URL。
- `PeriodMetrics`: commits、activeDays、additions、deletions、changedLines、changedFiles、score。
- `RepositoryActivity`: RepositoryとToday/7/30 Days metrics、直近commit。
- `DashboardData`: Repository活動、30日daily series、summary、rate limit、warnings、generatedAt。
- `DevelopmentSnapshot`: raw/meaningful LOC、net、files、new files、active repos/days、Test/Docs量、file detail coverage。
- `DevelopmentDensity`: 0–100の参考値、5つのsub score、前期間値、説明文。能力・品質・生産性の評価ではない。

## Identity and Relations

- RepositoryはGitHub numeric idで一意。
- CommitはRepository idとSHAの組で一意。
- Repositoryは複数Commit Activityを持つ。

## Lifecycle and Retention

commitは90日を保持し、通常同期時に期限外を削除する。初回同期は90日、通常同期は前回時刻から3日戻したoverlap windowでforce-push/rebase由来の遅延を吸収する。
