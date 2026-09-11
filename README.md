# github-monitor

複数のGitHub Repositoryを横断し、「最近どのプロジェクトを一番触っているか」を1画面で確認する個人用Dashboardです。

## Features

- Today / 7 Days / 30 Daysのsummary切替
- Repository別のcommit、追加・削除行、active days、Activity Score
- 過去30日のdaily commit chart
- Repository詳細と直近commit stats
- Private Repository対応（Token権限内）
- archived / fork / 任意Repositoryの除外
- GitHub API rate limit、loading、error、empty state
- 12個の高密度KPI、Week-over-Week、Repository share、Focus Score
- 30/90日trend、90日Activity heatmap、Repository Momentum
- sortable Repository matrix、commit size、曜日×時間、language activity
- AIなしのDevelopment Pulseとseverity付きRecent Changes
- activity spike/drop、recent inactivity、large commit、burst、share/focus/time shift、streak、新規・再開検知

## Setup

Node.js 20.9以降を用意し、依存関係をinstallします。

```bash
npm install
cp .env.example .env.local
```

`.env.local`を編集します。

```env
GITHUB_TOKEN=github_pat_your_token
GITHUB_USERNAME=maruyamamasaya
GITHUB_EXCLUDED_REPOS=owner/repo,another-repo
GITHUB_INCLUDE_ARCHIVED=false
GITHUB_INCLUDE_FORKS=false
```

fine-grained Personal Access Tokenには、対象Repositoryのread-only `Metadata` と `Contents` 権限を付けてください。TokenはClientへ送信されません。

## Run

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。GitHub responseはServer側で5分cacheされます。最大90日を100件単位でpaginationし、取得したcommit detailを全分析へ再利用します。

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Activity Score

Repository間の相対比較用参考値です。開発時間ではありません。

```text
commits × 4
+ activeDays × 8
+ log2(changedLines + 1) × 3
+ log2(changedFiles + 1) × 2
```

設計の正本は[ARCHITECTURE.md](ARCHITECTURE.md)、業務ルールは[DOMAIN.md](DOMAIN.md)、セキュリティは[SECURITY.md](SECURITY.md)を参照してください。
