# Current

## Current Phase

v1 complete / ready for local GitHub connection

## Current State

Next.js Dashboard、GitHub API連携、期間別集計、Repository詳細、cache、rate-limit表示、error/loading/empty state、Unit Testを実装済み。

## Working

- Today / 7 Days / 30 DaysのDashboard切替。
- Repository別Activity Score、30日daily chart、commit detail。
- Server-only GitHub token、5分cache、取得並列数制限。
- lint、typecheck、10 Unit Tests、production buildが成功。

## In Progress

- None.

## Known Issues

- 実TokenによるGitHub live smoke testは利用者の`.env.local`設定後に必要。
- GitHub API仕様上、1 Repositoryで30日100件を超えるcommitはv1では先頭100件まで。

## Immediate Next

- `.env.local`へfine-grained tokenを設定し、実データ表示を確認する。
