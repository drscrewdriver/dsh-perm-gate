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

> **Nota di compatibilità:** la v2.0.0 include i dizionari `ja` / `ko`, ma il DSH ufficiale espone
> solo `zh` / `en` tramite `LocaleRuntime` (`LOCALE_IDS = ["zh", "en"]`). Su un DSH originale, la
> selezione di `ja` / `ko` fallisce con `locale "<id>" is not registered`. Usare un fork di DSH
> che aggiorni `LOCALE_IDS` (locale-settings.ts) e le etichette `LOCALES` (client/index.ts), poi
> ricompilare.

> **▼ Compatibilità delle versioni DSH**
>
> Due linee DSH sono servite da due branch di lunga durata, ciascuno con la propria serie di
> versioni, il proprio `engines.dsh` e il proprio dist-tag npm
> ([disposizione delle release](./RELEASING.md)):
>
> | Versione DSH | Branch | Versione | Tag npm |
> | --- | --- | --- | --- |
> | 0.1.0-rc.7 ~ 0.1.1-rc.x | `legacy` | `1.x` | `@legacy` |
> | 0.1.2-alpha.1+ (incl. 0.1.5-rc.2) | `main` | `2.x` | `@latest` / `@dsh-0.1.2` (`@2.x` è un intervallo) |
> | 0.2.0-rc.1 (linea 0.2.0) | `compat/0.2.0` | `5.x` | `@dsh-0.2.0` |
>
> Il numero di serie segue la **linea DSH** (`1.x` = DSH ≤ 0.1.1, `2.x` = DSH 0.1.2+), e i major
> si recintano a vicenda: un'installazione `^1.x` non risolve mai una versione `2.x` e viceversa.
> `engines.dsh` dichiara la stessa separazione, ma DSH non lo legge mai — sono gli intervalli e i
> dist-tag a tenere un vecchio DSH su `1.x`.
>
> `@deepseek-ai/dsh-client-runtime` è stato **rimosso** a partire da `0.1.2-alpha.1` — non si è
> semplicemente spostato. La linea `legacy` raggiunge ancora `ctx.slots` attraverso di esso;
> `main` ottiene la stessa dichiarazione da `@deepseek-ai/dsh-client-ui-renderer/client`. Due
> giunzioni sensibili alla versione sono gestite con sonde di capacità anziché con controlli di
> versione: (1) la registrazione delle impostazioni usa `register`, presente su entrambe le linee
> (`installSection` è un'aggiunta, non una sostituzione); (2) `effectivePolicy` è un metodo
> **privato** del servizio di approvazione utente su entrambe, quindi viene letto dietro una
> sonda `typeof` e degrada a "policy sconosciuta" quando è assente o lancia un errore.

Versione **2.6.0** — vedere il [changelog](./CHANGELOG.it.md).

Un unico gate di permessi autosufficiente, deterministico in primis e fail-closed per DeepSeek
Harness.

`dsh-perm-gate` decide ogni chiamata a un tool attraverso una catena di priorità fissa:

| Stadio | Decisione | Che cosa è |
| ---- | ---- | ---- |
| **P0** | `deny` | hard-deny deterministico: materiale credenziali, mutazione di percorsi protetti, shell pericolosa |
| **P1** | `allow` | un **grant di sessione** preciso e delimitato |
| **P2** | `deny/allow/ask` | catena di regole statica: prima la blacklist, poi l'allow, poi l'ask |
| **P3** | `allow/deny/ask` | classificatore semantico LLM opzionale (**off** per impostazione predefinita) |
| **P4** | `ask` | seam di approvazione ufficiale |

Strettamente fail-closed: una decisione P0 non viene mai scavalcata da un grant, una regola, il
classificatore o un essere umano.

## Perché

L'ecosistema di sicurezza di DSH distribuisce questo su più plugin (`dsh-permission-rules`,
`dsh-auto-mode`, `dsh-auto-review`, `dsh-movein-permissions`). `dsh-perm-gate` fonde gate +
approvazione + classificatore (opzionale) in un solo pacchetto, con un'unica traccia di audit e
nessun accoppiamento di versione tra plugin.

