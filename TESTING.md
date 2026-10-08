# Testing

## Testing Strategy

純粋関数をUnit testし、GitHub APIはfixture/mockでresponse変換とcold/warm差分同期を検証する。Development分析ではLOC、file分類、coverage、Density sub score、session境界、summaryを検証する。大量のlive API testは行わない。UIはlint/typecheck/buildと手動確認で検証する。

## Validation Matrix

| 変更タイプ | 必要な検証 |
| --- | --- |
| 集計・期間 | `npm test`、`npm run typecheck` |
| GitHub client | fixture test、lint、typecheck |
| UI/route | lint、typecheck、build、responsive手動確認 |
| dependency/config | install、全検証、audit確認 |
| 文書 | 実装・README・正本間の整合確認 |

## Fast Validation

`npm run lint && npm run typecheck && npm test`

## Full Validation

`npm run lint && npm run typecheck && npm test && npm run build`

## Unit Test

VitestでActivity Score、期間境界（Asia/Tokyo）、集計、空データ、GitHub response変換、WoW、Momentum、Focus、commit size、heatmap、曜日×時間、pagination、spike/inactive/large commit/burst/share/time/streak系change detectionを検証する。

同期テストではSHA重複排除、既知detail再利用、新規commitだけの取得、3日overlap、inactive repository、request budget、low rate limit、partial failure、cold/warm、file-detail backfillの5件上限・cooldown・rate guardを検証する。

GitHub API 409時の失敗記録、24時間の再試行間隔、成功時の記録解除を検証する。

全ブランチはbranch/commit pagination、同一head/SHA重複除外、default branchとscopeの分離、detail相互再利用、送信前の共有budget予約、90日照合と削除branch履歴の除去、partial状態の永続化と次回再試行を検証する。
不変headの走査結果再利用、budget中断後の次headへの進行、期限外SHAと削除head snapshotの除去も検証する。
同期上限が小さい場合も、未着手Repositoryが部分取得の大規模Repositoryより先に実行され、部分取得同士は古い試行時刻順に再開することを検証する。

複数作者の正規化、作者間SHA重複除外、作者走査途中のbudget中断、作者集合変更時の90日再照合と既知detail再利用を検証する。

取得上限では即時の継続を案内し、GitHub制限・利用枠不足では待機を案内する。作者追加後も409対象を未完了件数から除外することを検証する。

## Integration / E2E

自動E2Eはv1初期版では未導入。GitHub live APIは手動smoke testに限定する。

## Manual Verification

- Token未設定、無効Token、空Repository、部分API失敗。
- Today/7/30/90切替と再読み込み後の選択、Trend chartで今日の日付が見えること、GitHub link、狭いviewport。
- すべて／コードのみ切替と`scope=code`の再読み込み復元。混在commitのcode部分だけの集計、Docs-only/未分類commitの除外、未分類件数、全グラフ・比較・sessionとの整合。切替時に追加のServer requestがないこと。
- rate-limit表示とprivate metadataの不要な露出がないこと。

## Commands

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit: `npm test`
- Build: `npm run build`
