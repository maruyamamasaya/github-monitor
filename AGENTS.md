# AI Agent Guide

## このStarterの目的

このRepositoryは、AIと人間が新規プロジェクトを一貫した方法で進めるための再利用可能な土台です。Starter状態にアプリケーションコードや確定済み技術スタックはありません。コピー後、実装前にプロジェクト固有情報を各正本へ初期化してください。

## Project Context

- **Project Name**: AI-driven Development Starter（Repository: `AI-Project-Seed`）
- **Purpose**: AIエージェントと人間が、要件整理、設計、実装、レビュー、検証を一貫した方法で開始するための、再利用可能なStarter Repositoryを提供する。
- **Primary Stack**: 技術スタック非依存。Starter状態ではアプリケーションコード、フレームワーク、依存関係、データベースを採用していない。
- **Main Domains**: AI支援開発フロー、プロジェクト初期化、正本ドキュメント、ADR、チェックリスト、workflow、Progressive Documentation。
- **Expected Work**: StarterのAI向けルールやテンプレートの改善、正本間の整合維持、再利用性の改善、およびコピー後の明示的なプロジェクト初期化。新しい技術や機能領域の導入は、それだけで無関係とは判断せず、初期化またはStarter拡張として妥当か確認する。
- **Clearly Unrelated Examples**: このRepositoryに存在しない別製品名、別製品固有の画面・クラス・DB・ファイルパスを複数前提にした修正、または別Repository内の実装をこのRepositoryの既存機能であるかのように変更する要求。

## Project Context Guard

ファイル変更、ファイル作成、パッケージ追加、DB変更、破壊的コマンド、commit、pushの前に、ユーザー要求を上記Project Contextおよび`CURRENT.md`と照合する。これは正当な新機能を制限するホワイトリストではなく、誤ったRepository操作を止めるための事前確認である。

1. **MATCH**: 現在のStarter、その保守、または明示的なプロジェクト初期化と明確に関連する。通常のフローで作業する。
2. **UNCERTAIN**: このRepositoryで実現可能だが、新技術、新領域、大きな構成変更、または初期化意図が不明瞭である。拒否せず、`CURRENT.md`、関連する正本、Repository内の検索結果を追加確認し、必要ならユーザーへ確認してから作業を判断する。確認が済むまでは変更や副作用のあるコマンドを実行しない。
3. **MISMATCH**: 別プロジェクト名、別プロジェクト固有機能、固有ファイル名・クラス名、明確に異なる既存プラットフォーム、複数の矛盾したシグナルなどから、別プロジェクト向けである確信が高い。作業を停止し、ファイル変更、新規作成、パッケージ追加、DB変更、破壊的コマンド、commit、pushを行わない。応答では **Current Project**、**Mismatchと判断した理由**、**Prompt内の不一致要素**、**No files were modified** を簡潔に示す。

SQLite、React、API、Docker、Python、Swift、databaseなどの一般的な技術名や単一キーワードだけでMISMATCHにしない。複数の具体的な根拠を総合し、高い確信がない場合はUNCERTAINとする。追加調査によって整合性が確認できた場合はMATCHとして通常のフローへ進む。

## Repository Boundary

- 作業開始時に`git rev-parse --show-toplevel`等で現在のGit rootを確認し、対象がこのRepositoryであることを確かめる。
- ユーザーが明示的に依頼した場合を除き、Git root外のファイルや別Repositoryを読み替えて変更しない。
- パスや対象Repositoryが曖昧またはProject Contextと矛盾する場合は、UNCERTAINまたはMISMATCHとして変更前に停止する。

## Context Guard Validation

作業前に判定と根拠を内部で確認し、変更後は`git status --short`で変更がGit root内の意図したファイルだけであることを確認する。MISMATCH時は状態確認のための読み取り専用操作に留め、作業ツリーを変更していないことを確認する。

## 基本行動

`ユーザー要求 → AGENTS.md → CURRENT.md → 必要な設計文書 → 検索 → 対象コード → 影響範囲 → 関連テスト → 変更 → 検証 → 必要な文書更新`

コードが生成された後は、無差別にファイルを読まず、検索して対象を特定してから必要部分だけを読みます。

- 概念しか分からない: semantic/repository search
- symbol名が分かる: symbol/exact search
- 特定文字列: `rg`、`git grep`等
- 呼び出し元: references search
- 影響範囲: referencesと関連テスト

特定ツールを前提にせず、利用可能な手段から適切なものを選びます。

## 作業原則

- 既存仕様と正本を尊重し、推測を事実として固定しない。
- 最小変更を優先し、無関係なリファクタリングを避ける。
- 後から理由が必要になる重要な設計判断だけをADRへ残す。
- ドキュメントと実装の不整合を放置しない。
- 秘密情報、credential、token、個人情報の実値を記録しない。
- 現時点では実装、技術固有設定、CODEMAP、階層型AGENTS、verify script、sessionsを作らない。

## Source of Truth

| 正本 | 管理対象 |
| --- | --- |
| `CURRENT.md` | 現在の状態（履歴ではない） |
| `ARCHITECTURE.md` | 現在のシステム構造 |
| `DOMAIN.md` | 業務概念・ルール |
| `DATA_MODEL.md` | 永続化モデル |
| `ROADMAP.md` | 今後の優先順位 |
| `TESTING.md` | 検証方針 |
| `SECURITY.md` | セキュリティ方針 |
| `decisions/` | 重要な設計判断と理由 |
| Git history | 変更履歴 |

詳細は該当する正本へ集約し、他文書からリンクします。

## Context Budget

必要になった段階だけ次へ進み、毎回すべてを読みません。

1. Level 1: `AGENTS.md` + `CURRENT.md`
2. Level 2: 関連する設計文書
3. Level 3: 検索結果
4. Level 4: 対象コード
5. Level 5: 依存先・参照元・テスト

## Progressive Documentation

次の条件を満たした時だけ追加します。

- **`CODEMAP.md`**: 複数のFeature領域が存在する、構造だけでは位置を予測しづらい、または検索開始の安定した入口が必要な場合。全ファイル一覧にはしない。
- **階層型`AGENTS.md`**: 独立した技術スタック、検証方法、変更ルール、または強い責務境界がある場合。小さなディレクトリ単位では作らない。
- **Verify Script**: lint/typecheck/test/build等の確立済みコマンドを単一の検証入口へまとめる価値がある場合。技術スタック決定前は作らない。
- **`docs/architecture/`**: `ARCHITECTURE.md`だけでは詳細設計を簡潔に説明できない場合。`ARCHITECTURE.md`は全体要約・索引として維持する。
- **`docs/operations/`**: デプロイ、監視、バックアップ、障害対応、環境管理など実際の運用情報が必要な場合。
- **`sessions/`**: Git履歴、`CURRENT.md`、`ROADMAP.md`、ADRで不足する重要な引き継ぎ情報が実際に発生した場合のみ。AIの全作業ログにはしない。

## Documentation Hygiene

巨大な`AGENTS.md`/`CURRENT.md`、全ファイル一覧型CODEMAP、READMEへの全情報集約、無制限のAI作業ログ、説明の複製、コードの大量貼り付け、Git履歴で分かる情報の再記録を避けます。古い調査文書を正本として扱わず、習慣的な追記で文書を肥大化させません。詳細は正本へ集約し、他文書はリンクします。
