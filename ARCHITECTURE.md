# Architecture

## System Overview

Next.js App RouterのServer ComponentがGitHub REST APIからデータを取得・集約し、serializableなDashboard modelだけをClient Componentへ渡す単一Web application。外部DBは持たない。

## Technology Stack

- Next.js 16 / React 19 / TypeScript
- App Router / Server Components
- Tailwind CSS 4
- GitHub REST API (native `fetch`)
- Vitest

## Major Components

- `src/lib/github`: 認証済みAPI client、Repository/commit/rate-limit取得、response変換。
- `src/lib/analytics`: JST期間計算、集計、Activity Score。
- `src/features/dashboard`: 期間切替、summary、ranking、daily chart、repository table。
- `src/app/repositories/[owner]/[repo]`: Repository詳細。

## Data Flow

1. Server Componentが環境変数を検証する。
2. GitHub APIからRepository一覧をpagination付きで取得する。
3. 除外filter後、30日分の対象author commit一覧をRepositoryごとに並列取得する。
4. commit detailを制限付き並列処理で取得し、30日modelへ集約する。
5. Client Componentは受け取ったmodelをToday/7/30 Daysで切り替える。Tokenは境界を越えない。

## Caching and Failure Handling

- GitHub fetchはNext.js Data Cacheで5分revalidateする。
- React `cache`で同一Server render内のloadをdeduplicateする。
- Repository単位のAPI失敗はwarningとして表示し、取得できたデータを継続表示する。
- Token未設定・認証失敗は専用の案内画面にする。

## External Services

GitHub REST APIのみ。Repository metadata、commits、commit detail、rate limitを取得する。

## Deployment

Node.js runtime。ローカルまたはNext.js対応hostで環境変数を設定して稼働する。

## Key Constraints

- API tokenはServer限定。
- GitHub rate limitと多数Repositoryでの応答時間が主要制約。
- 30日より古い活動はv1では取得しない。
