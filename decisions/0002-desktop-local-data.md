# Desktop版は既存Web画面と端末別JSONを再利用する

## Status

Accepted

## Context

Windows・Macを独立したアプリとして使い、取得済みGitHubデータを引き継ぎたい。既知commit detailを全件再取得するとquotaへの負荷が大きい。Desktopは当初v1対象外だったがユーザーが実装を依頼した。

## Decision

Electron内のutility processでNext.js standalone serverを起動し、既存のServer側API・集計・UIを再利用する。127.0.0.1限定とし、rendererはsandbox・context isolationを有効にする。OS userDataへcacheを保存し、3種類のversioned JSONをtokenなしのtransfer fileで初回移行する。設定はsafeStorageで暗号化する。端末間の共有DB・常時同期は導入しない。

## Consequences

Mac/Windowsは各々差分取得し、共通tokenならquotaを共有する。既存cacheと同期cursorを維持できるが、metadata確認と差分一覧取得は必要。上書き移行は拒否する。90日保持を維持する。配布署名・公証とMac実機確認は別途必要。