## Funzionalità

- **Whitelist / blacklist dei comandi** — confronto su una **scomposizione argv** (non una stringa
  grezza), con discesa ricorsiva in `sh -c`/`bash -c`, rilevamento delle pipeline, controllo delle
  destinazioni delle redirezioni e riconoscimento di ricorsivo/forzato (`rm -rf`).
- **Priorità al deny** — una regola deny corrispondente batte qualsiasi regola allow.
- **Grant di sessione** — grant precisi `(tool, fingerprint canonico)` con `TTL` + `maxUses`;
  rieseguire con un target diverso non riutilizza mai l'autorità. I sub-agent ereditano ma non
  possono coniarne.
- **Motore di regole a funzioni pure** — compilazione glob/regex con un limite ReDoS, fallimento
  rumoroso su regole malformate e cache di compilazione basata sull'hash della sorgente.
- **Audit** — ogni decisione viene registrata come evento `{ignorable:true}` con il suo `callId`;
  il motivo visibile al modello corrisponde all'esito registrato.
- **Livello 自动审查** (`permissive`, più `permissive-full`) — una **modalità di approvazione
  indipendente** (separata dai livelli sola lettura, accesso completo e whitelist) che non è né
  "approvazione automatica" né fiducia indiscriminata. Il front-end espone un **unico
  interruttore** (`permissive`); le quattro strategie di back-end sono **combinabili** e guidate
  dalle impostazioni del plugin — sempre fail-closed contro P0. Il selettore dei permessi e la
  riga delle impostazioni la mostrano entrambi con l'etichetta di prodotto 自动审查, senza icona.
  La variante `permissive-full` mantiene lo stesso comportamento di approvazione ma elimina la
  sandbox dei file integrata, che altrimenti nega le named pipe di cui `git clone` / Cygwin /
  ConPTY hanno bisogno.
- **Risposta automatica alle escalation della sandbox** (`trustEscalation`) — un'escalation della
  sandbox viene richiesta dall'*interno* del corpo del tool shell / pwsh / edit, dopo
  `tools/pre-execute`, così il gate non l'ha mai vista e una chiamata che aveva auto-consentito
  richiedeva comunque l'approvazione dell'ampliamento. Con questa strategia attiva, è qui che
  viene risposta l'esatta richiesta che il gate aveva autorizzato (riconosciuta per `callId`).
- **`llmAssist` con rischio graduato** — un LLM personalizzato compatibile OpenAI valuta ogni
  `ask` come `safe` / `risky:<categoria>`; le categorie hard (eliminazione, credenziali, remoto,
  sistema, massa) **chiedono sempre**, il neutro alimenta l'apprendimento dei verdetti e ogni
  guasto resta fail-closed.
- **Apprendimento dei verdetti** — gli `ask` a rischio neutro approvati da una persona ed
  effettivamente eseguiti si accumulano; superata la soglia, *la stessa identica operazione*
  (riconosciuta per fingerprint) si auto-consente.
- **Feed di eventi di decisione** — ogni decisione viene aggiunta a un feed JSONL e mostrata dalla
  parte browser come una striscia di avviso sopra l'input della conversazione, più una scheda dei
  registri di approvazione (dal più recente) nella vista conversazione.

Una **blacklist di parole chiave deny preimpostata** (ereditata dai `DEFAULT_DENY_KEYWORDS` di
dsh-approval-gate: `rm -rf`, `push --force`, `drop table`, `mkfs`, `git reset --hard`,
`docker system prune`, …) mette il veto a qualsiasi chiamata il cui testo contenga una parola
chiave — sottostringa case-insensitive, applicata prima della whitelist, dei grant e dell'LLM. È
modificabile come elenco nella scheda impostazioni (le voci preimpostate sono etichettate e un
ripristino con un clic rimette il preset); non impostata o vuota si applica il preset — la
blacklist non si spegne mai silenziosamente.

## Installazione

Richiede un'installazione esistente di
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

