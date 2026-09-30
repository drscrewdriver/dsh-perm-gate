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

> **Nota de compatibilidad:** la v2.0.0 incluye diccionarios `ja` / `ko`, pero el DSH oficial solo
> expone `zh` / `en` a través de `LocaleRuntime` (`LOCALE_IDS = ["zh", "en"]`). En un DSH sin
> modificar, seleccionar `ja` / `ko` falla con `locale "<id>" is not registered`. Use un fork de
> DSH que actualice `LOCALE_IDS` (locale-settings.ts) y las etiquetas `LOCALES`
> (client/index.ts), y recompile.

> **▼ Compatibilidad de versiones de DSH**
>
> Dos líneas de DSH se atienden desde dos ramas de larga vida, cada una con su propia serie de
> versiones, su `engines.dsh` y su dist-tag de npm ([esquema de releases](./RELEASING.md)):
>
> | Versión de DSH | Rama | Versión | Tag de npm |
> | --- | --- | --- | --- |
> | 0.1.0-rc.7 ~ 0.1.1-rc.x | `legacy` | `1.x` | `@legacy` |
> | 0.1.2-alpha.1+ (incl. 0.1.5-rc.2) | `main` | `2.x` | `@latest` / `@dsh-0.1.2` (`@2.x` es un rango) |
> | 0.2.0-rc.1 (línea 0.2.0) | `compat/0.2.0` | `5.x` | `@dsh-0.2.0` |
>
> El número de serie sigue la **línea de DSH** (`1.x` = DSH ≤ 0.1.1, `2.x` = DSH 0.1.2+), y los
> mayores se cercan entre sí: una instalación `^1.x` nunca resuelve una versión `2.x`, y
> viceversa. `engines.dsh` declara la misma separación, pero DSH nunca lo lee: son los rangos y
> los dist-tags lo que mantienen un DSH antiguo en `1.x`.
>
> `@deepseek-ai/dsh-client-runtime` fue **eliminado** en `0.1.2-alpha.1` — no se limitó a mudarse.
> La línea `legacy` sigue llegando a `ctx.slots` a través de él; `main` obtiene la misma
> declaración de `@deepseek-ai/dsh-client-ui-renderer/client`. Dos costuras sensibles a la versión
> se manejan con sondeos de capacidad en lugar de comprobaciones de versión: (1) el registro de
> ajustes usa `register`, presente en ambas líneas (`installSection` es una adición, no un
> reemplazo); (2) `effectivePolicy` es un método **privado** del servicio de aprobación de usuario
> en ambas, así que se lee tras un sondeo `typeof` y degrada a «política desconocida» cuando falta
> o lanza un error.

Versión **2.6.0** — véase el [changelog](./CHANGELOG.es.md).

Una única puerta de permisos autosuficiente, determinista en primer término y fail-closed para
DeepSeek Harness.

`dsh-perm-gate` decide cada llamada a una herramienta mediante una cadena de prioridad fija:

| Etapa | Decisión | Qué es |
| ---- | ---- | ---- |
| **P0** | `deny` | denegación dura determinista: material de credenciales, mutación de rutas protegidas, shell peligroso |
| **P1** | `allow` | una **concesión de sesión** precisa y acotada |
| **P2** | `deny/allow/ask` | cadena de reglas estática: primero la lista negra, luego allow, luego ask |
| **P3** | `allow/deny/ask` | clasificador semántico LLM opcional (**desactivado** por defecto) |
| **P4** | `ask` | el seam oficial de aprobación |

Estrictamente fail-closed: una decisión P0 nunca es anulada por una concesión, una regla, el
clasificador o un humano.

## Por qué

El ecosistema de seguridad de DSH reparte esto entre varios plugins (`dsh-permission-rules`,
`dsh-auto-mode`, `dsh-auto-review`, `dsh-movein-permissions`). `dsh-perm-gate` fusiona la puerta +
la aprobación + el clasificador (opcional) en un solo paquete, con una única pista de auditoría y
sin acoplamiento de versiones entre plugins.

