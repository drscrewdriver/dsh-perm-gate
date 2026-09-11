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

> **互換性に関する注記:** v2.0.0 は `ja` / `ko` 辞書を同梱しますが、公式 DSH の
> `LocaleRuntime` が公開するのは `zh` / `en` のみです（`LOCALE_IDS = ["zh", "en"]`）。
> 素の DSH で `ja` / `ko` を選択すると `locale "<id>" is not registered` になります。
> `LOCALE_IDS`（locale-settings.ts）と `LOCALES` ラベル（client/index.ts）を更新した
> DSH fork を使って再ビルドしてください。

> **▼ DSH バージョン互換性**
>
> 2 つの DSH ラインが 2 つの長期ブランチから提供され、それぞれが独立したバージョン
> 系列、`engines.dsh`、npm dist-tag を持っています
> （[リリースレイアウト](./RELEASING.md)）：
>
> | DSH バージョン | ブランチ | バージョン | npm タグ |
> | --- | --- | --- | --- |
> | 0.1.0-rc.7 ~ 0.1.1-rc.x | `legacy` | `1.x` | `@legacy` |
> | 0.1.2-alpha.1+（0.1.5-rc.2を含む） | `main` | `2.x` | `@latest` / `@dsh-0.1.2` （`@2.x` は範囲） |
>
> バージョン系列は **DSH ライン**を追います（`1.x` = DSH ≤ 0.1.1、`2.x` = DSH 0.1.2+）。
> メジャー同士が互いを遮断するため、`^1.x` のインストールが `2.x` を解決することは
> なく、その逆もありません。`engines.dsh` も同じ境界を述べていますが DSH は決して
> 読まないため、古い DSH を `1.x` に留めるのはバージョン範囲と dist-tag です。
>
> `@deepseek-ai/dsh-client-runtime` は `0.1.2-alpha.1` で**削除**されました ——
> 単なる移動ではありません。`legacy` ラインは引き続きこれを通じて
> `ctx.slots` にアクセスします；`main` は
> `@deepseek-ai/dsh-client-ui-renderer/client` から同じ宣言を取得します。
> 2 つのバージョン依存シームは、バージョンチェックではなく機能プロブで処理
> されます：（1）設定登録は `register` を使い、両ラインとも存在します
> （`installSection` は追加であり、置き換えではありません）；（2）
> `effectivePolicy` は両ラインとも user-approval サービスの**プライベート**
> メソッドであるため、`typeof` プロブで読み取り、欠落時やエラー時には「ポリシー
> 不明」にフォールバックします。

バージョン **2.0.0** — 変更履歴は [日本語 changelog](./CHANGELOG.ja.md) を参照。

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
- **自动审查ティア**（`permissive`）— read-only / full-access / whitelist とは別の**独立した承認
  モード**。汎用の「自動承認」でもなく、包括的な権限付与でもありません。フロントが露出する
  のは**単一スイッチ**（`permissive`）だけで、バックエンドの 4 つの戦略は**組み合わせ
  可能**でプラグイン設定から制御されます。P0 に対しては依然 fail-closed です。
  権限ピッカーと設定行はいずれも製品名「自动审查」で表示し、アイコンは描きません。
- **サンドボックス昇格の自動回答**（`trustEscalation`）— サンドボックス昇格は shell /
   pwsh / edit ツールの**内部**（`tools/pre-execute` 後）から発生するためゲートはそれを
   見ておらず、ゲートが自動許可した呼び出しでも確認プロンプトが表示されます。この戦略を
   オンにすると、ゲートが許可した呼び出しを `callId` で正確に一致させてここで直接回答
   します。

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
    rulesFile: ./permissions.yaml   # 任意。既定は $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # 保護対象チェックのルート固定
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # ゲートが有効なティア（既定）
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

## 自动审查ティア（マシン値 `permissive`）

自动审查は権限ピッカーの中で 読み取り専用 / ワークスペース内変更 / 完全権限 /
許可リストと並ぶ**独立した承認ティア**です。汎用の「自動承認」ではなく、包括的な権限を
発行することもありません。人間/LLM のシーム**の前**で判定を狭めたり広めたりする
だけで、P0 ハード拒否は単調かつ交渉不能のままです。

ピッカーの表示名は**ホストが供給する製品名**で、言語別辞書の項目ではありません。DSH 0.1.2 は
プラグイン提供ティアの `name:` を 2 つの権限サーフェス（一般設定の既定行と入力欄のピッカー）で
そのまま描画し、自前のローカライズ済みラベルは 3 つの組み込み値にしか与えないため、
`cordis.patch.yml` は全セッション共通で中国語ラベルを配布します。このティアは**アイコンを
描きません** —— ピッカーのグリフは組み込み値にのみ紐づきます。

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
      trustEscalation: true      # ゲートが許可済みの呼び出し自身のサンドボックス昇格は確認不要
      llmAssist: false           # まず LLM が分類、ask/失敗時は人手へ
