# Changelog

Lingue: [English](./CHANGELOG.md) · [日本語](./CHANGELOG.ja.md) · [한국어](./CHANGELOG.ko.md) · [Français](./CHANGELOG.fr.md) · [Deutsch](./CHANGELOG.de.md) · [Italiano](./CHANGELOG.it.md) · [Русский](./CHANGELOG.ru.md) · [Español](./CHANGELOG.es.md)

Tutte le modifiche notevoli a questo progetto saranno documentate in questo file.

Il formato si basa su [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-09-17

### Aggiunto

- **Test delle regole (dry-run) nella scheda impostazioni.** Un nuovo pannello valuta una
  potenziale chiamata a un tool contro l'insieme di regole che il gate ha attualmente caricato e
  mostra il verdetto, la regola corrispondente (indice e azione), le dimensioni che quella regola
  vincola, e il motivo. Scritto per la domanda che il YAML non può rispondere a occhio: *che cosa
  farà davvero?* — `args` è un OR sui token, una dimensione vuota non vincola nulla, e `command`
  corrisponde solo alla **parola** di comando scomposta, così una regola di aspetto plausibile
  può essere morta all'arrivo.

  Il rapporto tiene volutamente separate due risposte. **`verdict`** è il risultato di policy
  dell'intera catena (hard-deny P0 → parola chiave deny → grant P1 → regole P2 → ask P4 →
  permissive). **`ruleLayer`** è ciò che la catena `permissions` decide da sola, e solo quello
  strato può nominare un indice di regola: un hard-deny P0 o una parola chiave deny da preset
  scatta *prima* di lui e non lascia dietro alcuna regola, così il pannello lo dice invece di
  attribuire una regola non pertinente. `matchedDimensions` elenca parimenti le dimensioni che
  la regola corrispondente *vincola*, non quella che avrebbe "causato" la corrispondenza — le
  dimensioni sono in AND, quindi una causa singola non può essere onestamente nominata. Un
  `ruleCount` di 0 viene segnalato come "0 regole caricate, controlla il percorso rulesFile"
  anziché come "nulla corrispondeva".

- **`POST /api/dsh-perm-gate/dry-run`** — l'endpoint del pannello. **In sola lettura per
  costruzione**: non ha alcuna forma di scrittura, le chiavi del corpo sconosciute vengono
  scartate anziché inoltrate, e non tocca mai regole, grant, stato di apprendimento né il
  namespace delle impostazioni. Testare una regola non deve poterla cambiare. Valuta contro il
  runtime **live** anziché uno fresco, così il pannello testa le regole in vigore — un runtime
  fresco risolverebbe di nuovo la catena da una radice diversa e potrebbe rispondere
  silenziosamente su un altro file.

- **`src/dry-run.ts`** — `runDryRun` / `createDryRunRuntime`, l'evaluator condiviso tra CLI e
  route, più `PermGateRuntime.explainRules` (rapporto in sola lettura dello strato di regole) e
  `PermGateRuntime.explainCall` (valutazione di policy pura). `src/cli.ts` è ora un sottile
  wrapper sopra di esso; il suo output è invariato su nove invocazioni rieseguite, verificato
  byte per byte (compresi i casi `--list`, senza tool, JSON malformato e percorso di scrittura).

### Corretto

- **Il pannello di test delle regole riportava `allow` per chiamate che le regole mandano a una
  persona.** La prima versione valutava attraverso il percorso orientato all'host, che applica
  gli strati di sessione — il ritiro del preset e la degradazione `approval: never` dell'ask. Un
  dry-run senza sessione non ha sessione, quindi il lettore di policy rispondeva "never", ogni
  `ask` degradava a passthrough, e il pannello mostrava **allow** esattamente per le regole per
  cui qualcuno lo apre. Misurato sull'host live: `shell ls -la` mostrava `allow` mentre lo strato
  di regole della stessa scheda diceva `ask`.

  `runDryRun` ora riporta il verdetto di **policy pura** da `explainCall`: la stessa catena
  P0 → parola chiave deny → P1 → P2 → P4, con gli strati di stato di sessione esclusi anziché
  indovinati, e con `reason` mai ridotto a un nudo `(default/passthrough)`. La vista orientata
  all'host resta disponibile sotto `input.hostView`; la CLI la richiede, così il suo output
  storico resta identico byte per byte (riverificato: 9/9 casi, SHA256 per caso).

- **La rotta "in sola lettura" non era in sola lettura.** Eseguiva il percorso di decisione
  orientato all'host contro il runtime live, che accoda voci di audit e registra eventi di
  decisione — aprire il pannello di test delle regole scriveva nel feed di decisioni live. Il
  percorso puro non accoda nulla, e `test/dry-run.spec.ts` ora asserisce che una chiamata che il
  percorso host *registrerebbe* lascia lo specchio di audit a zero.

## [2.5.0] - 2026-09-17

### Aggiunto

- **Dimensione di regola `branch`** — corrispondenza di branch / remote / branch protetto git,
  così una regola può finalmente dire "nessun push su un branch protetto" senza beccare comandi
  non pertinenti. Il caso decisivo è quello che `args` non può mai esprimere:
  `git push --force origin main` (pericoloso) e `git checkout --force main` (di routine) portano
  gli *stessi token*, e solo la dimensione branch li distingue. Sotto-campi: `target` (glob del
  nome del branch, `*` attraversa `/`), `remote` (glob del nome del remote) e `shared` (esigere
  un branch protetto). Le candidate arrivano dal dispatcher di comandi condiviso, così le forme
  `refspec` (`HEAD:main`) sono già divise e un nome di remote non viene mai scambiato per un nome
  di branch. Documentato in `docs/rules-format.md` §4.11.

### Corretto

- **La catena di regole multi-file svuotava silenziosamente ogni dimensione di corrispondenza.**
  `resolveRuleChain` fondeva le voci a mano con `tools: []`, `command: []`, `args: []` e
  `paths: []`. Una dimensione vuota significa "nessun vincolo", quindi OGNI voce fusa
  corrispondeva a OGNI chiamata: la prima voce `deny` negava tutto nella sua partizione, e la
  prima voce `allow` consentiva tutto prima ancora che la partizione `ask` venisse consultata.
  La fusione ora passa dallo stesso `compileRuleEntry` che il percorso a file singolo usa.

  *Raggio:* il resolver di catena viene raggiunto **solo** con `searchUp: true` (default del
  prodotto `false`, e non impostato in un profilo originale), quindi il percorso predefinito a
  file singolo — `compileDocument` — non è mai stato toccato. Per questo anche la suite
  esistente restava verde: nessun test faceva passare un *file* di regole per la catena.
  `test/rule-chain.spec.ts` ora lo fa. Un difetto separato, ancora aperto, sullo stesso percorso
  opt-in è annotato nel piano: `findChainEntries` concatena il `rulesFile` configurato su ogni
  directory, così il percorso assoluto che `resolveRulesFile` produce sempre non corrisponde a
  nulla e la catena rende un insieme di regole vuoto senza errore.