## Funcionalidades

- **Lista blanca / negra de comandos** — emparejamiento sobre una **descomposición argv** (no una
  cadena cruda), con descenso recursivo en `sh -c`/`bash -c`, detección de tuberías, comprobación
  de destinos de redirección y reconocimiento de recursivo/forzado (`rm -rf`).
- **Prioridad del deny** — una regla deny que coincida vence a cualquier regla allow.
- **Concesiones de sesión** — concesiones precisas `(herramienta, huella canónica)` con `TTL` +
  `maxUses`; relanzar con un destino distinto nunca reutiliza la autoridad. Los sub-agentes
  heredan pero no pueden acuñar.
- **Motor de reglas de funciones puras** — compilación glob/regex con cota de ReDoS, fallo ruidoso
  ante reglas malformadas y caché de compilación por hash de la fuente.
- **Auditoría** — cada decisión se registra como un evento `{ignorable:true}` con su `callId`; la
  razón visible para el modelo coincide con el desenlace registrado.
- **Nivel 自动审查** (`permissive`, además de `permissive-full`) — un **modo de aprobación
  independiente** (aparte de los niveles de solo lectura, acceso completo y lista blanca) que no
  es ni «autoaprobación» ni confianza ciega. El frontend expone un **único interruptor**
  (`permissive`); las cuatro estrategias de backend son **combinables** y las dirige la
  configuración del plugin — siempre fail-closed frente a P0. El selector de permisos y la fila de
  ajustes lo muestran ambos bajo la etiqueta de producto 自动审查, sin icono. La variante
  `permissive-full` conserva el mismo comportamiento de aprobación pero elimina la sandbox de
  archivos integrada, que de otro modo niega las tuberías con nombre que `git clone` / Cygwin /
  ConPTY necesitan.
- **Respuesta automática a las escaladas de sandbox** (`trustEscalation`) — una escalada de
  sandbox se pide desde *dentro* del cuerpo de la herramienta shell / pwsh / edit, tras
  `tools/pre-execute`, de modo que la puerta nunca la vio y una llamada que había permitido
  automáticamente seguía pidiéndole aprobar la ampliación. Con esta estrategia activada, la
  llamada exacta que la puerta despejó (reconocida por `callId`) se responde aquí.
- **`llmAssist` con riesgo graduado** — un LLM propio compatible con OpenAI califica cada `ask`
  como `safe` / `risky:<categoría>`; las categorías duras (borrado, credenciales, remoto, sistema,
  masivo) **siempre preguntan**, lo neutro alimenta el aprendizaje de veredictos, y todo fallo
  permanece fail-closed.
- **Aprendizaje de veredictos** — los `ask` de riesgo neutro que el humano aprueba y que realmente
  se ejecutan se acumulan; superado el umbral, *la misma operación exacta* (emparejada por huella)
  se auto-permite.
- **Flujo de eventos de decisión** — cada decisión se añade a un flujo JSONL y la mitad de
  navegador lo muestra como una franja de aviso sobre la entrada de conversación, más una pestaña
  de registros de aprobación (de lo más reciente a lo más antiguo) en la vista de conversación.

Una **lista negra de palabras clave deny predefinida** (heredada de los `DEFAULT_DENY_KEYWORDS` de
dsh-approval-gate: `rm -rf`, `push --force`, `drop table`, `mkfs`, `git reset --hard`,
`docker system prune`, …) veta toda llamada cuyo texto contenga una palabra clave — subcadena sin
distinguir mayúsculas, aplicada antes de la lista blanca, las concesiones y el LLM. Es editable
como lista en la tarjeta de ajustes (las entradas predefinidas van etiquetadas, y una
restauración de un clic recupera el preajuste); sin definir o vacía aplica el preajuste — la lista
negra nunca se apaga en silencio.

## Instalación

Requiere una instalación existente de
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

```sh
dsh plugin --profile web add dsh-perm-gate
```

