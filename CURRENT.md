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
- lint、typecheck、61 Unit Tests、production build、実Token browser smoke testが成功。
- Today / 7 Days / 30 DaysのDevelopment Snapshot、Density内訳と前期間比較、file detail coverageを表示。
- 新規取得commitの既存detail responseからfile status/statsを段階保存し、追加APIや過去detailの再取得を行わない。
- 旧cacheは直近commitから1時間ごとに最大5件だけfile detailをbackfillする。rate limit 1,000未満では停止し、200 request budget内で実行する。
- Developer Infoで通常detail取得とFile Backfilledを分離表示する。
- DashboardとRepository詳細の日本語表示を全セクションへ適用し、Asia/Tokyo基準の日付に曜日を表示する。
- 言語設定の復元を描画フレーム待ちからmicrotaskへ変更し、警告表示を実際の警告内容に合わせた。Trend chartの期間データと描画を再利用する。
- ローカル起動はNext.js既定の3000を使用し、Local Dev Hubからは起動プロセスの`PORT`または`--port`で指定可能。他のローカルアプリへのURL参照はない。

## In Progress

- None.

## Known Issues

- 31 Repository cold実測（旧500 budget）は502 requests / detail成功180 / 46.7秒でSecondary Rate Limitを確認し、200 budget・実効並列2へ調整済み。
- 31 Repository warm実測は2 requests / cache hit 853 / detail 0 / 2.9秒。
- JSON storeは単一Node processのローカル利用向け。複数instance deploymentでは共有DBへの置換が必要。
- 旧cache commitのTest / Docs / New Filesはcoverage付き部分値、または未取得表示から始まり、低負荷backfillで段階的に充実する。
- v1.3実Token warm syncは31 Repositoryで2 requests、853 cache hits、detail fetch 0、約4.3秒。browser console errorなし。

## Immediate Next

- file detail coverageと1時間5件backfillのAPI影響を通常運用で観測する。
