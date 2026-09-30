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

> **Note de compatibilité :** la v2.0.0 est livrée avec des dictionnaires `ja` / `ko`, mais le DSH
> officiel n'expose que `zh` / `en` via `LocaleRuntime` (`LOCALE_IDS = ["zh", "en"]`). Sur un DSH
> d'origine, la sélection de `ja` / `ko` échoue avec `locale "<id>" is not registered`. Utilisez un
> fork de DSH qui met à jour `LOCALE_IDS` (locale-settings.ts) et les libellés `LOCALES`
> (client/index.ts), puis recompilez.

> **▼ Compatibilité des versions de DSH**
>
> Deux lignes DSH sont servies depuis deux branches de longue durée, chacune avec sa propre série
> de versions, son `engines.dsh` et son dist-tag npm ([organisation des releases](./RELEASING.md)) :
>
> | Version de DSH | Branche | Version | Tag npm |
> | --- | --- | --- | --- |
> | 0.1.0-rc.7 ~ 0.1.1-rc.x | `legacy` | `1.x` | `@legacy` |
> | 0.1.2-alpha.1+ (incl. 0.1.5-rc.2) | `main` | `2.x` | `@latest` / `@dsh-0.1.2` (`@2.x` est une plage) |
> | 0.2.0-rc.1 (ligne 0.2.0) | `compat/0.2.0` | `5.x` | `@dsh-0.2.0` |
>
> Le numéro de série suit la **ligne DSH** (`1.x` = DSH ≤ 0.1.1, `2.x` = DSH 0.1.2+), et les
> majeures se cloisonnent mutuellement : une installation `^1.x` ne résout jamais une version
> `2.x`, et inversement. `engines.dsh` exprime la même séparation, mais DSH ne le lit jamais —
> ce sont les plages et les dist-tags qui maintiennent un vieux DSH sur `1.x`.
>
> `@deepseek-ai/dsh-client-runtime` a été **supprimé** à partir de `0.1.2-alpha.1` — il n'a pas
> simplement été déplacé. La ligne `legacy` atteint toujours `ctx.slots` à travers lui ; `main`
> obtient la même déclaration depuis `@deepseek-ai/dsh-client-ui-renderer/client`. Deux coutures
> sensibles à la version sont gérées par des sondes de capacité plutôt que par des vérifications
> de version : (1) l'enregistrement des réglages utilise `register`, présent sur les deux lignes
> (`installSection` est un ajout, pas un remplacement) ; (2) `effectivePolicy` est une méthode
> **privée** du service d'approbation utilisateur sur les deux lignes ; elle est donc lue derrière
> une sonde `typeof` et se dégrade en « politique inconnue » lorsqu'elle est absente ou lève une
> erreur.

Version **2.6.0** — voir le [changelog](./CHANGELOG.fr.md).

Un gate de permissions unique, autosuffisant, déterministe d'abord et fail-closed, pour DeepSeek
Harness.

`dsh-perm-gate` tranche chaque appel d'outil selon une chaîne de priorité fixe :

| Étape | Décision | De quoi il s'agit |
| ---- | ---- | ---- |
| **P0** | `deny` | refus dur déterministe : matériau d'identifiants, mutation de chemin protégé, shell dangereux |
| **P1** | `allow` | un **octroi de session** précis et borné |
| **P2** | `deny/allow/ask` | chaîne de règles statique : d'abord la blacklist, puis l'allow, puis l'ask |
| **P3** | `allow/deny/ask` | classificateur sémantique LLM optionnel (**désactivé** par défaut) |
| **P4** | `ask` | seam d'approbation officiel |

Strictement fail-closed : une décision P0 n'est jamais annulée par un octroi, une règle, le
classificateur ou un humain.

## Pourquoi

L'écosystème de sécurité DSH éclate cela entre plusieurs plugins (`dsh-permission-rules`,
`dsh-auto-mode`, `dsh-auto-review`, `dsh-movein-permissions`). `dsh-perm-gate` fusionne le gate +
l'approbation + le classificateur (facultatif) en un seul paquet, avec une seule piste d'audit et
aucun couplage de versions entre plugins.

