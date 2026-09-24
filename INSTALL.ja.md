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

`dsh-perm-gate` バージョン **4.1.2**。判定チェーン、ルールファイル形式、自动审查
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

公開パッケージを取得し、`cordis.patch.yml`（自动审查セッション ティアとプラグイン
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

## **DSH** アップグレード後：入力欄アイコンのパッチを再適用

「自动审查」と「自动审查（高权限）」の 2 つのティアにアイコンが付くのは、
`scripts/patch-permission-glyph.mjs` が **DSH ホストパッケージ内の閉じた Map** に
それらを追加したからにすぎません ——「自动审查」は `workspace-write` の盾＋鉛筆を、
「自动审查（高权限）」は `danger-full-access` の盾＋感嘆符をコピーしており、それぞれが
実際に共有するファイルサンドボックスのグリフになります。DSH はプラグイン提供ティアに
**設計上アイコンを与えません** —— その Map 自身のコメントが *"host-configured names
outside the design set get none"* と述べています。プラグインが影響できる option
オブジェクトは `{value, name, description}` しか運ばないため、代わりに使えるプラグイン側の
シームは存在しません。

スクリプトは取得元のキーを**解決**します（`["<key>",` を先に、次にホストが使う定数別名 ——
0.1.5 の `danger-full-access` は `[FULL_ACCESS,`）。DSH はこの設計セットを一度変更して
います —— 0.1.2 には `permissive` のグリフがあり、0.1.5 には `read-only` /
`workspace-write` / `danger-full-access` しかありません。解決できないキーは、Map が実際に
持つキーと一緒に報告されるため、ティアの付け替えは `GLYPH_TARGETS` の 1 行で済みます。

このパッチは**ホスト**のファイルを書き換えるので、**DSH のアップグレードや再インストールで
失われます**。*本プラグイン*のアップグレードでは失われません。アイコンは元々プラグインの
ものではなく、プラグイン自身の寄与（`cordis.patch.yml` の `name:` / `description:`）は
パッケージに同梱されています。

```sh
npx dsh-perm-gate-patch-glyph            # パッチを適用
npx dsh-perm-gate-patch-glyph --check    # 確認のみ。グリフが失われていれば終了コード 1
dsh profile reload --profile web
```

スクリプトは**このパッケージに同梱**されています —— `scripts/patch-permission-glyph.mjs`
としても、`dsh-perm-gate-patch-glyph` bin としても —— ソースの checkout は不要です。
**意図的に `postinstall` には接続していません**：これはホストパッケージを書き換えるもので、
プラグインが許可なく自分の harness を書き換えてよい理由はありません。適用の有無にかかわらず
DSH の動作に影響はなく、ティア自体はそのまま機能します。

このスクリプトは冪等（2 回目は no-op）で、バックアップは 1 度だけ取り、2 つのグリフは
両方適用するか両方とも適用しないか（解決できない取得元キーは拒否であり、部分適用では
ありません）のいずれかで、壊れたスライスを書き込もうとしません —— 結果に対して
`node --check` を実行し、失敗すればバックアップを復元します —— したがって DSH
アップグレードのたびに無条件で再実行して安全です。
呼び出し元の profile スコープを先に、CLI インストールを次に探すため、nvm のバージョン
変更やインストール symlink の貼り替えでも壊れません。マシンに複数の DSH インストールが
ある場合、**パッチを当てなかった**方は出力に列挙されます —— 目の前の UI を提供している
のはそのうち 1 つだけなので、必要ならそのパスを引数で明示してください。

**プラグインを再インストールしてもアイコンは戻りません。**
`dsh plugin --profile web add …` は profile ディレクトリ内の pnpm に引数を転送し、
profile 自身の `node_modules` しか書き換えません（`-w` ＝ `--workspace-root` ですが、
この profile の workspace は `packages: ['.']` そのものなので関係ありません）。
アイコンは DSH インストール側にあります。標準的なインストールでは、以下の 3 つの
パスは 3 つのコピーではなく **1 つの物理ファイル**です：

| パス | 実体 |
|------|------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | DSH インストール先（symlink のことがある） |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | そこへの**ジャンクション** |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | パッチ対象のファイル |

見るべき症状：ティアは動作しゲートも効いたままですが、入力欄のドロップダウンの行に
アイコンがなく、折りたたまれたトリガーは他のティアがアイコン＋文字なのに対して
文字だけになります。

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
   key 単位パッチが自动审查ティア（または組み込みティア）を黙って消すことがあります。
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

UI では **設定 → プラグイン → 自动审查** に、1 つのスイッチと 4 つの
バックエンド戦略トグルが表示されます。

## アンインストール

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

プラグインを削除するとパッチの寄与も失われるため、自动审查ティアはセッションの
権限ピッカーから再び消えます。

## トラブルシューティング

**権限ピッカーに自动审查ティアが出ない。**
DSH の bundle patch は `permission.config.presets` を key 単位でマージせず**全体置換**
します。profile を再読込して `cordis.patch.yml` を再適用し、後から読み込まれる
プラグインが `presets` を上書きしていないか確認してください。

**「自动审查」ティアの入力欄アイコンが消えた。**
DSH のアップグレードまたは再インストールが、パッチを当てたホスト bundle を置き換え
ました。プラグインを再インストールしても戻りません。
`npx dsh-perm-gate-patch-glyph` を実行して再読込してください。取得元キーが無いと
報告された場合は DSH がグリフ表を再度変更しています —— エラーが現在のキー一覧を
示すので、`GLYPH_TARGETS` の該当ティアを付け替えてください。
ティア自体は影響を受けません —— パッチなしでもラベルとゲートは動作します。

**ルールファイルがあるのに `--list` が `ruleCount: 0` を返す。**
`rulesFile` はプラグイン ディレクトリではなく Harness プロセスの CWD から解決されます。
絶対パスを使うか、シェルの CWD を確認してください。不正なドキュメントは読み込み時に
loud-fail し、暗黙に無効化されることはありません。

**`llmAssist` が発火しない。**
`classifierEndpoint` / `classifierModel` / `classifierApiKey` が必要です
（**設定 → プラグイン → 自动审查** または `cordis.yml` で設定）。
欠落や通信エラー時は人手のシームへフォールバックします。設計上 fail-closed です。

**「承認記録」ページが空のまま。**
ゲートが動作するのは `gatePresets` に列挙したティア（既定 `['permissive']`、
ピッカーでの表示名が「自动审查」）だけなので、他のティアのセッションでは
イベントを一切記録しません —— 記録したいセッションで権限ピッカーから
「自动审查」を選んでください。preset を一度も選んでいないセッションも対象外です。
新しいセッションの初期ティアは `permission.defaultPreset` 設定で決まります。

**設定カードに「設定名前空間が利用できません」と出る。**
プラグインが現在の profile に組み込まれていません。
`dsh plugin --profile web add dsh-perm-gate` を実行して再読込してください。

**`ja` / `ko` を選ぶと `locale "<id>" is not registered` になる。**
公式 DSH の `LocaleRuntime` は `zh` / `en` のみを公開しています。
[日本語 README](./README.ja.md) の互換性に関する注記を参照してください。

## ライセンス

[MIT](./LICENSE)
