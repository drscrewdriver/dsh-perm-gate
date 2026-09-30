# Installationsanleitung

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

`dsh-perm-gate` Version **2.4.1**. Weiter mit dem [README](./README.de.md) für die
Entscheidungskette, das Format der Regeldatei und die 自动审查-Stufe.

## Voraussetzungen

- Eine bestehende
  [DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness)-Installation.
- Node.js **>= 20** (siehe `engines` in `package.json`).
- Die `dsh`-CLI in Ihrem `PATH`.
- Ein Profil, in das installiert wird — die Browser-Hälfte wird nur für das `web`-Profil
  ausgeliefert (`dsh.client.platform = "web"` in `package.json`).

## Den Tag für Ihre DSH-Version wählen

Ein Build bedient beide DSH-Linien, also installiert jeder der beiden Tags funktionierenden
Code — der Tag existiert, damit eine gepinnte Version pro Linie aussagekräftig bleibt.

| Ihr DSH | Installation |
|----------|---------|
| `0.1.2-alpha.1` oder neuer (inkl. `0.1.5-rc.2`) | `dsh plugin --profile web add dsh-perm-gate` (Tag `latest`) |
| bis `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH erzwingt `engines.dsh` nicht, daher sind die Tags der Auswahlmechanismus statt eines
Kompatibilitäts-Tores. Siehe [RELEASING.md](./RELEASING.md), warum ein Artefakt beide Linien
abdeckt und wie die Tags veröffentlicht werden.

## Mit der offiziellen CLI installieren

```sh
dsh plugin --profile web add dsh-perm-gate
```

Damit wird das veröffentlichte Paket gezogen, seine `cordis.patch.yml` angewandt (die
自动审查-Sitzungsstufe plus der Plugin-Eintrag) und beide Hälften zusammengesetzt.

## Aus dem Quellcode installieren

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` ist auch der `prepublishOnly`-Schritt, sodass eine Veröffentlichung nie ein
veraltetes `lib/` ausliefert.

## Aktivieren und konfigurieren

Fügen Sie das Plugin in die `cordis.yml` Ihres Profils ein:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # tiers where the gate is active at all (default)
```

Beginnen Sie mit
[examples/permissions.example.yaml](./examples/permissions.example.yaml) und laden Sie dann das
Profil neu.

## Upgrade

```sh
dsh plugin --profile web update dsh-perm-gate
```

Danach das Profil erneut anwenden, damit die Patch-Datei neu gelesen wird:

```sh
dsh profile reload --profile web
```

## Nach einem **DSH**-Upgrade: den Composer-Glyph-Patch erneut anwenden

Die 自动审查（高权限）-Stufe zeigt nur deshalb dasselbe Schild+Auge-Glyph wie 自动审查, weil
`scripts/patch-permission-glyph.mjs` es in eine **geschlossene Map innerhalb eines
DSH-Host-Pakets** eingetragen hat. DSH gibt von Host konfigurierten Stufen bewusst kein Glyph —
der Kommentar der Map selbst lautet *„host-configured names outside the design set get none“* —
und die Optionsobjekte, die ein Plugin beeinflussen kann, tragen nur
`{value, name, description}`; es gibt also keine Plugin-seitige Naht als Alternative.

Dieser Patch editiert eine **Host**-Datei; ein DSH-Upgrade oder eine Neuinstallation löscht ihn.
Ein Upgrade *dieses Plugins* tut das nicht: Das Plugin besaß das Glyph nie, und sein eigener
Beitrag (`name:` / `description:` in `cordis.patch.yml`) reist im Paket mit.

```sh
npx dsh-perm-gate-patch-glyph            # apply the patch
npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is gone
dsh profile reload --profile web
```

Das Skript **liegt in diesem Paket bei** — als `scripts/patch-permission-glyph.mjs` und als das
Bin `dsh-perm-gate-patch-glyph` — daher ist kein Source-Checkout nötig. Es ist bewusst **nicht**
an `postinstall` gekoppelt: Es editiert ein Host-Paket, und ein Plugin darf seinen Harness nicht
ungefragt umschreiben. Ein laufendes DSH bleibt in beiden Fällen unberührt; die Stufe
funktioniert mit oder ohne ihn.

Er ist idempotent (ein zweiter Lauf ist ein No-op), sichert das Bundle einmalig und weigert sich,
ein falsch geschnittenes Bundle zu schreiben — er führt `node --check` über das Ergebnis aus und
stellt bei einem Fehlschlag das Backup wieder her — daher darf er nach jedem DSH-Upgrade
bedingungslos laufen. Er findet das Bundle über die laufende `node`-Binärdatei, sodass ein
nvm-Versionswechsel oder ein umgebogener Installations-Symlink ihn nicht bricht.

**Die Neuinstallation des Plugins stellt das Glyph nicht wieder her.** `dsh plugin --profile web
add …` leitet an pnpm innerhalb des Profilordners weiter und schreibt nur das `node_modules` des
Profils selbst; `-w` (`--workspace-root`, und der Workspace dieses Profils ist nur
`packages: ['.']`) ändert daran nichts. Das Glyph lebt in der DSH-Installation. Bei einer
standardmäßigen Installation sind das nicht drei Kopien, sondern **eine physische Datei**:

| Pfad | Was es ist |
|------|------------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | die DSH-Installation (kann ein Symlink sein) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | eine **Junction** dorthin |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | die gepatchte Datei |

Symptom, auf das zu achten ist: Die Stufe funktioniert weiter und gatet korrekt, aber ihre Zeile
im Composer-Dropdown hat kein Icon, und der eingeklappte Auslöser rendert reinen Text, wo die
anderen Stufen Glyph + Text rendern.

## Von den aufgeteilten Plugins migrieren

`dsh-perm-gate` führt Gate, Approval-Naht und den (optionalen) Klassifikator zusammen, die zuvor
über `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review` und `dsh-movein-permissions`
verteilt waren.

1. Exportieren Sie Ihre bestehenden Regellisten (deny / allow / ask) und führen Sie sie in einem
   einzigen `permissions.yaml`-Dokument zusammen.
2. Entfernen Sie die vier Plugins aus der `cordis.yml` und fügen Sie den einzelnen
   `dsh-perm-gate`-Eintrag von oben hinzu.
3. Löschen Sie alle Preset-Overrides, die diese Plugins beisteuerten — `cordis.patch.yml`
   **ersetzt** `permission.config.presets` als Ganzes, sodass veraltete Per-Key-Patches anderer
   Plugins stillschweigend die 自动审查-Stufe (oder eine eingebaute) fallen lassen können.
4. Laden Sie das Profil neu und prüfen Sie mit `--list` (unten).

## Verifizieren

```sh
# summarize the loaded ruleset (no harness needed)
dsh-perm-gate --rules permissions.yaml --list

