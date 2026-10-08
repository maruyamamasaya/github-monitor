# Data Model

## Persistence Strategy

GitHubを正本とし、`.next/cache/github-monitor/commits.json`へversioned JSON形式でcommit detailと同期状態を保存する。SHAをRepository内の一意keyとし、手動migrationは不要。30〜50 Repository規模ではnative dependencyを追加するSQLiteより導入・運用が軽いためJSONを採用し、store interfaceにより将来のSQLite移行余地を保つ。

## Runtime Models

- `BranchScope`: `default` / `all`。defaultは既存`commits.json`、allは`commits-all-branches.json`へ保存し、所属履歴が混ざらないようにする。同じSHAのdetailはscope間で再利用する。
- `CachedRepository.partial`: 一覧・detail取得が未完了であることを示す。partial時は次回更新でTTLを待たず再試行し、完全取得後に解除する。一覧未完了時は同期cursorを進めず過去cacheを維持する。
- `CachedRepository.branchHeads`: 全ブランチで走査完了したhead SHAから`since`とcommit SHA/author日時一覧へのmap。未完了headは登録しない。不変headの履歴再取得を避け、budgetによる中断後も次のheadへ進める。
- `CachedRepository.lastAttemptedAt`: 実際に同期を試行した時刻。全ブランチでは未着手を優先し、残る部分取得を古い試行順に再開する。
- `CachedRepository.branchProgress`: 全ブランチの確認済みbranch数と総branch数。走査完了headを持つbranchを数え、同一headの別名branchもそれぞれ数える。branch一覧未完了時の総数はnull。旧cacheでは次回走査から保存する。Dashboardでは未完了Repositoryの進捗として表示する。

- `Repository`: id、owner、name、visibility、URL、default branch、updated/pushed時刻、language、archived、fork。
- `CommitActivity`: SHA、Repository、author日時、message、additions、deletions、changedFiles、任意のfile detail（filename/status/additions/deletions/changes）、URL。
- `PeriodMetrics`: commits、activeDays、additions、deletions、changedLines、changedFiles、score。
- `RepositoryActivity`: RepositoryとToday/7/30 Days metrics、直近commit。
- `DashboardData`: Repository活動、30日daily series、summary、rate limit、warnings、generatedAt。
- `DevelopmentSnapshot`: raw/meaningful LOC、net、files、new files、active repos/days、Test/Docs量、file detail coverage。
- `DevelopmentDensity`: 0–100の参考値、5つのsub score、前期間値、説明文。能力・品質・生産性の評価ではない。
- `CodeScopeData`: code fileだけで再集計したRepository metrics、daily series、CockpitAnalysis、Today/7/30 Daysごとの未分類commit件数。派生値のため永続化しない。

- `GITHUB_AUTHORS`で複数commit作者を指定可能。`GITHUB_USERNAME`も必ず含め、Repository内SHAで重複除外する。作者集合変更時は既存detailを維持して同期cursor・head snapshotを無効化し、90日分を上限内で再照合する。

## Identity and Relations

- `.next/cache/github-monitor/source-size.json`は活動cacheとは独立したversioned JSON。Repositoryごとにdefault branch/head SHA、対象file manifest、未取得subtree queue、除外数、試行・完了日時、失敗分類を保存する。blob SHAは物理行数（binaryはnull）へのmapであり、ソース本文は保存しない。途中のmanifestがなくならないようtree完了後だけ到達不能blobを除去する。

- RepositoryはGitHub numeric idで一意。
- CommitはRepository idとSHAの組で一意。
- Repositoryは複数Commit Activityを持つ。

## Lifecycle and Retention

commitは90日を保持し、通常同期時に期限外を削除する。初回同期は90日、通常同期は前回時刻から3日戻したoverlap windowでforce-push/rebase由来の遅延を吸収する。cache rootの`lastFileDetailBackfillAt`で旧commit detail補完の1時間cooldownを永続化する。