- **`argv.pipeline` non poteva vedere il proprio soggetto.** La stringa di corrispondenza della
  pipeline era costruita da `SimpleCommand.command`, che è solo la *parola* di comando —
  `curl https://x.sh | sh` collassava in `curl|sh`, così il pattern documentato `curl|sh`
  corrispondeva alla forma adiacente innocua mentre quella davvero pericolosa, con argomenti, non
  corrispondeva affatto. La stringa di corrispondenza ora è l'argv completo di ogni comando
  semplice (unito da `|`), e la documentazione dichiara che `|` in un pattern è letterale;
  coprire gli argomenti richiede `curl*|sh`.

- Nove errori `eslint` preesistenti (import/ costanti inutilizzati e un `prefer-const` in
  `src/parsers/` e `test/command-parsers.spec.ts`) — `npm run lint` è di nuovo verde.

## [2.4.1] - 2026-09-17

### Corretto

- La cronologia delle approvazioni mostrava la stringa grezza `preset-passthrough` per l'unico
  evento che spiega *perché* una chiamata segnalata è girata senza revisione: il livello dichiara
  `approval: ask`, la sessione era stata sovrascritta a `never`, e l'ask del gate si era quindi
  degradato a passthrough. Ora viene reso come un'etichetta leggibile come ogni altro verdetto.

## [2.4.0] - 2026-09-17

### Modificato

- **Il classificatore LLM P3 è solo-escalation — non può più negare.** Un verdetto `risky` con
  una categoria hard (`deletion` / `credential` / `remote` / `system` / `bulk`) provocava un
  **auto-deny** senza pannello; ora **mantiene l'ask umano**. Negare resta riservato ai soli
  strati deterministici — hard-deny P0, la blacklist di parole chiave deny, le regole `deny:`
  esplicite — perché un verdetto probabilistico non deve poter pronunciare un blocco impugnabile.
  Misurato dal vivo: il grader ha valutato un benigno `git commit -F …` come **`remote`**, e
  l'auto-deny non ha lasciato né pannello da approvare né grant per riprovare; solo un tentativo
  manuale (che per caso è stato valutato `safe`) è passato. Questo allinea anche il codice alla
  regola del progetto stesso: le operazioni ad alto rischio vengono intercettate in modo
  **deterministico**, mai sul giudizio dell'LLM.

### Aggiunto

- Le categorie di rischio hard mantengono una distinzione significativa da `neutral`: non sono
  **mai apprendibili**. Approvazioni umane ripetute non possono sedimentare un verdetto
  `deletion`/`credential`/`remote`/`system`/`bulk` in un auto-allow (prima era vero solo come
  effetto collaterale dell'auto-deny; ora è una proprietà esplicita).

### Note di comportamento

- Con `approval: never`, un ask che il gate non può consegnare si degrada comunque a passthrough,
  così una chiamata segnalata dal classificatore ora **gira** dove prima veniva auto-negata. È la
  conseguenza diretta di "nega solo ciò che è deterministico e pericoloso, negozia tutto il
  resto": una negoziazione richiede un essere umano, e `never` significa che non c'è. Far girare
  il gate su un livello il cui `approval` è `ask` perché i segnali ti raggiungano.

## [2.3.0] - 2026-09-17

### Aggiunto

- **Un ritiro non è più silenzioso.** Quando il preset dei permessi della sessione era fuori da
  `gatePresets`, il gate si ritirava senza registrare nulla — la chiamata al tool sembrava così
  esattamente una che il gate aveva esaminato e consentito. Ora registra **un** avviso
  `stand-down` per transizione (sessione, preset) (mai per chiamata), nominando il preset, l'ambito
  e il fatto che l'hard-deny P0 è inattivo. Il browser lo rende come una striscia persistente
  **GATE OFF** sopra l'input, e la cronologia delle approvazioni mostra un tag `Gate off`.
- La scheda impostazioni 自动审查 enuncia l'ambito di preset proprio del gate (`gatePresets`,
  default `permissive` / `permissive-full`) e che cosa accade fuori, così l'ambito è visibile
  dove il livello viene configurato.

### Modificato

- **Il posizionamento documentato di P0 è delimitato, non globale.** L'hard-deny P0 è monotono e
  non negoziabile *dentro l'ambito di preset del gate*; tra i preset il gate si ritira
  interamente — P0 compreso — perché la politica propria del livello scelto possiede quella
  sessione. Il codice si è sempre comportato così; `AGENTS.md` e i quattro README affermavano il
  contrario, il che faceva leggere `danger-full-access` come "P0 si applica ancora". Impostare
  `gatePresets: ['*']` per rendere di nuovo globale P0.

### Corretto

- `DEFAULT_GATE_PRESETS` / `resolveGatePresets` si sono spostati da `config.ts` (che importa
  schemastery) al `preset.ts` privo di dipendenze, così la parte browser può rendere l'ambito
  senza tirare una dipendenza node-only nel bundle client. `config.ts` li ri-esporta entrambi;
  gli import esistenti sono invariati.

## [2.2.0] - 2026-09-17

### Corretto

- **L'hard-deny P0 saltava ogni tool shell tranne quattro.** `hardDenyReason` condizionava la
  propria ispezione shell a una regex definita localmente, `/^(?:bash|pwsh|sh|cmd)$/`, che
  **non** corrisponde a `shell`, `terminal` o `powershell`. `shell` è il tool shell principale
  di DSH, così l'intero controllo shell di P0 — la guardia di redirezione sui percorsi protetti —
  era **inerte per la forma di chiamata più comune**. Misurato, stesso comando
  `echo x > /etc/passwd`: bloccato via `bash`, **consentito** via `shell`. `engine.ts` ora
  importa `SHELL_TOOLS` da `evaluate.ts`; il gate teneva tre copie di quell'unico fatto e solo
  una era completa.
- **`git push --delete` veniva analizzato come un push ordinario.** `hasDelete` era calcolato in
  `analyzeSubcommand` ma letto solo nel caso `branch`, così `git push --delete origin main`
  cadeva nel ramo push semplice (`destructiveness: 4`) e la voce `'push-delete': 5` di
  `DESTRUCTIVENESS_MAP` era un dato morto.
