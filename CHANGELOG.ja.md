# 変更履歴

このプロジェクトの重要な変更はすべてこのファイルに記録されます。

形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に従い、
このプロジェクトは [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠します。

## [0.2.1-beta.5] - 2026-09-11

### 修正

- **DSH 0.1.2 ではゲートが全呼び出しで待機状態になり、「承認記録」ページが空のままでした。** セッションの
  権限プリセット fold はログを `exec.agent.session.events` として読んでいました。DSH 0.1.1 はこの配列を
  公開していましたが、0.1.2 はログを `Session.snapshotEvents()` / `ownEvents()` の背後に隠し `events`
  メンバーを残していないため、読み取りは `undefined` を返し、`presetOf` も `undefined` を返し、
  `presetInScope(undefined, ['permissive'])` によって `gateActive` が**すべての**呼び出しで false に
  なりました —— ルール / grant / 拒否キーワード / 分類器 / P0 ハード拒否のいずれの判定も行われず、監査
  イベントも記録されません（ゲート自身のティアを選択したセッションでも同様で、タブには失敗ではなく
  「本セッションにはまだ承認記録がありません」と表示されていました）。fold は既知のすべてのアクセサ形状
  （`events` 配列、`snapshotEvents()`、`ownEvents()`）でログを読み、ホストが何も公開しない場合にのみ
  「イベントなし」に縮退します。fold キャッシュはログ長と末尾イベントの同一性をキーにします（0.1.2 の
  スナップショットは同じ凍結イベントに対する毎回新しい配列のため）。`test/preset-scope.spec.ts` が両形状を
  固定します。

### 変更

- **権限ティアの表示名を全サーフェスで「自动审查」に統一し、アイコンを廃止しました。**
  `cordis.patch.yml` の preset `name:` が中国語の製品名になり、一般設定の既定行・入力欄のピッカー・
  プラグイン設定タブのすべてで同じ表示になります。DSH 0.1.2 はプラグイン提供ティアの `name:` をそのまま
  描画し、ローカライズするのは組み込み 3 値（`仅可查看` / `工作区内修改` / `完全权限`）だけなので、zh
  セッションが見るのはこの 1 つの文字列です。マシン値は `permissive` のままです（`gatePresets` が照合
  する値）。権限ピッカーのアイコン装飾は削除しました（`src/client/permission-icon.ts` を削除）：退役した
  `auto` ティアの盾グリフに合わせるためのもので、0.1.2 では `aria-haspopup="menu"` セレクタ経由で設定行にも
  適用され、ピッカーのグリフは組み込み値にのみ紐づくためプラグイン ティアは描画しません。

## [Unreleased]

### 追加

- Permissive ティアに `trustEscalation` 戦略を追加（ティア有効時に既定オン）：ゲートがすでに許可した呼び出しの
  サンドボックス昇格承認をここで `allowed-once` と回答し、プロンプトを出さなくする。昇格は shell / pwsh / edit
  ツールの内部 — `tools/pre-execute` の決着後 — から発生するため、ゲート自身の allow はそこに届かず、
  LLM が `safe` と判定した呼び出しでも広げの確認を求めていた。ゲートが許可した呼び出しのみ
  （`callId` とツール名で一致）がプロンプトをスキップし、`workspace-write` / `danger-full-access` を
  命名する認識された昇格原因のみ適用。それ以外は変更なく人手へ委譲。自動回答はイベントフィードに記録
  （`verdict: "escalation-auto"`、`mode: <ターゲット>`）。スイッチをオフにすると広げは人手ゲート化。

### 修正

- 設定カードがルール ファイルから編集可能なホワイトリストをシードするようになりました。
  `installSettingsSection` はホスト設定スコープで `scope.set('allowlist', …)` を呼んでいましたが、
  ホスト スコープは `get` / `watch` / `update` / `replace` だけ expose —
  `set(field, value)` は *クライアント* の `mutate()` 用 convenience ラッパーで異なるオブジェクトなので、
  呼び出しが投げて名前空間がシードされませんでした。
  今度は `scope.update({ allowlist: … })` を使います。
- `approval/request` リスナーが `prepend` で登録され、パッシブ オブザーバから回答ゲートになり、
  ブラウザ プロンプトを描画するリモート ブリッジの前に位置するようになりました。
  そのブリッジの後ろにリスナーがあれば、すでに示されたプロンプトしか記録できませんでした。

## [0.2.1-beta.3] - 2026-09-10

### 追加

- リスク判定 `llmAssist`：設定されたカスタム LLM（OpenAI 互換エンドポイント）が各 `ask` を
  `safe` / `risky:<カテゴリ>` で判定。ハードカテゴリ（deletion / credential / remote / system /
  bulk）は自動拒否、タイムアウトは 1 回リトライ、失敗は常に fail-closed。
- 裁決学習（`riskLearning`、既定オフ、`riskThreshold` 1–10、既定 3）：人手で承認され実際に実行された
  neutral リスクをカウントし、指紋一致する同一操作のみ自動許可。`$DSH_HOME/perm-gate/learning.json`
  に永続化され、ユーザーの YAML ルールには書き込みません。
- 決定イベントフィード：各決定を `$DSH_HOME/perm-gate/events.jsonl` に追記し、
  `GET /api/dsh-perm-gate/events?sessionId=&since=` で提供。ブラウザ側は入力欄上の通知バーで表示。
- 権限ピッカーの盾アイコンが折りたたみトリガーにも表示されます。
- 承認記録ページ：会話ビューに「承認記録」タブを追加し、セッション内のゲート判定を新しい順に
  タイムライン表示（種類タグ・リスクカテゴリ・時刻付き）。設定カードの許可リストは行ごとに削除できる
  編集可能なリスト＋一括編集トグルになりました。
- dsh-approval-gate から継承したプリセット拒否キーワード（`DEFAULT_DENY_KEYWORDS`）：キーワード一致
  （大小文字を区別しない部分一致）で許可リスト / 許可 / LLM より先に拒否。設定カードでリスト編集でき
  プリセットタグとワンクリック復元に対応、未設定・空ならプリセットを適用（黑名単は常に有効）。
- 学習沈殿（`riskSediment`、既定オン）：しきい値に達したキーの確認サンプルが決定論的な自動許可ルールに——
  指紋の正確一致は LLM 呼び出しをスキップし、llmAssist オフでも継続。設定カードで一覧表示し、キー終止・
  サンプル削除が可能（`GET/POST /api/dsh-perm-gate/learning`）。
- 選択可能な llmAssist 受信先：**カスタム API**（OpenAI 互換、Xiaomi MiMo
  `https://api.xiaomimimo.com/v1` を含むプリセット付き）または **DSH ホストモデルグループ**
  （`llm` サービス + `agentDefaultModel.currentSelection`、provider/model 上書き可）に加え、
  **健全性テスト**ボタン（`POST /api/dsh-perm-gate/health`）で最小 completion の応答とレイテンシを確認。設定カードは
  `GET /api/dsh-perm-gate/receiver` 経由でライブのプロバイダー/モデルグループ一覧（ホスト
  `llm.listProviders`/`listModels`、カスタムグループ含む）を取得し、実効的な選択を表示します。
- **承認記録のレビュー面**：各決定が触れたファイルは変更前にスナップショットされ（≤5 ファイル、
  各 ≤256 KB、`$DSH_HOME/perm-gate/snapshots/`）、**承認記録**タブでファイルチップから行 diff
  （`GET /api/dsh-perm-gate/diff`）を開き、**取り消し**（`POST /api/dsh-perm-gate/revert`）で会話に
  復元指示を送信できます。スナップショット管理バー（`GET /api/dsh-perm-gate/snapshots-stats` /
  `POST /api/dsh-perm-gate/snapshots-clear`、セッション単位または全件）も追加。イベント行は
  `files` / `justification` / `verdict` / `category` を持つようになりました。
- **人手承認の終態記録**：人手に回した `ask` を追跡し、受動的な `approval/request` オブザーバで
  実際の回答を記録します — `allowed-once` → 承認、`rejected` → 拒否、`cancelled` → キャンセル、
  `unavailable` → 拒否（承認チャネルなし）。オブザーバが関連付けできない場合（`callId` 欠落、
  approval サービスなし、上流リスナーの短絡）は `tools/result` がフォールバックとして同じ ask を
  解決します（「解決時に削除」が唯一の重複排除ルール）。承認時には承認後の学習進捗（`n`/しきい値）を
  表示し、通知バーは 3 つの終態をラベル表示します。

### 削除

- 廃止された **Auto** 権限ティアを `cordis.patch.yml` に再記載しなくなりました。DSH の bundle
  patch は `permission.config.presets` マップ全体を**置換**するため、このファイルは残すべき
  ティアをすべて記載する必要があり、`dsh-auto-mode` が提供していた `auto` も含まれていました。
  同プラグインはアンインストール済みで、ノブは `workspace-write` と同一、説明文の
  「自動レビュー / ワンショット承認」は実装ごと失われ、さらにこのゲートはそのティアでは
  動作しません（`gatePresets` の既定は `['permissive']`）。ピッカーは組み込み 3 ティア
  （`read-only` / `workspace-write` / `danger-full-access`、`@deepseek-ai/dsh-base/cordis.patch.yml`
  から再記載）と本プラグインの `permissive` のみを提示します。
- `test/patch-presets.spec.ts` がこのキー集合を固定し、組み込みティアの脱落や廃止ティアの
  復活があればテストが失敗します。

### 変更

- ゲートは **`gatePresets` に列挙したティアでのみ動作**します（既定 `['permissive']`、
  このプラグインが追加するティア）。それ以外のティア（Read Only / Workspace Write / Auto /
  Full access / `custom`）では判定フローは一切実行されません——許可・ask・拒否・P0 ハード拒否・
  拒否キーワード遮断・監査イベントのいずれも行いません。`gatePresets: ['*']` で再び全体
  （ハード拒否を含む）に適用できます。
- `llmAssist` はリスクカテゴリプロトコルを使用（従来の allow/deny/ask 判定のスーパーセット）。
  `classifier.ts` はリスク判定器と OpenAI 互換トランスポート（`chatCompletion`）を共有します。
  ハードリスクカテゴリ（`deletion` / `credential` / `remote` / `system` / `bulk`）は
  **自動拒否**に変更（人手に渡すのではなく、明らかに危険な操作は確認不要）；`risky:neutral`
  （不確実）のみ人手に渡ります。
- `write` / `edit` に**パス感知のデフォルト**が追加され、ワークスペース内の書き込みは
  `defaultAction`（通常 `allow`）に従い、ワークスペース外への書き込みはコンテンツ審査のため
  `ask` に昇格。LLM 分類器が安全コンテンツを自動許可、有害コンテンツを自動拒否できるため、
  不確実な操作のみポップアップが発生します。

### 修正

- **`llmAssist` の `safe` は記録されるだけで、実際には自動許可されていませんでした。**
  `tools/pre-execute` リスナーは `ask` を即座に返してバックグラウンドで判定していましたが、ホストへ
  渡した ask はすでに承認 answerer へ向かっており、DSH にはそれを取り消す API がありません
  （リクエストの `signal` ができるのは `cancelled` での決着だけです）。そのためパネルは表示され続け、
  フィードには `safe` の自動許可が出ているのに人手でのクリックが必須でした — さらにハードリスクの
  `auto-deny` はホストにまったく届いていませんでした。リスナーは決定を返す**前に** `refineAsk` を
  await するようになり（`makePreExecuteListener`）、`safe` は `next()` で委譲されパネルは出ず、
  ハードカテゴリは自動拒否、`risky:neutral` / `unresolved` / 判定失敗のみが人手の ask を維持します
  （fail-closed）。待機時間は `riskTimeoutMs`（既定 20 秒）で上限が決まり、すでにキャンセルされた
  呼び出しは判定をスキップします。
- **ユーザーが選んだ権限ティアをゲートが上書きしていました。** ゲートは独立した承認ティアを
  持ちますが *すべての* プリセットで動作し、あらゆる越境が `ask` になって DSH 承認シームへ
  転送され、`danger-full-access`（`approval: never`）ではそのシームが **どの answerer よりも
  先に** `rejected` を返しました — パネルは一度も表示されず、read 専用以外のすべての呼び出しが
  誤解を招く `the user rejected tool "..."` で失敗しました。ハード拒否と拒否キーワード層も同様に
  ティアを無視していたため、`danger-full-access`（「承認プロンプトなしのフルアクセス」）が
  黙って狭められていました。ゲート全体が `gatePresets` に限定され、範囲外では何も行わず記録も
  しません。有効なティア内では、実効承認方針が `never` の場合 ask はパススルーに降格します。
- **読み取り専用の検索とセッション内ツールが ask になっていました。** `web_search` /
  `modlens_read_image` は読み取り専用クエリ、`todo_write` / `render_ui` / `validate_dsh_ui` /
  `ask_user_question` / `exit_plan_mode` / `ralph` / `workflow` はセッション内の状態または
  委譲でありながら自動許可の分類に含まれておらず、毎回 `ask`（`no rule matched; default action`
  のポップアップ）になっていました。これらを自動許可に追加し、第三者製の読み取り専用ツール向けに
  `autoAllowTools` 設定を新設しました。P0 ハード拒否と拒否キーワード層は先に実行されるため、
  このリストが権限を広げることはありません。
- **`write`/`edit` がワークスペース外のパスに静かに書き込んでいました。** `~/.bashrc` や
  別ドライブへの書き込みに `defaultAction`（通常 `allow`）が適用され、審査なしで実行されて
  いました。ルールが一致しない場合、`write`/`edit` ツールに対してパス感知のオーバーライドが
  適用され、ワークスペース内の書き込みは `defaultAction` に従い、ワークスペース外の書き込みは
  コンテンツ審査のために `ask` に昇格します。有害なコンテンツは拒否され、`llmAssist` が有効
  な場合は正常な追加が自動許可されます。`deny` ルールはパス範囲に関係なく勝ち、`allow` ルール
  は内部パスを許可できますが、外部パスの審査を回避することはできません。
- **P0 の資格情報検出が文書本文まで走査していました。** トークン・秘密鍵・`credentials.yaml` を
  単に *言及* したファイルの書き込み／編集までハード拒否されていました。操作自体を表す引数
  （`command` / `file_path` など）のみを走査するよう変更し、拒否キーワード層の「ファイルの
  テキストは操作そのものではない」という規則に揃えました。
- **`$DSH_HOME/perm-gate/rules.yml` が読み込まれませんでした。** `rulesFile` に既定値がなく、
  `config` を省略したプロファイルではルールセットが空＋`defaultAction: ask` になり、ユーザーの
  `defaultAction: allow` と `allow:` ルールは黙って無視されていました。`rulesFile` は
  `<dataDir>/rules.yml` を既定値とし、設定カードの許可リストもそこへ書き込みます。
- **`format` が PowerShell の `Format-Table` を拒否していました。** ハイフンはコマンド識別子の
  単語境界ではないため、キーワードの端を識別子文字（`[A-Za-z0-9_-]`）で判定するようにし、
  `format C: /q` は引き続き検出しつつ `Format-Table` / `mkfs.ext4` は正しく扱われます。
- 拒否キーワードのマッチングが、長い識別子の中に単に含まれるだけのキーワードを拒否しなくなり、
  文書本文の引数（`content` / `new_string` / `old_string` / `text` など）は走査対象外になりました
  — ファイルのテキストは操作そのものではありません。マッチングは単語境界を意識するようになり、
  句読点で終わるキーワードや CJK キーワードも引き続き機能し、空白は圧縮されるため余分な空白を含む
  コマンドも検出されます。

### Fixed

- **すべての読み取りクエリに手動承認が必要でした。** `read` / `read_image` / `grep` / `glob` / `ls` / `lsp`
  はワークスペース内のみの読み取り操作で、変更を加えることはできません。これらは自動許可されました。

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