# Current

## Current Phase

v1.3 Development Impact & Density

## Current State

v1.2のAPI効率を維持し、Development Snapshot、Meaningful LOC、file composition、Development Density、Git Activity Sessions、Repository Development Scale、copy可能なProfile Summaryを実装。

## Working

- URLの`period`で保持するToday / 7 Days / 30 Days / 90 DaysのDashboard切替。
- Repository別Activity Score、30日daily chart、commit detail。
- Server-only GitHub token、90日initial sync、3日overlap付きincremental sync、active 30分/inactive 24時間cache。
- GitHub API 409のRepositoryは一時的に集計対象から外し、失敗一覧をDeveloper Infoに保持・表示する。24時間後の再試行に成功すると自動復帰する。
- WoW、share、trend、heatmap、Momentum、Focus、sortable matrix、commit size、曜日×時間、language activity。
- 共通デザイントークン、優先度に沿った情報階層、responsive layout、reduced-motion対応。
- DashboardとRepository詳細で日本語／英語、およびライト／ダークテーマを切り替え可能。言語はcookieへ保存し、初期表示は日本語。テーマはbrowserへ保存し、未設定時はOS themeを使う。
- SHA単位detail再利用、200 request budget、low-rate guard、Developer Info metrics。
- lint、typecheck、61 Unit Tests、production build、実Token browser smoke testが成功。
- Today / 7 Days / 30 Days / 90 DaysのDevelopment Snapshot、Density内訳と前期間比較、file detail coverageを表示。
- 新規取得commitの既存detail responseからfile status/statsを段階保存し、追加APIや過去detailの再取得を行わない。
- 旧cacheは直近commitから1時間ごとに最大5件だけfile detailをbackfillする。rate limit 1,000未満では停止し、200 request budget内で実行する。
- Developer Infoで通常detail取得とFile Backfilledを分離表示する。
- DashboardとRepository詳細の日本語表示を全セクションへ適用し、Asia/Tokyo基準の日付に曜日を表示する。
- 言語設定の復元を描画フレーム待ちからmicrotaskへ変更し、警告表示を実際の警告内容に合わせた。Trend chartの期間データと描画を再利用する。
- Trend chartの日付ラベルは右端の今日から間隔を空けて配置し、重なりを避ける。
- ローカル起動はNext.js既定の3000を使用し、Local Dev Hubからは起動プロセスの`PORT`または`--port`で指定可能。他のローカルアプリへのURL参照はない。
- 画面の配色に合わせた開発活動マークをブラウザのアイコンに設定。
- DashboardのGitHubデータ取得は初回表示・手動更新・ブランチ対象切替時に行い、期間切替は再取得せずClient側の表示だけを切り替える。

- 初回読み込み・手動更新中はスピナー付きステータスを表示し、Dashboardの「指標の定義・集計対象」でdefault branch・author日時・活動日数などの説明を展開できる。
- Dashboardの「すべて／コードのみ」で全指標とグラフを切り替える。`scope=code`でURLへ保存し、切替時の追加API呼び出しはない。コードのみはファイル詳細取得済みのCode分類（HTML/CSSを含む）だけを集計し、未分類commitの除外件数を期間別に表示する。Repository詳細は全変更を表示する。

- DashboardとRepository詳細の大きなタイトル・数値はサイズを一段階抑え、情報階層を維持する。

- DashboardとRepository詳細は「デフォルトブランチ／全ブランチ」に対応。`branches=all`をURLで保持し、未マージのpush済みbranchもRepository内SHAで重複除外して集計する。
- branch scopeごとにJSON cacheを分離し、既知SHAのdetailは相互再利用する。全ブランチは90日を再照合し、新しいbranchの古い作成日commitも取り込む。取得完了時は削除branch・rebaseで到達不能になった履歴を集計から外す。
- 一覧paginationも同期200 request budgetへ事前予約する。部分取得状態をJSONへ保存し、対象Repository名付き警告を表示して次回更新で再試行する。
- 全ブランチの走査完了headの履歴も保存し、不変headを再取得せずに未完了headへ進める。
- 全ブランチの未着手Repositoryを優先し、部分取得は前回試行時刻の古い順で再開する。大量branchのRepositoryが他のRepositoryを毎回後回しにしないようにする。

- 90日間は今日を含むJSTの90暦日。曜日・時間帯と曜日別棒グラフは選択期間に連動する。前90日間のDensity比較は保存対象外のため表示しない。期間切替による追加API取得はない。

- 言語切替はClient側で即時反映し、同時にcookieへ保存する。画面遷移やGitHub再取得を起こさず期間・scopeを保持する。

- `GITHUB_AUTHORS`で複数commit作者を指定可能。`GITHUB_USERNAME`も必ず含め、Repository内SHAで重複除外する。作者集合変更時は既存detailを維持して同期cursor・head snapshotを無効化し、90日分を上限内で再照合する。

- 取得状況は原因と次の操作を表示する。取得上限は待たずに「続きを取得」、GitHub制限は待機、利用枠不足は回復予定時刻を案内する。Repository一覧と技術情報は詳細ログへ格納し、409で集計対象外のRepositoryは未完了件数に含めない。

- 全ブランチの未完了Repositoryにブランチ確認済み数・総数・残数を表示する。一覧取得途中は総数未確定とし、進捗はcacheへ保存する。
- `/data`でRepository別の保存済みcommit一覧・取得状況・最終同期日時を確認できる。branch scope切替と50件paginationに対応し、このページはGitHub APIを呼ばない。

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
