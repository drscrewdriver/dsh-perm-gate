# Guía de instalación

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

`dsh-perm-gate` versión **2.4.1**. Continúe con el [README](./README.es.md) para la
cadena de decisión, el formato del fichero de reglas y el nivel 自动审查.

## Requisitos

- Una instalación existente de
  [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
- Node.js **>= 20** (véase `engines` en `package.json`).
- La CLI `dsh` en su `PATH`.
- Un perfil donde instalar — la mitad de navegador solo se envía para el perfil `web`
  (`dsh.client.platform = "web"` en `package.json`).

## Elija el tag para su versión de DSH

Una única compilación sirve a ambas líneas de DSH, así que cualquiera de los dos tags instala
código funcional — el tag existe para que una versión fijada siga siendo significativa por línea.

| Su DSH | Instalación |
|----------|---------|
| `0.1.2-alpha.1` o más nuevo (incl. `0.1.5-rc.2`) | `dsh plugin --profile web add dsh-perm-gate` (tag `latest`) |
| hasta `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH no impone `engines.dsh`, así que los tags son el mecanismo de selección en lugar de una valla
de compatibilidad. Véase [RELEASING.md](./RELEASING.md) para saber por qué un artefato cubre
ambas líneas y cómo se publican los tags.

## Instalar con la CLI oficial

```sh
dsh plugin --profile web add dsh-perm-gate
```

Esto trae el paquete publicado, aplica su `cordis.patch.yml` (el nivel de sesión 自动审查 más la
entrada del plugin) y ensambla ambas mitades.

## Instalar desde el código fuente

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` es también el paso `prepublishOnly`, de modo que publicar nunca envía un `lib/`
obsoleto.

## Activar y configurar

Añada el plugin al `cordis.yml` de su perfil:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # tiers where the gate is active at all (default)
```

Parta de
[examples/permissions.example.yaml](./examples/permissions.example.yaml) y después recargue el
perfil.

## Actualizar

```sh
dsh plugin --profile web update dsh-perm-gate
```

Después vuelva a aplicar el perfil para que el fichero de parche se relea:

```sh
dsh profile reload --profile web
```

## Tras una actualización de **DSH**: vuelva a aplicar el parche de glifo del composer

El nivel 自动审查（高权限） muestra el mismo glifo escudo+ojo que 自动审查 solo porque
`scripts/patch-permission-glyph.mjs` lo añadió a un **mapa cerrado dentro de un paquete host de
DSH**. DSH no da por diseño ningún glifo a los niveles configurados por el host — el comentario
del propio mapa dice *«host-configured names outside the design set get none»* — y los objetos de
opción que un plugin puede influir llevan solo `{value, name, description}`; no existe, pues,
ninguna costura del lado del plugin que usar en su lugar.

Ese parche edita un fichero **del host**, así que una actualización o reinstalación de DSH lo
borra. Actualizar *este plugin* no lo borra: el plugin nunca poseyó el glifo, y su propia
contribución (`name:` / `description:` en `cordis.patch.yml`) viaja dentro del paquete.

```sh
npx dsh-perm-gate-patch-glyph            # apply the patch
npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is gone
dsh profile reload --profile web
```

El script **viaja dentro de este paquete** — como `scripts/patch-permission-glyph.mjs` y como el
bin `dsh-perm-gate-patch-glyph` — así que no hace falta un checkout del código fuente.
Deliberadamente **no** está cableado a `postinstall`: edita un paquete host, y un plugin no debe
reescribir su harness sin ser invitado. Un DSH en ejecución no se ve afectado en ningún caso; el
nivel funciona con o sin él.

Es idempotente (una segunda ejecución es un no-op), respalda el bundle una vez y se niega a
escribir un bundle mal troceado — ejecuta `node --check` sobre el resultado y restaura la copia
de seguridad si falla — así que es seguro ejecutarlo incondicionalmente tras cada actualización
de DSH. Localiza el bundle a partir del binario `node` en ejecución, así que un cambio de versión
de nvm o un symlink de instalación reorientado no lo rompen.

**Reinstalar el plugin no restaura el glifo.** `dsh plugin --profile web add …` reenvía a pnpm
dentro del directorio del perfil y escribe solo el `node_modules` del propio perfil; `-w`
(`--workspace-root`, y el workspace de este perfil es solo `packages: ['.']`) no cambia nada de
eso. El glifo vive en la instalación de DSH. En una instalación estándar no son tres copias sino
**un único fichero físico**:

| Ruta | Qué es |
|------|------------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | la instalación de DSH (puede ser un symlink) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | una **junction** hacia ella |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | el fichero parcheado |

Síntoma que buscar: el nivel sigue funcionando y sigue controlando correctamente, pero su fila en
el desplegable del composer no tiene icono y el disparador colapsado renderiza texto plano donde
los demás niveles renderizan glifo + texto.

## Migrar desde los plugins separados

`dsh-perm-gate` fusiona la puerta, el seam de aprobación y el clasificador (opcional) que antes
vivían repartidos entre `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review` y
`dsh-movein-permissions`.

1. Exporte sus listas de reglas existentes (deny / allow / ask) y fúndalas en un único documento
   `permissions.yaml`.
2. Retire los cuatro plugins del `cordis.yml` y añada la única entrada `dsh-perm-gate` de arriba.
3. Borre cualquier sobrescritura de preajuste que aportaran esos plugins — `cordis.patch.yml`
   **reemplaza** `permission.config.presets` al por mayor, de modo que parches obsoletos por clave
   de otros plugins pueden hacer desaparecer silenciosamente el nivel 自动审查 (o uno integrado).
4. Recargue el perfil y verifique con `--list` (abajo).

## Verificar

```sh
# summarize the loaded ruleset (no harness needed)
dsh-perm-gate --rules permissions.yaml --list

# dry-run one call
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

Forma esperada de la salida de `--list`:

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

En la interfaz, **Ajustes → Plugins → 自动审查** debe mostrar un interruptor más los cuatro
conmutadores de estrategia de backend.

## Desinstalar

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Retirar el plugin retira también su contribución de parche, de modo que el nivel 自动审查
desaparece de nuevo del selector de permisos de sesión.

## Resolución de problemas

**Falta el nivel 自动审查 en el selector de permisos.**
El parche del bundle de DSH reemplaza todo el mapa `permission.config.presets` en lugar de fusionar
por clave. Recargue el perfil para que `cordis.patch.yml` se vuelva a aplicar, y asegúrese de que
ningún plugin posterior sobrescribe `presets`.

**自动审查（高权限） perdió su icono en el composer.**
Una actualización o reinstalación de DSH reemplazó el bundle del host en el que estaba parcheado
el glifo; volver a ejecutar la instalación del plugin no lo recuperará. Ejecute
`npx dsh-perm-gate-patch-glyph` y recargue. El nivel en sí no se ve afectado — su etiqueta y su
control siguen funcionando sin el parche.

**`--list` informa `ruleCount: 0` aunque mi fichero de reglas existe.**
`rulesFile` se resuelve contra el CWD del proceso del harness, no contra el directorio del plugin.
Prefiera una ruta absoluta o confirme el CWD de la shell. Un documento malformado falla ruidosamente
al cargarse — nunca se desactiva en silencio.

**`llmAssist` nunca se dispara.**
Necesita `classifierEndpoint`, `classifierModel` y `classifierApiKey` (fíjelos en
**Ajustes → Plugins → 自动审查** o en `cordis.yml`). Cualquier valor ausente o error de red recae
en el seam humano — la puerta es fail-closed por diseño.

**La pestaña Approvals sigue vacía.**
La puerta está acotada a los niveles listados en `gatePresets` (por defecto `['permissive']`), así
que no registra nada mientras la sesión corre en otro nivel — elija 自动审查 en el selector de
permisos de la sesión que quiera ver registrada. Una sesión que nunca ha elegido un preajuste está
fuera de alcance también. Las sesiones nuevas empiezan en el nivel nombrado por el ajuste
`permission.defaultPreset`.

**La tarjeta de ajustes muestra "Settings namespace unavailable".**
El plugin no está ensamblado en el perfil activo. Ejecute
`dsh plugin --profile web add dsh-perm-gate` y recargue.

**Seleccionar `ja` / `ko` falla con `locale "<id>" is not registered`.**
El DSH oficial solo expone `zh` / `en` a través de `LocaleRuntime`. Véase la nota de
compatibilidad en el [README](./README.es.md).

## Licencia

[MIT](./LICENSE)