```

`trustAutoAllow` は中間ティアのベースラインです（rule-allow は自動通過）。
`alwaysConfirm` はすべての境界で承認パネルを表示し、その「許可コントロール」に
2 つの拡張ボタンを追加します — **このセッションで当該種別を繰り返し許可**
（`approveRepeat`、有界なセッション許可）と**すべての発生を許可**
（`approveAllowEverywhere`、コマンド語を `permissions.yaml` の allow ホワイトリストへ
永続化して再読込）。`llmAssist` は設定済みの実際の LLM
（受信先は設定カードで選択：**カスタム API**（`classifierEndpoint` / `classifierModel`。OpenAI 互換 API なら何でも可、Xiaomi MiMo `https://api.xiaomimimo.com/v1` 等のプリセット付き）または**ホストモデルグループ**（DSH の `llm` サービスと現在のモデルグループ、`classifierProvider` / `classifierModel` で上書き可）。**健全性テスト**ボタンで受信 LLM の疎通とレイテンシを確認可能）に
`ask` の自動判定を委ね、`ask`/エラー時は人手のシームへフォールバックします —
常に fail-closed です。`trustEscalation`（ティア有効時に既定オン）はゲートがすでに許可した呼び出し内で
`sandbox_permissions` 昇格が発生した際にここで回答します。以下参照。`permissive` がオフなら、ゲートの挙動は以前と完全に同じです。

### サンドボックス昇格：なぜ `safe` 判定でもプロンプトが出たか

ツール呼び出しは**2 つの独立した承認**を引き起こし得ます。ゲートが持つのが第 1 の承認 —
`tools/pre-execute` ウォーターフォール上の `ask` です。第 2 はツール内部の `approveEscalation`、
`tools/execute` 時刻に発生し、モデルが `sandbox_permissions` + `justification` を渡したとき；
すでに `tools/pre-execute` は決着しているため、ゲートの allow はそこに届きません。LLM が `safe` と
判定しゲートが自動許可した呼び出しでも、サンドボックス広げの確認プロンプトが出たままでした。

`trustEscalation` はこの隙間を埋めます。ゲートは正面向上許可した呼び出し（ホストの `callId` で
キー化され、昇格リクエストがこれを繰り返す）を記憶し、昇格をここで `allowed-once` と自答します。
**すべてが満たされる場合のみ**適用されます：

- 自动审查ティアがオンで `trustEscalation` がオン；
- 呼び出しにゲートが許可した `callId` があり、ツール名が一致；
- 理由は認識された昇格で `workspace-write` または `danger-full-access` を命名。

それ以外は — 認識されない理由、異なる呼び出し、ゲートが ask した/拒否した呼び出し、`approval:
never` パススルー — は人手に変更なく委譲されるため、将来の DSH 変更でも open ではなく closed
になります。自動回答はイベントフィードに記録されます
（`verdict: "escalation-auto"`、`mode: <ターゲット>`）。スイッチをオフにすると広げは
人手ゲート化されたまま、他の許可は自動のままとします。

### 選択可能なセッション ティア

`cordis.patch.yml` は DSH の `permission.config.presets` に、ワークスペース内変更と
完全権限の間に `permissive` preset（`sandbox: workspace-write`、`approval: ask`、
名称 **自动审查**）を追加します。DSH の bundle patch はこの map を**全体置換**するため
（キー単位のマージではありません）、組み込み 3 ティア
（`read-only` / `workspace-write` / `danger-full-access`、
`@deepseek-ai/dsh-base/cordis.patch.yml` 由来）も再記載する必要があり、
`test/patch-presets.spec.ts` がそのキー集合を固定しています。したがって
セッションの権限ピッカーには「auto-approval」ではなく、**独立して選択できる承認
ティア**として「自动审查」が並びます。

ゲートが動作するのは **`gatePresets` に列挙したティアの中だけ**です（既定 `['permissive']`、
このプラグインが追加するティア）。それ以外のティア（Read Only / Workspace Write /
Full access / `custom`）では、ゲートの判定フローは**一切実行されません**——許可も、ask も、
拒否も、P0 ハード拒否も、拒否キーワードの遮断も、監査イベントの記録も行いません。選択された
ティア自身の方針が呼び出しを決めます。`danger-full-access` の定義は「承認プロンプトなしの
フルアクセス」であり、そこを ask で上書きしても意味がありません（その方針では DSH の承認シームが
**どの answerer よりも先に** `rejected` を返し、転送された ask はパネルを一度も表示せず
`the user rejected tool "..."` にしかなりません）。ハード拒否で上書きするのも、ユーザーが選んだ
ティアを黙って覆すことになります。`gatePresets: ['*']` でゲートを再び全体（ハード拒否を含む）に
適用できます。有効なティア内では、セッションの実効承認方針が `never` の場合 ask はパススルーに
降格します。