```sh
dsh plugin --profile web add dsh-perm-gate
```

I passaggi completi di installazione, aggiornamento, migrazione e risoluzione dei problemi si
trovano nella [Guida all'installazione](./INSTALL.it.md) — disponibile anche in
[English](./INSTALL.md) / [中文](./INSTALL.zh.md) / [日本語](./INSTALL.ja.md) /
[한국어](./INSTALL.ko.md) / [Français](./INSTALL.fr.md) / [Deutsch](./INSTALL.de.md) /
[Русский](./INSTALL.ru.md) / [Español](./INSTALL.es.md).

## Configurazione

Aggiungere il plugin al `cordis.yml`:

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

### Pulizia delle sessioni

All'avvio e ogni ora il gate legge l'archivio dei workspace di DSH
(`$DSH_HOME/storages/workspace.json`, in sola lettura) e classifica ogni sessione per cui
conserva dati della catena di autorizzazione. Le sessioni che DSH ha archiviato
(`global.archivedSessionIds`) o non traccia più affatto vedono i propri eventi di decisione
rimossi da `$DSH_HOME/perm-gate/events.jsonl` e i propri file di snapshot pre-modifica cancellati
da `$DSH_HOME/perm-gate/snapshots/` — storia che la pagina di revisione non può più raggiungere,
per dati che l'harness stesso considera andati. Le sessioni vive non vengono toccate, le righe non
attribuibili (session id vuoto) non vengono mai cancellate, e ogni guasto è fail-open: il giro
viene saltato e ritentato un'ora dopo. Impostare `sessionSweep: false` per disattivare;
`workspaceStoreFile` sostituisce il percorso dell'archivio. Ripristinare una sessione archiviata
non ripristina la sua storia ripulita.

### File delle regole

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

Una voce di comando `word#flag` corrisponde alla parola comando (`word`) con il modificatore
`recursive` o `force` — così `rm#recursive` corrisponde a `rm -rf`, `env rm -rf` e
`sh -c "rm -rf /"`.

### Politica di rete (opt-in)

Un proxy HTTP/CONNECT locale che giudica il traffico in uscita dei **sottoprocessi shell** in
base allo stesso file di regole, più un percorso di approvazione per i target che nessuna regola
copre. **Disattivato per impostazione predefinita** — attivarlo lega una porta di loopback e
riscrive l'ambiente proxy per i processi figli, quindi non viene mai attivato implicitamente.

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

**Comportamento a livelli.** Nulla raggiunge la rete senza una regola allow. Un target non
elencato viene escalato al seam di approvazione interattivo, sollevato per conto del comando
shell che ha aperto la connessione; approvare amplia la copertura per quel target per la
sessione. Una regola `deny` non viene **mai** escalata — l'approvazione può ampliare ciò che un
target non elencato può raggiungere, ma non può mai scavalcare una regola che dice no.

**Il confine — da leggere prima di contarci.** Il proxy è uno strato di policy *cooperativo*,
non un confine di applicazione. Vede solo il traffico dei client che leggono l'ambiente proxy:

| Client | Coperto? |
|--------|----------|
| `curl`, `wget`, `git`, Go `net/http`, Python `requests` | sì |
| **Node.js `http`/`https`/`fetch`** | **no — si collega direttamente** |
| Java (senza flag proxy `-D`), .NET `HttpClient` | no |
| Socket raw, TCP personalizzato | no |
| DNS, QUIC/HTTP3, protocolli non HTTP | no |
| Connessioni a un IP letterale | no |

Quindi un comando shell come `node -e "require('http').get('http://host/')"` non viene
intercettato. Trattatelo come un guard-rail contro gli incidenti e un luogo dove dichiarare
un'intenzione, non come una sandbox ermetica.

Il traffico di rete **proprio** di DSH — i tool di rete integrati e il trasporto LLM — è
deliberatamente lasciato in pace. Quelle connessioni non portano alcuna attribuzione shell, e
`networkUnattributed: allow` (il valore predefinito) le lascia passare senza revisione:
revisionarle permetterebbe all'host di bloccare *se stesso*, che è un fallimento peggiore di un
blocco mancato. Impostare `networkUnattributed: deny` solo se si sa che i client del proprio host
ignorano l'ambiente proxy.

Lo stato live si interroga su `GET /api/dsh-perm-gate/network` (modalità, bind, porta, vivacità
del proxy, stato dell'iniezione d'ambiente, contatori dei blocchi, blocchi recenti).

## Il livello 自动审查 (valore macchina `permissive`)

自动审查 è un **livello di approvazione indipendente** nel selettore dei permessi di DSH, in
parallelo a Sola lettura / Scrittura workspace / Accesso completo / Whitelist. Non è
un'"approvazione automatica" generica e non conia mai autorità indiscriminata: restringe o
amplia soltanto il seam *prima* del passaggio umano/LLM, mentre l'hard-deny P0 resta monotono e
non negoziabile **dentro l'ambito proprio del gate**.

> **P0 è delimitato, non globale.** Il gate agisce solo quando il preset dei permessi della
> sessione è uno dei `gatePresets` (predefinito `permissive` / `permissive-full`). Con qualsiasi
> altro preset — Sola lettura, Scrittura workspace o Accesso completo — **l'intero** gate si
> ritira, hard-deny P0 compreso, perché la politica propria del livello scelto governa quella
> sessione. È voluto (si veda `gatePresets` nella tabella di configurazione), ma significa che "P0
> non è negoziabile" vale *dentro* i livelli del gate e non attraverso ogni livello. Un ritiro
> non è silenzioso: il gate registra un evento `stand-down` per ogni transizione sessione/preset
> e il browser mostra una striscia persistente **GATE OFF** sopra l'input. Impostare
> `gatePresets: ['*']` per rendere di nuovo globale P0.

**Ne vengono shipiate due varianti**, perché `sandbox` e `approval` di un preset sono manopole
indipendenti e accoppiarle imponeva un cattivo compromesso:

| Etichetta nel selettore | Valore macchina | sandbox | approval |
|--------------|---------------|---------|----------|
| 自动审查 | `permissive` | `workspace-write` | `ask` |
| 自动审查（高权限） | `permissive-full` | `danger-full-access` | `ask` |

Il livello semplice conserva la sandbox dei file integrata. Quella sandbox nega anche le named
pipe di cui un processo figlio ha bisogno per avviarsi, così `git clone`, `sh.exe` di MSYS2/Cygwin
e ConPTY falliscono con `Win32 error 5` / `couldn't create signal pipe`. Poiché il gate è attivo
**solo** nei livelli elencati in `gatePresets`, volere il gate significava accettare quella
restrizione. 自动审查（高权限） rimuove l'accoppiamento: identico comportamento di approvazione,
nessuna restrizione di sandbox dei file. La descrizione del livello enuncia il compromesso senza
giri di parole — il flusso di lavoro è più fluido, le approvazioni valgono comunque per chiamata,
ma non resta **nessuna sandbox di sistema come rete di sicurezza**. Entrambi sono nei
`gatePresets` predefiniti, quindi l'uno o l'altro danno l'intera catena P0–P4 — il gate legge solo
il **nome** del preset, mai la modalità di sandbox.

L'etichetta nel selettore è una **stringa di prodotto fornita dall'host**, non una voce di
dizionario per locale: DSH rende verbatim il `name:` del livello di un plugin su entrambe le
superfici dei permessi (la riga predefinita nelle impostazioni generali e il selettore del
composer) e fornisce le proprie etichette localizzate solo per i tre valori integrati, così
`cordis.patch.yml` spedisce l'etichetta cinese per ogni sessione.

**L'icona** è un'altra storia. La mappa dei glifi del composer è chiusa e il suo stesso commento
enuncia la regola: *host-configured names outside the design set get none.* `permissive` è un
valore integrato, quindi 自动审查 ha già un glifo scudo+occhio; `permissive-full` riceve lo stesso
glifo solo perché `npx dsh-perm-gate-patch-glyph` lo aggiunge a quella mappa. Quella patch modifica
un pacchetto **host**, quindi si perde a ogni aggiornamento di DSH — si veda
[Dopo un aggiornamento di DSH](./INSTALL.it.md).

Nel `cordis.yml`:

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

`trustAutoAllow` è il livello intermedio di base (un allow da regola passa da sé).
`alwaysConfirm` mostra il pannello di approvazione a ogni attraversamento; i suoi "controlli
allow" aggiungono due pulsanti estesi — **ri-consentire questo tipo per questa sessione** (un
grant di sessione delimitato) e **consentire ogni occorrenza** (che persiste la parola comando
nella whitelist `allow` del `permissions.yaml` tramite `approveAllowEverywhere`). `llmAssist`
consulta un vero LLM configurabile (`classifierEndpoint` / `classifierModel`, qualsiasi API
compatibile OpenAI) per decidere automaticamente un `ask`, e ricade sul seam umano su
`ask`/errore — sempre fail-closed. `trustEscalation` (attivo per impostazione predefinita quando
il livello è attivo) risponde a un'escalation `sandbox_permissions` sollevata dall'interno di una
chiamata che il gate aveva già consentito; si veda sotto. Con `permissive` disattivo, il gate si
comporta esattamente come prima.