- **Il rilevamento dei branch protetti scattava a torto su ogni nome contenente una barra.** Il
  predicato tagliava tutto ciò che precedeva l'ultimo `/`, così `backup/main` e `feat/release`
  erano letti come protetti. Ora taglia solo i prefissi di ref noti (`refs/heads/`,
  `refs/tags/`, `refs/remotes/<remote>/`). La direzione conta: questo predicato alimenta un P0
  **inrimuovibile**, dove un mancato colpimento ha ancora dietro gli strati parola chiave /
  regola / LLM, mentre un falso positivo blocca un flusso di lavoro legittimo senza rimedio.

### Aggiunto

- **Hard-deny P0 per la riscrittura della cronologia remota su un branch protetto.** Un
  `git push` che sovrascrive con force o elimina `main` / `master` / `production` / `release` /
  `stable` viene rifiutato in modo deterministico, prima di qualsiasi chiamata LLM. La
  protezione preesistente era la parola chiave piatta, cieca ai branch e sovrascrivibile per
  namespace `'push --force'`; questo è il pavimento non negoziabile sotto di essa.
  - **Solo-escalation per costruzione, non per convenzione**: l'helper restituisce
    `string | undefined`, che il chiamante legge come deny / non deciso. Non ha alcun modo di
    esprimere allow, quindi cablarlo in P0 non può allargare ciò che il gate consente.
  - Deliberatamente **non** coperto (sempre lasciato agli strati parola chiave / regola / LLM):
    force-push verso un branch non protetto, `git push --force` senza branch nominato, e i push
    ordinari.
  - Primo uso in produzione del parser dei comandi (`command-dispatcher`, `command-semantics`,
    `parsers/git`, `parsers/shell-cmds`), finora referenziato solo dal proprio file di test.

### Test

- Nuova suite `test/git-protected-push.spec.ts` (13 casi): varianti del parser, il predicato di
  branch protetto in entrambe le direzioni, copertura completa di `SHELL_TOOLS`, le quattro forme
  deliberatamente consentite, e la segmentazione dei comandi composti
  (`git status && git push --force origin main`).
- **Falsificato**: revertare ognuno dei tre fix rende rossi esattamente i casi che li presidiano
  (7 fallimenti in totale), mentre i casi di consenso deliberato restano verdi.
- Suite completa **40 file / 459 casi**; `typecheck` pulito.

## [2.1.2] - 2026-09-15

### Aggiunto

- **La patch del glifo del composer ora viaggia con il pacchetto.** `scripts/patch-permission-glyph.mjs`
  è messo in whitelist in `files` ed esposto come il bin **`dsh-perm-gate-patch-glyph`**, così
  riapplicare la patch del bundle host dopo un aggiornamento di DSH non richiede più un checkout
  dei sorgenti:

  ```sh
  npx dsh-perm-gate-patch-glyph            # apply
  npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is missing
  ```

  In un checkout, `npm run patch:glyph` e `npm run patch:glyph:check` fanno lo stesso.

  È deliberatamente **non** un `postinstall`. Lo script modifica un pacchetto **host**, e un
  plugin non deve riscrivere l'harness in cui è installato senza esserne invitato. (pnpm 10+
  blocca gli script di installazione per impostazione predefinita a meno che non siano in
  whitelist, quindi un `postinstall` sarebbe anche stato una promessa che in silenzio non gira mai
  — peggio di un comando esplicito.)

### Modificato

- Lo script è ora testabile: le sue parti pure sono esportate (`sliceEntry`, `applyGlyphPatch`,
  `candidateBundles`, `findBundle`) e fissate da `test/glyph-patch.spec.ts` (11 casi).
  L'invariante del bilanciamento delle parentesi è quella che conta — la prima versione dello
  slicer scansionava dalla parentesi sbagliata e produceva un bundle non analizzabile, che solo
  la guardia `node --check` dello script stesso beccava.
- `candidateBundles` sonda in più lo scope per-profilo hoistato sotto `$DSH_HOME`, e la CLI è un
  no-op quando importata (il blocco main gira solo quando il file è il punto di ingresso).

## [2.1.1] - 2026-09-15

### Aggiunto

- **Superficie di esecuzione di rete (opt-in, spenta per impostazione predefinita).** Un proxy
  HTTP/CONNECT locale giudica il traffico in uscita dei *sottoprocessi shell* in base allo stesso
  file di regole, più un percorso di approvazione interattivo per i target che nessuna regola
  copre. Una regola `deny` non viene mai escalata — l'approvazione amplia la copertura di un
  target non elencato, ma non può mai scavalcare una regola che dice no. Nuova configurazione:
  `networkEnabled` (default `false`), `networkMode`, `networkUnlisted`, `networkUnattributed`,
  `networkBind`, `networkPort`, `networkNoProxy`, `networkInjectEnv`, `networkAskTimeoutMs`,
  `networkGrantTtlMs`. Diagnostica su `GET /api/dsh-perm-gate/network`. Coperto da
  `test/network.spec.ts`, `test/proxy-errors.spec.ts`, `test/network-lifecycle.spec.ts` e
  `test/network-approval.spec.ts`.
- **Due livelli 自动审查.** `permissive` conserva la sandbox dei file integrata;
  `permissive-full` (etichetta 自动审查（高权限）) accosta lo stesso comportamento di approvazione
  a `danger-full-access`. `sandbox` e `approval` di un preset sono manopole indipendenti, e
  accoppiarli imponeva un compromesso: la sandbox `workspace-write` nega anche le named pipe di
  cui un processo figlio ha bisogno per avviarsi, così `git clone`, `sh.exe` di MSYS2/Cygwin e
  ConPTY fallivano sotto l'unico livello in cui il gate era attivo. Entrambi i livelli sono nei
  `gatePresets` predefiniti.
- **Espansione del modello di regole.** Sei nuove dimensioni di corrispondenza (`params` /
  `absent` / `agents` / `when` / `argv` / `network`), una catena di regole multi-file con
  `searchUp` e un percorso di fallback, e rilevamento di ombra per le regole irraggiungibili.
  Nuova configurazione: `searchUp`, `fallbackPath`, `badFilePolicy`, `maxChainLength`.
- **Ricarica a caldo delle regole.** Un watcher chokidar ricarica i file di regole effettivi, con
  debounce, evizione LRU tra workspace, e osservazione dei file candidati attraverso
  l'antenato esistente più profondo, così un file di regole creato a sessione in corso viene
  adottato. Nuova configurazione: `watch` (default `true`), `watchDebounceMs`.

### Corretto

- **Una connessione bloccata poteva uccidere l'host.** Quando il proxy rispondeva 403 a un
  CONNECT, l'RST del client produceva un `ECONNRESET` senza gestore attaccato, che escalava a un
  evento `'error'` non gestito e terminava il processo DSH. I gestori di errori dei socket ora
  vengono attaccati al momento della connessione, con fallback `clientError` e di rifiuto del
  gestore dietro di loro. Un proxy di policy non deve mai far cadere il proprio host.