Los pasos completos de instalación, actualización, migración y resolución de problemas viven en la
[Guía de instalación](./INSTALL.es.md) — también disponible en
[English](./INSTALL.md) / [中文](./INSTALL.zh.md) / [日本語](./INSTALL.ja.md) /
[한국어](./INSTALL.ko.md) / [Français](./INSTALL.fr.md) / [Deutsch](./INSTALL.de.md) /
[Italiano](./INSTALL.it.md) / [Русский](./INSTALL.ru.md).

## Configuración

Añada el plugin al `cordis.yml`:

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

### Barrido de sesiones

Al arrancar y cada hora, la puerta lee el almacén de espacios de trabajo de DSH
(`$DSH_HOME/storages/workspace.json`, de solo lectura) y clasifica cada sesión para la que
conserva datos de la cadena de autorización. Las sesiones que DSH archivó
(`global.archivedSessionIds`) o que ya no rastrea en absoluto ven sus eventos de decisión
retirados de `$DSH_HOME/perm-gate/events.jsonl` y sus ficheros de instantánea previos al cambio
eliminados de `$DSH_HOME/perm-gate/snapshots/` — historia que la página de revisión ya no puede
alcanzar, por datos que el propio harness considera desaparecidos. Las sesiones vivas no se
tocan, las filas no atribuibles (id de sesión vacío) nunca se eliminan, y cualquier fallo es
fail-open: la pasada se salta y se reintenta una hora después. Fije `sessionSweep: false` para
desactivarlo; `workspaceStoreFile` reemplaza la ruta del almacén. Restaurar una sesión archivada
no restaura su historia barrida.

### Fichero de reglas

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

Una entrada de comando `word#flag` empareja la palabra del comando (`word`) con el modificador
`recursive` o `force` — así, `rm#recursive` coincide con `rm -rf`, `env rm -rf` y
`sh -c "rm -rf /"`.

### Política de red (opt-in)

Un proxy local HTTP/CONNECT que juzga el tráfico saliente de los **subprocesos de shell** según
el mismo fichero de reglas, más una vía de aprobación para destinos que ninguna regla cubre.
**Desactivado por defecto** — activarlo enlaza un puerto de loopback y reescribe el entorno proxy
de los procesos hijos, así que nunca se enciende implícitamente.

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

**Comportamiento por niveles.** Nada llega a la red sin una regla allow. Un destino no listado se
escala al seam de aprobación interactivo, planteado en nombre del comando de shell que abrió la
conexión; aprobar amplía el alcance de ese destino durante la sesión. Una regla `deny` nunca se
escala: la aprobación puede ampliar lo que un destino no listado puede alcanzar, pero jamás puede
anular una regla que dice no.

**El límite — léalo antes de fiarse de esto.** El proxy es una capa de política *cooperativa*,
no una frontera de aplicación. Solo ve el tráfico de clientes que leen el entorno de proxy:

| Cliente | ¿Cubierto? |
|--------|----------|
| `curl`, `wget`, `git`, Go `net/http`, Python `requests` | sí |
| **Node.js `http`/`https`/`fetch`** | **no — conecta directamente** |
| Java (sin flags de proxy `-D`), .NET `HttpClient` | no |
| Sockets en crudo, TCP propio | no |
| DNS, QUIC/HTTP3, protocolos no HTTP | no |
| Conexiones a una IP literal | no |

Así que un comando de shell como `node -e "require('http').get('http://host/')"` no se
intercepta. Trátelo como una barrera contra accidentes y un lugar donde declarar una intención,
no como una sandbox hermética.

El tráfico de red **propio** de DSH — las herramientas de red integradas y el transporte LLM — se
deja deliberadamente al margen. Esas conexiones no llevan atribución de shell, y
`networkUnattributed: allow` (el valor por defecto) las deja pasar sin revisión: revisarlas
permitiría al host bloquearse *a sí mismo*, lo cual es un fallo peor que un bloqueo omitido.
Fije `networkUnattributed: deny` solo si sabe que los clientes de su host ignoran el entorno de
proxy.