## Fonctionnalités

- **Liste blanche / liste noire de commandes** — filtrage sur une **décomposition argv** (pas une
  chaîne brute), avec descente récursive dans `sh -c`/`bash -c`, détection de pipelines,
  vérification des cibles de redirection et reconnaissance du récursif/forcé (`rm -rf`).
- **Priorité au deny** — une règle deny correspondante l'emporte sur toute règle allow.
- **Octrois de session** — des octrois précis `(outil, empreinte canonique)` avec `TTL` +
  `maxUses` ; relancer avec une cible différente ne réutilise jamais l'autorité. Les sous-agents
  héritent mais ne peuvent pas en frapper.
- **Moteur de règles à fonctions pures** — compilation glob/regex avec une borne ReDoS, échec
  bruyant sur règle malformée, et cache de compilation par hash de la source.
- **Audit** — chaque décision est journalisée comme un événement `{ignorable:true}` avec son
  `callId` ; la raison visible du modèle correspond au résultat enregistré.
- **Palier 自动审查** (`permissive`, plus `permissive-full`) — un **mode d'approbation
  indépendant** (distinct des paliers lecture seule, accès complet et liste blanche) qui n'est ni
  « auto-approbation » ni confiance aveugle. Le front expose un **interrupteur unique**
  (`permissive`) ; les quatre stratégies backend sont **combinables** et pilotées par les réglages
  du plugin — toujours fail-closed face à P0. Le sélecteur de permissions et la carte de réglages
  l'affichent tous deux sous le libellé produit 自动审查, sans icône. La variante `permissive-full`
  conserve un comportement d'approbation identique mais supprime le bac à sable de fichiers
  intégré, qui sinon refuse les tubes nommés dont `git clone` / Cygwin / ConPTY ont besoin.
- **Réponse automatique aux escalades de sandbox** (`trustEscalation`) — une escalade de sandbox
  est demandée depuis *l'intérieur* du corps de l'outil shell / pwsh / edit, après
  `tools/pre-execute`, si bien que le gate ne l'a jamais vue et qu'un appel qu'il avait
  auto-autorisé vous demandait quand même d'approuver l'élargissement. Avec cette stratégie
  activée, c'est ici qu'est répondue l'exacte requête que le gate avait dégagée (repérée par
  `callId`).
- **`llmAssist` à risque gradué** — un LLM personnalisé compatible OpenAI grade chaque `ask` en
  `safe` / `risky:<catégorie>` ; les catégories dures (suppression, identifiants, distant,
  système, masse) **demandent toujours**, le neutre alimente l'apprentissage des verdicts, et tout
  échec reste fail-closed.
- **Apprentissage des verdicts** — les `ask` à risque neutre que l'humain approuve et qui
  s'exécutent réellement s'accumulent ; passé le seuil, la *même opération exacte* (repérée par
  empreinte) s'auto-autorise.
- **Flux d'événements de décision** — chaque décision est ajoutée à un flux JSONL et remontée par
  la moitié navigateur sous forme de bandeau d'avis au-dessus de la saisie de conversation, plus
  un onglet d'enregistrements d'approbation (du plus récent au plus ancien) dans la vue de
  conversation.

Une **blacklist de mots-clés deny préconfigurée** (héritée des `DEFAULT_DENY_KEYWORDS` de
dsh-approval-gate : `rm -rf`, `push --force`, `drop table`, `mkfs`, `git reset --hard`,
`docker system prune`, …) oppose son veto à tout appel dont le texte contient un mot-clé —
sous-chaîne insensible à la casse, appliquée avant la liste blanche, les octrois et le LLM. Elle
est modifiable sous forme de liste dans la carte de réglages (les entrées préconfigurées sont
étiquetées, et une restauration en un clic ramène le préréglage) ; non définie ou vide, elle
applique le préréglage — la liste noire ne se désactive jamais silencieusement.

## Installation

Nécessite une installation existante de
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

```sh
dsh plugin --profile web add dsh-perm-gate
```