### Escalation della sandbox: perché un verdetto `safe` mostrava comunque la richiesta

Una chiamata a un tool può sollevare **due approvazioni indipendenti**. Il gate possiede la prima
— il suo `ask`, sulla cascata `tools/pre-execute`. La seconda arriva da `approveEscalation`
**dentro il corpo del tool**, al momento di `tools/execute`, ogni volta che il modello ha passato
`sandbox_permissions` + `justification`; a quel punto `tools/pre-execute` è già deciso, così
l'allow del gate non la raggiunge mai. Una chiamata valutata `safe` dall'LLM e auto-consentita dal
gate mostrava quindi comunque una richiesta di approvare l'ampliamento della sandbox.

`trustEscalation` chiude questo varco. Il gate ricorda ogni chiamata che ha effettivamente
consentito (indicizzata per la `callId` dell'host, che la richiesta di escalation ripete) e
risponde da sé all'escalation con `allowed-once`. Si applica solo quando valgono **tutti** i
punti:

- il livello 自动审查 è attivo e `trustEscalation` è attivo;
- la richiesta porta una `callId` che il gate ha autorizzato, con nome del tool corrispondente;
- il motivo è un'escalation riconosciuta che nomina `workspace-write` o `danger-full-access`.

Tutto il resto — un motivo non riconosciuto, una chiamata diversa, una chiamata che il gate aveva
richiesto o negato, il passaggio diretto `approval: never` — delega immutato all'umano, così un
futuro cambio di formulazione di DSH fallisce chiuso anziché aperto. La risposta automatica viene
registrata nel feed di eventi (`verdict: "escalation-auto"`, `mode: <target>`). Spegnere
l'interruttore per tenere l'ampliamento della sandbox sotto controllo umano mentre gli altri
allow restano automatici.

### llmAssist con rischio graduato, apprendimento dei verdetti e feed di eventi

Con `llmAssist` attivo, l'LLM configurato valuta un `ask` alla volta con un protocollo strutturato.
La valutazione avviene **dentro la cascata `tools/pre-execute` del gate, prima che la decisione
torni all'host**: un verdetto `safe` delega la chiamata direttamente, così il pannello di
approvazione non appare mai; solo un verdetto davvero incerto raggiunge l'utente. Due sorgenti di
ricevitore sono selezionabili nella scheda impostazioni: un'**API personalizzata** (qualsiasi
endpoint compatibile OpenAI — `classifierEndpoint` / `classifierModel` / `classifierApiKey`, con
preset tra cui Xiaomi MiMo `https://api.xiaomimimo.com/v1`), oppure il **gruppo di modelli host
DSH** (il servizio `llm` configurato della sessione, via `agentDefaultModel.currentSelection`,
facoltativamente sostituito con `classifierProvider` / `classifierModel`). Un pulsante di **test
di salute** (`POST /api/dsh-perm-gate/health`) esegue una completion minima e riporta la latenza.

