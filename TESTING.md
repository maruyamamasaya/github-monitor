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

## Integration / E2E

自動E2Eはv1初期版では未導入。GitHub live APIは手動smoke testに限定する。

## Manual Verification

- Token未設定、無効Token、空Repository、部分API失敗。
- Today/7/30切替と再読み込み後の選択、Trend chartで今日の日付が見えること、GitHub link、狭いviewport。
- rate-limit表示とprivate metadataの不要な露出がないこと。

## Commands

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit: `npm test`
- Build: `npm run build`