Les étapes complètes d'installation, de mise à niveau, de migration et de dépannage se trouvent
dans le [Guide d'installation](./INSTALL.fr.md) — également disponible en
[English](./INSTALL.md) / [中文](./INSTALL.zh.md) / [日本語](./INSTALL.ja.md) /
[한국어](./INSTALL.ko.md) / [Deutsch](./INSTALL.de.md) / [Italiano](./INSTALL.it.md) /
[Русский](./INSTALL.ru.md) / [Español](./INSTALL.es.md).

## Configuration

Ajoutez le plugin au `cordis.yml` :

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

### Nettoyage des sessions

Au démarrage puis chaque heure, le gate lit le magasin d'espaces de travail de DSH
(`$DSH_HOME/storages/workspace.json`, en lecture seule) et classe chaque session pour laquelle il
détient des données de chaîne d'autorisation. Les sessions que DSH a archivées
(`global.archivedSessionIds`) ou ne suit plus du tout voient leurs événements de décision retirés
de `$DSH_HOME/perm-gate/events.jsonl` et leurs fichiers d'instantanés pré-modification supprimés
de `$DSH_HOME/perm-gate/snapshots/` — de l'historique que la page de revue ne peut plus atteindre,
pour des données que le harnais lui-même considère comme disparues. Les sessions vivantes ne sont
pas touchées, les lignes inattribuables (identifiant de session vide) ne sont jamais supprimées,
et tout échec est fail-open : la passe est ignorée et retentée une heure plus tard. Définissez
`sessionSweep: false` pour désactiver ; `workspaceStoreFile` remplace le chemin du magasin.
Restaurer une session archivée ne restaure pas son historique nettoyé.

### Fichier de règles

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

Une entrée de commande `word#flag` correspond au mot de commande (`word`) avec le modificateur
`recursive` ou `force` — ainsi `rm#recursive` correspond à `rm -rf`, `env rm -rf` et
`sh -c "rm -rf /"`.

### Politique réseau (opt-in)

Un proxy HTTP/CONNECT local qui arbitre le trafic sortant des **sous-processus shell** selon le
même fichier de règles, plus un chemin d'approbation pour les cibles qu'aucune règle ne couvre.
**Désactivé par défaut** — l'activer lie un port loopback et réécrit l'environnement proxy des
processus enfants ; il n'est donc jamais activé implicitement.

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

**Comportement par paliers.** Rien n'atteint le réseau sans règle allow. Une cible non
répertoriée est escaladée vers le seam d'approbation interactif, soulevée au nom de la commande
shell qui a ouvert la connexion ; approuver élargit la portée pour cette cible pendant la session.
Une règle `deny` n'est **jamais** escaladée — l'approbation peut élargir ce qu'une cible non
répertoriée peut atteindre, mais elle ne peut jamais annuler une règle qui dit non.

**La limite — à lire avant de vous y fier.** Le proxy est une couche de politique *coopérative*,
pas une frontière d'application. Il ne voit que le trafic des clients qui lisent l'environnement
proxy :

| Client | Couvert ? |
|--------|----------|
| `curl`, `wget`, `git`, Go `net/http`, Python `requests` | oui |
| **Node.js `http`/`https`/`fetch`** | **non — connexion directe** |
| Java (sans options proxy `-D`), .NET `HttpClient` | non |
| Sockets bruts, TCP personnalisé | non |
| DNS, QUIC/HTTP3, protocoles non HTTP | non |
| Connexions vers une IP littérale | non |

Ainsi une commande shell comme `node -e "require('http').get('http://host/')"` n'est pas
interceptée. Considérez cela comme un garde-fou contre les accidents et un endroit pour exprimer
une intention, pas comme un bac à sable hermétique.

Le trafic réseau **propre** de DSH — les outils réseau intégrés et le transport LLM — est
délibérément laissé de côté. Ces connexions ne portent aucune attribution shell, et
`networkUnattributed: allow` (le défaut) les laisse passer sans revue : les examiner permettrait à
l'hôte de se bloquer *lui-même*, ce qui est un échec pire qu'un blocage manqué. Ne définissez
`networkUnattributed: deny` que si vous savez que les clients de votre hôte ignorent
l'environnement proxy.

Interrogez l'état en direct via `GET /api/dsh-perm-gate/network` (mode, bind, port, vivacité du
proxy, état d'injection d'env, compteurs de blocage, blocages récents).

