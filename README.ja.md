# dsh-perm-gate

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

> **互換性に関する注記:** v0.1.0 は `ja` / `ko` 辞書を同梱しますが、公式 DSH の
> `LocaleRuntime` が公開するのは `zh` / `en` のみです（`LOCALE_IDS = ["zh", "en"]`）。
> 素の DSH で `ja` / `ko` を選択すると `locale "<id>" is not registered` になります。
> `LOCALE_IDS`（locale-settings.ts）と `LOCALES` ラベル（client/index.ts）を更新した
> DSH fork を使って再ビルドしてください。

バージョン **0.1.0** — 変更履歴は [日本語 changelog](./CHANGELOG.ja.md) を参照。

DeepSeek Harness 向けの、単一・自己完結・決定論優先・fail-closed な権限ゲートです。

ツール呼び出しごとに固定の優先チェーンで判定します：

| 段階 | 判定 | 内容 |
| ---- | ---- | ---- |
| **P0** | `deny` | 決定論的ハード拒否：資格情報の material / 保護パスの変更 / 危険な shell |
| **P1** | `allow` | 精密で有界な**セッション許可** grant |
| **P2** | `deny/allow/ask` | 静的ルール連鎖：ブラックリスト → allow → ask の順 |
| **P3** | `allow/deny/ask` | 任意の LLM 意味分類器（既定**オフ**） |
| **P4** | `ask` | 公式の approval seam |

fail-closed を徹底します：P0 の判定は、grant・ルール・分類器・人間のいずれにも
上書きされません。

## 背景

DSH の安全まわりのエコシステムでは、この役割が `dsh-permission-rules` /
`dsh-auto-mode` / `dsh-auto-review` / `dsh-movein-permissions` の複数プラグインに
分散しています。`dsh-perm-gate` はゲート・承認・（任意の）分類器を 1 パッケージに
統合し、監査ログを 1 本にまとめ、プラグイン間のバージョン結合をなくします。

## 主な機能

- **コマンド ホワイト/ブラックリスト** — 生文字列ではなく **argv 分解**で照合
  （`sh -c`/`bash -c` の再帰降下、パイプライン検出、リダイレクト先の検査、
  再帰/強制（`rm -rf`）の認識）。
- **拒否優先** — 拒否ルールはどの allow ルールにも勝ります。
- **セッション許可** — `(ツール, 正準フィンガープリント)` 単位の精密な許可
  （TTL＋maxUses。対象が変われば権限は再利用されません。サブエージェントは継承
  できますが自ら発行はできません）。
- **純関数ルール エンジン** — glob/regex コンパイル＋ReDoS 上限、不正ルールは
  loud fail、ソースの内容ハッシュによるコンパイル キャッシュ。
- **監査** — すべての判定を `callId` 付きの `{ignorable:true}` イベントとして記録。
  モデルに見える理由と記録される結果は常に一致します。
- **Permissive ティア** — read-only / full-access / whitelist とは別の**独立した承認
  モード**。「自動承認」でもなく、包括的な権限付与でもありません。フロントが露出する
  のは**単一スイッチ**（`permissive`）だけで、バックエンドの 3 つの戦略は**組み合わせ
  可能**でプラグイン設定から制御されます。P0 に対しては依然 fail-closed です。

## インストール

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) が導入済みである
必要があります。

```sh
dsh plugin --profile web add dsh-perm-gate
```

インストール・アップグレード・移行・トラブルシューティングの詳細は
[日本語インストールガイド](./INSTALL.ja.md)（[English](./INSTALL.md) /
[中文](./INSTALL.zh.md) / [한국어](./INSTALL.ko.md)）にあります。

## 設定

`cordis.yml` に追加します：

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # 任意。空なら defaultAction に従う
    dshHome: $DSH_HOME              # 保護対象チェックのルート固定
    defaultAction: ask              # allow | ask | deny
```

### ルール ファイル

```yaml
permissions:
  defaultAction: ask
  deny:
    - command: [rm#recursive]
      reason: no recursive rm
    - paths: [.dsh/**]
      reason: protect harness metadata
  allow:
    - command: [pnpm, node]
      reason: dev tools
    - command: [curl, wget]
      args: ["https://*.example.com/*"]
      reason: allowed endpoint
  ask:
    - command: [bash, sh]
      reason: ask shells
```

コマンド項目の `word#flag` は、コマンド語 `word` に修飾子 `recursive` または
`force` を付けて照合します。つまり `rm#recursive` は `rm -rf`、`env rm -rf`、
`sh -c "rm -rf /"` に一致します。

完全な例: [examples/permissions.example.yaml](./examples/permissions.example.yaml)

## Permissive ティア

Permissive は権限ピッカーの中で Read Only / Workspace Write / Full access /
Whitelist と並ぶ**独立した承認ティア**です。「自動承認」ではなく、包括的な権限を
発行することもありません。人間/LLM のシーム**の前**で判定を狭めたり広めたりする
だけで、P0 ハード拒否は単調かつ交渉不能のままです。

`cordis.yml` では：

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml
    defaultAction: ask
    permissive: true            # フロント唯一のスイッチ（独立ティア ON）
    permissiveStrategies:        # バックエンド戦略、組み合わせ可
      trustAutoAllow: true       # スコープ内安全操作は自動許可、危険/不明は ask
      alwaysConfirm: false       # すべて ask。許可コントロールに拡張ボタン 2 つ
      llmAssist: false           # まず LLM が分類、ask/失敗時は人手へ
```

`trustAutoAllow` は中間ティアのベースラインです（rule-allow は自動通過）。
`alwaysConfirm` はすべての境界で承認パネルを表示し、その「許可コントロール」に
2 つの拡張ボタンを追加します — **このセッションで当該種別を繰り返し許可**
（`approveRepeat`、有界なセッション許可）と**すべての発生を許可**
（`approveAllowEverywhere`、コマンド語を `permissions.yaml` の allow ホワイトリストへ
永続化して再読込）。`llmAssist` は設定済みの実際の LLM
（`classifierEndpoint` / `classifierModel`。OpenAI 互換 API なら何でも可）に
`ask` の自動判定を委ね、`ask`/エラー時は人手のシームへフォールバックします —
常に fail-closed です。`permissive` がオフなら、ゲートの挙動は以前と完全に同じです。

### 選択可能なセッション ティア

`cordis.patch.yml` は DSH の `permission.config.presets` を拡張し、Workspace Write と
Full access の間に `permissive` preset（`sandbox: workspace-write`、`approval: ask`、
名称 **Permissive**）を追加します。Auto モードと同じ仕組みです。したがって
セッションの権限ピッカーには「auto-approval」ではなく、**独立して選択できる承認
ティア**として Permissive が並びます。

### UI から設定可能

このティアは実行時にも **設定 → プラグイン → Permissive 承認ティア** から調整できます
（プラグインのブラウザ側が描画する `settings.plugins.tab` ページ）。1 つのスイッチが
`permissive` を切り替え、3 つのトグルがバックエンドの `permissiveStrategies` を編集
します。host は名前空間を live に読むため、変更は再起動なしで次のツール呼び出しから
適用されます。これは独立した承認クラスであり、DSH の「auto-approval」モードでは
**ありません**。

## CLI（スタンドアロン dry-run）

Harness なしで 1 件の呼び出しをルール ファイルに対して評価できます：

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
dsh-perm-gate --permissive --tool bash --args '{"command":"pnpm install"}'
```

## 開発

```sh
npm run typecheck
npm test
npm run build
```

## ライセンス

[MIT](./LICENSE)