- **I tool integrati chiedevano approvazione.** L'elenco auto-allow era mantenuto a mano, così i
  tool aggiunti a DSH da allora ne erano usciti e una chiamata di sola lettura poteva sollevare
  una richiesta di approvazione: `advanced_search`, `platform_search`, `free_search_test`,
  `context_compression_retrieve`, `memory_search_graph`, `memory_expand_graph_node`,
  `memory_import`, `memory_ruminate`, `memory_ruminate_cancel`, `memory_ruminate_status`.
- **Corse del ciclo di vita del proxy.** `close()` ora attende un bind in corso invece di
  gareggiarci, è limitato, e chiamate `start()` concorrenti condividono un solo bind. Le
  risoluzioni DNS sono limitate nel tempo, la fase di instaurazione della connessione è limitata,
  le connessioni concorrenti sono capped, e un logger che lancia non può più escalare in un
  crash. Lo smontaggio del proxy viene registrato prima di attendere il bind, così un dispose
  precoce non può disperdere una porta bindata o un `process.env` riscritto.
- **`permissive-full` non aveva icona nel selettore del composer.** La mappa dei glifi del
  selettore è chiusa e, per il proprio commento, non ne dà ai nomi configurati dall'host, così
  自动审查（高权限） appariva solo come testo mentre 自动审查 mostrava scudo+occhio.
  `scripts/patch-permission-glyph.mjs` aggiunge la voce mancante a quella mappa **host**:
  idempotente, taglio per profondità di parentesi, e fa `node --check` sul proprio output e
  ripristina il backup in caso di fallimento. Patcha un pacchetto host, quindi va rieseguito
  dopo ogni aggiornamento di DSH — reinstallare il plugin non lo ripristina **perché**
  `dsh plugin … add` scrive solo il `node_modules` del profilo. Documentato in tutte e quattro
  le guide all'installazione.

### Modificato

- `networkUnattributed` è ora `allow` per default: il traffico senza attribuzione shell è il
  client proprio di DSH (un tool di rete integrato, il trasporto LLM), e revisionarlo permetterebbe
  all'host di bloccare se stesso. Impostare `deny` per il comportamento più severo.
- `networkUnlisted` è ora `ask` per default.
- `DEFAULT_GATE_PRESETS` è ora `['permissive', 'permissive-full']`.

### Documentato

- **Il proxy di rete è uno strato di policy cooperativo, non un confine di applicazione.** Vede
  solo i client che leggono l'ambiente proxy. Misurato, non assunto: `curl` passa per lui, mentre
  `node` `http`/`https`/`fetch` si collega direttamente, come i socket raw, il DNS, QUIC, i target
  a IP letterale e i client predefiniti Java/.NET. Dichiarato in tutti e quattro i README.

