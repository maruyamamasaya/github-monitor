# Current

## Current Phase

v1.2 Change & Anomaly Monitor implementation

## Current State

v1.1 Cockpitを維持し、GitHub既存データだけを使う決定論的Change DetectionとDevelopment Pulse / Recent Changesを実装。Signal RoomコンセプトのUI再設計を反映し、検証中。

## Working

- Today / 7 Days / 30 DaysのDashboard切替。
- Repository別Activity Score、30日daily chart、commit detail。
- Server-only GitHub token、5分cache、取得並列数制限。
- WoW、share、trend、heatmap、Momentum、Focus、sortable matrix、commit size、曜日×時間、language activity。
- 共通デザイントークン、優先度に沿った情報階層、responsive layout、reduced-motion対応。
- lint、typecheck、18 Unit Tests、production build、実Token browser smoke testが成功。

## In Progress

- None.

## Known Issues

- 実TokenによるGitHub live smoke testは利用者の`.env.local`設定後に必要。
- API防御のため1 Repositoryあたり90日最大1,000 commitを取得する。

## Immediate Next

- `.env.local`へfine-grained tokenを設定し、実データ表示を確認する。
