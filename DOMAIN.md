# Domain

## Glossary

- **Tracked Repository**: Token利用者がアクセス可能で、除外条件に該当しないRepository。
- **Activity Window**: Today、7 Days、30 Daysのいずれか。TrendとHeatmapは最大90日。Asia/Tokyoの日境界で集計する。
- **Commit Activity**: 対象ユーザーがauthorであるcommitの件数、追加・削除行、変更file数、活動日。
- **Active Repository**: 選択期間内に1件以上のcommitがあるRepository。
- **Activity Score**: Repository間の相対比較用の参考値。
- **Change Event**: 現在値と統一baselineの差から決定論的に生成する、info / notable / strongの観測イベント。生産性評価や障害判定ではない。

## Entities

- Repository metadata
- Commit detail
- Period activity
- Daily activity
- GitHub rate limit

## Business Rules

- Repository一覧は認証済みユーザーがアクセス可能な範囲を対象にする。
- archived、fork、`GITHUB_EXCLUDED_REPOS`指定Repositoryは集計対象外にできる。
- commitは設定されたGitHub usernameをauthorとして最大30日分取得する。
- additions、deletions、changed filesはcommit detailから集計する。
- Activity Scoreは `commits * 4 + activeDays * 8 + log2(changedLines + 1) * 3 + log2(changedFiles + 1) * 2` とする。
- Momentumは直近7日Scoreを、それ以前の3週間の週平均Scoreで割る。1.5以上をHOT、0.65以上をSTABLE、それ未満をCOOLINGとする。
- Focus Scoreは `Top Repository Share * 0.65 + Top 3 Share * 0.35`（最大100）とする。
- Commit sizeはXS 0–9、S 10–49、M 50–199、L 200–999、XL 1000+ changed linesに分類する。
- Change Detection baselineは、Daily=今日対直前7日平均、Weekly=直近7日対前7日、Momentum=直近7日対それ以前3週間の週平均、Monthly=直近30日対前30日とする。
- Spike/dropは最低Activity閾値を満たした場合だけ通知し、share/time shiftはpercentage pointで比較する。
- Large commitは履歴8件以上ならRepository別p95、未満なら1,000 changed linesを閾値とする。
- Commit burstは60分で5件、または3時間で10件を初期閾値とする。
- 同一commitはRepository内のSHAで一意とみなす。

## Invariants

- changedLinesはadditionsとdeletionsの合計。
- activeDaysは選択期間内のJST日付の重複を除いた数。
- TodayはAsia/Tokyoの当日00:00から現在まで。
- Scoreは分析上の参考値で、開発時間を表さない。

## Out of Scope

Issue/PR、AI要約、時間推定、複数Account、チーム分析はv1に含めない。