- `safe` → la chiamata è auto-consentita (audited come sorgente `classifier`); nessun pannello.
- `risky` + una **categoria hard** (`deletion`, `credential`, `remote`, `system`, `bulk`) → la
  chiamata **mantiene l'ask umano**. Il classificatore **non nega mai**: il percorso di deny
  appartiene ai soli strati deterministici (hard-deny P0, la blacklist di parole chiave deny, le
  regole `deny:` esplicite), così una categoria mal valutata resta sempre negoziabile invece di
  essere un blocco impugnabile.
  (Negare sulla parola del modello è stato misurato dal vivo: un benigno `git commit -F …`
  valutato `remote` ha prodotto un auto-deny senza pannello e senza grant per riprovare.)
- `risky:neutral` → con `riskLearning` attivo (scheda Impostazioni, spento per impostazione
  predefinita), ogni approvazione umana effettivamente eseguita (saldato tramite l'evento
  `tools/result` dell'host) conta su una chiave `tool|category`; quando il conteggio raggiunge
  `riskThreshold` (predefinito 3) **e** il fingerprint dell'operazione della nuova chiamata
  (parola comando + basename del target) corrisponde a un campione confermato, la stessa identica
  operazione si auto-consente. Un target diverso non riutilizza mai quell'autorità. Con la
  sedimentazione (`riskSediment`, attiva per impostazione predefinita) i campioni confermati di
  una chiave arrivata a soglia diventano **regole allow deterministiche**: una corrispondenza
  esatta consente outright senza un'altra chiamata LLM — anche con `llmAssist` spento — e le
  regole sedimentate sono visibili e gestibili (terminare / rimuovere) nella scheda impostazioni.
- Timeout (`riskTimeoutMs`, predefinito 20 s, un tentativo), guasti di trasporto e uscite fuori
  protocollo lasciano l'ask intatto — il gate non indovina mai.

Lo stato di apprendimento persiste in un JSON di proprietà del plugin
(`$DSH_HOME/perm-gate/learning.json`, o `learningFile`), mai nel file di regole YAML
dell'utente. Ogni decisione viene aggiunta a `$DSH_HOME/perm-gate/events.jsonl` (o `eventsFile`) e
servita su `GET /api/dsh-perm-gate/events?sessionId=&since=`; la parte browser la interroga e
mostra l'ultima decisione come striscia di avviso sopra l'input della conversazione (gli ask
restano visibili fino all'evento successivo) ed elenca tutte le decisioni della sessione dalla più
recente nella scheda **Approvals** della vista conversazione.

I file toccati da ogni decisione vengono istantaneizzati prima che la modifica atterri (≤ 5 file,
≤ 256 KB ciascuno) sotto `$DSH_HOME/perm-gate/snapshots/`; nella scheda **Approvals** ogni chip di
file apre un diff di righe (`GET /api/dsh-perm-gate/diff`) con un'azione di **revert** che invia
un'istruzione di ripristino nella conversazione (`POST /api/dsh-perm-gate/revert`). Una barra di
inventario degli snapshot li cancella per sessione o del tutto
(`GET /api/dsh-perm-gate/snapshots-stats` / `POST /api/dsh-perm-gate/snapshots-clear`).

Un `ask` instradato dal gate a una persona viene tracciato finché la persona risponde: un
osservatore passivo `approval/request` registra l'esito chiuso (`allowed-once` → **approvato**,
`rejected` → **rifiutato**, `cancelled` → **annullato**, `unavailable` → un diniego, poiché non
esisteva alcun canale di approvazione), con `tools/result` che salda lo stesso ask come fallback
quando l'osservatore non riesce a correlarlo. Le approvazioni riportano il progresso
dell'apprendimento post-approvazione (`n`/soglia), e la striscia di avviso etichetta tutti e tre
gli stati terminali.

自动审查 e 自动审查（高权限） disegnano entrambi il glifo scudo+occhio nel selettore — la prima
dalla mappa integrata di DSH, la seconda dalla patch host descritta nella guida
all'installazione. Senza quella patch il secondo livello è solo testo su ogni superficie;
l'etichetta e il gating restano invariati.

### Un livello di sessione selezionabile

`cordis.patch.yml` aggiunge un preset `permissive` (`sandbox: workspace-write`, `approval: ask`,
nome **自动审查**) tra Scrittura workspace e Accesso completo. La patch del bundle DSH sostituisce
l'intera mappa `permission.config.presets` invece di fare merge per chiave, quindi il file
ridichiara anche i tre integrati (`read-only` / `workspace-write` / `danger-full-access`, da
`@deepseek-ai/dsh-base/cordis.patch.yml`); `test/patch-presets.spec.ts` fissa quel set di chiavi.
Così il selettore dei permessi di sessione offre 自动审查 come livello di approvazione indipendente
selezionabile, non una generica modalità di "approvazione automatica".

Il gate è attivo **solo nei livelli elencati in `gatePresets`** (predefinito
`['permissive', 'permissive-full']`, i due livelli che questo plugin aggiunge). In ogni altro
livello — Sola lettura, Scrittura workspace, Accesso completo, `custom` — il flusso di decisione
del gate non gira affatto: nessun allow, nessun ask, nessun deny, nessun hard-deny P0, nessun veto
di parola chiave deny, nessun evento di audit. La politica propria del livello scelto governa la
chiamata, ed è questo il punto: il `danger-full-access` integrato è definito come "accesso
completo senza richieste di approvazione", quindi scavalcato con un ask (lì irrivendicabile — il
seam di approvazione rifiuta prima che qualsiasi risponditore parta, producendo
`the user rejected tool "..."` senza pannello) o con un hard-deny contraddirebbe silenziosamente
il livello scelto dall'utente. `gatePresets: ['*']` rende di nuovo globale il gate (hard-deny
compreso); dentro un livello attivo un `ask` viene comunque degradato a passthrough quando la
politica di approvazione effettiva della sessione è `never` — ecco perché entrambi i livelli
自动审查 dichiarano `approval: ask`.

