# インストールガイド

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

`dsh-perm-gate` バージョン **1.0.0**。判定チェーン、ルールファイル形式、Permissive
ティアについては [日本語 README](./README.ja.md) を参照してください。

## 必要条件

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) がインストール済みであること。
- Node.js **>= 20**（`package.json` の `engines` を参照）。
- `dsh` CLI が `PATH` に存在すること。
- インストール先の profile。ブラウザ側は `web` profile 向けにのみビルドされます
  （`package.json` の `dsh.client.platform = "web"`）。

## DSH のバージョンに合う tag を選ぶ

単一ビルドが DSH 両ラインをカバーするため、どちらの tag を選んでも動作するコードが
インストールされます —— tag を残しておくのは、あなたがピン留めするバージョンが
各ラインで意味を持つようにするためです。

| DSH のバージョン | インストール方法 |
|-----------------|-----------------|
| `0.1.2-alpha.1` 以上（`0.1.5-rc.2` を含む） | `dsh plugin --profile web add dsh-perm-gate`（tag `latest`） |
| `0.1.1-rc.2` まで | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH は `engines.dsh` を強制しないため、tag が選択メカニズムであり、互換性ゲート
そのものではありません。単一ビルドが両ラインをカバーする理由と tag の公開方法については、
[RELEASING.md](./RELEASING.md) を参照してください。

## 公式 CLI でインストール

```sh
dsh plugin --profile web add dsh-perm-gate
```

公開パッケージを取得し、`cordis.patch.yml`（Permissive セッション ティアとプラグイン
本体の挿入）を適用して、host / client の両方を組み込みます。

## ソースからインストール

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts、tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` は `prepublishOnly` でもあるため、公開時に古い `lib/` が混入しません。

## 有効化と設定

profile の `cordis.yml` にプラグインを追加します：

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # 任意。既定は $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # 保護対象チェックのルート固定
    defaultAction: ask              # allow | ask | deny
```

まずは [examples/permissions.example.yaml](./examples/permissions.example.yaml)
から始め、profile を再読込してください。

## アップグレード

```sh
dsh plugin --profile web update dsh-perm-gate
```

その後、パッチファイルを再読込させるために profile を再適用します：

```sh
dsh profile reload --profile web
```

## 分割プラグインからの移行

`dsh-perm-gate` は、これまで `dsh-permission-rules` / `dsh-auto-mode` /
`dsh-auto-review` / `dsh-movein-permissions` に分散していたゲート・承認シーム・
（任意の）分類器を 1 つのパッケージに統合します。

1. 既存のルール一覧（deny / allow / ask）を書き出し、1 つの `permissions.yaml`
   に統合します。
2. 上記 4 プラグインを `cordis.yml` から削除し、`dsh-perm-gate` のエントリだけを
   追加します。
3. それらが提供していた preset の上書きを削除します。`cordis.patch.yml` は
   `permission.config.presets` を**丸ごと置換**するため、他プラグインの古い
   key 単位パッチが Permissive ティア（または組み込みティア）を黙って消すことがあります。
4. profile を再読込し、後述の `--list` で検証します。

## 検証

```sh
# 読み込まれたルールセットのサマリ（Harness 不要）
dsh-perm-gate --rules permissions.yaml --list

# 1 回の呼び出しを dry-run
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

`--list` の出力例：

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

UI では **設定 → プラグイン → Permissive 承認ティア** に、1 つのスイッチと 4 つの
バックエンド戦略トグルが表示されます。

## アンインストール

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

プラグインを削除するとパッチの寄与も失われるため、Permissive ティアはセッションの
権限ピッカーから再び消えます。

## トラブルシューティング

**権限ピッカーに Permissive ティアが出ない。**
DSH の bundle patch は `permission.config.presets` を key 単位でマージせず**全体置換**
します。profile を再読込して `cordis.patch.yml` を再適用し、後から読み込まれる
プラグインが `presets` を上書きしていないか確認してください。

**ルールファイルがあるのに `--list` が `ruleCount: 0` を返す。**
`rulesFile` はプラグイン ディレクトリではなく Harness プロセスの CWD から解決されます。
絶対パスを使うか、シェルの CWD を確認してください。不正なドキュメントは読み込み時に
loud-fail し、暗黙に無効化されることはありません。

**`llmAssist` が発火しない。**
`classifierEndpoint` / `classifierModel` / `classifierApiKey` が必要です
（**設定 → プラグイン → Permissive 承認ティア** または `cordis.yml` で設定）。
欠落や通信エラー時は人手のシームへフォールバックします。設計上 fail-closed です。

**設定カードに「設定名前空間が利用できません」と出る。**
プラグインが現在の profile に組み込まれていません。
`dsh plugin --profile web add dsh-perm-gate` を実行して再読込してください。

**`ja` / `ko` を選ぶと `locale "<id>" is not registered` になる。**
公式 DSH の `LocaleRuntime` は `zh` / `en` のみを公開しています。
[日本語 README](./README.ja.md) の互換性に関する注記を参照してください。

## ライセンス

[MIT](./LICENSE)
