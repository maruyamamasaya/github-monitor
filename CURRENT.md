# Current

## Current Phase

v1.3 Development Impact & Density

## Current State

v1.2のAPI効率を維持し、Development Snapshot、Meaningful LOC、file composition、Development Density、Git Activity Sessions、Repository Development Scale、copy可能なProfile Summaryを実装。

## Working

- Today / 7 Days / 30 DaysのDashboard切替。
- Repository別Activity Score、30日daily chart、commit detail。
- Server-only GitHub token、90日initial sync、3日overlap付きincremental sync、active 10分/inactive 24時間cache。
- WoW、share、trend、heatmap、Momentum、Focus、sortable matrix、commit size、曜日×時間、language activity。
- 共通デザイントークン、優先度に沿った情報階層、responsive layout、reduced-motion対応。
- DashboardとRepository詳細で日本語／英語、およびライト／ダークテーマを切り替え可能。設定はbrowserへ保存し、未設定時はOS themeを使う。
- SHA単位detail再利用、200 request budget、low-rate guard、Developer Info metrics。
- lint、typecheck、32 Unit Tests、production build、実Token browser smoke testが成功。
- Today / 7 Days / 30 DaysのDevelopment Snapshot、Density内訳と前期間比較、file detail coverageを表示。
- 新規取得commitの既存detail responseからfile status/statsを段階保存し、追加APIや過去detailの再取得を行わない。

## In Progress

- None.

## Known Issues

- 31 Repository cold実測（旧500 budget）は502 requests / detail成功180 / 46.7秒でSecondary Rate Limitを確認し、200 budget・実効並列2へ調整済み。
- 31 Repository warm実測は2 requests / cache hit 853 / detail 0 / 2.9秒。
- JSON storeは単一Node processのローカル利用向け。複数instance deploymentでは共有DBへの置換が必要。
- 旧cache commitはfile detailを持たないためTest / Docs / New Filesはcoverage付き部分値、または未取得表示になる。
- v1.3実Token warm syncは31 Repositoryで2 requests、853 cache hits、detail fetch 0、約4.3秒。browser console errorなし。

## Immediate Next

- 新しいcommitの蓄積に伴うfile detail coverageをDeveloper InfoとSnapshotで観測する。