# dry-run one call
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

Erwartete Ausgabeform von `--list`:

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

In der UI sollten unter **Einstellungen → Plugins → 自动审查** ein Schalter plus die vier
Backend-Strategie-Schalter erscheinen.

## Deinstallieren

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Beim Entfernen des Plugins verschwindet auch sein Patch-Beitrag, sodass die 自动审查-Stufe aus
dem Berechtigungs-Picker der Sitzung wieder verschwindet.

## Fehlerbehebung

**Die 自动审查-Stufe fehlt im Berechtigungs-Picker.**
Der DSH-Bundle-Patch ersetzt die ganze `permission.config.presets`-Map, statt per Schlüssel zu
mergen. Laden Sie das Profil neu, damit `cordis.patch.yml` erneut angewandt wird, und stellen Sie
sicher, dass kein späteres Plugin `presets` überschreibt.

**自动审查（高权限） hat sein Icon im Composer verloren.**
Ein DSH-Upgrade oder eine Neuinstallation hat das Host-Bundle ersetzt, in das das Glyph gepatcht
war; eine erneute Plugin-Installation holt es nicht zurück. Führen Sie
`npx dsh-perm-gate-patch-glyph` aus und laden Sie neu. Die Stufe selbst ist unberührt — Label und
Gate-Verhalten funktionieren ohne den Patch weiter.

**`--list` meldet `ruleCount: 0`, obwohl meine Regeldatei existiert.**
`rulesFile` wird gegen den Prozess-CWD des Harness aufgelöst, nicht gegen das
Plugin-Verzeichnis. Bevorzugen Sie einen absoluten Pfad oder prüfen Sie den Shell-CWD. Ein
fehlerhaftes Dokument schlägt beim Laden laut fehl — es wird nie still deaktiviert.

**`llmAssist` greift nie.**
Es braucht `classifierEndpoint`, `classifierModel` und `classifierApiKey` (setzen Sie sie in
**Einstellungen → Plugins → 自动审查** oder in der `cordis.yml`). Jeder fehlende Wert oder
Netzwerkfehler fällt auf die menschliche Naht zurück — das Gate ist by Design fail-closed.

**Der Approvals-Tab bleibt leer.**
Das Gate ist auf die in `gatePresets` gelisteten Stufen beschränkt (Default `['permissive']`);
solange die Sitzung in einer anderen Stufe läuft, zeichnet es nichts auf — wählen Sie 自动审查 im
Berechtigungs-Picker der Sitzung, die Sie aufgezeichnet haben wollen. Eine Sitzung, die nie einen
Preset gewählt hat, ist ebenfalls außerhalb. Neue Sitzungen starten in der Stufe, die die
Einstellung `permission.defaultPreset` benennt.

**Die Einstellungskarte zeigt „Settings namespace unavailable“.**
Das Plugin ist nicht in das aktive Profil zusammengesetzt. Führen Sie
`dsh plugin --profile web add dsh-perm-gate` aus und laden Sie neu.

**Die Auswahl von `ja` / `ko` schlägt fehl mit `locale "<id>" is not registered`.**
Das offizielle DSH stellt über `LocaleRuntime` nur `zh` / `en` bereit. Siehe den
Kompatibilitätshinweis im [README](./README.de.md).

## Lizenz

[MIT](./LICENSE)