## Le palier 自动审查 (valeur machine `permissive`)

自动审查 est un **palier d'approbation indépendant** du sélecteur de permissions DSH, parallèle à
Lecture seule / Écriture espace de travail / Accès complet / Liste blanche. Ce n'est **pas** une
« auto-approbation » générique et il ne frappe jamais d'autorité aveugle : il ne fait que
rétrécir ou élargir le seam *avant* l'étape humaine/LLM, tandis que le refus dur P0 reste
monotone et non négociable **dans le périmètre propre du gate**.

> **P0 est délimité, pas global.** Le gate n'agit que lorsque le préréglage de permissions de la
> session est l'un des `gatePresets` (défaut `permissive` / `permissive-full`). Sous tout autre
> préréglage — Lecture seule, Écriture espace de travail ou Accès complet — **tout** le gate se
> retire, refus dur P0 compris, parce que la politique propre au palier sélectionné régit cette
> session. C'est délibéré (voir `gatePresets` dans le tableau de configuration), mais cela
> signifie que « P0 est non négociable » vaut *à l'intérieur* des paliers du gate plutôt qu'à
> travers chaque palier. Un retrait n'est pas silencieux : le gate enregistre un événement
> `stand-down` par transition session/préréglage et le navigateur affiche un bandeau persistant
> **GATE OFF** au-dessus de la saisie. Définissez `gatePresets: ['*']` pour rendre P0 global à
> nouveau.

**Deux variantes sont livrées**, car le `sandbox` et l'`approval` d'un préréglage sont des
réglages indépendants et leur couplage imposait un mauvais compromis :

| Libellé du sélecteur | Valeur machine | sandbox | approval |
|--------------|---------------|---------|----------|
| 自动审查 | `permissive` | `workspace-write` | `ask` |
| 自动审查（高权限） | `permissive-full` | `danger-full-access` | `ask` |

Le palier simple conserve le bac à sable de fichiers intégré. Ce bac à sable refuse aussi les
tubes nommés dont un processus enfant a besoin pour démarrer, si bien que `git clone`, le
`sh.exe` MSYS2/Cygwin et ConPTY échouent dessous avec `Win32 error 5` /
`couldn't create signal pipe`. Le gate n'étant actif **que** dans les paliers listés dans
`gatePresets`, vouloir le gate impliquait d'accepter cette restriction. 自动审查（高权限）
supprime le couplage : comportement d'approbation identique, sans restriction de bac à sable de
fichiers. La description propre du palier énonce le compromis sans détour — le flux de travail
est plus fluide, les approbations s'appliquent toujours par appel, mais il ne reste **aucun bac à
sable système en filet de secours**. Les deux sont dans les `gatePresets` par défaut ; l'un comme
l'autre vous donne la chaîne complète P0–P4 — le gate ne lit que le **nom** du préréglage, jamais
le mode de sandbox.

Le libellé du sélecteur est une **chaîne produit fournie par l'hôte**, pas une entrée de
dictionnaire par locale : DSH rend verbatim le `name:` du palier d'un plugin sur les deux
surfaces de permission (la ligne par défaut des réglages généraux et le sélecteur du composer) et
ne fournit ses propres libellés localisés que pour les trois valeurs intégrées ;
`cordis.patch.yml` livre donc le libellé chinois pour chaque session.

**L'icône** est une autre histoire. La table de glyphes du composer est fermée et son propre
commentaire énonce la règle : *host-configured names outside the design set get none.*
`permissive` est une valeur intégrée, donc 自动审查 a déjà un glyphe bouclier+œil ;
`permissive-full` ne reçoit le même glyphe que parce que `npx dsh-perm-gate-patch-glyph` l'ajoute
à cette table. Ce patch modifie un paquet **hôte**, il se perd donc à chaque mise à niveau de
DSH — voir [Après une mise à niveau de DSH](./INSTALL.fr.md).

