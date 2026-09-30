# dsh-perm-gate

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Français README](./README.fr.md)
- [Deutsch README](./README.de.md)
- [Italiano README](./README.it.md)
- [Русский README](./README.ru.md)
- [Español README](./README.es.md)
- [Installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Guide d'installation](./INSTALL.fr.md)
- [Installationsanleitung](./INSTALL.de.md)
- [Guida all'installazione](./INSTALL.it.md)
- [Руководство по установке](./INSTALL.ru.md)
- [Guía de instalación](./INSTALL.es.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Français changelog](./CHANGELOG.fr.md)
- [Deutsch changelog](./CHANGELOG.de.md)
- [Italiano changelog](./CHANGELOG.it.md)
- [Русский changelog](./CHANGELOG.ru.md)
- [Español changelog](./CHANGELOG.es.md)

> **Kompatibilitätshinweis:** v2.0.0 liefert `ja`-/`ko`-Wörterbücher mit, aber das offizielle DSH
> stellt über `LocaleRuntime` nur `zh` / `en` bereit (`LOCALE_IDS = ["zh", "en"]`). Auf einem
> unveränderten DSH schlägt die Auswahl von `ja` / `ko` mit `locale "<id>" is not registered` fehl.
> Verwenden Sie einen DSH-Fork, der `LOCALE_IDS` (locale-settings.ts) und die `LOCALES`-Beschriftungen
> (client/index.ts) aktualisiert, und bauen Sie ihn neu.

> **▼ DSH-Versionskompatibilität**
>
> Zwei DSH-Linien werden von zwei langlebigen Branches bedient, jeder mit seiner eigenen
> Versionsserie, seinem `engines.dsh` und seinem npm-Dist-Tag
> ([Release-Aufteilung](./RELEASING.md)):
>
> | DSH-Version | Branch | Version | npm-Tag |
> | --- | --- | --- | --- |
> | 0.1.0-rc.7 ~ 0.1.1-rc.x | `legacy` | `1.x` | `@legacy` |
> | 0.1.2-alpha.1+ (inkl. 0.1.5-rc.2) | `main` | `2.x` | `@latest` / `@dsh-0.1.2` (`@2.x` ist eine Range) |
> | 0.2.0-rc.1 (0.2.0-Linie) | `compat/0.2.0` | `5.x` | `@dsh-0.2.0` |
>
> Die Seriennummer folgt der **DSH-Linie** (`1.x` = DSH ≤ 0.1.1, `2.x` = DSH 0.1.2+), und die
> Majors zäunen einander ein: Eine `^1.x`-Installation löst nie eine `2.x`-Version auf und
> umgekehrt. `engines.dsh` sagt dieselbe Trennung aus, aber DSH liest es nie — die Ranges und
> Dist-Tags sind es, die ein altes DSH auf `1.x` halten.
>
> `@deepseek-ai/dsh-client-runtime` wurde mit `0.1.2-alpha.1` **entfernt** — es ist nicht bloß
> umgezogen. Die `legacy`-Linie erreicht `ctx.slots` weiterhin über es; `main` bekommt dieselbe
> Deklaration aus `@deepseek-ai/dsh-client-ui-renderer/client`. Zwei versionsempfindliche Nähte
> werden über Capability-Probes statt Versionsprüfungen gehandhabt: (1) Die
> Einstellungsregistrierung verwendet `register`, das es auf beiden Linien gibt (`installSection`
> ist eine Ergänzung, kein Ersatz); (2) `effectivePolicy` ist auf beiden eine **private** Methode
> des Nutzerfreigabe-Dienstes, daher wird sie hinter einer `typeof`-Probe gelesen und degradiert
> zu „Policy unbekannt“, wenn sie fehlt oder wirft.

Version **2.6.0** — siehe das [Changelog](./CHANGELOG.de.md).

Ein einzelnes, in sich geschlossenes, determinismus-zuerst- und fail-closed-Permission-Gate für
DeepSeek Harness.

`dsh-perm-gate` entscheidet jeden Toolaufruf über eine feste Prioritätskette:

| Stufe | Entscheidung | Was es ist |
| ---- | ---- | ---- |
| **P0** | `deny` | deterministisches Hard-Deny: Zugangsdaten-Material, Mutation geschützter Pfade, gefährliche Shell |
| **P1** | `allow` | ein präzises, begrenztes **Session-Grant** |
| **P2** | `deny/allow/ask` | statische Regelkette: zuerst Blacklist, dann Allow, dann Ask |
| **P3** | `allow/deny/ask` | optionaler LLM-Semantikklassifikator (Standardmäßig **aus**) |
| **P4** | `ask` | offizieller Approval-Seam |

Streng fail-closed: Eine P0-Entscheidung wird nie von einem Grant, einer Regel, dem Klassifikator
oder einem Menschen überstimmt.

## Warum

Das DSH-Sicherheitsökosystem verteilt dies auf mehrere Plugins (`dsh-permission-rules`,
`dsh-auto-mode`, `dsh-auto-review`, `dsh-movein-permissions`). `dsh-perm-gate` führt Gate +
Freigabe + (optionalen) Klassifikator in einem Paket zusammen — mit einem einzigen Audit-Trail und
ohne versionsübergreifende Plugin-Kopplung.

## Funktionen

- **Befehls-Whitelist / Blacklist** — Abgleich über eine **argv-Zerlegung** (kein Rohstring), mit
  rekursivem Abstieg in `sh -c`/`bash -c`, Pipeline-Erkennung, Prüfung von
  Redirect-Zielen und Erkennung von recursive/force (`rm -rf`).
- **Deny-Priorität** — eine passende Deny-Regel schlägt jede Allow-Regel.
- **Session-Grants** — präzise `(Tool, kanonischer Fingerabdruck)`-Grants mit `TTL` + `maxUses`;
  ein erneutes Ausführen mit anderem Ziel nutzt die Autorität nie wieder. Sub-Agents erben, können
  aber nicht selbst münzen.
- **Pure-Function-Regel-Engine** — glob/regex-Kompilierung mit ReDoS-Schranke, lautes Versagen bei
  fehlerhaften Regeln und Compile-Cache über Source-Hash.
- **Audit** — jede Entscheidung wird als `{ignorable:true}`-Ereignis mit ihrer `callId`
  protokolliert; der modellsichtbare Grund entspricht dem aufgezeichneten Ausgang.
- **自动审查-Stufe** (`permissive`, dazu `permissive-full`) — ein **unabhängiger
  Freigabemodus** (getrennt von den Stufen Read-only, Full-access und Whitelist), der weder
  „Auto-Genehmigung“ noch pauschales Vertrauen ist. Das Frontend stellt einen **einzigen
  Schalter** bereit (`permissive`); die vier Backend-Strategien sind **kombinierbar** und werden
  über die Plugin-Einstellungen gesteuert — weiterhin fail-closed gegenüber P0. Der
  Berechtigungs-Picker und die Einstellungszeile zeigen sie beide unter dem Produktlabel
  自动审查, ohne Icon. Die Variante `permissive-full` behält dasselbe Freigabeverhalten, fällt
  aber die eingebaute Datei-Sandbox weg, die sonst die benannten Pipes verweigert, die
  `git clone` / Cygwin / ConPTY brauchen.
- **Auto-Antwort auf Sandbox-Eskalation** (`trustEscalation`) — eine Sandbox-Eskalation wird aus
  *dem Inneren* des shell-/pwsh-/edit-Toolkörpers heraus gestellt, nach `tools/pre-execute`; das
  Gate sah sie nie, und ein automatisch erlaubter Aufruf forderte Sie trotzdem auf, die
  Ausweitung zu genehmigen. Ist diese Strategie an, wird genau der vom Gate freigegebene Aufruf
  (an `callId` erkannt) hier beantwortet.
- **Risikogestufter `llmAssist`** — ein eigenes OpenAI-kompatibles LLM stuft jedes `ask` als
  `safe` / `risky:<Kategorie>` ein; harte Kategorien (Löschen, Zugangsdaten, Remote, System,
  Massen) **fragen immer**, Neutrales fließt in das Verdict-Lernen ein, und jeder Fehler bleibt
  fail-closed.
- **Verdict-Lernen** — neutrale `ask`s, die ein Mensch freigibt und die tatsächlich ausgeführt
  werden, zählen hoch; nach dem Schwellenwert wird *exakt derselbe Vorgang* (fingerabdruckgleich)
  automatisch erlaubt.
- **Entscheidungs-Ereignis-Feed** — jede Entscheidung wird an einen JSONL-Feed angehängt und von
  der Browser-Hälfte als Hinweisband über der Konversationseingabe plus ein
  Freigabe-Protokoll-Tab (neueste zuerst) in der Konversationsansicht angezeigt.

Eine vordefinierte **Deny-Keyword-Blacklist** (geerbt von dsh-approval-gates
`DEFAULT_DENY_KEYWORDS`: `rm -rf`, `push --force`, `drop table`, `mkfs`, `git reset --hard`,
`docker system prune`, …) setzt ein Veto gegen jeden Aufruf, dessen Text ein Keyword enthält —
case-insensitiver Teilstring, angewandt vor Whitelist, Grants und LLM. Sie ist in der
Einstellungskarte als Liste editierbar (Vorlageneinträge sind markiert, ein Klick stellt die
Vorlage wieder her); nicht gesetzt oder leer bedeutet die Vorlage — die Blacklist schaltet sich
nie still ab.

## Installation

Benötigt eine bestehende
[DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness)-Installation.

```sh
dsh plugin --profile web add dsh-perm-gate
```

Vollständige Schritte zu Installation, Upgrade, Migration und Fehlerbehebung stehen in der
[Installationsanleitung](./INSTALL.de.md) — auch verfügbar auf
[English](./INSTALL.md) / [中文](./INSTALL.zh.md) / [日本語](./INSTALL.ja.md) /
[한국어](./INSTALL.ko.md) / [Français](./INSTALL.fr.md) / [Italiano](./INSTALL.it.md) /
[Русский](./INSTALL.ru.md) / [Español](./INSTALL.es.md).

## Konfiguration

Fügen Sie das Plugin in die `cordis.yml` ein:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive, permissive-full]   # tiers where the gate is active (default)
    sessionSweep: true              # hourly cleanup of archived/dead sessions' gate data
```

### Session-Sweep

Beim Start und stündlich liest das Gate den Workspace-Speicher von DSH
(`$DSH_HOME/storages/workspace.json`, nur lesend) und klassifiziert jede Sitzung, für die es
Autorisationskettendaten hält. Sitzungen, die DSH archiviert hat (`global.archivedSessionIds`)
oder gar nicht mehr führt, verlieren ihre Entscheidungsereignisse aus
`$DSH_HOME/perm-gate/events.jsonl`, und ihre Snapshot-Dateien vor der Änderung werden aus
`$DSH_HOME/perm-gate/snapshots/` gelöscht — Historie, die die Review-Seite nicht mehr erreichen
kann, für Daten, die der Harness selbst als weg betrachtet. Lebende Sitzungen bleiben unberührt,
nicht zuordenbare Zeilen (leere Sitzungs-ID) werden nie gelöscht, und jeder Fehler ist fail-open:
Der Durchlauf wird übersprungen und eine Stunde später wiederholt. Setzen Sie
`sessionSweep: false` zum Deaktivieren; `workspaceStoreFile` überschreibt den Speicherpfad. Die
Wiederherstellung einer archivierten Sitzung stellt deren weggesäuberte Historie nicht wieder her.

### Regeldatei

```yaml
permissions:
  defaultAction: ask
  deny:
    - command: [rm#recursive]
      reason: no recursive rm
    - command: [ssh]
      reason: no direct ssh
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

Ein Befehlseintrag `word#flag` matcht das Befehlswort (`word`) mit dem Modifikator `recursive`
oder `force` — `rm#recursive` matcht also `rm -rf`, `env rm -rf` und `sh -c "rm -rf /"`.

### Netzwerk-Policy (Opt-in)

Ein lokaler HTTP/CONNECT-Proxy, der den ausgehenden Verkehr von **Shell-Subprozessen** anhand
derselben Regeldatei entscheidet, plus ein Freigabepfad für Ziele, die keine Regel abdeckt.
**Standardmäßig aus** — die Aktivierung bindet einen Loopback-Port und schreibt die
Proxy-Umgebung der Kindprozesse um; sie wird daher nie implizit eingeschaltet.

```yaml
- id: dsh-perm-gate
  config:
    networkEnabled: false          # master switch (default false)
    networkMode: whitelist         # deny-all | whitelist | allow-all
    networkUnlisted: ask           # ask | deny  — unlisted target handling
    networkUnattributed: allow     # allow | deny — traffic with no shell attribution
    networkInjectEnv: true         # rewrite HTTP(S)_PROXY/ALL_PROXY for children
    networkAskTimeoutMs: 120000    # approval wait before failing closed
    networkGrantTtlMs: 1800000     # how long one approval covers its target
```

**Gestuftes Verhalten.** Nichts erreicht das Netzwerk ohne Allow-Regel. Ein nicht gelistetes
Ziel wird an die interaktive Freigabenaht eskaliert, im Namen des Shell-Befehls erhoben, der die
Verbindung öffnete; eine Freigabe weitet die Reichweite für dieses Ziel für die Sitzung. Eine
`deny`-Regel wird **nie** eskaliert — eine Freigabe kann erweitern, was ein nicht gelistetes Ziel
erreichen darf, aber sie kann nie eine Regel überstimmen, die Nein sagt.

**Die Grenze — lesen Sie das, bevor Sie sich darauf verlassen.** Der Proxy ist eine
*kooperative* Policy-Schicht, keine Durchsetzungsgrenze. Er sieht nur Verkehr von Clients, die die
Proxy-Umgebung lesen:

| Client | Abgedeckt? |
|--------|----------|
| `curl`, `wget`, `git`, Go `net/http`, Python `requests` | ja |
| **Node.js `http`/`https`/`fetch`** | **nein — verbindet direkt** |
| Java (ohne `-D`-Proxy-Flags), .NET `HttpClient` | nein |
| Raw Sockets, eigenes TCP | nein |
| DNS, QUIC/HTTP3, Nicht-HTTP-Protokolle | nein |
| Verbindungen zu einer literalen IP | nein |

Ein Shell-Befehl wie `node -e "require('http').get('http://host/')"` wird also nicht
abgefangen. Betrachten Sie dies als Leitplanke gegen Unfälle und als Ort, um Absicht zu
dokumentieren — nicht als hermetische Sandbox.

DSHs **eigener** Netzwerkverkehr — die eingebauten Netzwerk-Tools und der LLM-Transport — wird
bewusst in Ruhe gelassen. Diese Verbindungen tragen keine Shell-Zuordnung, und
`networkUnattributed: allow` (der Default) lässt sie ungeprüft durch: Sie zu prüfen würde dem
Host erlauben, *sich selbst* zu blockieren — ein schlimmerer Fehler als ein verpasster Block.
Setzen Sie `networkUnattributed: deny` nur, wenn Sie wissen, dass die Clients Ihres Hosts die
Proxy-Umgebung ignorieren.

Den Live-Zustand abfragen über `GET /api/dsh-perm-gate/network` (Modus, Bind, Port,
Proxy-Lebendigkeit, Env-Injection-Status, Block-Zähler, letzte Blocks).

## Die 自动审查-Stufe (Maschinenwert `permissive`)

自动审查 ist eine **unabhängige Freigabestufe** im DSH-Berechtigungs-Picker, parallel zu
Read Only / Workspace Write / Full Access / Whitelist. Sie ist **keine** generische
„Auto-Genehmigung“ und prägt nie pauschale Autorität: Sie verengt oder weitet nur die Naht *vor*
dem Mensch/LLM-Schritt, während das P0-Hard-Deny **innerhalb des eigenen Geltungsbereichs des
Gates** monoton und nicht verhandelbar bleibt.

> **P0 ist begrenzt, nicht global.** Das Gate wirkt nur, solange der Berechtigungs-Preset der
> Sitzung einer der `gatePresets` ist (Default `permissive` / `permissive-full`). Unter jedem
> anderen Preset — Read Only, Workspace Write oder Full Access — tritt das **gesamte** Gate
> zurück, das P0-Hard-Deny eingeschlossen, weil die eigene Policy der gewählten Stufe diese
> Sitzung regiert. Das ist beabsichtigt (siehe `gatePresets` in der Konfigurationstabelle), heißt
> aber: „P0 ist nicht verhandelbar“ gilt *innerhalb* der Gate-Stufen, nicht über jede Stufe
> hinweg. Ein Rückzug ist nicht lautlos: Das Gate zeichnet ein `stand-down`-Ereignis pro
> Sitzungs-/Preset-Wechsel auf, und der Browser zeigt ein klebendes **GATE OFF**-Band über der
> Eingabe. Setzen Sie `gatePresets: ['*']`, um P0 wieder global zu machen.

**Es werden zwei Varianten ausgeliefert**, denn `sandbox` und `approval` eines Presets sind
unabhängige Stellschrauben, und ihre Kopplung erzwang einen schlechten Kompromiss:

| Picker-Label | Maschinenwert | sandbox | approval |
|--------------|---------------|---------|----------|
| 自动审查 | `permissive` | `workspace-write` | `ask` |
| 自动审查（高权限） | `permissive-full` | `danger-full-access` | `ask` |

Die schlichte Stufe behält die eingebaute Datei-Sandbox. Diese Sandbox verweigert auch die
benannten Pipes, die ein Kindprozess zum Starten braucht; deshalb scheitern daran `git clone`,
MSYS2/Cygwin-`sh.exe` und ConPTY mit `Win32 error 5` / `couldn't create signal pipe`. Da das Gate
**nur** in den in `gatePresets` gelisteten Stufen aktiv ist, hieß Gate wollen, diese Einschränkung
akzeptieren. 自动审查（高权限） löst die Kopplung: identisches Freigabeverhalten, keine
Datei-Sandbox-Einschränkung. Die Beschreibung der Stufe sagt den Kompromiss offen — der
Workflow ist reibungsloser, Freigaben gelten weiterhin pro Aufruf, aber es bleibt **keine
System-Sandbox als Rückfallebene**. Beide stehen im Default der `gatePresets`, also gibt Ihnen
jede die volle P0–P4-Kette — das Gate liest nur den **Namen** des Presets, nie den Sandbox-Modus.

Das Picker-Label ist ein **vom Host gelieferter Produkt-String**, kein pro-Locale-Wörterbucheintrag:
DSH rendert den `name:` einer Plugin-Stufe wortwörtlich auf beiden Berechtigungsflächen (die
Default-Zeile in den allgemeinen Einstellungen und der Composer-Picker) und liefert eigene
lokalisierte Labels nur für die drei eingebauten Werte; `cordis.patch.yml` liefert daher das
chinesische Label für jede Sitzung.

Beim **Icon** ist es eine andere Geschichte. Die Glyph-Map des Composers ist geschlossen, und ihr
eigener Kommentar nennt die Regel: *host-configured names outside the design set get none.*
`permissive` ist ein eingebauter Wert, daher hat 自动审查 bereits ein Schild+Auge-Glyph;
`permissive-full` bekommt dasselbe Glyph nur, weil `npx dsh-perm-gate-patch-glyph` es in diese Map
einträgt. Dieser Patch editiert ein **Host**-Paket und geht deshalb bei jedem DSH-Upgrade
verloren — siehe [Nach einem DSH-Upgrade](./INSTALL.de.md).

In der `cordis.yml`:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml
    defaultAction: ask
    permissive: true            # single front-facing switch (independent tier on)
    permissiveStrategies:        # backend, combinable
      trustAutoAllow: true       # in-scope safe ops auto-allow; dangerous/unknown ask
      alwaysConfirm: false       # every crossing asks; allow-controls add repeat-allow / wl-migrate buttons
      llmAssist: false           # LLM classify first, human fallback on ask/failure
      trustEscalation: true      # a cleared call's own sandbox escalation needs no prompt
```

`trustAutoAllow` ist die Basismittelstufe (eine Regel-Allow läuft automatisch durch).
`alwaysConfirm` zeigt bei jedem Übertritt das Freigabepanel; seine „Allow-Controls“ fügen zwei
erweiterte Buttons hinzu — **diesen Typ für diese Sitzung wiederholt erlauben** (ein begrenztes
Session-Grant) und **jedes Vorkommen erlauben** (das das Befehlswort per `approveAllowEverywhere`
in die `allow`-Whitelist der `permissions.yaml` überträgt). `llmAssist` zieht ein echtes,
konfigurierbares LLM hinzu (`classifierEndpoint` / `classifierModel`, jede OpenAI-kompatible
API), um ein `ask` automatisch zu entscheiden, und fällt bei `ask`/Fehler auf die menschliche
Naht zurück — immer fail-closed. `trustEscalation` (standardmäßig an, solange die Stufe an ist)
beantwortet eine `sandbox_permissions`-Eskalation, die aus dem Inneren eines bereits vom Gate
erlaubten Aufrufs gestellt wurde; siehe unten. Bei ausgeschaltetem `permissive` verhält sich das
Gate genau wie zuvor.

### Sandbox-Eskalation: warum ein `safe`-Verdict trotzdem nachfragte

Ein Toolaufruf kann **zwei unabhängige Freigaben** auslösen. Das Gate besitzt die erste — sein
eigenes `ask` im `tools/pre-execute`-Wasserfall. Die zweite kommt von `approveEscalation`
**im Toolkörper**, zur Zeit von `tools/execute`, wann immer das Modell `sandbox_permissions` +
`justification` übergeben hat; bis dahin ist `tools/pre-execute` bereits entschieden, sodass das
Allow des Gates sie nie erreicht. Ein vom LLM als `safe` eingestufter und vom Gate automatisch
erlaubter Aufruf zeigte also trotzdem eine Aufforderung, die Sandbox-Ausweitung zu genehmigen.

`trustEscalation` schließt diese Lücke. Das Gate merkt sich jeden positiv erlaubten Aufruf
(schlüsselt auf der `callId` des Hosts, die die Eskalationsanfrage wiederholt), und beantwortet
die Eskalation selbst mit `allowed-once`. Sie greift nur, wenn **alles** zutrifft:

- die 自动审查-Stufe ist an und `trustEscalation` ist an;
- die Anfrage trägt eine vom Gate freigegebene `callId` mit passendem Toolnamen;
- der Grund ist eine erkannte Eskalation, die `workspace-write` oder `danger-full-access` nennt.

Alles andere — ein unbekannter Grund, ein anderer Aufruf, ein vom Gate nachgefragter oder
verweigerter Aufruf, der `approval: never`-Durchgriff — delegiert unverändert an den Menschen,
sodass eine künftige Formulierungsänderung in DSH geschlossen statt offen scheitert. Die
Auto-Antwort wird im Ereignis-Feed aufgezeichnet (`verdict: "escalation-auto"`, `mode: <Ziel>`).
Schalten Sie den Schalter aus, um Sandbox-Ausweitungen menschlich gateen zu lassen, während
andere Allows automatisch bleiben.

### Risikogestufter llmAssist, Verdict-Lernen und der Ereignis-Feed

Ist `llmAssist` an, stuft das konfigurierte LLM jeweils ein `ask` nach einem strukturierten
Protokoll ein. Die Bewertung geschieht **im `tools/pre-execute`-Wasserfall des Gates, bevor die
Entscheidung an den Host zurückgeht**: ein `safe`-Verdict delegiert den Aufruf direkt durch, das
Freigabepanel erscheint also nie; nur ein wirklich unsicheres Verdict erreicht Sie. Zwei
Empfängerquellen sind in der Einstellungskarte wählbar: eine **eigene API** (jeder
OpenAI-kompatible Endpoint — `classifierEndpoint` / `classifierModel` / `classifierApiKey`, mit
Presets u. a. Xiaomi MiMo `https://api.xiaomimimo.com/v1`) oder die **DSH-Host-Modellgruppe** (der
konfigurierte `llm`-Dienst der Sitzung, über `agentDefaultModel.currentSelection`, optional
überschrieben mit `classifierProvider` / `classifierModel`). Ein **Gesundheitstest**-Button
(`POST /api/dsh-perm-gate/health`) führt eine minimale Completion aus und meldet die Latenz.

- `safe` → der Aufruf wird automatisch erlaubt (auditert mit der Quelle `classifier`); kein Panel.
- `risky` + eine **harte Kategorie** (`deletion`, `credential`, `remote`, `system`, `bulk`) → der
  Aufruf **behält die menschliche Nachfrage**. Der Klassifikator **verweigert nie**: Der
  Deny-Pfad gehört allein den deterministischen Schichten (P0-Hard-Deny, die
  Deny-Keyword-Blacklist, explizite `deny:`-Regeln), sodass eine falsch eingestufte Kategorie
  immer verhandelbar bleibt statt einer nicht anfechtbaren Blockade. Harte Kategorien bleiben in
  einem wichtigen Punkt von `neutral` verschieden: Sie werden **nie gelernt**, sodass wiederholte
  menschliche Freigaben sie nie zu einem Auto-Allow sedimentieren können.
  (Das Verweigern nach dem Wort des Modells wurde live gemessen: ein harmloses `git commit -F …`,
  eingestuft als `remote`, erzeugte ein Auto-Deny ohne Panel und ohne Grant zum Wiederholen.)
- `risky:neutral` → mit aktiviertem `riskLearning` (Einstellungskarte, standardmäßig aus) zählt
  jede menschliche Freigabe, die tatsächlich ausgeführt wird (über das `tools/result`-Ereignis des
  Hosts abgerechnet), auf einen `tool|category`-Schlüssel; sobald der Zähler `riskThreshold`
  (Default 3) erreicht **und** der Vorgangs-Fingerabdruck des neuen Aufrufs (Befehlswort +
  Basisname des Ziels) zu einer bestätigten Probe passt, wird exakt derselbe Vorgang automatisch
  erlaubt. Ein anderes Ziel nutzt diese Autorität nie wieder. Mit Sedimentation (`riskSediment`,
  standardmäßig an) werden die bestätigten Proben eines Schwellenwert erreichten Schlüssels zu
  **deterministischen Allow-Regeln**: ein exakter Treffer erlaubt ohne weiteren LLM-Aufruf —
  sogar bei ausgeschaltetem `llmAssist` — und die sedimentierten Regeln sind in der
  Einstellungskarte sichtbar und verwalten (beenden / entfernen).
- Timeouts (`riskTimeoutMs`, Default 20 s, ein Wiederholungsversuch), Transportfehler und
  protokollfremde Modellausgaben lassen das `ask` unangetastet — das Gate rät nie.

Der Lernzustand persistiert in einer plugin-eigenen JSON-Datei
(`$DSH_HOME/perm-gate/learning.json` oder `learningFile`), nie in Ihre YAML-Regeldatei. Jede
Entscheidung wird an `$DSH_HOME/perm-gate/events.jsonl` (oder `eventsFile`) angehängt und unter
`GET /api/dsh-perm-gate/events?sessionId=&since=` ausgeliefert; die Browser-Hälfte fragt sie ab
und zeigt die letzte Entscheidung als Hinweisband über der Konversationseingabe (Asks bleiben
sichtbar, bis das nächste Ereignis kommt) und listet alle Entscheidungen der Sitzung, neueste
zuerst, im **Approvals**-Tab der Konversationsansicht.

Die betroffenen Dateien jeder Entscheidung werden gesnapshottet, bevor die Änderung landet
(≤ 5 Dateien, je ≤ 256 KB) unter `$DSH_HOME/perm-gate/snapshots/`; im **Approvals**-Tab öffnet
jeder Datei-Chip ein Zeilen-Diff (`GET /api/dsh-perm-gate/diff`) mit einer **Revert**-Aktion, die
eine Wiederherstellungsanweisung in die Konversation liefert (`POST /api/dsh-perm-gate/revert`).
Eine Snapshot-Bestandsleiste löscht sie pro Sitzung oder insgesamt
(`GET /api/dsh-perm-gate/snapshots-stats` / `POST /api/dsh-perm-gate/snapshots-clear`).

Ein an einen Menschen gerichtetes `ask` wird verfolgt, bis der Mensch antwortet: ein passiver
`approval/request`-Beobachter zeichnet den geschlossenen Ausgang auf (`allowed-once` →
**genehmigt**, `rejected` → **abgelehnt**, `cancelled` → **abgebrochen**, `unavailable` → eine
Ablehnung, da kein Freigabekanal existierte), mit `tools/result`, dasselbe Ask als Fallback
abzuschließen, wenn der Beobachter es nicht zuordnen kann. Freigaben berichten den
Lernfortschritt nach der Freigabe (`n`/Schwellenwert), und das Hinweisband beschriftet alle drei
Endzustände.

自动审查 und 自动审查（高权限） zeichnen beide das Schild+Auge-Glyph im Picker — die erste aus
DSHs eingebauter Map, die zweite aus dem Host-Patch, das die Installationsanleitung beschreibt.
Ohne diesen Patch ist die zweite Stufe überall nur Text; Label und Gate-Verhalten bleiben
unberührt.

### Eine wählbare Sitzungsstufe

`cordis.patch.yml` fügt ein `permissive`-Preset hinzu (`sandbox: workspace-write`,
`approval: ask`, Name **自动审查**) zwischen Workspace Write und Full Access. Der
DSH-Bundle-Patch ersetzt die gesamte `permission.config.presets`-Map, statt per Schlüssel zu
mergen, daher restatuiert die Datei auch die drei eingebauten (`read-only` / `workspace-write` /
`danger-full-access`, aus `@deepseek-ai/dsh-base/cordis.patch.yml`); `test/patch-presets.spec.ts`
pinnt diesen Schlüsselsatz. So bietet der Berechtigungs-Picker der Sitzung 自动审查 als
unabhängige, wählbare Freigabestufe an — nicht als generischen „Auto-Genehmigungs“-Modus.

Das Gate ist **nur in den in `gatePresets` gelisteten Stufen aktiv** (Default
`['permissive', 'permissive-full']`, die beiden Stufen, die dieses Plugin hinzufügt). In jeder
anderen Stufe — Read Only, Workspace Write, Full Access, `custom` — läuft der Entscheidungsfluss
des Gates gar nicht: kein Allow, kein Ask, kein Deny, kein P0-Hard-Deny, kein
Deny-Keyword-Veto, kein Audit-Ereignis. Die eigene Policy der gewählten Stufe regiert den Aufruf,
und das ist der Punkt: Das eingebaute `danger-full-access` ist als „Vollzugriff ohne
Freigabeaufforderungen“ definiert, es also mit einem Ask zu überstimmen (dort unbeantwortbar —
die Freigabenaht lehnt ab, bevor irgendein Antworter läuft, was
`the user rejected tool "..."` ohne Panel ergibt) oder mit einem Hard-Deny würde die vom Nutzer
gewählte Stufe still widerrufen. `gatePresets: ['*']` macht das Gate wieder global (Hard-Deny
eingeschlossen); innerhalb einer aktiven Stufe wird ein `ask` weiterhin zum Durchgriff degradiert,
wenn die effektive Freigabe-Policy der Sitzung `never` ist — deshalb deklarieren beide
自动审查-Stufen `approval: ask`.

### In der Oberfläche konfigurierbar

Die Stufe lässt sich auch zur Laufzeit anpassen unter **Einstellungen → Plugins → 自动审查**
(eine `settings.plugins.tab`-Seite, gerendert vom Browser-Client des Plugins): Ein Schalter
legt `permissive` um, vier weitere editieren die Backend-`permissiveStrategies`. Der Host liest
den Namespace live, eine Änderung greift also beim nächsten Toolaufruf ohne Neustart. Dies ist
eine unabhängige Freigabeklasse, KEIN generischer „Auto-Genehmigungs“-Modus.

### Regeltest (Dry-Run)

Dieselbe Seite trägt ein **Regeltest**-Panel: Toolnamen und Befehl eingeben, Test drücken, und
das Gate beurteilt diesen Aufruf gegen den aktuell geladenen Regelsatz — ohne etwas auszuführen
und ohne eine Regel zu schreiben. Sie erhalten das Verdict, die passende Regel (Index und
Aktion), die Dimensionen, die sie einschränkt, und den Grund.

Es berichtet sowohl das effektive Verdict (die ganze Kette P0 → P1 → P2 → P3 → P4) *als auch* die
eigene Antwort der Regelebene — nicht dasselbe: Ein P0-Hard-Deny oder ein Preset-Deny-Keyword
zündet vor der Regelkette und hinterlässt keinen Regelindex, daher sagt das Panel „keine Regel
gematcht“, statt eine unrelated Regel zu benennen. Ein Hinweis „0 Regeln geladen“ bedeutet, dass
der `rulesFile`-Pfad nichts aufgelöst hat.

Das Panel spricht mit `POST /api/dsh-perm-gate/dry-run`, das **konstruktionsbedingt nur lesend**
ist — es hat überhaupt keine Schreibform, ein Regeltest kann eine Regel also nie ändern.

## CLI

Dry-Run eines Aufrufs gegen eine Regeldatei (ohne Harness):

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
```

## Entwicklung

```sh
npm run typecheck
npm test
npm run build
```

## Lizenz

[MIT](./LICENSE)
