# 総コード量を活動同期から独立したsnapshotとして集計する

## Status

Accepted

## Context

期間中の変更行数からは、現在存在するコードの総量を求められない。全branchの合算は共通履歴を重複させ、毎回file本文を取得するとAPI負荷が高い。

## Decision

default branchの取得時点のfileだけを対象に、既存のfile分類でCode / Test / Docs / Configの物理行数を分離する。空行・コメントを含む。専用の手動更新で200 request以内ずつ取得し、branch/headとfile manifestを保存する。内容SHAごとの行数を再利用し、ソース本文は保存しない。活動期間・作者・branch scopeから独立させ、部分取得には進捗・部分値を表示する。

## Consequences

初回は複数回の更新が必要になり得るが、以降は未変更fileの本文取得が不要になる。Repositoryごとの取得時刻は異なるため完了日時を表示する。生成物・依存・対象外fileに加え、binary・symlink・submodule・2 MiB超のfileは集計対象外とし、サイズ除外を明示する。