- **Pulizia delle sessioni — la catena di autorizzazione ora segue il ciclo di vita della
  sessione.** All'avvio del plugin e ogni ora, il gate legge l'archivio dei workspace di DSH
  (`$DSH_HOME/storages/workspace.json`, in sola lettura) e classifica ogni sessione per cui
  detiene dati del gate. Le sessioni che DSH ha archiviato (`global.archivedSessionIds`) o non
  traccia più affatto vedono i propri eventi di decisione rimossi da
  `$DSH_HOME/perm-gate/events.jsonl` (riscrittura atomica tmp+rename, solo se qualcosa viene
  rimosso) e i propri file di snapshot pre-modifica cancellati da
  `$DSH_HOME/perm-gate/snapshots/`. Le sessioni vive non vengono toccate; le righe non
  attribuibili (session id vuoto, riga/file imparsabile) non vengono mai cancellate; ogni fallimento
  di I/O è fail-open (il giro viene saltato e ritentato un'ora dopo); il timer orario è `unref`'ato
  e smontato con il plugin. Nuova configurazione: `sessionSweep` (default `true`),
  `workspaceStoreFile` (default `<dshHome>/storages/workspace.json`). Notare che ripristinare una
  sessione archiviata non ripristina la sua storia ripulita. Coperto da
  `test/session-sweep.spec.ts` (13 casi unitari) e `test/session-sweep-apply.spec.ts`
  (cablaggio end-to-end).

## [2.0.0] - 2026-09-11

### Corretto

- **Il gate si ritirava su ogni chiamata con DSH 0.1.2, così la pagina Approvals restava vuota.**
  Il fold del preset dei permessi della sessione leggeva il log come
  `exec.agent.session.events`. DSH 0.1.1 esponeva quell'array; 0.1.2 ha reso il log privato dietro
  `Session.snapshotEvents()` / `ownEvents()` e non ha tenuto alcun membro `events`, così la
  lettura restituiva `undefined`, `presetOf` rispondeva `undefined`, e
  `presetInScope(undefined, ['permissive'])` rendeva `gateActive` falso per **ogni** chiamata:
  nessuna decisione di regola, grant, parola chiave deny, classificatore o hard-deny P0, e nessun
  evento di audit — comprese le sessioni che avevano scelto il livello proprio del gate, per cui
  la scheda mostrava "本会话暂无审批记录" anziché un fallimento. Il fold ora legge il log attraverso
  ogni forma di accessore nota (array `events`, `snapshotEvents()`, `ownEvents()`) e degrada a
  "nessun evento" solo quando l'host non ne espone alcuno; la cache del fold è chiavata sulla
  lunghezza del log più l'identità del suo ultimo evento, poiché uno snapshot 0.1.2 è un array
  fresco sugli stessi eventi congelati a ogni lettura. `test/preset-scope.spec.ts` fissa entrambe
  le forme: una sessione di forma `0.1.2` deve produrre una decisione (e un evento registrato), e
  un log cresciuto deve rifare il fold perché un cambio di preset abbia effetto alla chiamata
  successiva.

### Modificato

- **La serie di versioni della linea `main` è ora `2.x`, seguendo la linea DSH che serve.**
  `1.x` è la linea DSH `<= 0.1.1` e `2.x` la linea DSH `0.1.2+`, così una versione del plugin
  dice per quale DSH è stata costruita; `2.0.0` è la prima release della nuova serie e le release
  `0.2.x` (`0.2.0`, `0.2.1-beta.2`…`beta.5`) ne vengono superate. I major si recintano a vicenda —
  `^1.0.0` non risolve `2.0.0` e `^2.0.0` non risolve `1.0.0` — quindi un'installazione esistente
  `^0.2.1-beta.4` (che non risolve `2.0.0` neanche lei) deve essere avanzata deliberatamente.
  `engines.dsh` dichiara la stessa separazione (`>=0.1.2-alpha.1 <0.2.0-0` qui,
  `>=0.1.0-rc.7 <0.1.2-alpha.1` su `legacy`), ma DSH non lo legge mai: sono gli intervalli di
  versione e i dist-tag a tenere un vecchio DSH su `1.x`.
- **Il livello dei permessi è etichettato 自动审查 su ogni superficie, senza icona.** Il `name:` del
  preset in `cordis.patch.yml` è ora la stringa di prodotto cinese, e la riga predefinita delle
  impostazioni generali, il selettore del composer e la scheda impostazioni del plugin la
  mostrano tutti. DSH 0.1.2 rende verbatim il `name:` di un livello contribuito da un plugin e
  localizza solo i tre valori integrati (`仅可查看` / `工作区内修改` / `完全权限`), così l'unica
  stringa fornita dall'host è ciò che vede una sessione zh; il valore macchina del livello resta
  `permissive`, quello che `gatePresets` confronta. La decorazione a icona del selettore dei
  permessi viene rimossa (`src/client/permission-icon.ts` eliminata): esisteva per eguagliare il
  glifo a scudo del livello `auto` ritirato, si applicava alla riga delle impostazioni attraverso
  il selettore 0.1.2 `aria-haspopup="menu"`, e un livello di plugin non disegna alcun glifo
  perché i glifi del composer sono chiaviati solo sui valori integrati.

## [0.2.1-beta.4] - 2026-09-11

### Aggiunto

- Strategia `trustEscalation` nel livello Permissive (attiva per impostazione predefinita finché
  il livello è attivo): un'approvazione di escalation della sandbox per una chiamata che questo
  gate aveva già consentito riceve qui `allowed-once` invece di chiedervi. L'escalation viene
  sollevata da `approveEscalation` dall'*interno* del corpo del tool shell / pwsh / edit — dopo
  che `tools/pre-execute` si è saldato — così l'allow proprio del gate non la raggiungeva mai e
  una chiamata valutata `safe` dall'LLM vi chiedeva comunque di approvare l'ampliamento. Solo la
  chiamata esatta che il gate aveva autorizzato (riconosciuta per `callId` e nome del tool)
  salta la richiesta, e solo per un motivo di escalation riconosciuto che nomina
  `workspace-write` / `danger-full-access`; tutto il resto delega immutato all'umano. La risposta
  automatica viene registrata nel feed di eventi (`verdict:"escalation-auto"`, `mode:<target>`).
  Spegnere l'interruttore per tenere l'ampliamento della sandbox sotto controllo umano.

### Corretto

- La scheda impostazioni ora semina la whitelist editabile dal file di regole.
  `installSettingsSection` chiamava `scope.set('allowlist', …)` sullo scope delle impostazioni
  **dell'host**, che espone solo `get` / `watch` / `update` / `replace` — `set(field, value)` è
  il wrapper di convenienza del *client* sopra `mutate()`, un oggetto diverso — così la chiamata
  lanciava e il namespace restava non seminato. Ora usa `scope.update({ allowlist: … })`.
- Il listener `approval/request` è registrato con `prepend` e ora è un gate che risponde anziché
  un osservatore passivo, così siede davanti al bridge remoto che rende la richiesta nel browser.
  Un listener dietro quel bridge poteva solo registrare una richiesta già mostrata.
- La parte browser non importa più `@deepseek-ai/dsh-client-runtime`, che DSH ha rimosso in
  `0.1.2-alpha.1`. `ClientContext` ora arriva da `@deepseek-ai/cordis` — l'alias che DSH 0.1.1
  definiva come `export type ClientContext = Context`, quindi nomina lo stesso tipo su entrambe
  le linee — e la scheda impostazioni dichiara localmente i quattro membri di scope che usa
  (`SettingsScopeLike`), lo stesso pattern di faccia locale che la parte host usa già per il
  servizio `settings` dell'host. Il contratto client è identico byte per byte su entrambe le
  linee; solo il suo pacchetto di esportazione si è spostato.

### Modificato

- La compatibilità DSH ora viene spedita come **due branch di lunga durata**, ciascuno con la
  propria serie di versioni, il proprio `engines.dsh` e il proprio dist-tag npm: `main` / `0.2.x`
  / `>=0.1.2-alpha.1 <0.2.0-0` / `latest`, e `legacy` / `1.x` / `>=0.1.0-rc.7 <0.1.2-alpha.1` /
  `legacy`. Questo branch è `main`. Si veda `RELEASING.md` per la disposizione dei branch e il
  flusso di cherry-pick.
- Su questa linea `ctx.slots` è dichiarato da `@deepseek-ai/dsh-client-ui-renderer/client` — da
  `0.1.2-alpha.1` in poi `@deepseek-ai/dsh-client-runtime` non esiste più — così l'entry client
  lo importa da lì.
- Floor delle devDependency client sollevati da `^0.1.0-rc.7` a `^0.1.5-rc.2`, e
  `@deepseek-ai/dsh-client-ui-renderer` aggiunto. Il vecchio floor significava che la build poteva
  risolvere solo il set di pacchetti 0.1.0-rc.8, così questa linea non era mai stata compilata
  contro di lui.
- `npm run verify:line` (`scripts/verify-line.mjs`) installa i pacchetti della linea di questo
  branch con `npm install --no-save` e lancia typecheck + test + build contro di loro, così una
  build compila sempre contro i pacchetti per cui il branch spedisce. `npm run verify:lines` è un
  controllo di deriva opt-in che compila su entrambe le linee e confronta i bundle.

## [0.2.1-beta.3] - 2026-09-10

### Aggiunto

- `llmAssist` con rischio graduato: l'LLM personalizzato configurato (qualsiasi endpoint
  compatibile OpenAI) valuta ogni `ask` come `safe` / `risky:<categoria>`; le categorie hard
  (deletion / credential / remote / system / bulk) auto-negano, i timeout riprovano una volta, e
  ogni fallimento resta fail-closed.
- Apprendimento dei verdetti (`riskLearning`, spento per impostazione predefinita;
  `riskThreshold` 1–10, default 3): gli ask a rischio neutro confermati da una persona ed
  effettivamente eseguiti contano verso l'auto-allow della stessa identica operazione
  (riconosciuta per fingerprint) — persistiti in `$DSH_HOME/perm-gate/learning.json`, mai nelle
  regole YAML dell'utente.
- Feed di eventi di decisione: ogni decisione si accoda a `$DSH_HOME/perm-gate/events.jsonl` e
  viene servita su `GET /api/dsh-perm-gate/events?sessionId=&since=`; la parte browser mostra
  l'ultima decisione come striscia di avviso sopra l'input della conversazione.
