# Windows / macOS アプリ

Electron内でNext.jsのproduction serverを起動する。別途Node.jsをインストールする必要はない。WindowsとMacは独立して差分同期し、同じtokenを使う場合はGitHub API quotaを共有する。

## 既存データの引き継ぎ

1. 現在のWebアプリの更新を止め、Repositoryで `npm run data:export` を実行する。
2. `data-transfer/github-monitor-data.json` をWindows・Macへコピーする。private Repositoryの情報を含むため私用の安全な経路で渡す。
3. アプリを起動し、メニュー「GitHub Monitor → 取得済みデータを取り込む」でファイルを選ぶ。
4. 「接続設定を読み込む (.env.local)」で各端末の設定ファイルを選ぶ。`.env.example`の項目を使い、`GITHUB_TOKEN`と`GITHUB_USERNAME`を必ず指定する。設定はOSの暗号化機能で保存し、データ書き出しには含めない。
5. 「Dashboard」を開く。既知SHAの詳細と同期進捗を再利用する。metadata・差分一覧・未完了分はAPIを使う。

起動直後はAPI取得のないデータ閲覧画面を開く。同期済みの端末への取り込みは上書き事故を避けるため拒否する。Webアプリのcacheは書き出し後もそのまま残る。アプリ同士の自動同期はない。取得済みcommitは従来どおり同期時に90日保持へ整理する。

保存先はElectron `userData` の `data` フォルダ（Windowsは `%APPDATA%/GitHub Monitor/data`、Macは `~/Library/Application Support/GitHub Monitor/data`）。メニューから実際の保存先を開ける。アプリ更新時にデータを削除しない。

## 開発・パッケージ

Node.js 22.12以降で `npm ci` を実行する。

- `npm run desktop:build` : standalone serverと静的assetを用意する。token・取得済みデータを同梱しない。
- `npm run desktop:start` : アプリを起動する。
- `npm run desktop:package` : 実行OS向けの配布物を `release` に作る。WindowsはNSIS installer、MacはDMG/ZIP。
- `npm run test:desktop` : データ移行・秘密情報除外・上書き拒否を確認する。
- `npm run desktop:smoke` : 非表示アプリとRepository内のテストprofileで両branch scope・日別表示・再起動後の保存を確認する。GitHub接続設定は使わない。
- `node desktop/verify.cjs` : build後のserverへ環境設定・個人cache・現在のtokenが混入していないことを検証する。

Mac配布物はMac上で作る。GitHub Actionsの `Desktop packages` は手動実行でWindowsとMac（Apple Silicon / Intel）をビルドする。workflow追加だけでは実行しない。署名・公証は未設定で、一般公開用releaseにはApple Developer/Windows署名の設定が別途必要。

## 起動確認

初回の空データ画面、設定読み込み、移行後の両branch scope・日別表示、Dashboardのwarm sync、終了後のserver停止、再起動後のデータ保持を確認する。Macでのnative動作はMac実機で検証する。