El estado en vivo se consulta en `GET /api/dsh-perm-gate/network` (modo, bind, puerto, viveza del
proxy, estado de inyección de entorno, contadores de bloqueos, bloqueos recientes).

## El nivel 自动审查 (valor de máquina `permissive`)

自动审查 es un **nivel de aprobación independiente** en el selector de permisos de DSH, en
paralelo a Solo lectura / Escritura de espacio de trabajo / Acceso completo / Lista blanca. No es
una «autoaprobación» genérica y nunca acuña autoridad ciega: solo estrecha o ensancha el seam
*antes* del paso humano/LLM, mientras la denegación dura P0 se mantiene monótona e innegociable
**dentro del ámbito propio de la puerta**.

> **P0 tiene alcance, no es global.** La puerta actúa solo cuando el preajuste de permisos de la
> sesión es uno de los `gatePresets` (por defecto `permissive` / `permissive-full`). Con
> cualquier otro preajuste — Solo lectura, Escritura de espacio de trabajo o Acceso completo —
> **toda** la puerta se retira, incluida la denegación dura P0, porque la política propia del
> nivel elegido gobierna esa sesión. Es deliberado (véase `gatePresets` en la tabla de
> configuración), pero significa que «P0 es innegociable» se cumple *dentro* de los niveles de la
> puerta, no en todos los niveles. Una retirada no es silenciosa: la puerta registra un evento
> `stand-down` por transición sesión/preajuste y el navegador muestra una franja persistente
> **GATE OFF** sobre la entrada. Fije `gatePresets: ['*']` para volver a hacer P0 global.

**Se envían dos variantes**, porque el `sandbox` y el `approval` de un preajuste son perillas
independientes y acoplarlas forzaba un mal intercambio:

| Etiqueta del selector | Valor de máquina | sandbox | approval |
|--------------|---------------|---------|----------|
| 自动审查 | `permissive` | `workspace-write` | `ask` |
| 自动审查（高权限） | `permissive-full` | `danger-full-access` | `ask` |

El nivel sencillo conserva la sandbox de archivos integrada. Esa sandbox también niega las
tuberías con nombre que un proceso hijo necesita para arrancar, de modo que `git clone`, el
`sh.exe` de MSYS2/Cygwin y ConPTY fallan bajo ella con `Win32 error 5` /
`couldn't create signal pipe`. Como la puerta solo está activa **en los niveles listados en
`gatePresets`**, querer la puerta implicaba aceptar esa restricción. 自动审查（高权限） elimina el
acoplamiento: idéntico comportamiento de aprobación, sin restricción de sandbox de archivos. La
descripción propia del nivel enuncia el intercambio sin rodeos — el flujo de trabajo es más
fluido, las aprobaciones siguen aplicándose por llamada, pero no queda **ninguna sandbox de
sistema como respaldo**. Ambos están en los `gatePresets` por defecto, así que cualquiera le da la
cadena completa P0–P4 — la puerta lee solo el **nombre** del preajuste, nunca el modo de sandbox.

La etiqueta del selector es una **cadena de producto suministrada por el host**, no una entrada de
diccionario por locale: DSH renderiza el `name:` del nivel de un plugin literalmente en ambas
superficies de permisos (la fila por defecto de los ajustes generales y el selector del composer)
y solo aporta sus propias etiquetas localizadas para los tres valores integrados, de modo que
`cordis.patch.yml` envía la etiqueta china para cada sesión.

El **icono** es otra historia. El mapa de glifos del composer está cerrado, y su propio comentario
enuncia la regla: *host-configured names outside the design set get none.* `permissive` es un
valor integrado, así que 自动审查 ya tiene un glifo escudo+ojo; `permissive-full` recibe el mismo
glifo solo porque `npx dsh-perm-gate-patch-glyph` lo añade a ese mapa. Ese parche edita un paquete
**del host**, así que se pierde en cada actualización de DSH — véase
[Tras una actualización de DSH](./INSTALL.es.md).

En `cordis.yml`:

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

