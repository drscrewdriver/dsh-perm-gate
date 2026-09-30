# Guide d'installation

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

`dsh-perm-gate` version **2.4.1**. Poursuivez avec le [README](./README.fr.md) pour la
chaîne de décision, le format du fichier de règles et le palier 自动审查.

## Prérequis

- Une installation existante de
  [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
- Node.js **>= 20** (voir `engines` dans `package.json`).
- La CLI `dsh` dans votre `PATH`.
- Un profil dans lequel installer — la moitié navigateur n'est livrée que pour le profil `web`
  (`dsh.client.platform = "web"` dans `package.json`).

## Choisir le tag selon votre version de DSH

Un seul build sert les deux lignes DSH ; l'un ou l'autre tag installe donc du code fonctionnel —
le tag existe pour qu'une version épinglée reste significative par ligne.

| Votre DSH | Installation |
|----------|---------|
| `0.1.2-alpha.1` ou plus récent (incl. `0.1.5-rc.2`) | `dsh plugin --profile web add dsh-perm-gate` (tag `latest`) |
| jusqu'à `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH n'applique pas `engines.dsh` ; les tags sont donc le mécanisme de sélection plutôt qu'un
garde-fou de compatibilité. Voir [RELEASING.md](./RELEASING.md) pour savoir pourquoi un artefact
couvre les deux lignes et comment les tags sont publiés.

## Installer avec la CLI officielle

```sh
dsh plugin --profile web add dsh-perm-gate
```

Cela récupère le paquet publié, applique son `cordis.patch.yml` (le palier de session
自动审查 plus l'entrée du plugin) et assemble les deux moitiés.

## Installer depuis les sources

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` est aussi l'étape `prepublishOnly`, donc une publication ne livre jamais un
`lib/` périmé.

## Activer et configurer

Ajoutez le plugin au `cordis.yml` de votre profil :

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # tiers where the gate is active at all (default)
```

Partez de [examples/permissions.example.yaml](./examples/permissions.example.yaml), puis
rechargez le profil.

## Mettre à niveau

```sh
dsh plugin --profile web update dsh-perm-gate
```

Puis ré-appliquez le profil pour que le fichier de patch soit relu :

```sh
dsh profile reload --profile web
```

## Après une mise à niveau de **DSH** : ré-appliquer le patch de glyphe du composer

Le palier 自动审查（高权限） affiche le même glyphe bouclier+œil que 自动审查 uniquement parce que
`scripts/patch-permission-glyph.mjs` l'a ajouté à une **table fermée à l'intérieur d'un paquet
hôte de DSH**. DSH n'attribue par conception aucun glyphe aux paliers configurés par l'hôte — le
commentaire propre de la table dit *« host-configured names outside the design set get none »* —
et les objets d'option qu'un plugin peut influencer ne portent que `{value, name, description}` ;
il n'existe donc aucune couture côté plugin à utiliser à la place.

Ce patch modifie un fichier **hôte** ; une mise à niveau ou une réinstallation de DSH l'efface.
Mettre à niveau *ce plugin* ne l'efface pas : le plugin n'a jamais possédé le glyphe, et sa
propre contribution (`name:` / `description:` dans `cordis.patch.yml`) voyage dans le paquet.

```sh
npx dsh-perm-gate-patch-glyph            # apply the patch
npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is gone
dsh profile reload --profile web
```

Le script **voyage dans ce paquet** — comme `scripts/patch-permission-glyph.mjs` et comme le bin
`dsh-perm-gate-patch-glyph` — donc aucun checkout des sources n'est nécessaire. Il est
délibérément **pas** branché sur `postinstall` : il modifie un paquet hôte, et un plugin ne doit
pas réécrire son harnais sans y être invité. DSH en cours d'exécution n'est affecté ni dans un
cas ni dans l'autre ; le palier fonctionne avec ou sans lui.

Il est idempotent (un second passage est un no-op), sauvegarde le bundle une fois, et refuse
d'écrire un bundle mal découpé — il exécute `node --check` sur le résultat et restaure la
sauvegarde si cela échoue — donc il peut être lancé sans condition après chaque mise à niveau de
DSH. Il localise le bundle depuis le binaire `node` en cours d'exécution ; un changement de
version nvm ou un symlink d'installation repointé ne le casse pas.

**Réinstaller le plugin ne restaure pas le glyphe.** `dsh plugin --profile web add …`
transfère vers pnpm à l'intérieur du répertoire du profil et n'écrit que le `node_modules` propre
au profil ; `-w` (`--workspace-root`, et le workspace de ce profil est juste `packages: ['.']`)
n'y change rien. Le glyphe vit dans l'installation DSH. Sur une installation d'origine, ce ne
sont pas trois copies mais **un seul fichier physique** :

| Chemin | Ce que c'est |
|------|------------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | l'installation DSH (peut être un symlink) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | une **jonction** vers elle |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | le fichier patché |

Symptôme à repérer : le palier fonctionne toujours et filtre toujours correctement, mais sa ligne
dans la liste déroulante du composer n'a pas d'icône et le déclencheur replié rend du texte brut
là où les autres paliers rendent glyphe + texte.

## Migrer depuis les plugins séparés

`dsh-perm-gate` fusionne le gate, le seam d'approbation et le classificateur (facultatif) qui
vivaient auparavant à travers `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review` et
`dsh-movein-permissions`.

1. Exportez vos listes de règles existantes (deny / allow / ask) et fusionnez-les en un seul
   document `permissions.yaml`.
2. Retirez les quatre plugins du `cordis.yml` et ajoutez l'unique entrée `dsh-perm-gate`
   ci-dessus.
3. Supprimez tout dépassement de préréglage que ces plugins apportaient — `cordis.patch.yml`
   **remplace** `permission.config.presets` en bloc, si bien que des patches périmés par clé
   d'autres plugins peuvent faire disparaître silencieusement le palier 自动审查 (ou un palier
   intégré).
4. Rechargez le profil et vérifiez avec `--list` (ci-dessous).

## Vérifier

```sh
# summarize the loaded ruleset (no harness needed)
dsh-perm-gate --rules permissions.yaml --list

# dry-run one call
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

Forme attendue de la sortie de `--list` :

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

Dans l'interface, **Réglages → Plugins → 自动审查** doit afficher un interrupteur plus les quatre
bascules de stratégie backend.

## Désinstaller

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Retirer le plugin retire aussi sa contribution de patch, si bien que le palier 自动审查
disparaît à nouveau du sélecteur de permissions de session.

## Dépannage

**Le palier 自动审查 est absent du sélecteur de permissions.**
Le patch de bundle DSH remplace toute la table `permission.config.presets` au lieu de fusionner
par clé. Rechargez le profil pour que `cordis.patch.yml` soit ré-appliqué, et assurez-vous
qu'aucun plugin ultérieur n'écrase `presets`.

**自动审查（高权限） a perdu son icône dans le composer.**
Une mise à niveau ou une réinstallation de DSH a remplacé le bundle hôte dans lequel le glyphe
avait été patché ; relancer l'installation du plugin ne le ramènera pas. Exécutez
`npx dsh-perm-gate-patch-glyph` et rechargez. Le palier lui-même n'est pas affecté — son libellé
et son filtrage continuent de fonctionner sans le patch.

**`--list` rapporte `ruleCount: 0` alors que mon fichier de règles existe.**
`rulesFile` est résolu par rapport au CWD du processus du harnais, pas au répertoire du plugin.
Préférez un chemin absolu ou vérifiez le CWD du shell. Un document malformé échoue bruyamment au
chargement — il n'est jamais désactivé en silence.

**`llmAssist` ne se déclenche jamais.**
Il requiert `classifierEndpoint`, `classifierModel` et `classifierApiKey` (à définir dans
**Réglages → Plugins → 自动审查** ou dans `cordis.yml`). Toute valeur manquante ou erreur réseau
retombe sur le seam humain — le gate est fail-closed par conception.

**L'onglet Approbations reste vide.**
Le gate est limité aux paliers listés dans `gatePresets` (défaut `['permissive']`) ; il ne
n'enregistre donc rien tant que la session tourne sur un autre palier — choisissez 自动审查 dans
le sélecteur de permissions de la session que vous voulez voir enregistrée. Une session qui n'a
jamais choisi de préréglage est hors périmètre aussi. Les nouvelles sessions démarrent sur le
palier nommé par le réglage `permission.defaultPreset`.

**La carte de réglages affiche « Settings namespace unavailable ».**
Le plugin n'est pas assemblé dans le profil actif. Exécutez
`dsh plugin --profile web add dsh-perm-gate` et rechargez.

**La sélection de `ja` / `ko` échoue avec `locale "<id>" is not registered`.**
Le DSH officiel n'expose que `zh` / `en` via `LocaleRuntime`. Voir la note de compatibilité du
[README](./README.fr.md).

## Licence

[MIT](./LICENSE)