Dans `cordis.yml` :

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

`trustAutoAllow` est le palier intermédiaire de base (une règle allow passe automatiquement).
`alwaysConfirm` affiche le panneau d'approbation à chaque franchissement ; ses « contrôles allow »
ajoutent deux boutons étendus — **ré-autoriser ce type pour cette session** (un octroi de session
borné) et **autoriser chaque occurrence** (qui persiste le mot de commande dans la liste blanche
`allow` du `permissions.yaml` via `approveAllowEverywhere`). `llmAssist` consulte un vrai LLM
configurable (`classifierEndpoint` / `classifierModel`, toute API compatible OpenAI) pour trancher
automatiquement un `ask`, et retombe sur le seam humain en cas d'`ask`/erreur — toujours
fail-closed. `trustEscalation` (actif par défaut quand le palier l'est) répond à une escalade
`sandbox_permissions` soulevée depuis l'intérieur d'un appel que le gate a déjà autorisé ; voir
ci-dessous. Quand `permissive` est désactivé, le gate se comporte exactement comme avant.

### Escalade de sandbox : pourquoi un verdict `safe` provoquait quand même une invite

Un appel d'outil peut soulever **deux approbations indépendantes**. Le gate possède la première —
son propre `ask`, sur la cascade `tools/pre-execute`. La seconde vient d'`approveEscalation`
**dans le corps de l'outil**, au moment de `tools/execute`, chaque fois que le modèle a transmis
`sandbox_permissions` + `justification` ; à ce stade, `tools/pre-execute` est déjà tranché, si
bien que l'allow du gate ne l'atteint jamais. Un appel que le LLM avait gradé `safe` et que le
gate avait auto-autorisé affichait donc quand même une invite demandant d'approuver
l'élargissement de sandbox.

`trustEscalation` comble ce fossé. Le gate se souvient de chaque appel qu'il a positivement
autorisé (indexé par le `callId` de l'hôte, que la requête d'escalade répète) et répond lui-même
à l'escalade `allowed-once`. Elle ne s'applique que si **tout** est réuni :

- le palier 自动审查 est actif et `trustEscalation` est activé ;
- la requête porte un `callId` que le gate a dégagé, avec un nom d'outil correspondant ;
- la raison est une escalade reconnue nommant `workspace-write` ou `danger-full-access`.

Tout le reste — une raison non reconnue, un autre appel, un appel que le gate a demandé ou
refusé, le passe-plat `approval: never` — est délégué à l'humain à l'identique, si bien qu'un
futur changement de formulation de DSH échoue fermé plutôt qu'ouvert. La réponse automatique est
enregistrée sur le flux d'événements (`verdict: "escalation-auto"`, `mode: <cible>`). Désactivez
l'interrupteur pour garder l'élargissement de sandbox sous contrôle humain pendant que les autres
allows restent automatiques.

### llmAssist à risque gradué, apprentissage des verdicts et flux d'événements

Quand `llmAssist` est actif, le LLM configuré grade un `ask` à la fois selon un protocole
structuré. La notation se fait **dans la cascade `tools/pre-execute` du gate, avant que la
décision ne soit renvoyée à l'hôte** : un verdict `safe` délègue l'appel directement, si bien que
le panneau d'approbation n'apparaît jamais ; seul un verdict réellement incertain vous parvient.
Deux sources de récepteur sont sélectionnables dans la carte de réglages : une **API
personnalisée** (tout endpoint compatible OpenAI — `classifierEndpoint` / `classifierModel` /
`classifierApiKey`, avec des préréglages dont Xiaomi MiMo `https://api.xiaomimimo.com/v1`), ou le
**groupe de modèles hôte DSH** (le service `llm` configuré de la session, via
`agentDefaultModel.currentSelection`, avec possibilité de le remplacer par `classifierProvider` /
`classifierModel`). Un bouton de **test de santé** (`POST /api/dsh-perm-gate/health`) exécute une
complétion minimale et rapporte la latence.

- `safe` → l'appel est auto-autorisé (audité comme source `classifier`) ; aucun panneau n'est
  affiché.
- `risky` + une **catégorie dure** (`deletion`, `credential`, `remote`, `system`, `bulk`) →
  l'appel **conserve l'ask humain**. Le classificateur **ne refuse jamais** : le chemin de deny
  appartient aux seules couches déterministes (refus dur P0, blacklist de mots-clés deny, règles
  `deny:` explicites), si bien qu'une catégorie mal gradée reste toujours négociable au lieu d'un
  blocage sans recours. Les catégories dures restent distinctes de `neutral` d'une manière qui
  compte : elles ne sont **jamais apprises**, si bien que des approbations humaines répétées ne
  peuvent jamais les sédimenter en auto-allow.
  (Refuser sur la parole du modèle a été mesuré en conditions réelles : un bénin
  `git commit -F …` gradé `remote` a produit un auto-deny sans panneau et sans octroi pour
  retenter.)
- `risky:neutral` → avec `riskLearning` activé (carte Réglages, désactivé par défaut), chaque
  approbation humaine réellement exécutée (solde via l'événement `tools/result` de l'hôte) compte
  pour une clé `outil|catégorie` ; dès que le compte atteint `riskThreshold` (défaut 3) **et** que
  l'empreinte d'opération (mot de commande + basename de la cible) du nouvel appel correspond à un
  échantillon confirmé, la même opération exacte s'auto-autorise. Une cible différente ne réutilise
  jamais cette autorité. Avec la sédimentation (`riskSediment`, actif par défaut), les échantillons
  confirmés d'une clé au seuil deviennent des **règles allow déterministes** : une correspondance
  exacte autorise net, sans nouvel appel LLM — même avec `llmAssist` désactivé — et les règles
  sédimentées sont visibles et gérables (terminer / supprimer) dans la carte de réglages.
- Les dépassements de délai (`riskTimeoutMs`, défaut 20 s, une seule nouvelle tentative), les
  échecs de transport et les sorties hors protocole laissent l'ask intact — le gate ne devine
  jamais.

L'état d'apprentissage persiste dans un JSON possédé par le plugin
(`$DSH_HOME/perm-gate/learning.json`, ou `learningFile`), jamais dans votre fichier de règles
YAML. Chaque décision est ajoutée à `$DSH_HOME/perm-gate/events.jsonl` (ou `eventsFile`) et servie
à `GET /api/dsh-perm-gate/events?sessionId=&since=` ; la moitié navigateur l'interroge et affiche
la dernière décision en bandeau d'avis au-dessus de la saisie de conversation (les asks restent
visibles jusqu'à l'événement suivant) et liste toutes les décisions de la session, de la plus
récente à la plus ancienne, dans l'onglet **Approbations** de la vue de conversation.

