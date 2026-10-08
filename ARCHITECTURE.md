# Architecture

## System Overview

Next.js App RouterのServer ComponentがGitHub REST APIからデータを差分同期・集約し、serializableなDashboard modelだけをClient Componentへ渡す単一Web application。commit detailはサーバーローカルの永続cacheへ保存する。

## Technology Stack

- Next.js 16 / React 19 / TypeScript
- App Router / Server Components
- Tailwind CSS 4
- GitHub REST API (native `fetch`)
- Vitest

## Major Components

- `src/lib/github`: 認証済みAPI client、Repository/commit/rate-limit取得、response変換。
- `src/lib/analytics`: JST期間計算、集計、Activity Score、比較、Momentum、Focus、Heatmap、commit size。
- `src/lib/analytics/development`: LOC/file分類、Snapshot、Density、session、Profile Summaryの純粋関数。
- `src/lib/analytics/anomaly`: 閾値、baseline、各種change detector、severity ranking、重複排除、template文生成。
- `src/features/dashboard`: 高密度KPI、trend、share、heatmap、momentum、sortable matrix、distribution表示。
- `src/app/repositories/[owner]/[repo]`: Repository詳細。

## Data Flow

1. Server Componentが環境変数を検証する。
2. GitHub APIからRepository一覧をpagination付きで取得する。
3. 初回は90日、通常は前回同期から3日のoverlapを含む対象author commit一覧をRepositoryごとにpaginationする。
4. 未知SHAのcommit detailだけを制限付き並列処理で取得し、file status/statsを含めSHA単位の永続cacheへ保存する。既知SHAは全指標とRepository詳細で再利用し、過去detailのbackfillはしない。
5. Dashboardの期間はURLの`period`で保持し、Server render時の選択をClient Componentへ渡す。Tokenは境界を越えない。
6. Change DetectionとDevelopment分析も同じcommit modelからServer側で実行し、serializableな結果だけをClientへ渡す。追加APIは呼ばない。
7. Dashboardでは同じ取得済みcommitからCode-only modelもServer側で構築する。Clientへはcommit/file detailを渡さず、集計済みmodelを切り替える。`scope=code`をnative History APIで保持し、期間・scope切替ではAPIを再取得しない。
8. `branches=all`ではServer側でbranch一覧をpaginationし、各head SHAの90日履歴を取得する。同一headの走査とRepository内commit SHAを重複除外する。branch scope切替はServer navigationを行い、期間・code scope選択は維持する。Repository詳細も同じbranch scopeを使う。

## Caching and Failure Handling

- Repository metadataはNext.js Data Cacheで30分、rate limitは2分revalidateする。commit同期は独自cacheで制御する。
- active repositoryは30分、30日以上inactiveなrepositoryは24時間の同期間隔とする。
- 旧cacheのfile detailは直近commit優先で1時間に最大5件をbackfillする。rate limit remaining 1,000未満では実行しない。
- 同期は最大200 requests、rate limit remaining 500未満ではheavy syncを停止する。
- Repository並列2、各Repositoryのcommit detail並列1（実効最大2）でSecondary Rate Limitへの圧力を抑える。
- React `cache`で同一Server render内のloadをdeduplicateする。
- branch scopeごとにJSON cacheを分離し、別scopeに保存済みのdetailは選択scopeの一覧に含まれるSHAだけ再利用する。全ブランチは新branch・削除・rebaseを反映するため90日一覧を再照合し、完了した一覧だけで到達可能性を更新する。
- 全ブランチの走査完了head SHAとauthor日時付きcommit SHA一覧も保存する。headが不変で保存済み期間が90日windowを覆う場合は一覧を再利用する。部分取得時も完了headを残すため次回は未完了headへ進める。branch一覧の完全取得後に消えたhead snapshotを除去する。
- 一覧paginationも送信前に共有200 request budgetから予約する。1 Repositoryは最大1,000 unique commit。budget/page上限・detail失敗時はpartial状態を永続化し、Repository名付き警告と次回更新での再試行を行う。403/429時は追加取得を停止する。
- Repository単位のAPI失敗はwarningとして表示し、取得できたデータを継続表示する。
- commit一覧がGitHub API 409の場合はRepositoryを集計から一時除外し、失敗一覧をローカルcacheに保持する。24時間後に再試行し、成功時に自動復帰する。失敗一覧はDashboardの開発者向け情報に表示する。
- Token未設定・認証失敗は専用の案内画面にする。

## External Services

`/data`は選択branch scopeのJSON cacheをServer側で読み、Repository選択・50件pagination付きのcommit一覧と取得状況を表示する。追加API・同期は行わず、更新はDashboardから行う。

GitHub REST APIのみ。Repository metadata、commits、commit detail、rate limitを取得する。

## Deployment

Node.js runtime。ローカルまたはNext.js対応hostで環境変数を設定して稼働する。

## Key Constraints

- API tokenはServer限定。
- GitHub rate limitと多数Repositoryでの応答時間が主要制約。
- Monitoring trendとheatmap用に90日を取得する。API防御上1 Repository最大1,000 commitとする。
