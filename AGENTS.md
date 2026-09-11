# AI Agent Guide

## Project Context

- **Project Name**: github-monitor
- **Repository**: `maruyamamasaya/github-monitor`
- **Purpose**: 複数のGitHub Repositoryを横断し、個人の開発活動量と最近注力しているプロジェクトを1画面で把握する。
- **Primary Stack**: Next.js / TypeScript / App Router / React / Tailwind CSS / GitHub REST API。
- **Main Domains**: Repository、Commit Activity、期間別集計、Activity Score、GitHub API quota。
- **Expected Work**: Dashboard、GitHub API連携、集計ロジック、Repository詳細、テスト、および正本の整合維持。
- **Out of Scope for v1**: DB、ユーザー認証、複数Account、AI要約、Issue/PR分析、通知、SaaS化、Desktop/Mobile app。

## Project Context Guard

変更前に要求を上記Contextと`CURRENT.md`へ照合する。明確に別Repository向けなら変更せず不一致を報告する。新技術や一般的な技術名だけでは不一致とせず、必要な正本を確認する。

## Repository Boundary

- 作業開始時にGit rootを確認する。
- 明示依頼がない限りGit root外を変更しない。
- 変更後は`git status --short`で対象を確認する。

## Workflow

`要求 → CURRENT.md → 関連正本 → 検索 → 対象コード → 関連テスト → 変更 → lint/typecheck/test/build → 正本更新`

## Principles

- GitHub tokenをコード、Client Component、ログ、Git管理ファイルへ出さない。
- GitHub APIアクセス、集計、表示を分離する。
- Asia/Tokyoを表示と「今日」の基準にする。
- API呼び出しをServer側へ限定し、cacheと同一render内のdeduplicationを使う。
- 最小変更を優先し、v2機能を先行実装しない。
- 重要な設計判断だけを`decisions/`へ残す。

## Source of Truth

| 正本 | 管理対象 |
| --- | --- |
| `CURRENT.md` | 現在の実装状態 |
| `ARCHITECTURE.md` | システム構造 |
| `DOMAIN.md` | 用語・業務ルール |
| `DATA_MODEL.md` | データモデルと永続化方針 |
| `ROADMAP.md` | 優先順位 |
| `TESTING.md` | 検証方針とコマンド |
| `SECURITY.md` | セキュリティ方針 |
| `decisions/` | 重要な設計判断 |

## Documentation Hygiene

詳細は該当する正本へ集約する。全ファイル一覧、AI作業ログ、重複説明、未採用案を正本へ蓄積しない。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