`trustAutoAllow` es el nivel intermedio de base (un allow por regla pasa automáticamente).
`alwaysConfirm` muestra el panel de aprobación en cada cruce; sus «controles allow» añaden dos
botones extendidos — **volver a permitir este tipo en esta sesión** (una concesión de sesión
acotada) y **permitir cada ocurrencia** (que persiste la palabra del comando en la lista blanca
`allow` del `permissions.yaml` vía `approveAllowEverywhere`). `llmAssist` consulta un LLM real
configurable (`classifierEndpoint` / `classifierModel`, cualquier API compatible con OpenAI) para
decidir automáticamente un `ask`, y recae en el seam humano ante `ask`/error — siempre
fail-closed. `trustEscalation` (activo por defecto mientras el nivel esté activo) responde una
escalada `sandbox_permissions` planteada desde dentro de una llamada que la puerta ya permitió;
véase abajo. Con `permissive` desactivado, la puerta se comporta exactamente como antes.

### Escalada de sandbox: por qué un veredicto `safe` seguía mostrando la pregunta

Una llamada a una herramienta puede plantear **dos aprobaciones independientes**. La puerta posee
la primera — su propio `ask`, en la cascada `tools/pre-execute`. La segunda llega de
`approveEscalation` **dentro del cuerpo de la herramienta**, en el momento de `tools/execute`,
siempre que el modelo haya pasado `sandbox_permissions` + `justification`; para entonces
`tools/pre-execute` ya está resuelto, de modo que el allow de la puerta nunca llega a ella. Una
llamada que el LLM calificó `safe` y que la puerta auto-permitía seguía mostrando, pues, una
pregunta pidiendo aprobar la ampliación de sandbox.

`trustEscalation` cierra esa brecha. La puerta recuerda cada llamada que permitió positivamente
(indexada por la `callId` del host, que la petición de escalada repite) y responde ella misma la
escalada con `allowed-once`. Solo se aplica cuando se cumple **todo**:

- el nivel 自动审查 está activo y `trustEscalation` está activo;
- la petición lleva una `callId` que la puerta despejó, con nombre de herramienta coincidente;
- la razón es una escalada reconocida que nombra `workspace-write` o `danger-full-access`.

Todo lo demás — una razón no reconocida, otra llamada, una llamada que la puerta preguntó o
denegó, el paso a través `approval: never` — se delega al humano sin cambios, de modo que un
futuro cambio de redacción de DSH falla cerrado en vez de abierto. La respuesta automática queda
registrada en el flujo de eventos (`verdict: "escalation-auto"`, `mode: <objetivo>`). Apague el
interruptor para mantener la ampliación de sandbox bajo control humano mientras los demás allow
siguen siendo automáticos.

### llmAssist con riesgo graduado, aprendizaje de veredictos y el flujo de eventos

Con `llmAssist` activo, el LLM configurado califica un `ask` cada vez con un protocolo
estructurado. La calificación ocurre **dentro de la cascada `tools/pre-execute` de la puerta,
antes de que la decisión vuelva al host**: un veredicto `safe` delega la llamada directamente, de
modo que el panel de aprobación nunca aparece; solo un veredicto realmente incierto llega hasta
usted. En la tarjeta de ajustes se pueden elegir dos fuentes de receptor: una **API propia**
(cualquier endpoint compatible con OpenAI — `classifierEndpoint` / `classifierModel` /
`classifierApiKey`, con preajustes que incluyen Xiaomi MiMo `https://api.xiaomimimo.com/v1`), o el
**grupo de modelos del host DSH** (el servicio `llm` configurado de la sesión, vía
`agentDefaultModel.currentSelection`, opcionalmente sustituido con `classifierProvider` /
`classifierModel`). Un botón de **prueba de salud** (`POST /api/dsh-perm-gate/health`) ejecuta una
completación mínima e informa de la latencia.