- L'icona del selettore dei permessi ora decora anche il trigger collassato del selettore.
- Pagina dei registri di approvazione: la vista conversazione guadagna una scheda **Approvals**
  che elenca le decisioni del gate della sessione dalla più recente (timeline con tag di tipo,
  categoria di rischio e ora); la whitelist della scheda impostazioni è ora un elenco di regole
  editabile con eliminazione per riga più un interruttore di modifica in blocco.
- Sedimentazione dell'apprendimento (`riskSediment`, attiva per default): i campioni confermati
  di una chiave arrivata a soglia diventano regole auto-allow deterministiche — le corrispondenze
  esatte di fingerprint saltano del tutto la chiamata LLM e sopravvivono all'interruttore
  llmAssist; la scheda impostazioni le elenca con terminazione per chiave e rimozione per campione
  (dietro `GET/POST /api/dsh-perm-gate/learning`).
- Ricevitore llmAssist selezionabile: **API personalizzata** (compatibile OpenAI, con preset di
  endpoint tra cui Xiaomi MiMo `https://api.xiaomimimo.com/v1`) o **gruppo di modelli host DSH**
  (servizio `llm` + `agentDefaultModel.currentSelection`, provider/modello sostituibile) — più un
  pulsante di **test di salute** (`POST /api/dsh-perm-gate/health`) che esegue una completion
  minima e riporta la latenza. La scheda legge il catalogo live di provider/gruppi di modelli
  (host `llm.listProviders`/`listModels` — gruppi custom configurati dall'utente compresi) via
  `GET /api/dsh-perm-gate/receiver` e mostra la selezione effettiva di provider/modello.
- Blacklist di parole chiave deny da preset ereditata da dsh-approval-gate
  (`DEFAULT_DENY_KEYWORDS`): una corrispondenza di parola chiave case-insensitive mette il veto
  alla chiamata prima di whitelist / grant / LLM; editabile come elenco nella scheda impostazioni
  con tag da preset e ripristino con un clic; non impostata o vuota si applica il preset (la
  blacklist non si spegne mai in silenzio).
- **Piano di revisione dei registri di approvazione**: i file toccati da ogni decisione vengono
  istantaneizzati prima che la modifica atterri (≤ 5 file, ≤ 256 KB ciascuno) sotto
  `$DSH_HOME/perm-gate/snapshots/`; la scheda **Approvals** trasforma quei file in chip cliccabili
  che aprono un diff di righe (`GET /api/dsh-perm-gate/diff`) con un'azione di **revert** che
  consegna un'istruzione di ripristino nella conversazione (`POST /api/dsh-perm-gate/revert`),
  più una barra di inventario degli snapshot (`GET /api/dsh-perm-gate/snapshots-stats`,
  `POST /api/dsh-perm-gate/snapshots-clear`, per sessione o tutto). Le righe di evento ora
  portano `files`, `justification`, `verdict` e `category`.
- **Registri terminali di approvazione manuale**: un `ask` instradato a una persona viene
  tracciato e saldato con la risposta reale della persona da un osservatore passivo
  `approval/request` — `allowed-once` → approvato, `rejected` → rifiutato, `cancelled` →
  annullato, `unavailable` → un diniego (nessun canale di approvazione). `tools/result` salda lo
  stesso ask come fallback quando l'osservatore non riesce a correlarlo (`callId` mancante, nessun
  servizio di approvazione, o un listener precedente che cortocircuita la cascata); "cancella al
  saldo" è tutta la regola di deduplicazione. Le approvazioni riportano il progresso
  dell'apprendimento post-approvazione (`n`/soglia), e la striscia di avviso etichetta tutti e
  tre gli stati terminali.

### Rimosso

- Il livello di permessi **Auto** ritirato non viene più ridichiarato in `cordis.patch.yml`. La
  patch del bundle DSH sostituisce l'intera mappa `permission.config.presets`, quindi quel file
  doveva portare ogni livello che doveva sopravvivere — incluso `auto`, che `dsh-auto-mode`
  contribueva. Quel plugin è disinstallato: le sue manopole erano identiche a `workspace-write`,
  la sua descrizione "revisione automatica / approvazione a colpo singolo" perse con lui la
  propria implementazione, e questo gate è inattivo su quel livello (`gatePresets` è `['permissive']`
  per default). Il selettore ora offre i tre integrati (`read-only` / `workspace-write` /
  `danger-full-access`, ridichiarati da `@deepseek-ai/dsh-base/cordis.patch.yml`) più il
  `permissive` di questo plugin.
- `test/patch-presets.spec.ts` fissa esattamente quel set di chiavi, così un livello integrato non
  può più essere abbandonato (o un livello ritirato resuscitato) senza far fallire la suite.

### Modificato

- **Supporto DSH a doppia versione (0.1.0-rc.7 … 0.1.2-rc.1).** Un artefatto copre ora
  `dsh-v0.1.1-rc.2` e `dsh-v0.1.2-rc.1` senza controllo di versione. `effectivePolicy` è un
  metodo **privato** del servizio di approvazione utente in entrambe le versioni, così viene
  letto dietro una sonda `typeof`, e una sonda che lancia o manca ora degrada a "policy
  sconosciuta" (l'ask regge) anziché far fallire il percorso di decisione. La registrazione delle
  impostazioni mantiene `ctx.settings.register`, presente in ogni versione supportata.
  `dsh.client.inject` non nomina più `@deepseek-ai/dsh-client-runtime` (rimosso in 0.1.2) né
  `@deepseek-ai/dsh-client-ui-slots` (non una riga client dinamica in nessuna versione); ora
  elenca le vere righe client in cui rende. `engines.dsh` e una tabella di compatibilità delle
  versioni sono stati aggiunti al README.
- Il gate è **attivo solo nei livelli di permessi elencati in `gatePresets`** (default
  `['permissive']`, il livello che questo plugin aggiunge). In ogni altro livello — Read Only,
  Workspace Write, Auto, Full access, `custom` — il suo flusso di decisione non gira affatto:
  nessun allow, nessun ask, nessun deny, nessun hard-deny P0, nessun veto di parola chiave deny,
  nessun evento di audit. `gatePresets: ['*']` rende di nuovo globale il gate (hard-deny
  compreso); un embedding che non passa alcun ambito mantiene il comportamento legacy.
- `llmAssist` ora usa il protocollo delle categorie di rischio (surinsieme dei precedenti verdetti
  allow/deny/ask); `classifier.ts` condivide un unico trasporto OpenAI-compatibile
  (`chatCompletion`) con il grader di rischio. Le categorie di rischio hard (`deletion` /
  `credential` / `remote` / `system` / `bulk`) ora **auto-negano** invece di instradare all'umano
  — l'operazione è chiaramente pericolosa e non serve alcuna popup; solo `risky:neutral`
  (incerto) raggiunge ancora il seam umano.