### Configurabile nell'interfaccia

Il livello è regolabile anche a runtime da **Impostazioni → Plugin → 自动审查** (una pagina
`settings.plugins.tab` resa dal client browser del plugin): un interruttore commuta `permissive`,
e quattro interruttori modificano le `permissiveStrategies` di back-end. L'host legge il namespace
al volo, quindi una modifica si applica alla successiva chiamata a tool senza riavvio. Questa è
una classe di approvazione indipendente, NON una generica modalità di "approvazione automatica".

### Test delle regole (dry-run)

La stessa pagina ospita un pannello di **test delle regole**: digitare un nome di tool e un
comando, premere Test, e il gate giudica quella chiamata contro l'insieme di regole che ha
attualmente caricato — senza eseguire nulla e senza scrivere alcuna regola. Si ottengono il
verdetto, la regola corrispondente (indice e azione), le dimensioni che quella regola vincola e il
motivo.

Riporta sia il verdetto effettivo (l'intera catena P0 → P1 → P2 → P3 → P4) *sia* la risposta
propria dello strato di regole, che non sono la stessa cosa: un hard-deny P0 o una parola chiave
deny da preset scattano prima della catena di regole e non lasciano dietro alcun indice di
regola, così il pannello dice "nessuna regola corrispondente" anziché nominare una regola non
pertinente. Una nota "0 regole caricate" significa che il percorso `rulesFile` non ha risolto
nulla.

Il pannello parla con `POST /api/dsh-perm-gate/dry-run`, che è **in sola lettura per
costruzione** — non ha alcuna forma di scrittura, quindi testare una regola non potrà mai
modificarla.

## CLI

Dry-run di una chiamata contro un file di regole (senza harness):

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
```

## Sviluppo

```sh
npm run typecheck
npm test
npm run build
```

## Licenza

[MIT](./LICENSE)