- `safe` → la llamada se auto-permite (auditada como fuente `classifier`); no se muestra panel.
- `risky` + una **categoría dura** (`deletion`, `credential`, `remote`, `system`, `bulk`) → la
  llamada **conserva el ask humano**. El clasificador **nunca deniega**: la vía de denegación
  pertenece solo a las capas deterministas (denegación dura P0, la lista negra de palabras clave
  deny, las reglas `deny:` explícitas), de modo que una categoría mal calificada siempre queda
  negociable en lugar de un bloqueo sin apelación. Las categorías duras se distinguen de
  `neutral` de una manera que importa: **nunca se aprenden**, así que aprobaciones humanas
  repetidas nunca pueden sedimentarlas en un auto-allow.
  (Denegar por palabra del modelo se midió en vivo: un benigno `git commit -F …` calificado
  `remote` produjo un auto-deny sin panel y sin concesión para reintentar.)
- `risky:neutral` → con `riskLearning` activado (tarjeta de Ajustes, desactivado por defecto),
  cada aprobación humana que realmente se ejecuta (saldada mediante el evento `tools/result` del
  host) cuenta hacia una clave `tool|category`; cuando el contador alcanza `riskThreshold`
  (3 por defecto) **y** la huella de operación de la nueva llamada (palabra del comando + basename
  del destino) coincide con una muestra confirmada, la misma operación exacta se auto-permite. Un
  destino distinto nunca reutiliza esa autoridad. Con la sedimentación (`riskSediment`, activada
  por defecto) las muestras confirmadas de una clave que alcanzó el umbral se vuelven **reglas
  allow deterministas**: un acierto exacto permite sin más, sin otra llamada al LLM — incluso con
  `llmAssist` desactivado — y las reglas sedimentadas son visibles y gestionables (terminar /
  quitar) en la tarjeta de ajustes.
- Los tiempos de espera agotados (`riskTimeoutMs`, 20 s por defecto, un reintento), los fallos de
  transporte y las salidas fuera de protocolo dejan el ask intacto — la puerta nunca adivina.

El estado de aprendizaje persiste en un JSON propiedad del plugin
(`$DSH_HOME/perm-gate/learning.json`, o `learningFile`), nunca en su fichero de reglas YAML. Cada
decisión se añade a `$DSH_HOME/perm-gate/events.jsonl` (o `eventsFile`) y se sirve en
`GET /api/dsh-perm-gate/events?sessionId=&since=`; la mitad de navegador la consulta y muestra la
última decisión como franja de aviso sobre la entrada de conversación (los ask siguen visibles
hasta el siguiente evento) y enumera las decisiones de toda la sesión, de lo más reciente, en la
pestaña **Approvals** de la vista de conversación.

Los ficheros afectados por cada decisión se copian en instantáneas antes de que el cambio aterrice
(≤ 5 ficheros, ≤ 256 KB cada uno) bajo `$DSH_HOME/perm-gate/snapshots/`; en la pestaña
**Approvals**, cada chip de fichero abre un diff de líneas (`GET /api/dsh-perm-gate/diff`) con una
acción de **revert** que entrega una instrucción de restauración en la conversación
(`POST /api/dsh-perm-gate/revert`). Una barra de inventario de instantáneas las borra por sesión o
por completo (`GET /api/dsh-perm-gate/snapshots-stats` / `POST /api/dsh-perm-gate/snapshots-clear`).

Un `ask` que la puerta enruta a un humano se rastrea hasta que el humano responde: un observador
pasivo `approval/request` registra el desenlace cerrado (`allowed-once` → **aprobado**,
`rejected` → **rechazado**, `cancelled` → **cancelado**, `unavailable` → una denegación, pues no
existía canal de aprobación), con `tools/result` saldando el mismo ask como respaldo cuando el
observador no puede correlacionarlo. Las aprobaciones informan del progreso de aprendizaje
posterior (`n`/umbral), y la franja de aviso etiqueta los tres estados terminales.

