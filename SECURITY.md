# Security

## Authentication and Authorization

GitHub Personal Access TokenでGitHub APIを認証する。Application独自のユーザー認証はv1対象外なので、public internetへ公開する場合はhost側のaccess controlを必須とする。GitHub上の閲覧範囲はToken権限を上限とする。

## Secrets

- `GITHUB_TOKEN`は`.env.local`またはdeployment secretへ保存し、Git管理しない。
- `.env.example`には空値だけを置く。
- TokenをClient Component、HTML、URL、例外message、ログへ渡さない。
- fine-grained tokenと最小限のread-only Repository権限を推奨し、不要時は失効する。

## Sensitive Data

Private Repository名、commit message、活動情報は機密になり得る。ServerからDashboard利用者へ必要な表示情報だけを返し、第三者analyticsは使用しない。

## Input Validation

環境変数のusernameと除外Repository名を正規化する。dynamic routeはencode/decodeし、GitHub API URL segmentを必ずencodeする。外部URLはGitHub APIから得たHTTPS URLだけを表示に使う。

## External Services and Logging

外部送信先はGitHub APIのみ。認証headerを含むrequestや生のerror responseをログ出力しない。UI errorは安全な分類済みmessageへ変換する。

## Dependencies

依存はNext.js/React/Tailwind/Vitestへ限定し、lockfileを管理し、release前にauditと更新状況を確認する。

## Security Review

release前にClient bundleへTokenが含まれないこと、`.env.local`がignoredであること、Token未設定/無効時の表示を確認する。
