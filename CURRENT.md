# Current

## Current Phase

v1.1 Monitoring Cockpit complete

## Current State

v1機能を維持し、高密度Monitoring Cockpit、90日分析、paginationを実装・検証済み。

## Working

- Today / 7 Days / 30 DaysのDashboard切替。
- Repository別Activity Score、30日daily chart、commit detail。
- Server-only GitHub token、5分cache、取得並列数制限。
- WoW、share、trend、heatmap、Momentum、Focus、sortable matrix、commit size、曜日×時間、language activity。
- lint、typecheck、18 Unit Tests、production build、実Token browser smoke testが成功。

## In Progress

- None.

## Known Issues

- 実TokenによるGitHub live smoke testは利用者の`.env.local`設定後に必要。
- API防御のため1 Repositoryあたり90日最大1,000 commitを取得する。

## Immediate Next

- `.env.local`へfine-grained tokenを設定し、実データ表示を確認する。