自动审查 y 自动审查（高权限） dibujan ambas el glifo escudo+ojo en el selector — la primera del
mapa integrado de DSH, la segunda del parche del host que describe la guía de instalación. Sin
ese parche, el segundo nivel es solo texto en todas las superficies; su etiqueta y su control no
se ven afectados.

### Un nivel de sesión seleccionable

`cordis.patch.yml` añade un preajuste `permissive` (`sandbox: workspace-write`, `approval: ask`,
nombre **自动审查**) entre Escritura de espacio de trabajo y Acceso completo. El parche del bundle
de DSH reemplaza todo el mapa `permission.config.presets` en lugar de fusionar por clave, así que
el fichero también redeclara los tres integrados (`read-only` / `workspace-write` /
`danger-full-access`, de `@deepseek-ai/dsh-base/cordis.patch.yml`);
`test/patch-presets.spec.ts` fija ese conjunto de claves. Así, el selector de permisos de sesión
ofrece 自动审查 como un nivel de aprobación independiente y seleccionable, no un modo genérico de
«autoaprobación».

La puerta está activa **solo en los niveles listados en `gatePresets`** (por defecto
`['permissive', 'permissive-full']`, los dos niveles que añade este plugin). En cualquier otro
nivel — Solo lectura, Escritura de espacio de trabajo, Acceso completo, `custom` — el flujo de
decisión de la puerta no se ejecuta en absoluto: ni allow, ni ask, ni deny, ni denegación dura
P0, ni veto de palabras clave deny, ni evento de auditoría. La política propia del nivel elegido
gobierna la llamada, y ese es el punto: el `danger-full-access` integrado se define como «acceso
completo sin avisos de aprobación», así que rebasarlo con un ask (allí irresponsable — el seam de
aprobación rechaza antes de que corra cualquier respondedor, produciendo
`the user rejected tool "..."` sin panel) o con una denegación dura contradeciría en silencio el
nivel que el usuario eligió. `gatePresets: ['*']` vuelve a hacer global la puerta (denegación dura
incluida); dentro de un nivel activo, un `ask` sigue degradándose a paso transparente cuando la
política de aprobación efectiva de la sesión es `never` — por eso ambos niveles 自动审查 declaran
`approval: ask`.

### Configurable en la interfaz

El nivel también se ajusta en tiempo de ejecución desde **Ajustes → Plugins → 自动审查** (una
página `settings.plugins.tab` renderizada por el cliente de navegador del plugin): un interruptor
conmuta `permissive`, y cuatro conmutadores editan las `permissiveStrategies` de backend. El host
lee el espacio de nombres en vivo, de modo que un cambio se aplica en la siguiente llamada a
herramienta sin reiniciar. Esta es una clase de aprobación independiente, NO un modo genérico de
«autoaprobación».

### Prueba de reglas (dry-run)

La misma página lleva un panel de **prueba de reglas**: escriba un nombre de herramienta y un
comando, pulse Probar, y la puerta juzga esa llamada contra el conjunto de reglas que tiene
cargado en ese momento — sin ejecutar nada y sin escribir regla alguna. Obtiene el veredicto, la
regla emparejada (índice y acción), las dimensiones que esa regla restringe, y la razón.

Informa tanto del veredicto efectivo (toda la cadena P0 → P1 → P2 → P3 → P4) *como* de la
respuesta propia de la capa de reglas, que no son lo mismo: una denegación dura P0 o una palabra
clave deny de preajuste saltan antes de la cadena de reglas y no dejan tras de sí índice de regla
alguno, de modo que el panel dice «ninguna regla coincidió» en vez de nombrar una regla ajena. Una
nota de «0 reglas cargadas» significa que la ruta `rulesFile` no resolvió nada.

El panel habla con `POST /api/dsh-perm-gate/dry-run`, que es **de solo lectura por construcción**
— no tiene forma de escritura alguna, así que probar una regla nunca podrá cambiarla.

## CLI

Dry-run de una llamada contra un fichero de reglas (sin harness):

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
```

## Desarrollo

```sh
npm run typecheck
npm test
npm run build
```

## Licencia

[MIT](./LICENSE)
