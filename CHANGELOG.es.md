# Changelog

Idiomas: [English](./CHANGELOG.md) · [日本語](./CHANGELOG.ja.md) · [한국어](./CHANGELOG.ko.md) · [Français](./CHANGELOG.fr.md) · [Deutsch](./CHANGELOG.de.md) · [Italiano](./CHANGELOG.it.md) · [Русский](./CHANGELOG.ru.md) · [Español](./CHANGELOG.es.md)

Todos los cambios notables de este proyecto serán documentados en este fichero.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto se adhiere al [Versionado Semántico](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-09-17

### Añadido

- **Prueba de reglas (dry-run) en la tarjeta de ajustes.** Un nuevo panel evalúa una hipotética
  llamada a herramienta contra el conjunto de reglas que la puerta tiene cargado en ese momento y
  muestra el veredicto, la regla emparejada (índice y acción), las dimensiones que esa regla
  restringe, y la razón. Escrito para la pregunta que el YAML no puede responder a la vista:
  *¿qué hará esto realmente?* — `args` es un OR sobre tokens, una dimensión vacía no restringe
  nada, y `command` empareja solo la **palabra** de comando descompuesta, de modo que una regla
  de apariencia plausible puede estar muerta a la llegada.

  El informe separa a propósito dos respuestas. **`verdict`** es el resultado de política de toda
  la cadena (denegación dura P0 → palabra clave deny → concesión P1 → reglas P2 → ask P4 →
  permissive). **`ruleLayer`** es lo que la cadena `permissions` decide por sí sola, y solo esa
  capa puede nombrar un índice de regla: una denegación dura P0 o una palabra clave deny de
  preajuste salta *antes* de ella y no deja regla tras de sí, de modo que el panel lo dice en
  vez de atribuir una regla ajena. `matchedDimensions` del mismo modo enumera las dimensiones
  que la regla emparejada *restringe*, no la que «causó» la coincidencia — las dimensiones se
  combinan por AND, así que una causa única no puede nombrarse honestamente. Un `ruleCount` de 0
  se comunica como «0 reglas cargadas, compruebe la ruta rulesFile» en lugar de «nada coincidió».

- **`POST /api/dsh-perm-gate/dry-run`** — el endpoint del panel. **De solo lectura por
  construcción**: no tiene forma de escritura, las claves de cuerpo desconocidas se descartan en
  lugar de reenviarse, y nunca toca reglas, concesiones, estado de aprendizaje ni el espacio de
  nombres de ajustes. Probar una regla no debe poder cambiarla. Evalúa contra el runtime **en
  vivo** en vez de uno fresco, de modo que el panel prueba las reglas en vigor — un runtime
  fresco volvería a resolver la cadena desde otra raíz y podría responder silenciosamente sobre
  otro fichero.

- **`src/dry-run.ts`** — `runDryRun` / `createDryRunRuntime`, el evaluador compartido entre la
  CLI y la ruta, más `PermGateRuntime.explainRules` (informe de la capa de reglas de solo
  lectura) y `PermGateRuntime.explainCall` (evaluación de política pura). `src/cli.ts` es ahora
  un envoltorio fino sobre él; su salida no ha cambiado en nueve invocaciones rehechas, verificada
  byte a byte (incluidos los casos `--list`, sin herramienta, JSON malformado y ruta de escritura).

### Corregido

- **El panel de prueba de reglas informaba `allow` para llamadas que las reglas envían a una
  persona.** La primera versión evaluaba a través de la vía orientada al host, que aplica las
  capas de sesión — el repliegue del preajuste y la degradación `approval: never` del ask. Un
  dry-run sin sesión no tiene sesión, así que el lector de política respondía «never», todo `ask`
  degradaba a paso transparente, y el panel mostraba **allow** justo para las reglas que uno abre
  para revisar. Medido en el host en vivo: `shell ls -la` mostraba `allow` mientras la capa de
  reglas de la misma tarjeta decía `ask`.

  `runDryRun` informa ahora el veredicto de **política pura** de `explainCall`: la misma cadena
  P0 → palabra clave deny → P1 → P2 → P4, con las capas de estado de sesión excluidas en vez de
  adivinadas, y con `reason` nunca colapsado a un desnudo `(default/passthrough)`. La vista
  orientada al host sigue disponible bajo `input.hostView`; la CLI la pide, así que su salida
  histórica sigue siendo idéntica byte a byte (reverificado: 9/9 casos, SHA256 por caso).

- **La ruta «de solo lectura» no era de solo lectura.** Ejecutaba la vía de decisión orientada al
  host contra el runtime en vivo, que añade entradas de auditoría y registra eventos de decisión —
  abrir el panel de prueba de reglas escribía en el flujo de decisiones en vivo. La vía pura no
  añade nada, y `test/dry-run.spec.ts` afirma ahora que una llamada que la vía del host
  *registraría* deja el espejo de auditoría a cero.

## [2.5.0] - 2026-09-17

### Añadido

- **Dimensión de regla `branch`** — emparejamiento de rama git / remota / rama protegida, para que
  una regla pueda por fin decir «nada de push a una rama protegida» sin pescar comandos ajenos.
  El caso decisivo es el que `args` nunca puede expresar: `git push --force origin main`
  (peligroso) y `git checkout --force main` (rutinario) llevan *los mismos tokens*, y solo la
  dimensión de rama los distingue. Subcampos: `target` (glob de nombre de rama, `*` cruza `/`),
  `remote` (glob de nombre de remota) y `shared` (exigir una rama protegida). Las candidatas
  provienen del despachador de comandos compartido, así que las formas `refspec` (`HEAD:main`)
  ya vienen partidas y un nombre de remota nunca se confunde con un nombre de rama. Documentado
  en `docs/rules-format.md` §4.11.

### Corregido

- **La cadena de reglas multi-fichero vaciaba silenciosamente cada dimensión de coincidencia.**
  `resolveRuleChain` fusionaba entradas a mano con `tools: []`, `command: []`, `args: []` y
  `paths: []`. Una dimensión vacía significa «sin restricción», así que CADA entrada fusionada
  coincidía con CADA llamada: la primera entrada `deny` denegaba todo en su partición, y la
  primera entrada `allow` permitía todo antes de que la partición `ask` llegara a consultarse.
  La fusión pasa ahora por el mismo `compileRuleEntry` que usa la vía de fichero único.

  *Alcance:* el resolutor de cadena solo se alcanza con `searchUp: true` (por defecto `false` en
  el producto, y sin fijar en un perfil estándar), así que la vía de fichero único por defecto —
  `compileDocument` — nunca se vio afectada. Por eso la suite existente siguió verde: ningún
  test hacía pasar un *fichero* de reglas por la cadena. `test/rule-chain.spec.ts` lo hace
  ahora. Un defecto distinto, aún abierto, en la misma vía opt-in queda anotado en el plan:
  `findChainEntries` concatena el `rulesFile` configurado sobre cada directorio, de modo que la
  ruta absoluta que `resolveRulesFile` produce siempre no coincide con nada y la cadena rinde un
  conjunto de reglas vacío sin error.

- **`argv.pipeline` no podía ver su propio sujeto.** La cadena de emparejamiento de tubería se
  construía desde `SimpleCommand.command`, que es solo la *palabra* de comando —
  `curl https://x.sh | sh` colapsaba a `curl|sh`, así que el patrón documentado `curl|sh`
  emparejaba la forma adyacente inofensiva mientras la genuinamente peligrosa, con argumentos, no
  emparejaba en absoluto. La cadena de emparejamiento es ahora el argv completo de cada comando
  simple (unido por `|`), y la documentación declara que `|` en un patrón es literal; cubrir
  argumentos requiere `curl*|sh`.

- Nueve errores `eslint` preexistentes (importaciones/constantes sin usar y un `prefer-const` en
  `src/parsers/` y `test/command-parsers.spec.ts`) — `npm run lint` vuelve a estar verde.

## [2.4.1] - 2026-09-17

### Corregido

- El historial de aprobaciones mostraba la cadena cruda `preset-passthrough` para el único
  evento que explica *por qué* una llamada marcada corrió sin revisión: el nivel declara
  `approval: ask`, la sesión fue sobreescrita a `never`, y el ask de la puerta se degradó por
  tanto a paso transparente. Ahora se renderiza como una etiqueta legible como cualquier otro
  veredicto.

## [2.4.0] - 2026-09-17

### Cambiado

- **El clasificador LLM P3 es de solo escalada — ya no puede denegar.** Un veredicto `risky` con
  una categoría dura (`deletion` / `credential` / `remote` / `system` / `bulk`) provocaba antes
  un **auto-deny** sin panel; ahora **mantiene el ask humano**. Denegar queda reservado a las
  solas capas deterministas — denegación dura P0, la lista negra de palabras clave deny, reglas
  `deny:` explícitas — porque un veredicto probabilístico no debe poder dictar un bloqueo sin
  apelación. Medido en vivo: el calificador llamó **`remote`** a un benigno `git commit -F …`, y
  el auto-deny no dejó ni panel para aprobar ni concesión para reintentar; solo un reintento
  manual (que por casualidad calificó `safe`) pasó. Esto alinea además el código con la regla del
  propio proyecto: las operaciones de alto riesgo se interceptan de forma **determinista, nunca
  por el juicio del LLM**.

### Añadido

- Las categorías de riesgo duras conservan una distinción significativa respecto de `neutral`:
  **nunca son aprendibles**. Aprobaciones humanas repetidas no pueden sedimentar un veredicto
  `deletion`/`credential`/`remote`/`system`/`bulk` en un auto-allow (antes era cierto solo como
  efecto colateral del auto-deny; ahora es una propiedad explícita).

### Notas de comportamiento

- Bajo `approval: never`, un ask que la puerta no puede entregar se degrada igualmente a paso
  transparente, así que una llamada marcada por el clasificador ahora **corre** donde antes se
  denegaba automáticamente. Es la consecuencia directa de «denegar solo lo deterministamente
  peligroso, negociar todo lo demás»: una negociación necesita un humano, y `never` significa
  que no hay. Haga correr la puerta en un nivel cuyo `approval` sea `ask` para que los avisos le
  lleguen.

## [2.3.0] - 2026-09-17

### Añadido

- **Un repliegue ya no es silencioso.** Cuando el preajuste de permisos de la sesión estaba fuera
  de `gatePresets`, la puerta se replegaba sin registrar nada — la llamada a herramienta
  parecía exactamente una que la puerta había examinado y permitido. Ahora registra **un** aviso
  `stand-down` por transición (sesión, preajuste) (nunca por llamada), nombrando el preajuste, el
  alcance y el hecho de que la denegación dura P0 está inactiva. El navegador lo renderiza como
  una franja persistente **GATE OFF** sobre la entrada, y el historial de aprobaciones muestra
  una etiqueta `Gate off`.
- La tarjeta de ajustes 自动审查 enuncia el alcance propio de la puerta en preajustes
  (`gatePresets`, por defecto `permissive` / `permissive-full`) y qué pasa fuera de él, así que
  el alcance es visible donde se configura el nivel.

### Cambiado

- **El posicionamiento documentado de P0 tiene alcance, no es global.** La denegación dura P0 es
  monótona e innegociable *dentro del alcance de preajustes de la puerta*; entre preajustes la
  puerta se replega por completo — P0 incluida — porque la política propia del nivel elegido
  posee esa sesión. El código se comportó siempre así; `AGENTS.md` y los cuatro README afirmaban
  lo contrario, lo que hacía leer `danger-full-access` como «P0 sigue aplicándose». Fije
  `gatePresets: ['*']` para volver a hacer P0 global.

### Corregido

- `DEFAULT_GATE_PRESETS` / `resolveGatePresets` se mudaron de `config.ts` (que importa
  schemastery) al `preset.ts` libre de dependencias, de modo que la mitad de navegador puede
  renderizar el alcance sin arrastrar una dependencia node-only al bundle del cliente. `config.ts`
  re-exporta ambos; las importaciones existentes no cambian.

## [2.2.0] - 2026-09-17

### Corregido

- **La denegación dura P0 saltaba toda herramienta de shell salvo cuatro.** `hardDenyReason`
  condicionaba su inspección de shell a una regex definida localmente, `/^(?:bash|pwsh|sh|cmd)$/`,
  que **no** empareja `shell`, `terminal` ni `powershell`. `shell` es la herramienta de shell
  principal de DSH, de modo que toda la comprobación de shell de P0 — la guardia de redirección
  sobre rutas protegidas — estaba **inerte para la forma de llamada más común**. Medido, el mismo
  comando `echo x > /etc/passwd`: bloqueado vía `bash`, **permitido** vía `shell`. `engine.ts`
  importa ahora `SHELL_TOOLS` desde `evaluate.ts`; la puerta sostenía tres copias de ese único
  hecho y solo una estaba completa.
- **`git push --delete` se analizaba como un push ordinario.** `hasDelete` se calculaba en
  `analyzeSubcommand` pero solo se leía en el caso `branch`, así que `git push --delete origin
  main` caía en la rama de push simple (`destructiveness: 4`) y la entrada `'push-delete': 5` de
  `DESTRUCTIVENESS_MAP` era un dato muerto.
- **La detección de rama protegida se disparaba por error en cualquier nombre con barra.** El
  predicado recortaba todo lo anterior a la última `/`, así que `backup/main` y `feat/release`
  se leían como protegidas. Ahora recorta solo los prefijos de ref conocidos (`refs/heads/`,
  `refs/tags/`, `refs/remotes/<remota>/`). La dirección importa: este predicado alimenta un P0
  **inremovible**, donde un fallo conserva detrás las capas de palabra clave / regla / LLM,
  mientras un falso positivo bloquea un flujo de trabajo legítimo sin remedio.

### Añadido

- **Denegación dura P0 por reescritura de historial remoto en una rama protegida.** Un `git push`
  que sobrescribe por la fuerza o borra `main` / `master` / `production` / `release` / `stable`
  se rechaza de forma determinista, antes de cualquier llamada al LLM. La protección preexistente
  era la palabra clave plana, ciega a ramas y sobreescrible por espacio de nombres
  `'push --force'`; esto es el suelo innegociable debajo.
  - **De solo escalada por construcción, no por convención**: el ayudante devuelve
    `string | undefined`, que quien llama lee como deny / sin decidir. No tiene forma de expresar
    allow, así que cablearlo en P0 no puede ensanchar lo que la puerta permite.
  - Deliberadamente **no** cubierto (sigue en manos de las capas de palabra clave / regla / LLM):
    force-push a una rama no protegida, `git push --force` sin rama nombrada, y los push
    ordinarios.
  - Primer uso en producción del analizador de comandos (`command-dispatcher`, `command-semantics`,
    `parsers/git`, `parsers/shell-cmds`), al que hasta ahora solo referenciaba su propio fichero
    de pruebas.

### Pruebas

- Nueva suite `test/git-protected-push.spec.ts` (13 casos): variantes del analizador, el
  predicado de rama protegida en ambos sentidos, cobertura completa de `SHELL_TOOLS`, las cuatro
  formas deliberadamente permitidas, y la segmentación de comandos compuestos
  (`git status && git push --force origin main`).
- **Falsificado**: revertir cada uno de los tres arreglos pone en rojo exactamente los casos que
  los custodian (7 fallos en total), mientras los casos de permiso deliberado siguen verdes.
- Suite completa **40 ficheros / 459 casos**; `typecheck` limpio.

## [2.1.2] - 2026-09-15

### Añadido

- **El parche de glifo del composer ahora viaja con el paquete.** `scripts/patch-permission-glyph.mjs`
  está en la lista blanca de `files` y expuesto como el bin **`dsh-perm-gate-patch-glyph`**, de
  modo que reaplicar el parche del bundle del host tras una actualización de DSH ya no necesita un
  checkout del código fuente:

  ```sh
  npx dsh-perm-gate-patch-glyph            # apply
  npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is missing
  ```

  En un checkout, `npm run patch:glyph` y `npm run patch:glyph:check` hacen lo mismo.

  Deliberadamente **no** es un `postinstall`. El script edita un paquete **del host**, y un plugin
  no debe reescribir el harness en el que está instalado sin ser invitado. (pnpm 10+ bloquea los
  scripts de instalación por defecto salvo que estén en lista blanca, así que un `postinstall`
  habría sido además una promesa que en silencio nunca se ejecuta — peor que un comando
  explícito.)

### Cambiado

- El script ahora es comprobable: sus partes puras están exportadas (`sliceEntry`,
  `applyGlyphPatch`, `candidateBundles`, `findBundle`) y fijadas por `test/glyph-patch.spec.ts`
  (11 casos). El invariante de balance de llaves es el que importa — la primera versión del
  troceador escaneaba desde la llave equivocada y producía un bundle no analizable, que solo
  cazaba la propia guardia `node --check` del script.
- `candidateBundles` sondea además el scope por-perfil izado bajo `$DSH_HOME`, y la CLI es un
  no-op al importarse (el bloque main corre solo cuando el fichero es el punto de entrada).

## [2.1.1] - 2026-09-15

### Añadido

- **Superficie de ejecución de red (opt-in, desactivada por defecto).** Un proxy local HTTP/CONNECT
  juzga el tráfico saliente de los *subprocesos de shell* según el mismo fichero de reglas, más
  una vía de aprobación interactiva para destinos que ninguna regla cubre. Una regla `deny` nunca
  se escala — la aprobación ensancha el alcance de un destino no listado, pero jamás puede anular
  una regla que dice no. Nueva configuración: `networkEnabled` (por defecto `false`),
  `networkMode`, `networkUnlisted`, `networkUnattributed`, `networkBind`, `networkPort`,
  `networkNoProxy`, `networkInjectEnv`, `networkAskTimeoutMs`, `networkGrantTtlMs`. Diagnóstico en
  `GET /api/dsh-perm-gate/network`. Cubierto por `test/network.spec.ts`,
  `test/proxy-errors.spec.ts`, `test/network-lifecycle.spec.ts` y `test/network-approval.spec.ts`.
- **Dos niveles 自动审查.** `permissive` conserva la sandbox de ficheros integrada;
  `permissive-full` (etiqueta 自动审查（高权限）) empareja el mismo comportamiento de aprobación
  con `danger-full-access`. El `sandbox` y el `approval` de un preajuste son perillas
  independientes, y acoplarlas forzaba un intercambio: la sandbox `workspace-write` niega también
  las tuberías con nombre que un proceso hijo necesita para arrancar, así que `git clone`, el
  `sh.exe` de MSYS2/Cygwin y ConPTY fallaban bajo el único nivel en que la puerta estaba activa.
  Ambos niveles están en los `gatePresets` por defecto.
- **Expansión del modelo de reglas.** Seis nuevas dimensiones de emparejamiento (`params` /
  `absent` / `agents` / `when` / `argv` / `network`), una cadena de reglas multi-fichero con
  `searchUp` y una vía de respaldo, y detección de sombra para reglas inalcanzables. Nueva
  configuración: `searchUp`, `fallbackPath`, `badFilePolicy`, `maxChainLength`.
- **Recarga en caliente de reglas.** Un vigilante chokidar recarga los ficheros de reglas
  efectivos, con antirrebote, expulsión LRU entre espacios de trabajo, y vigilancia de ficheros
  candidatos a través del ancestro existente más profundo, de modo que un fichero de reglas
  creado a mitad de sesión se adopte. Nueva configuración: `watch` (por defecto `true`),
  `watchDebounceMs`.

### Corregido

- **Una conexión bloqueada podía matar al host.** Cuando el proxy respondía a un CONNECT con 403,
  el RST del cliente producía un `ECONNRESET` sin gestor adjunto, que escalaba a un evento
  `'error'` no gestionado y terminaba el proceso de DSH. Los gestores de errores de socket se
  adjuntan ahora al tiempo de conexión, con redes de seguridad `clientError` y de rechazo de
  gestor detrás. Un proxy de política no debe derribar jamás a su host.
- **Las herramientas integradas pedían aprobación.** La lista de auto-allow se mantenía a mano,
  así que las herramientas añadidas a DSH desde entonces se le habían salido y una llamada de
  solo lectura podía levantar un aviso de aprobación: `advanced_search`, `platform_search`,
  `free_search_test`, `context_compression_retrieve`, `memory_search_graph`,
  `memory_expand_graph_node`, `memory_import`, `memory_ruminate`, `memory_ruminate_cancel`,
  `memory_ruminate_status`.
- **Carreras del ciclo de vida del proxy.** `close()` ahora espera un enlace en curso en vez de
  competir con él, está acotado, y las llamadas `start()` concurrentes comparten un único enlace.
  Las resoluciones DNS están acotadas en el tiempo, la fase de establecimiento de conexión está
  acotada, las conexiones concurrentes están limitadas, y un logger que lanza ya no puede escalar
  a un fallo. El desmontaje del proxy se registra antes de esperar el enlace, así que un dispose
  temprano no puede dejar fugas de un puerto enlazado ni de un `process.env` reescrito.
- **`permissive-full` no tenía icono en el selector del composer.** El mapa de glifos del selector
  está cerrado y, según su propio comentario, no da ninguno a los nombres configurados por el
  host, así que 自动审查（高权限） se renderizaba solo como texto mientras 自动审查 mostraba
  escudo+ojo. `scripts/patch-permission-glyph.mjs` añade la entrada que faltaba a ese mapa
  **del host**: idempotente, troceado por profundidad de llaves, y hace `node --check` sobre su
  propia salida y restaura la copia de seguridad si falla. Parchea un paquete del host, así que
  hay que volver a ejecutarlo tras cada actualización de DSH — reinstalar el plugin **no** lo
  restaura, porque `dsh plugin … add` solo escribe el `node_modules` del propio perfil.
  Documentado en las cuatro guías de instalación.

### Cambiado

- `networkUnattributed` es `allow` por defecto: el tráfico sin atribución de shell es el cliente
  propio de DSH (una herramienta de red integrada, el transporte LLM), y revisarlo permitiría al
  host bloquearse a sí mismo. Fije `deny` para el comportamiento más estricto.
- `networkUnlisted` es `ask` por defecto.
- `DEFAULT_GATE_PRESETS` es ahora `['permissive', 'permissive-full']`.

### Documentado

- **El proxy de red es una capa de política cooperativa, no una frontera de aplicación.** Solo ve
  a los clientes que leen el entorno de proxy. Medido, no supuesto: `curl` pasa por él, mientras
  que `node` `http`/`https`/`fetch` conecta directamente, igual que los sockets en crudo, DNS,
  QUIC, los destinos de IP literal y los clientes por defecto de Java/.NET. Declarado en los
  cuatro README.

- **Barrido de sesiones — la cadena de autorización sigue ahora el ciclo de vida de la sesión.**
  Al arranque del plugin y cada hora, la puerta lee el almacén de espacios de trabajo de DSH
  (`$DSH_HOME/storages/workspace.json`, de solo lectura) y clasifica cada sesión para la que
  conserva datos de la puerta. Las sesiones que DSH archivó (`global.archivedSessionIds`) o que
  ya no rastrea en absoluto ven sus eventos de decisión retirados de
  `$DSH_HOME/perm-gate/events.jsonl` (reescritura atómica tmp+rename, solo cuando algo se
  retira) y sus ficheros de instantánea previos al cambio eliminados de
  `$DSH_HOME/perm-gate/snapshots/`. Las sesiones vivas no se tocan; las filas no atribuibles (id
  de sesión vacío, línea/fichero no analizable) nunca se eliminan; cada fallo de E/S es fail-open
  (la pasada se salta y se reintenta una hora después); el temporizador horario se `unref`'a y se
  desmonta con el plugin. Nueva configuración: `sessionSweep` (por defecto `true`),
  `workspaceStoreFile` (por defecto `<dshHome>/storages/workspace.json`). Tenga en cuenta que
  restaurar una sesión archivada no restaura su historia barrida. Cubierto por
  `test/session-sweep.spec.ts` (13 casos unitarios) y `test/session-sweep-apply.spec.ts`
  (cableado de extremo a extremo).

## [2.0.0] - 2026-09-11

### Corregido

- **La puerta se replegaba en cada llamada con DSH 0.1.2, así que la página Approvals quedaba
  vacía.** El pliegue del preajuste de permisos de la sesión leía el log como
  `exec.agent.session.events`. DSH 0.1.1 exponía ese array; 0.1.2 hizo el log privado tras
  `Session.snapshotEvents()` / `ownEvents()` y no conservó ningún miembro `events`, así que la
  lectura devolvía `undefined`, `presetOf` respondía `undefined`, y
  `presetInScope(undefined, ['permissive'])` hacía `gateActive` falso para **cada** llamada: sin
  decisión de regla, concesión, palabra clave deny, clasificador o denegación dura P0, y sin
  evento de auditoría — incluso en sesiones que habían elegido el nivel propio de la puerta, por
  lo que la pestaña mostraba "本会话暂无审批记录" en lugar de un fallo. El pliegue ahora lee el
  log a través de todas las formas de accesor conocidas (array `events`, `snapshotEvents()`,
  `ownEvents()`) y solo degrada a «sin eventos» cuando el host no expone ninguno; la caché del
  pliegue se indexa por la longitud del log más la identidad de su último evento, ya que un
  snapshot 0.1.2 es un array fresco sobre los mismos eventos congelados en cada lectura.
  `test/preset-scope.spec.ts` fija ambas formas: una sesión de forma `0.1.2` debe producir una
  decisión (y un evento registrado), y un log crecido debe replegarse para que un cambio de
  preajuste surta efecto en la siguiente llamada.

### Cambiado

- **La serie de versiones de la línea `main` es ahora `2.x`, siguiendo la línea de DSH que
  sirve.** `1.x` es la línea de DSH `<= 0.1.1` y `2.x` la de DSH `0.1.2+`, de modo que una
  versión del plugin dice para qué DSH se construyó; `2.0.0` es la primera entrega de la nueva
  serie y las entregas `0.2.x` (`0.2.0`, `0.2.1-beta.2`…`beta.5`) quedan superadas por ella. Los
  mayores se cercan entre sí — `^1.0.0` no resuelve `2.0.0` y `^2.0.0` no resuelve `1.0.0` — así
  que una instalación existente `^0.2.1-beta.4` (que tampoco resuelve `2.0.0`) debe subirse
  deliberadamente. `engines.dsh` declara la misma separación (`>=0.1.2-alpha.1 <0.2.0-0` aquí,
  `>=0.1.0-rc.7 <0.1.2-alpha.1` en `legacy`), pero DSH nunca lo lee: son los rangos de versión y
  los dist-tags lo que mantienen un DSH antiguo en `1.x`.
- **El nivel de permisos está etiquetado 自动审查 en cada superficie, sin icono.** El `name:` del
  preajuste en `cordis.patch.yml` es ahora la cadena de producto china, y la fila por defecto de
  los ajustes generales, el selector del composer y la pestaña de ajustes del plugin la muestran
  todos. DSH 0.1.2 renderiza el `name:` de un nivel aportado por un plugin literalmente y
  localiza solo los tres valores integrados (`仅可查看` / `工作区内修改` / `完全权限`), de modo
  que la única cadena suministrada por el host es lo que ve una sesión zh; el valor de máquina
  del nivel sigue siendo `permissive`, que es con lo que casa `gatePresets`. La decoración de
  icono del selector de permisos se elimina (`src/client/permission-icon.ts` borrado): existía
  para igualar el glifo de escudo del nivel `auto` retirado, se aplicaba a la fila de ajustes a
  través del selector `aria-haspopup="menu"` de 0.1.2, y un nivel de plugin no dibuja glifo
  porque los glifos del composer están indexados solo a los valores integrados.

## [0.2.1-beta.4] - 2026-09-11

### Añadido

- Estrategia `trustEscalation` en el nivel Permissive (activa por defecto mientras el nivel esté
  activo): una aprobación de escalada de sandbox para una llamada que esta puerta ya había
  permitido recibe aquí la respuesta `allowed-once` en vez de preguntarle a usted. La escalada la
  levanta `approveEscalation` desde *dentro* del cuerpo de la herramienta shell / pwsh / edit —
  después de que `tools/pre-execute` se haya saldado — de modo que el allow propio de la puerta
  nunca la alcanzaba y una llamada que el LLM calificó `safe` le pedía igualmente aprobar el
  ensanchamiento. Solo la llamada exacta que la puerta despejó (emparejada por `callId` y nombre
  de herramienta) se salta el aviso, y solo por una razón de escalada reconocida que nombre
  `workspace-write` / `danger-full-access`; todo lo demás delega al humano sin cambios. La
  respuesta automática queda registrada en el flujo de eventos (`verdict:"escalation-auto"`,
  `mode:<objetivo>`). Apague el interruptor para mantener el ensanchamiento de sandbox bajo
  control humano.

### Corregido

- La tarjeta de ajustes ahora siembra la lista blanca editable desde el fichero de reglas.
  `installSettingsSection` llamaba a `scope.set('allowlist', …)` sobre el scope de ajustes **del
  host**, que solo expone `get` / `watch` / `update` / `replace` — `set(field, value)` es el
  envoltorio de conveniencia del *cliente* sobre `mutate()`, un objeto distinto — así que la
  llamada lanzaba y el espacio de nombres quedaba sin sembrar. Ahora usa
  `scope.update({ allowlist: … })`.
- El listener `approval/request` se registra con `prepend` y es ahora una puerta que responde en
  vez de un observador pasivo, así que se sienta delante del puente remoto que renderiza el aviso
  en el navegador. Un listener detrás de ese puente solo podía registrar un aviso ya mostrado.
- La mitad de navegador ya no importa `@deepseek-ai/dsh-client-runtime`, que DSH eliminó en
  `0.1.2-alpha.1`. `ClientContext` viene ahora de `@deepseek-ai/cordis` — el alias que DSH 0.1.1
  definía como `export type ClientContext = Context`, de modo que nombra el mismo tipo en ambas
  líneas — y la tarjeta de ajustes declara localmente los cuatro miembros de scope que usa
  (`SettingsScopeLike`), el mismo patrón de cara local que la mitad del host ya emplea para el
  servicio `settings` del host. El contrato del cliente es idéntico byte a byte en ambas líneas;
  solo se mudó el paquete que lo exporta.

### Cambiado

- La compatibilidad con DSH ahora se envía como **dos ramas de larga vida**, cada una con su
  propia serie de versiones, su `engines.dsh` y su dist-tag de npm: `main` / `0.2.x` /
  `>=0.1.2-alpha.1 <0.2.0-0` / `latest`, y `legacy` / `1.x` / `>=0.1.0-rc.7 <0.1.2-alpha.1` /
  `legacy`. Esta rama es `main`. Véase `RELEASING.md` para la disposición de ramas y el flujo de
  cherry-pick.
- En esta línea `ctx.slots` lo declara `@deepseek-ai/dsh-client-ui-renderer/client` — desde
  `0.1.2-alpha.1` `@deepseek-ai/dsh-client-runtime` ya no existe — de modo que la entrada del
  cliente lo importa de ahí.
- Los suelos de las devDependency del cliente se subieron de `^0.1.0-rc.7` a `^0.1.5-rc.2`, y se
  añadió `@deepseek-ai/dsh-client-ui-renderer`. El suelo antiguo significaba que la compilación
  solo podía resolver el conjunto de paquetes 0.1.0-rc.8, así que esta línea nunca se había
  compilado contra él.
- `npm run verify:line` (`scripts/verify-line.mjs`) instala los paquetes de la línea de esta rama
  con `npm install --no-save` y corre typecheck + pruebas + build contra ellos, de modo que una
  compilación compila siempre contra los paquetes para los que la rama envía. `npm run
  verify:lines` es una comprobación de deriva opt-in que compila en ambas líneas y compara los
  bundles.

## [0.2.1-beta.3] - 2026-09-10

### Añadido

- `llmAssist` con riesgo graduado: el LLM propio configurado (cualquier endpoint compatible con
  OpenAI) califica cada `ask` como `safe` / `risky:<categoría>`; las categorías duras (deletion /
  credential / remote / system / bulk) deniegan automáticamente, los tiempos agotados reintentan
  una vez, y todo fallo permanece fail-closed.
- Aprendizaje de veredictos (`riskLearning`, desactivado por defecto; `riskThreshold` 1–10, 3 por
  defecto): los ask de riesgo neutro confirmados por un humano y realmente ejecutados cuentan
  hacia el auto-allow de la misma operación exacta (emparejada por huella) — persistidos en
  `$DSH_HOME/perm-gate/learning.json`, nunca en las reglas YAML del usuario.
- Flujo de eventos de decisión: cada decisión se añade a `$DSH_HOME/perm-gate/events.jsonl` y se
  sirve en `GET /api/dsh-perm-gate/events?sessionId=&since=`; la mitad de navegador muestra la
  última decisión como franja de aviso sobre la entrada de conversación.
- El icono del selector de permisos ahora decora también el disparador colapsado del selector.
- Página de registros de aprobación: la vista de conversación gana una pestaña **Approvals** que
  enumera las decisiones de la puerta de la sesión de lo más reciente a lo más antiguo (línea de
  tiempo con etiquetas de tipo, categoría de riesgo y hora); la lista blanca de la tarjeta de
  ajustes es ahora una lista de reglas editable con borrado por fila y un conmutador de edición
  en bloque.
- Sedimentación del aprendizaje (`riskSediment`, activada por defecto): las muestras confirmadas
  de una clave que alcanzó el umbral se convierten en reglas auto-allow deterministas — los
  aciertos exactos de huella se saltan por completo la llamada al LLM y sobreviven al interruptor
  llmAssist; la tarjeta de ajustes las enumera con terminación por clave y eliminación por
  muestra (respaldadas por `GET/POST /api/dsh-perm-gate/learning`).
- Receptor de llmAssist seleccionable: **API propia** (compatible con OpenAI, con preajustes de
  endpoint que incluyen Xiaomi MiMo `https://api.xiaomimimo.com/v1`) o **grupo de modelos del
  host DSH** (servicio `llm` + `agentDefaultModel.currentSelection`, proveedor/modelo
  sustituibles) — más un botón de **prueba de salud** (`POST /api/dsh-perm-gate/health`) que
  ejecuta una completación mínima e informa de la latencia. La tarjeta lee el catálogo en vivo de
  proveedores/grupos de modelos (host `llm.listProviders`/`listModels` — incluidos los grupos
  propios configurados por el usuario) vía `GET /api/dsh-perm-gate/receiver` y muestra la
  selección efectiva de proveedor/modelo.
- Lista negra de palabras clave deny de preajuste heredada de dsh-approval-gate
  (`DEFAULT_DENY_KEYWORDS`): un acierto de palabra clave sin distinguir mayúsculas veta la
  llamada antes de la lista blanca / las concesiones / el LLM; editable como lista en la tarjeta
  de ajustes con etiquetas de preajuste y restauración de un clic; sin fijar o vacía aplica el
  preajuste (la lista negra nunca se apaga en silencio).
- **Plano de revisión de los registros de aprobación**: los ficheros afectados por cada decisión
  se copian en instantáneas antes de que el cambio aterrice (≤ 5 ficheros, ≤ 256 KB cada uno)
  bajo `$DSH_HOME/perm-gate/snapshots/`; la pestaña **Approvals** convierte esos ficheros en
  chips pulsables que abren un diff de líneas (`GET /api/dsh-perm-gate/diff`) con una acción de
  **revert** que entrega una instrucción de restauración en la conversación
  (`POST /api/dsh-perm-gate/revert`), más una barra de inventario de instantáneas
  (`GET /api/dsh-perm-gate/snapshots-stats`, `POST /api/dsh-perm-gate/snapshots-clear`, por
  sesión o todo). Las filas de evento llevan ahora `files`, `justification`, `verdict` y
  `category`.
- **Registros terminales de aprobación manual**: un `ask` enrutado a un humano se rastrea y se
  salda con la respuesta real del humano por un observador pasivo `approval/request` —
  `allowed-once` → aprobado, `rejected` → rechazado, `cancelled` → cancelado, `unavailable` → una
  denegación (no había canal de aprobación). `tools/result` salda el mismo ask como respaldo
  cuando el observador no puede correlacionarlo (`callId` ausente, sin servicio de aprobación, o
  un listener anterior que cortocircuita la cascada); «borrar al saldar» es toda la regla de
  desduplicación. Las aprobaciones informan del progreso de aprendizaje posterior a la aprobación
  (`n`/umbral), y la franja de aviso etiqueta los tres estados terminales.

### Eliminado

- El nivel de permisos **Auto** retirado ya no se redeclara en `cordis.patch.yml`. El parche del
  bundle de DSH reemplaza todo el mapa `permission.config.presets`, así que este fichero debía
  llevar cada nivel que debía sobrevivir — incluido `auto`, que aportaba `dsh-auto-mode`. Ese
  plugin está desinstalado: sus perillas eran idénticas a `workspace-write`, su descripción
  «revisión automática / aprobación de un disparo» perdió con él su implementación, y esta puerta
  está inactiva en ese nivel (`gatePresets` es `['permissive']` por defecto). El selector ofrece
  ahora los tres integrados (`read-only` / `workspace-write` / `danger-full-access`, redeclarados
  desde `@deepseek-ai/dsh-base/cordis.patch.yml`) más el `permissive` de este plugin.
- `test/patch-presets.spec.ts` fija exactamente ese conjunto de claves, de modo que ya no puede
  abandonarse un nivel integrado (ni resucitarse uno retirado) sin hacer fallar la suite.

### Cambiado

- **Soporte de DSH de doble versión (0.1.0-rc.7 … 0.1.2-rc.1).** Un artefacto cubre ahora
  `dsh-v0.1.1-rc.2` y `dsh-v0.1.2-rc.1` sin comprobación de versión. `effectivePolicy` es un
  método **privado** del servicio de aprobación de usuario en ambas versiones, de modo que se lee
  tras un sondeo `typeof`, y un sondeo que lance o falte se degrada ahora a «política desconocida»
  (el ask se mantiene) en vez de hacer fallar la vía de decisión. El registro de ajustes conserva
  `ctx.settings.register`, presente en cada versión soportada. `dsh.client.inject` ya no nombra
  `@deepseek-ai/dsh-client-runtime` (eliminado en 0.1.2) ni `@deepseek-ai/dsh-client-ui-slots`
  (no es una fila de cliente dinámica en ninguna versión); ahora enumera las filas de cliente
  reales en las que renderiza. Se añadieron al README `engines.dsh` y una tabla de compatibilidad
  de versiones.
- La puerta está **activa solo en los niveles de permisos listados en `gatePresets`** (por
  defecto `['permissive']`, el nivel que añade este plugin). En cualquier otro nivel — Read Only,
  Workspace Write, Auto, Full access, `custom` — su flujo de decisión no corre en absoluto: ni
  allow, ni ask, ni deny, ni denegación dura P0, ni veto de palabra clave deny, ni evento de
  auditoría. `gatePresets: ['*']` vuelve a hacer global la puerta (denegación dura incluida); un
  embedding que no pase alcance conserva el comportamiento heredado.
- `llmAssist` usa ahora el protocolo de categorías de riesgo (superconjunto de los veredictos
  allow/deny/ask anteriores); `classifier.ts` comparte un único transporte compatible con OpenAI
  (`chatCompletion`) con el calificador de riesgo. Las categorías de riesgo duras (`deletion` /
  `credential` / `remote` / `system` / `bulk`) ahora **deniegan automáticamente** en vez de
  enrutar al humano — la operación es claramente peligrosa y no hace falta ningún popup; solo
  `risky:neutral` (incierto) sigue llegando al seam humano.
- Las herramientas `write` / `edit` tienen ahora un **valor por defecto consciente de la ruta**:
  las escrituras dentro del espacio de trabajo siguen el `defaultAction` configurado (típicamente
  `allow`); las escrituras a rutas fuera del espacio de trabajo de la sesión escalan a `ask` para
  que el contenido pueda revisarse. El clasificador LLM puede entonces auto-permitir contenido
  seguro o auto-denegar contenido dañino, de modo que solo las operaciones verdaderamente
  inciertas producen un popup.

### Corregido

- **El «safe» de `llmAssist` ahora de verdad auto-permite en vez de limitarse a registrarse.**
  El listener `tools/pre-execute` devolvía el `ask` inmediatamente y calificaba la llamada en
  segundo plano, pero un ask entregado al host ya va de camino a los respondedores de aprobación
  y DSH no ofrece API para retractarlo (el `signal` propio de la petición solo puede saldarlo
  como `cancelled`). El panel aparecía, pues, igualmente y el humano tenía que pulsar, mientras
  el flujo mostraba el auto-allow `safe` — y un `auto-deny` de riesgo duro no llegaba jamás al
  host. El listener espera ahora `refineAsk` **antes** de devolver la decisión
  (`makePreExecuteListener`): `safe` delega vía `next()` sin panel, una categoría de riesgo duro
  auto-deniega, y solo `risky:neutral` / `unresolved` / un fallo del calificador conservan el ask
  humano (fail-closed). La espera está acotada por `riskTimeoutMs` (20 s por defecto) y una
  llamada ya cancelada se salta la calificación.
- **La capa de patrones de escritura de shell nunca corría para la herramienta de shell principal
  de DSH.** `SHELL_TOOLS` listaba `bash` / `pwsh` / `sh` / `cmd` / `powershell` pero no
  **`shell`** (el nombre de la herramienta propia de DSH) ni `terminal`, así que `git push`,
  `chmod`, `tee`, las redirecciones y cualquier otro patrón de escritura caían al `defaultAction`
  en vez de escalar a `ask`. La lista es ahora `shell` / `terminal` / `bash` / `pwsh` / `sh` /
  `cmd` / `powershell`, y la copia duplicada en `learning.ts` se eliminó (fuente única en
  `evaluate.ts`, para que la vía de decisión y la huella de aprendizaje no vuelvan a divergir).
- **La detección de redirecciones y `tee` era demasiado estrecha.** Solo `>>` emparejaba, así que
  `echo x > /tmp/out.txt` y un desnudo `tee /tmp/log.txt` se trataban como de solo lectura. `> f`
  / `>> f` / `>f` escalan ahora mientras los modismos de stderr que usa un comando de solo
  lectura (`2>&1`, `>&2`, `2>/dev/null`, `1>&2`) siguen siendo de solo lectura; `curl` / `wget`
  escalan solo cuando escriben un fichero (`-o` / `-O` / `>`).
- **`decideRules` ignoraba `args.command`.** Leía solo el `ctx.commandText` derivado, de modo que
  cualquier llamante que construyera un contexto a mano (tests, integradores) perdía
  silenciosamente la inspección del comando. Ahora recae en `args.command`, al igual que
  `PermGateRuntime.ctxFor`.
- **La puerta rebasaba el nivel de permisos que el usuario eligió.** Posee un nivel de aprobación
  independiente, pero actuaba en *cada* preajuste: todo cruce se volvía un `ask`, `dsh-tools` lo
  reenviaba al seam de aprobación de DSH, y bajo el preajuste `danger-full-access`
  (`approval: never`) ese seam devuelve `rejected` **antes de que corra cualquier respondedor** —
  nunca se renderizaba panel y toda llamada no de solo lectura fallaba con el engañoso
  `the user rejected tool "..."`. Sus capas de denegación dura y de palabra clave ignoraban el
  nivel igualmente, así que `danger-full-access` («acceso completo sin avisos de aprobación»)
  quedaba estrechado en silencio. La puerta entera está ahora acotada a `gatePresets`; fuera de
  ellos la puerta es inerte y no registra nada. Dentro de un nivel activo, un `ask` sigue
  degradándose a paso transparente cuando la política de aprobación efectiva de la sesión es
  `never`, de modo que un ask irrespondible nunca se vuelve una denegación.
- **La búsqueda de solo lectura y las herramientas locales de sesión se preguntaban.** `web_search`
  y `modlens_read_image` son consultas de solo lectura y `todo_write` / `render_ui` /
  `validate_dsh_ui` / `ask_user_question` / `exit_plan_mode` / `ralph` / `workflow` son estado de
  sesión o delegación, pero ninguno estaba en la clasificación de auto-allow, de modo que cada
  uno levantaba un `ask` (el popup `no rule matched; default action`). Ahora están
  auto-permitidos, y una nueva lista de configuración `autoAllowTools` extiende la clasificación
  a herramientas de solo lectura de terceros. La denegación dura P0 y la capa de palabra clave
  siguen corriendo primero, así que la lista nunca puede ensanchar la autoridad.
- **`write` / `edit` a rutas fuera del espacio de trabajo pasaban en silencio a través.** Una
  llamada que escribe en `~/.bashrc` o en los ficheros de otra unidad recibía el `defaultAction`
  configurado (típicamente `allow`) y se ejecutaba sin revisión. Ahora se aplica una
  sobreescritura consciente de la ruta a las herramientas write/edit cuando ninguna regla
  empareja: las escrituras dentro del espacio de trabajo siguen el `defaultAction` configurado,
  pero toda ruta de destino fuera del espacio de trabajo de la sesión escala a `ask` para que el
  contenido pueda revisarse — el contenido dañino se deniega; las adiciones benignas se
  auto-permiten cuando `llmAssist` está activado. Las reglas deny explícitas siguen ganando al
  margen del alcance de ruta, y las reglas allow explícitas pueden conceder acceso a rutas
  internas pero jamás eludir la revisión de las externas.
- **La detección de credenciales P0 escaneaba los cuerpos de documentos**, así que escribir o
  editar cualquier fichero que meramente *mencionara* un token, una clave privada o
  `credentials.yaml` se denegaba en duro. Ahora escanea solo los argumentos que describen la
  operación (`command`, `file_path`, …), igual que la regla existente de la capa de palabra
  clave: el texto de un fichero no es la operación.
- **Un `$DSH_HOME/perm-gate/rules.yml` nunca se cargaba.** `rulesFile` no tenía valor por
  defecto, así que una entrada de perfil que omitiera `config` dejaba la puerta con un conjunto
  de reglas vacío y `defaultAction: ask` — el `defaultAction: allow` del usuario y sus reglas
  `allow:` se ignoraban en silencio. `rulesFile` es ahora por defecto `<dataDir>/rules.yml` (como
  `eventsFile` / `learningFile`), y el espejo de lista blanca de la tarjeta de ajustes sí escribe
  ahí.
- **`format` vetaba el cmdlet de PowerShell `Format-Table`.** Un guion no es una frontera de
  palabra para un identificador de comando, así que la lista negra emparejaba `Format-Table` /
  `Format-List`. Los bordes de palabra clave emparejan ahora contra caracteres de identificador
  (`[A-Za-z0-9_-]`), de modo que `format C: /q` sigue cazándose mientras `Format-Table` y
  `mkfs.ext4` se comportan como antes.
- **Toda consulta de lectura exigía aprobación manual.** `read` / `read_image` / `grep` / `glob`
  / `ls` / `lsp` son operaciones de lectura confinadas al espacio de trabajo que no pueden
  modificar nada (la denegación dura P0 sigue bloqueando lecturas de rutas sensibles fuera de la
  raíz del espacio de trabajo). Ahora están auto-permitidas. Lo mismo vale para todas las
  herramientas internas de coordinación de DSH (`agent_teams_*`, `conversation_search`,
  `memory_*`, `get_goal` / `update_goal` / `create_goal`, `taskboard_*`, `job_*`, `list_agents` /
  `interrupt_agent` / `send_message`, `subagent` / `subagent_fork` / `terminal` / `skill`).

- **La pestaña Approvals no resolvía ningún id de sesión**, de modo que no enumeraba nada mientras
  la barra de instantáneas mostraba el inventario global. Un ocupante de `conversation.view`
  recibe las props estándar en el nivel superior (`sessionId` / `useSessions`) — la forma que
  consume `ConversationRoot` — y no bajo `slotsProps`; la vista y la franja de aviso sondean ahora
  el nivel superior, la forma anidada y el hook de lista de sesiones.
- **Los eventos se registraban con id de sesión vacío**, de modo que la pestaña Approvals (que
  filtra por la sesión actual) no mostraba nada aunque `events.jsonl` se llenaba. El
  `ToolExecution` de DSH lleva la sesión en `agent.session.id` (el cwd del espacio de trabajo en
  `agent.session.header.cwd`), no en `exec.sessionId` / `exec.cwd`; ambos se leen ahora del agent
  cuando los campos directos faltan.
- **La página de revisión estaba muerta en silencio en una instalación por defecto**: con una
  entrada de perfil que omite `config`, `dshHome` quedaba vacío, así que el directorio de datos
  era `undefined` y el log de eventos nunca se construía — sin `events.jsonl`, sin instantáneas,
  sin aprendizaje persistido, y un 404 en `GET /api/dsh-perm-gate/events`. `dshHome` se resuelve
  ahora a un valor explícito, si no `$DSH_HOME`, si no `~/.dsh`, de modo que
  `<dshHome>/perm-gate/{events.jsonl,learning.json,snapshots/}` se escribe siempre.
- El emparejamiento de palabras clave deny ya no veta una palabra clave que meramente aparece
  dentro de un identificador más largo, y los argumentos de cuerpo de documento (`content`,
  `new_string`, `old_string`, `text`, …) ya no se escanean en absoluto — el texto de un fichero
  no es la operación. El emparejamiento es ahora consciente de las fronteras de palabra, de modo
  que las palabras clave bordeadas de puntuación y CJK siguen funcionando, y los espacios se
  colapsan de modo que un comando escrito con espacios de más sigue cazándose.


### Añadido
- **Nivel Permissive** — un modo de aprobación independiente en paralelo a read-only /
  workspace-write / full-access / whitelist. Un único interruptor frontal (`permissive`) más
  estrategias de backend combinables (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`); la
  denegación dura P0 se mantiene monótona.
- Fuentes de decisión de auditoría `classifier` / `permissive`; hook `classify` inyectable
  opcional para `llmAssist` (fail-closed ante `ask`/ausencia).
- **Cliente de navegador** — una página `settings.plugins.tab` («Nivel de aprobación
  Permissive») se renderiza en Ajustes → Plugins: un interruptor (`permissive`) + tres
  conmutadores `permissiveStrategies` de backend. El host lee el espacio de nombres en vivo, de
  modo que las ediciones se aplican en la siguiente llamada a herramienta sin reiniciar.
- Flag de CLI `--permissive` y resumen permissive en `--list`.
- **LLM real para llmAssist** — un clasificador configurable compatible con OpenAI
  (`classifierEndpoint` / `classifierModel`), invocado para decidir automáticamente un `ask` y
  fail-closed hacia el seam humano.
- **Migración de lista blanca** — `approveAllowEverywhere` persiste una palabra de comando en la
  lista blanca `allow` del fichero de reglas y recarga; `approveRepeat` acuña una concesión de
  sesión acotada. Ambos respaldan los dos botones allow extendidos del panel always-confirm.
- **Guías de instalación en cuatro idiomas** — `INSTALL.md` / `INSTALL.zh.md` / `INSTALL.ja.md` /
  `INSTALL.ko.md` cubriendo instalación, actualización, migración desde los plugins separados,
  verificación y resolución de problemas; cada README ganó enlaces de cambio de idioma, una nota
  de compatibilidad `ja` / `ko` (el `LOCALE_IDS` oficial de DSH es `["zh", "en"]`) y una
  referencia de versión.
- README.ja / README.ko ampliados a espejos completos de la fuente de verdad en inglés (tabla de
  la cadena P0–P4, por qué/funcionalidades, formato del fichero de reglas, nivel Permissive, CLI).

## [0.1.0] - 2026-08-30

### Añadido
- Cadena de decisión P0–P4: denegación dura, concesión de sesión, cadena de reglas estática con
  deny primero, clasificador opcional (apagado), `ask`.
- Motor de reglas de funciones puras: compilación glob/regex con cota de ReDoS, análisis con fallo
  ruidoso, caché de compilación por hash de contenido.
- Lista blanca/negra de comandos vía descomposición argv (recursión `sh -c`/`bash -c`, tuberías,
  redirecciones, recursive/force).
- Concesiones de sesión precisas indexadas por huella canónica (TTL + maxUses, sin reutilización
  entre destinos).
- Auditoría de decisiones `{ignorable:true}` con invariante visible-al-modelo⟺registrado.
- Evaluador CLI autónomo de dry-run (`dsh-perm-gate --rules … --tool … --args …`).
- Contrato de plugin de función cordis de DSH (`cordis.patch.yml`, `Config` de Schemastery,
  exports/types).
- README en 4 idiomas (en/zh/ja/ko) y andamiaje Keep-a-Changelog (en + ja + ko).