- I tool `write` / `edit` ora hanno un **default consapevole del percorso**: le scritture interne
  al workspace seguono il `defaultAction` configurato (tipicamente `allow`); le scritture verso
  percorsi fuori dal workspace della sessione escalano a `ask` perché il contenuto possa essere
  revisionato. Il classificatore LLM può poi auto-consentire contenuto sicuro o auto-negare
  contenuto dannoso, così solo le operazioni davvero incerte producono una popup.

### Corretto

- **Il "safe" di `llmAssist` ora auto-consente davvero invece di limitarsi a essere registrato.**
  Il listener `tools/pre-execute` restituiva l'`ask` subito e valutava la chiamata in background,
  ma un ask consegnato all'host è già in cammino verso i risponditori di approvazione e DSH non
  offre API per ritirarlo (il `signal` della richiesta può solo saldarlo `cancelled`). Il pannello
  appariva quindi comunque e la persona doveva cliccare, mentre il feed mostrava l'auto-allow
  `safe` — e un `auto-deny` a rischio hard non raggiungeva affatto l'host. Il listener ora attende
  `refineAsk` **prima** di restituire la decisione (`makePreExecuteListener`): `safe` delega via
  `next()` senza pannello, una categoria hard auto-nega, e solo `risky:neutral` / `unresolved` /
  un fallimento del grader mantengono l'ask umano (fail-closed). L'attesa è limitata da
  `riskTimeoutMs` (default 20 s) e una chiamata già annullata salta la valutazione.
- **Lo strato dei pattern di scrittura shell non girava mai per il tool shell principale di DSH.**
  `SHELL_TOOLS` elencava `bash` / `pwsh` / `sh` / `cmd` / `powershell` ma non **`shell`** (il nome
  del tool proprio di DSH) né `terminal`, così `git push`, `chmod`, `tee`, le redirezioni e ogni
  altro pattern di scrittura cadeva nel `defaultAction` invece di escalare a `ask`. L'elenco ora è
  `shell` / `terminal` / `bash` / `pwsh` / `sh` / `cmd` / `powershell`, e la copia duplicata in
  `learning.ts` è stata rimossa (fonte unica in `evaluate.ts`, così il percorso di decisione e il
  fingerprint di apprendimento non possono più divergere).
- **Il rilevamento di redirezioni e `tee` era troppo stretto.** Solo `>>` corrispondeva, così
  `echo x > /tmp/out.txt` e un nudo `tee /tmp/log.txt` erano trattati come sola lettura. `> f` /
  `>> f` / `>f` ora escalano mentre gli idiomi stderr che un comando di sola lettura usa (`2>&1`,
  `>&2`, `2>/dev/null`, `1>&2`) restano sola lettura; `curl` / `wget` escalano solo quando
  scrivono un file (`-o` / `-O` / `>`).
- **`decideRules` ignorava `args.command`.** Leggeva solo il `ctx.commandText` derivato, così
  qualunque chiamante che costruisse un contesto a mano (test, embedder) perdeva silenziosamente
  l'ispezione del comando. Ora ricade su `args.command`, alla stregua di `PermGateRuntime.ctxFor`.
