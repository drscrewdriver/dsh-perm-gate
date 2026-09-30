# Guida all'installazione

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

`dsh-perm-gate` versione **2.4.1**. Continuare con il [README](./README.it.md) per la
catena di decisione, il formato del file di regole e il livello 自动审查.

## Requisiti

- Un'installazione esistente di
  [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
- Node.js **>= 20** (si veda `engines` in `package.json`).
- La CLI `dsh` nel proprio `PATH`.
- Un profilo in cui installare — la parte browser viene spedita solo per il profilo `web`
  (`dsh.client.platform = "web"` in `package.json`).

## Scegliere il tag per la propria versione di DSH

Una singola build serve entrambe le linee DSH, quindi uno dei due tag installa codice funzionante — il
tag esiste perché una versione bloccata resti significativa per linea.

| Il vostro DSH | Installazione |
|----------|---------|
| `0.1.2-alpha.1` o più recente (incl. `0.1.5-rc.2`) | `dsh plugin --profile web add dsh-perm-gate` (tag `latest`) |
| fino a `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH non impone `engines.dsh`, quindi i tag sono il meccanismo di selezione anziché un varco di
compatibilità. Si veda [RELEASING.md](./RELEASING.md) per il motivo per cui un artefatto copre
entrambe le linee e come i tag vengono pubblicati.

## Installare con la CLI ufficiale

```sh
dsh plugin --profile web add dsh-perm-gate
```

Questo recupera il pacchetto pubblicato, applica il suo `cordis.patch.yml` (il livello di sessione
自动审查 più la voce del plugin) e assembla entrambe le parti.

## Installare dai sorgenti

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` è anche il passo `prepublishOnly`, quindi la pubblicazione non spedisce mai un
`lib/` stantio.

## Attivare e configurare

Aggiungere il plugin al `cordis.yml` del proprio profilo:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # tiers where the gate is active at all (default)
```

Partire da
[examples/permissions.example.yaml](./examples/permissions.example.yaml), poi ricaricare il
profilo.

## Aggiornare

```sh
dsh plugin --profile web update dsh-perm-gate
```

Quindi riapplicare il profilo perché il file di patch venga rileto:

```sh
dsh profile reload --profile web
```

## Dopo un aggiornamento di **DSH**: riapplicare la patch del glifo del composer

Il livello 自动审查（高权限） mostra lo stesso glifo scudo+occhio di 自动审查 solo perché
`scripts/patch-permission-glyph.mjs` lo ha aggiunto a una **mappa chiusa dentro un pacchetto host
di DSH**. DSH non dà per progetto alcun glifo ai livelli configurati dall'host — il commento
della mappa stessa dice *«host-configured names outside the design set get none»* — e gli oggetti
opzione che un plugin può influenzare portano solo `{value, name, description}`; non esiste
quindi una giunzione lato plugin da usare in alternativa.

Quella patch modifica un file **host**, quindi un aggiornamento o una reinstallazione di DSH la
cancella. Aggiornare *questo plugin* no: il plugin non ha mai posseduto il glifo, e il suo
contributo proprio (`name:` / `description:` in `cordis.patch.yml`) viaggia dentro il pacchetto.

```sh
npx dsh-perm-gate-patch-glyph            # apply the patch
npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is gone
dsh profile reload --profile web
```

Lo script **viaggia dentro questo pacchetto** — come `scripts/patch-permission-glyph.mjs` e come
il bin `dsh-perm-gate-patch-glyph` — quindi non serve un checkout dei sorgenti. È deliberatamente
**non** cablato a `postinstall`: modifica un pacchetto host, e un plugin non deve riscrivere
l'harness in cui è installato senza essere invitato. Un DSH in esecuzione non è toccato in
nessun caso; il livello funziona con o senza.

È idempotente (una seconda esecuzione è un no-op), fa il backup del bundle una volta e si rifiuta
di scrivere un bundle tagliato male — esegue `node --check` sul risultato e ripristina il backup
se fallisce — quindi è sicuro eseguirlo incondizionatamente dopo ogni aggiornamento di DSH.
Trova il bundle dal binario `node` in esecuzione, così un cambio di versione nvm o un symlink di
installazione ripuntato non lo rompono.

**Reinstallare il plugin non ripristina il glifo.** `dsh plugin --profile web add …` inoltra a
pnpm dentro la directory del profilo e scrive solo il `node_modules` del profilo stesso; `-w`
(`--workspace-root`, e il workspace di questo profilo è solo `packages: ['.']`) non cambia nulla.
Il glifo vive nell'installazione DSH. Su un'installazione originale non sono tre copie ma **un
solo file fisico**:

| Percorso | Che cos'è |
|------|------------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | l'installazione DSH (può essere un symlink) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | una **junction** verso di essa |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | il file patchato |

Sintomo da cercare: il livello continua a funzionare e a filtrare correttamente, ma la sua riga
nel menu a tendina del composer è senza icona e il trigger collassato rende testo semplice dove
gli altri livelli rendono glifo + testo.

## Migrare dai plugin separati

`dsh-perm-gate` fonde il gate, il seam di approvazione e il classificatore (opzionale) che prima
vivevano distribuiti tra `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review` e
`dsh-movein-permissions`.

1. Esportare le proprie liste di regole esistenti (deny / allow / ask) e fonderle in un unico
   documento `permissions.yaml`.
2. Rimuovere i quattro plugin dal `cordis.yml` e aggiungere la singola voce `dsh-perm-gate` di
   sopra.
3. Eliminare qualsiasi override di preset contribuito da quei plugin — `cordis.patch.yml`
   **sostituisce** `permission.config.presets` per intero, così patch stantie per chiave di altri
   plugin possono far sparire silenziosamente il livello 自动审查 (o uno integrato).
4. Ricaricare il profilo e verificare con `--list` (sotto).

## Verificare

```sh
# summarize the loaded ruleset (no harness needed)
dsh-perm-gate --rules permissions.yaml --list

# dry-run one call
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

Forma attesa dell'output di `--list`:

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

Nella UI, **Impostazioni → Plugin → 自动审查** dovrebbe mostrare un interruttore più i quattro
interruttori delle strategie di back-end.

## Disinstallare

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Rimuovere il plugin rimuove anche il suo contributo di patch, così il livello 自动审查 scompare
di nuovo dal selettore dei permessi di sessione.

## Risoluzione dei problemi

**Il livello 自动审查 manca nel selettore dei permessi.**
La patch del bundle DSH sostituisce l'intera mappa `permission.config.presets` invece di fare
merge per chiave. Ricaricare il profilo perché `cordis.patch.yml` venga riapplicato, e assicurarsi
che nessun plugin successivo sovrascriva `presets`.

**自动审查（高权限） ha perso la sua icona nel composer.**
Un aggiornamento o una reinstallazione di DSH ha sostituito il bundle host nel quale il glifo era
stato patchato; rilanciare l'installazione del plugin non lo riporterà. Eseguire
`npx dsh-perm-gate-patch-glyph` e ricaricare. Il livello stesso non è toccato — la sua etichetta e
il suo gating continuano a funzionare senza la patch.

**`--list` riporta `ruleCount: 0` anche se il mio file di regole esiste.**
`rulesFile` viene risolto rispetto alla CWD del processo dell'harness, non alla directory del
plugin. Preferire un percorso assoluto o verificare la CWD della shell. Un documento malformato
fallisce rumorosamente al caricamento — non viene mai disattivato in silenzio.

**`llmAssist` non scatta mai.**
Richiede `classifierEndpoint`, `classifierModel` e `classifierApiKey` (impostarli in
**Impostazioni → Plugin → 自动审查** o nel `cordis.yml`). Qualsiasi valore mancante o errore di
rete ricade sul seam umano — il gate è fail-closed per costruzione.

**La scheda Approvals resta vuota.**
Il gate è limitato ai livelli elencati in `gatePresets` (predefinito `['permissive']`), quindi non
registra nulla mentre la sessione gira in un altro livello — scegliere 自动审查 nel selettore dei
permessi della sessione che si vuole registrata. Anche una sessione che non ha mai scelto un
preset è fuori ambito. Le nuove sessioni partono nel livello nominato dall'impostazione
`permission.defaultPreset`.

**La scheda impostazioni mostra "Settings namespace unavailable".**
Il plugin non è assemblato nel profilo attivo. Eseguire
`dsh plugin --profile web add dsh-perm-gate` e ricaricare.

**La selezione di `ja` / `ko` fallisce con `locale "<id>" is not registered`.**
Il DSH ufficiale espone solo `zh` / `en` tramite `LocaleRuntime`. Si veda la nota di compatibilità
nel [README](./README.it.md).

## Licenza

[MIT](./LICENSE)