Les fichiers affectés de chaque décision sont copiés en instantanés avant que la modification
n'atterrisse (≤ 5 fichiers, ≤ 256 Ko chacun) sous `$DSH_HOME/perm-gate/snapshots/` ; dans l'onglet
**Approbations**, chaque pastille de fichier ouvre un diff de lignes
(`GET /api/dsh-perm-gate/diff`) avec une action de **revert** qui délivre une instruction de
restauration dans la conversation (`POST /api/dsh-perm-gate/revert`). Une barre d'inventaire des
instantanés les efface par session ou entièrement (`GET /api/dsh-perm-gate/snapshots-stats` /
`POST /api/dsh-perm-gate/snapshots-clear`).

Un `ask` que le gate route vers un humain est suivi jusqu'à la réponse de l'humain : un
observateur passif `approval/request` enregistre l'issue close (`allowed-once` → **approuvé**,
`rejected` → **rejeté**, `cancelled` → **annulé**, `unavailable` → un refus, puisqu'aucun canal
d'approbation n'existait), avec `tools/result` qui solde le même ask en secours lorsque
l'observateur ne peut pas le corréler. Les approbations rapportent la progression d'apprentissage
post-approbation (`n`/seuil), et le bandeau d'avis étiquette les trois états terminaux.

自动审查 et 自动审查（高权限） dessinent toutes deux le glyphe bouclier+œil dans le sélecteur —
la première depuis la table intégrée de DSH, la seconde depuis le patch hôte que décrit le guide
d'installation. Sans ce patch, le second palier est en texte seul sur toutes les surfaces ; son
libellé et son filtrage ne sont pas affectés.

