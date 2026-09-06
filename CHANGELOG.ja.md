# 変更履歴

このプロジェクトの重要な変更はすべてこのファイルに記録されます。

形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に従い、
このプロジェクトは [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠します。

## [Unreleased]

### 追加

- リスク判定 `llmAssist`：設定されたカスタム LLM（OpenAI 互換エンドポイント）が各 `ask` を
  `safe` / `risky:<カテゴリ>` で判定。ハードカテゴリ（deletion / credential / remote / system /
  bulk）は常に人手へ、タイムアウトは 1 回リトライ、失敗は常に fail-closed。
- 裁決学習（`riskLearning`、既定オフ、`riskThreshold` 1–10、既定 3）：人手で承認され実際に実行された
  neutral リスクをカウントし、指紋一致する同一操作のみ自動許可。`$DSH_HOME/perm-gate/learning.json`
  に永続化され、ユーザーの YAML ルールには書き込みません。
- 決定イベントフィード：各決定を `$DSH_HOME/perm-gate/events.jsonl` に追記し、
  `GET /api/dsh-perm-gate/events?sessionId=&since=` で提供。ブラウザ側は入力欄上の通知バーで表示。
- 権限ピッカーの盾アイコンが折りたたみトリガーにも表示されます。

### 変更

- `llmAssist` はリスクカテゴリプロトコルを使用（従来の allow/deny/ask 判定のスーパーセット）。
  `classifier.ts` はリスク判定器と OpenAI 互換トランスポート（`chatCompletion`）を共有します。


### Added
- **Permissive モード（独立審批枠）** — read-only / workspace-write / full-access / whitelist と並ぶ独立モード。
  単一のフロントスイッチ（`permissive`）+ 組み合わせ可能なバックエンド戦略（`trustAutoAllow` / `alwaysConfirm` / `llmAssist`）。
  P0 ハード拒否は単調のまま。
- 監査に `classifier` / `permissive` の決定ソースを追加。`llmAssist` 用の注入可能な `classify` フック
  （`ask`/未指定時は fail-closed）。
- CLI に `--permissive` フラグと `--list` の permissive サマリを追加。
- **ブラウザ クライアント** — `settings.plugins.tab` ページ（「Permissive 承認ティア」）が
  設定 → プラグインに描画されます。1 つのスイッチ（`permissive`）＋ 3 つのバックエンド
  `permissiveStrategies` トグル。host は名前空間を live に読むため、再起動なしで次の
  ツール呼び出しから反映されます。
- **実際の llmAssist LLM** — 設定可能な OpenAI 互換分類器（`classifierEndpoint` /
  `classifierModel`）が `ask` の自動判定を行い、人手のシームへ fail-closed でフォールバック
  します。
- **ホワイトリスト移行** — `approveAllowEverywhere` はコマンド語をルール ファイルの
  `allow` に永続化して再読込し、`approveRepeat` は有界なセッション許可を発行します。
  いずれも always-confirm パネルの 2 つの拡張許可ボタンを裏で支えます。
- **4 言語インストール ガイド** — `INSTALL.md` / `INSTALL.zh.md` / `INSTALL.ja.md` /
  `INSTALL.ko.md`（インストール・アップグレード・分割プラグインからの移行・検証・
  トラブルシューティング）。全 README に言語切替リンク、`ja` / `ko` 互換性注記
  （公式 DSH の `LOCALE_IDS` は `["zh", "en"]`）、バージョン表記を追加。
- README.ja / README.ko を英語の正本と同等の内容に拡張（P0–P4 チェーン表、背景/機能、
  ルール ファイル形式、Permissive ティア、CLI）。

## [0.1.0] - 2026-08-30

### Added
- P0–P4 判定チェーン：ハード拒否 / セッション許可 / 静的な拒否優先ルール連鎖 / 任意の分類器（既定オフ）/ `ask`。
- 純関数ルールエンジン：glob/regex コンパイル＋ReDoS 上限、失敗時 loud-fail、コンテンツハッシュのコンパイルキャッシュ。
- argv 分解によるコマンドホワイト/ブラックリスト（`sh -c`/`bash -c` 再帰、パイプライン、リダイレクト、再帰/強制）。
- 正準フィンガープリントによる精密なセッション許可（TTL＋maxUses、対象が異なれば再利用不可）。
- `{ignorable:true}` 判定監査と、モデル可視⟺記録の不変条件。
- スタンドアロンの dry-run CLI 評価器（`dsh-perm-gate --rules … --tool … --args …`）。
- DSH cordis 関数プラグイン契約（`cordis.patch.yml`、Schemastery `Config`、exports/types）。
- 4 言語 README（en/zh/ja/ko）と Keep-a-Changelog 枠組み（en＋ja＋ko）。