### UI から設定可能

このティアは実行時にも **設定 → プラグイン → Permissive 承認ティア** から調整できます
（プラグインのブラウザ側が描画する `settings.plugins.tab` ページ）。1 つのスイッチが
`permissive` を切り替え、4 つのトグルがバックエンドの `permissiveStrategies` を編集
します。host は名前空間を live に読むため、変更は再起動なしで次のツール呼び出しから
適用されます。これは独立した承認クラスであり、DSH の「auto-approval」モードでは
**ありません**。

### リスク判定 llmAssist、裁決学習、イベントフィード

`llmAssist` 有効時、設定された LLM（OpenAI 互換エンドポイントなら任意——`classifierEndpoint` / `classifierModel` / `classifierApiKey` を自分の API に向けてください）が構造化プロトコルで `ask` を 1 件ずつ判定します。**判定はゲートの `tools/pre-execute` ウォーターフォール内、決定がホストへ返る前に行われます**：`safe` はそのまま委譲されるため承認パネルは一切表示されず、本当に判断できない判定だけが人手に回ります。

- `safe` → 自動許可（監査ソースは `classifier`）。パネルは表示されません。
- `risky` + **ハードリスクカテゴリ**（`deletion`、`credential`、`remote`、`system`、`bulk`）→ **自動拒否**、パネルなし。ハードリスクは自動許可も学習もされません。
- `risky:neutral` → `riskLearning` 有効時（設定カード内、既定オフ）、人手で承認され実際に実行された neutral リスクは `tool|カテゴリ` ごとにカウントされ、`riskThreshold`（既定 3）到達かつ新呼び出しの操作指紋（コマンド語＋対象の基底名）が確認済みサンプルに一致した場合、**同一操作のみ**自動許可されます。学習沈殿（`riskSediment`、既定オン）を有効にすると、しきい値に達したキーの確認サンプルは**決定論的な許可ルール**になります：指紋の正確一致は LLM を経由せず自動許可——llmAssist オフでも継続し、沈殿ルールは設定カードで確認・管理（終止 / サンプル削除）できます。
- タイムアウト（`riskTimeoutMs`、既定 20 秒、1 回リトライ）、通信失敗、プロトコル外出力は元の `ask` を維持します。

学習状態はプラグイン所有の JSON（`$DSH_HOME/perm-gate/learning.json` または `learningFile`）に永続化され、YAML ルールには書き込みません。各決定は `$DSH_HOME/perm-gate/events.jsonl`（または `eventsFile`）に追記され、`GET /api/dsh-perm-gate/events?sessionId=&since=` で提供されます。ブラウザ側はこれをポーリングし、入力欄の上に最新の決定を通知バーで表示するとともに、会話ビューの「承認記録」タブにセッション内の全判定を新しい順に一覧表示します。

各決定が触れたファイルは変更前に（1 イベントあたり ≤5 ファイル、各 ≤256 KB）`$DSH_HOME/perm-gate/snapshots/` へスナップショットされます。「承認記録」タブでは各ファイルチップから行単位の diff（`GET /api/dsh-perm-gate/diff`）を開き、**取り消し**（`POST /api/dsh-perm-gate/revert`）で会話に復元指示を送信できます。スナップショット管理バーはセッション単位または全件で削除できます（`GET /api/dsh-perm-gate/snapshots-stats` / `POST /api/dsh-perm-gate/snapshots-clear`）。

人手に回した `ask` は回答が返るまで追跡されます。受動的な `approval/request` オブザーバが閉じた結果を記録し（`allowed-once` → **承認**、`rejected` → **拒否**、`cancelled` → **キャンセル**、`unavailable` → 拒否＝承認チャネルなし）、オブザーバが関連付けできない場合（`callId` 欠落・approval サービスなし・上流リスナーの短絡）は `tools/result` が同じ ask をフォールバックとして解決します。承認時には承認後の学習進捗（`n`/しきい値）を表示し、通知バーも 3 つの終態にラベルを付けます。

さらにプリセットの**拒否キーワード黑名単**（dsh-approval-gate の `DEFAULT_DENY_KEYWORDS` を継承：`rm -rf`、`push --force`、`drop table`、`mkfs`、`git reset --hard`、`docker system prune` など）を備え、テキストがキーワードを含む呼び出し（大小文字を区別しない部分一致）は許可リスト / 許可 / LLM より先に拒否します。設定カードでリストとして編集でき（プリセット項目にはタグ付き、ワンクリック復元対応）、未設定・空ならプリセットを適用します——黑名単が静かに無効化されることはありません。
このティアは権限ピッカーに**アイコンを表示しません** —— ピッカーのグリフは組み込み 3 値にのみ
紐づき、プラグイン提供ティアはテキストのみです。


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