### Un palier de session sélectionnable

`cordis.patch.yml` ajoute un préréglage `permissive` (`sandbox: workspace-write`,
`approval: ask`, nom **自动审查**) entre Écriture espace de travail et Accès complet. Le patch de
bundle DSH remplace toute la table `permission.config.presets` au lieu de fusionner par clé, si
bien que le fichier réénonce aussi les trois intégrés (`read-only` / `workspace-write` /
`danger-full-access`, issus de `@deepseek-ai/dsh-base/cordis.patch.yml`) ;
`test/patch-presets.spec.ts` épingle ce jeu de clés. Ainsi, le sélecteur de permissions de session
propose 自动审查 comme palier d'approbation indépendant sélectionnable, et non un mode générique
d'« auto-approbation ».

Le gate n'est actif **que dans les paliers listés dans `gatePresets`** (défaut
`['permissive', 'permissive-full']`, les deux paliers qu'ajoute ce plugin). Dans tout autre
palier — Lecture seule, Écriture espace de travail, Accès complet, `custom` — le flux de décision
du gate ne s'exécute pas du tout : aucun allow, aucun ask, aucun deny, aucun refus dur P0, aucun
veto de mot-clé deny, aucun événement d'audit. La politique propre au palier sélectionné régit
l'appel, et c'est le propos : le `danger-full-access` intégré est défini comme « accès complet
sans invites d'approbation », donc le contourner par un ask (auquel on ne peut répondre là-bas —
le seam d'approbation refuse avant que le moindre répondant ne s'exécute, produisant
`the user rejected tool "..."` sans panneau) ou par un refus dur contredirait silencieusement le
palier choisi par l'utilisateur. `gatePresets: ['*']` rend le gate global à nouveau (refus dur
compris) ; à l'intérieur d'un palier actif, un `ask` est toujours dégradé en passe-plat lorsque
la politique d'approbation effective de la session est `never` — voilà pourquoi les deux paliers
自动审查 déclarent `approval: ask`.

### Configurable dans l'interface

Le palier est également ajustable à l'exécution depuis **Réglages → Plugins → 自动审查** (une
page `settings.plugins.tab` rendue par le client navigateur du plugin) : un interrupteur bascule
`permissive`, et quatre bascules éditent les `permissiveStrategies` backend. L'hôte lit l'espace
de noms en direct, si bien qu'un changement s'applique à l'appel d'outil suivant sans redémarrage.
C'est une classe d'approbation indépendante, PAS un mode générique d'« auto-approbation ».

### Test de règle (dry-run)

La même page embarque un panneau de **test de règle** : saisissez un nom d'outil et une commande,
appuyez sur Tester, et le gate juge cet appel au regard du jeu de règles qu'il a actuellement
chargé — sans rien exécuter et sans écrire aucune règle. Vous obtenez le verdict, la règle
correspondante (index et action), les dimensions que cette règle contraint, et la raison.

Il rapporte à la fois le verdict effectif (toute la chaîne P0 → P1 → P2 → P3 → P4) *et* la
réponse propre de la couche de règles, qui ne sont pas la même chose : un refus dur P0 ou un
mot-clé deny de préréglage se déclenche avant la chaîne de règles et ne laisse aucun index de
règle derrière lui, si bien que le panneau dit « aucune règle correspondante » plutôt que de
nommer une règle sans rapport. Une note « 0 règles chargées » signifie que le chemin `rulesFile`
n'a résolu aucun fichier.

Le panneau communique avec `POST /api/dsh-perm-gate/dry-run`, qui est **en lecture seule par
construction** — il n'a aucune forme d'écriture, si bien que tester une règle ne peut jamais la
modifier.

## CLI

Dry-run d'un appel contre un fichier de règles (sans harnais) :

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
```

## Développement

```sh
npm run typecheck
npm test
npm run build
```

## Licence

[MIT](./LICENSE)