- **Il gate scavalcava il livello di permessi scelto dall'utente.** Possiede un livello di
  approvazione indipendente, ma agiva in *ogni* preset: ogni attraversamento diventava un `ask`,
  `dsh-tools` lo inoltrava al seam di approvazione DSH, e sotto il preset `danger-full-access`
  (`approval: never`) quel seam restituisce `rejected` **prima che qualsiasi risponditore giri** —
  nessun pannello veniva mai reso e ogni chiamata non di sola lettura falliva con il fuorviante
  `the user rejected tool "..."`. I suoi strati hard-deny e parola chiave deny ignoravano il
  livello allo stesso modo, così `danger-full-access` ("accesso completo senza richieste di
  approvazione") veniva silenziosamente ristretto. L'intero gate ora è delimitato a
  `gatePresets`; fuori il gate è inerte e non registra nulla. Dentro un livello attivo un `ask`
  si degrada comunque a passthrough quando la politica di approvazione effettiva della sessione
  è `never`, così un ask irrisolvibile non può mai diventare un diniego.
- **La ricerca in sola lettura e i tool locali di sessione venivano chiesti.** `web_search` e
  `modlens_read_image` sono query di sola lettura e `todo_write` / `render_ui` / `validate_dsh_ui`
  / `ask_user_question` / `exit_plan_mode` / `ralph` / `workflow` sono stato di sessione o
  delega, ma nessuno era nella classificazione auto-allow, così ognuno sollevava un `ask` (la
  popup `no rule matched; default action`). Ora sono auto-consentiti, e una nuova lista di
  configurazione `autoAllowTools` estende la classificazione ai tool di sola lettura di terze
  parti. L'hard-deny P0 e lo strato di parole chiave deny girano comunque per primi, così
  l'elenco non può mai allargare l'autorità.
- **`write` / `edit` verso percorsi fuori dal workspace passavano silenziosamente attraverso.**
  Una chiamata che scrive in `~/.bashrc` o nei file di un altro disco riceveva il `defaultAction`
  configurato (tipicamente `allow`) e si eseguiva senza revisione. Un override consapevole del
  percorso ora si applica ai tool write/edit quando nessuna regola corrisponde: le scritture
  interne al workspace seguono il `defaultAction` configurato, ma qualsiasi percorso di destinazione
  fuori dal workspace della sessione escala a `ask` perché il contenuto possa essere revisionato —
  il contenuto dannoso viene negato; le aggiunte innocue vengono auto-consentite quando
  `llmAssist` è attivo. Le regole deny esplicite vincono comunque a prescindere dall'ambito del
  percorso, e le regole allow esplicite possono concedere l'accesso ai percorsi interni ma mai
  bypassare la revisione di quelli esterni.
- **Il rilevamento delle credenziali P0 scansionava i corpi dei documenti**, così scrivere o
  modificare qualunque file che semplicemente *menzionasse* un token, una chiave privata o
  `credentials.yaml` veniva hard-negato. Ora scansiona solo gli argomenti che descrivono
  l'operazione (`command`, `file_path`, …), alla stregua della regola esistente dello strato di
  parole chiave deny: il testo di un file non è l'operazione.
- **Un `$DSH_HOME/perm-gate/rules.yml` non veniva mai caricato.** `rulesFile` non aveva default,
  così una voce di profilo che omettesse `config` lasciava il gate con un insieme di regole vuoto
  e `defaultAction: ask` — il `defaultAction: allow` dell'utente e le sue regole `allow:` venivano
  silenziosamente ignorati. `rulesFile` ora è `default` a `<dataDir>/rules.yml` (come
  `eventsFile` / `learningFile`), e il mirror della whitelist nella scheda impostazioni scrive
  davvero lì.
- **`format` metteva il veto al cmdlet PowerShell `Format-Table`.** Un trattino non è un confine
  di parola per un identificatore di comando, così la blacklist corrispondeva a `Format-Table` /
  `Format-List`. I bordi delle parole chiave ora corrispondono ai caratteri di identificatore
  (`[A-Za-z0-9_-]`), così `format C: /q` viene comunque beccato mentre `Format-Table` e
  `mkfs.ext4` si comportano come prima.
- **Ogni query di lettura richiedeva approvazione manuale.** `read` / `read_image` / `grep` /
  `glob` / `ls` / `lsp` sono operazioni di lettura confinate al workspace che non possono
  modificare nulla (l'hard-deny P0 blocca comunque le letture di percorsi sensibili fuori dalla
  radice del workspace). Ora sono auto-consentite. Lo stesso vale per tutti i tool interni di
  coordinamento DSH (`agent_teams_*`, `conversation_search`, `memory_*`, `get_goal` /
  `update_goal` / `create_goal`, `taskboard_*`, `job_*`, `list_agents` / `interrupt_agent` /
  `send_message`, `subagent` / `subagent_fork` / `terminal` / `skill`).

- **La scheda Approvals non risolveva alcun session id**, così non elencava nulla mentre la barra
  degli snapshot mostrava l'inventario globale. Un occupante `conversation.view` riceve le props
  standard al livello superiore (`sessionId` / `useSessions`) — la forma che `ConversationRoot`
  consuma — non sotto `slotsProps`; la vista e la striscia di avviso ora sondano il livello
  superiore, la forma annidata e l'hook dell'elenco delle sessioni.
- **Gli eventi venivano registrati con session id vuoto**, così la scheda Approvals (che filtra
  per la sessione corrente) non mostrava nulla anche se `events.jsonl` si riempiva. Il
  `ToolExecution` di DSH porta la sessione su `agent.session.id` (cwd del workspace su
  `agent.session.header.cwd`), non su `exec.sessionId` / `exec.cwd`; entrambi ora si leggono
  dall'agent quando i campi diretti sono assenti.
- **La pagina di revisione era silenziosamente morta su un'installazione predefinita**: con una
  voce di profilo che omette `config`, `dshHome` era vuoto, così la directory dei dati era
  `undefined` e il log degli eventi non veniva mai costruito — niente `events.jsonl`, niente
  snapshot, niente apprendimento persistito, e un 404 su `GET /api/dsh-perm-gate/events`.
  `dshHome` ora si risolve a un valore esplicito, altrimenti `$DSH_HOME`, altrimenti `~/.dsh`,
  così `<dshHome>/perm-gate/{events.jsonl,learning.json,snapshots/}` viene sempre scritto.
- La corrispondenza di parole chiave deny non mette più il veto su una parola chiave che appare
  solo dentro un identificatore più lungo, e gli argomenti di corpo di documento (`content`,
  `new_string`, `old_string`, `text`, …) non vengono più scansionati affatto — il testo di un file
  non è l'operazione. La corrispondenza ora è consapevole dei confini di parola, così le parole
  chiave bordate di punteggiatura e CJK continuano a funzionare, e gli spazi bianchi vengono
  collassati così un comando scritto con spazi extra viene comunque beccato.


### Aggiunto
- **Livello Permissive** — una modalità di approvazione indipendente in parallelo a read-only /
  workspace-write / full-access / whitelist. Un unico interruttore front (`permissive`) più
  strategie back-end combinabili (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`); l'hard-deny
  P0 resta monotono.
- Sorgenti di decisione di audit `classifier` / `permissive`; hook `classify` iniettabile
  opzionale per `llmAssist` (fail-closed su `ask`/assenza).
- **Client browser** — una pagina `settings.plugins.tab` ("Permissive approval tier") si rende in
  Impostazioni → Plugin: un interruttore (`permissive`) + tre interruttori
  `permissiveStrategies` di back-end. L'host legge il namespace al volo, così le modifiche si
  applicano alla successiva chiamata a tool senza riavvio.
- Flag CLI `--permissive` e riepilogo permissive in `--list`.
- **Vero LLM per llmAssist** — un classificatore OpenAI-compatibile configurabile
  (`classifierEndpoint` / `classifierModel`), invocato per decidere automaticamente un `ask` e
  fail-closed al seam umano.
- **Migrazione della whitelist** — `approveAllowEverywhere` persiste una parola di comando nella
  whitelist `allow` del file di regole e ricarica; `approveRepeat` conia un grant di sessione
  delimitato. Entrambi stanno dietro ai due pulsanti allow estesi del pannello always-confirm.
- **Guide all'installazione in quattro lingue** — `INSTALL.md` / `INSTALL.zh.md` /
  `INSTALL.ja.md` / `INSTALL.ko.md` che coprono installazione, aggiornamento, migrazione dai
  plugin separati, verifica e risoluzione dei problemi; ogni README ha guadagnato link di cambio
  lingua, una nota di compatibilità `ja` / `ko` (il `LOCALE_IDS` ufficiale di DSH è
  `["zh", "en"]`) e un riferimento di versione.
- README.ja / README.ko espansi a specchi completi della fonte di verità inglese (tabella della
  catena P0–P4, perché/funzionalità, formato del file di regole, livello Permissive, CLI).

## [0.1.0] - 2026-08-30

### Aggiunto
- Catena di decisione P0–P4: hard-deny, grant di sessione, catena di regole statica deny-prima,
  classificatore opzionale (spento), `ask`.
- Motore di regole a funzioni pure: compilazione glob/regex con limite ReDoS, parsing a fallimento
  rumoroso, cache di compilazione per hash del contenuto.
- Whitelist/blacklist dei comandi via scomposizione argv (ricorsione `sh -c`/`bash -c`,
  pipeline, redirezioni, recursive/force).
- Grant di sessione precisi chiaviati per fingerprint canonico (TTL + maxUses, nessun riuso
  tra target).
- Audit delle decisioni `{ignorable:true}` con invariante visibile-al-modello⟺loggato.
- Evaluator CLI standalone in dry-run (`dsh-perm-gate --rules … --tool … --args …`).
- Contratto di plugin a funzione cordis di DSH (`cordis.patch.yml`, `Config` Schemastery,
  exports/types).
- README in 4 lingue (en/zh/ja/ko) e infrastruttura Keep-a-Changelog (en + ja + ko).
