# Registro de mudanças

## 5.6.0 (2026-11-23)

- **Gavetização do cartão de configurações (refatoração só do client, comportamento inalterado nas seis linhas de host)**: o "Portal de revisão automática" passa de ~10 seções planas para "chave frontal permanente + seis gavetas recolhíveis" — níveis não supervisionados / estratégias de aprovação e classificador LLM / testes e diagnóstico / listas de permissão e bloqueio / proteção de credenciais / rede e recarga a quente. Cada cabeçalho de gaveta traz um resumo de estado ao vivo (níveis ativos, contagem de estratégias, permissões/bloqueios, famílias readwrite, estados de rede/recarga), legível sem abrir. Otimizações de conteúdo: a dica `tierScopeHint`, duplicada com `card.scopeNote`, foi removida (10 idiomas); o visualizador do documento de regras passou de busca no mount para busca na primeira expansão (o dry-run continua sob clique); as palavras predefinidas embutidas da denylist ficam recolhidas em "Palavras integradas (%n)" por padrão, com palavras personalizadas e linha de adição sempre visíveis (os antigos chips de etiqueta preset/custom são substituídos pelo agrupamento); título `card.unattended` encurtado (o parêntese foi para o hint existente); as três seções de rede foram fundidas em um grupo. A vaga `plugins.bundle.config` usa o mesmo cartão e recebe a mudança junto. O guarda de diagnóstico virou forma estável de hooks (corrige o risco de ordem do return precoce que pulava hooks). Ids de controles, caminhos de envio, máquina de estados do interruptor otimista, half de host e rotas de server permanecem intocados.

## 5.5.4

- i18n: add Portuguese (pt-BR) locale — runtime dictionary, package metadata and README/INSTALL/CHANGELOG mirrors.
- i18n: acrescentado o idioma português (pt-BR) — dicionário em tempo de execução, metadados do pacote e espelhos README/INSTALL/CHANGELOG.
- Face de terminal (dsh-tui / mesma fonte do painel de comandos do Desktop): /gate de terminal (status/rules/why/history/grants) + `GrantRegistry.list()`.

## Unreleased

## 5.5.2 (2026-11-12)

- Correção de ruptura de tipos do client (legado do `autoAllowTools` do 5.5.0): `PermissiveCardValue` declara agora `autoAllowTools?: string[]`; os sete pacotes de idioma (ja/ko/fr/de/it/ru/es) tiveram a chave complementada.
- 5.5.1 recolhido: fora da janela de 72 horas, o npm não permite unpublish — adotou-se `deprecate` e todas as dist-tags das linhas de host apontam para 5.5.2.

## 5.5.0 (2026-11-06)

- **`apply_patch` auto-permitido por padrão (sensível a caminho)**: a ferramenta interna do host 0.2.2 passa a ser tratada no mesmo degrau de READ_TOOLS — sem popup, sem chamar o modelo — mas P0 duro, caminhos de credenciais e a camada de regras deny/ask continuam em peso; `extractPathCandidates` aprendeu a ler o texto de patch do Codex.
- Cartão de configurações expõe a whitelist `autoAllowTools` (campo volatile `string[]`, efeito imediato) para ferramentas de terceiros registradas por outros plugins.
- Enumeração de host 0.2.2-rc.1 nos dois manifestos (engines.dsh + peers).

## 5.4.4 (2026-11-03)

- Interruptor de isenção de workspace do YOLO `yoloWorkspaceExempt` (desligado por padrão): `opaque` dividido em `consequence` (conteúdo invisível) versus `location` (ato visível, alvo não fixável); o interruptor só ignora `location`, e apenas em `permissive-yolo`.
- Scripts invisíveis agora contam de fato como opaque: corpo `too-large` / `binary` / `unreadable` leva a chamada ao degrau U (antes só scripts fora do workspace).

## 5.4.3 (2026-11-03)

- Correção do fail-open #6: o host entrega os campos volatile **por referência**; o `...config` os espalhava para as opções de runtime, onde não eram nem `deny` nem `ask` e a chamada passava sem regra. Agora `resolveVolatileConfig` dereferencia antes de construir.
- Correção do falso SAFE #7: a revisão do host só colhia `text-delta`; o encerramento por `max-tokens`/`length`/`content-filter` virou falha, e a palavra-chave nua `safe` saiu do `parseRiskVerdict`.
- Correção de integração do host-review #8: `classifierEffort` controla o `reasoningEffort`; `POST …/health` deixou de usar o corpo errado.

## 5.4.2 (2026-11-02)

- A opinião de bloqueio deixou de se passar por mensagem do usuário: o `工具审核意见` pós-bloqueio saiu da fila `mode:'queue'` (a fila de input do usuário) e passou a ser entregue por `buildBlockNoteSender` na faixa de steering.
- Complemento: o `dsh-input-traffic` restringiu «interrompendo» a interrupções humanas (`source.kind === 'user'`).

## 5.4.0 (2026-10-30)

- Escada de famílias de credenciais: sete famílias embutidas (ssh / cloud / package / gitcreds / env / cli / db), quatro degraus `deny / ask` (padrão) / `readonly` / `readwrite` por família; o estado mora no próprio documento de regras (`[deny-rule:cred.<family>]`) mais a lista pareada de isenção de escrita.
- Motor: `decide()` pré-consulta a camada de regras para ferramentas READ; ferramentas INTERNAL de coordenação nunca são pré-consultadas; novo módulo puro `src/cred-families.ts`.
- Semeadura: tabela de predefinições 52→59 linhas; novo marco volatile `presetRulesVersion` (reabastecimento idempotente por id; linhas revogadas nunca revivem).
- Piso de push em branch protegida `allowProtectedBranchPush` (volatile, desligado por padrão) e nova predefinição `[deny-rule:rsync.delete]`.

## 5.3.2 (2026-10-18)

- Esclarecimento de escopo: o plugin é um **guarda pré-execução** (comandos Git/destrutivos de sistema de arquivos antes de rodar; acesso a chaves SSH, .env etc. — P0 duro + revisor mecânico determinístico, ativo sem modelo de revisão).
- Esclarecimento de nomes/descrições dos degraus: «自动审查» marcado como «自动审查（dsh沙箱中）»; filtros mecânicos rebaforam «perguntar só quando perigoso/indeterminado»; sincronizados cordis.patch.yml + cartões zh/en.
- hosts: acrescentada a enumeração declarativa 0.2.1-rc.2 (34/34 peers verificados por pacote; zero mudanças de código, release puro metadado).

## [5.3.1] - 2026-10-17

### Added

- Suporte de host: DSH `0.2.1-rc.1` (enumeração engines/peers + matriz de compatibilidade).

### Changed

- `publishConfig.registry` fixado em `https://registry.npmjs.org` (higiene de publicação).

## [5.3.0] - 2026-10-17

### Added

- Nível **YOLO** (`yolo`, dono do preset `permissive-yolo`): nunca levanta um humano.
- **Revisão degradada** (`rulesFallback`) e **revisão de script** (`scriptReview`, ligada por padrão).
- Proteção declarada pelo usuário, toda aditiva e aplicada a quente: `credentialPaths`, `denyKeywordsExtra`, `extraContentArgKeys` / `extraOperationArgKeys`.
- Três implementações não supervisionadas, um interruptor e um preset cada (`safenetAsk`, `safenetPass`, `yolo`); o YOLO não afirma um revisor que não obteve; um piso mecânico único para todos os níveis.
- Cartões com interruptores-pílula otimistas; o histórico de aprovações rotula os caminhos de decisão.

### Fixed

- Issue #2: prosa de ferramenta de documento não é mais lida como operação; Issue #3/#4 e mais (pré-vistoria de escrita confusa com `=>`/`->`, cofres de credenciais mutados por `write`/`edit`, chave pública de keypair, redação da auditoria `deny-keyword`).

### Known gap

- `pathArgument` lê apenas campos singulares; ferramentas que executam o documento que recebem não são lidas dele.

## [5.2.0] - 2026-10-14

### Added

- `src/preset-rules.ts`: 51 entradas `[deny-rule:*]` portadas do cc-safety-net (MIT); `argv.pipeline` avaliado por comando simples também.

### Fixed

- A semeadura rodava dentro do corpo síncrono do `apply` (serviço de configurações ainda não montado); regras e flag de idempotência viraram uma única chamada `update`; `rawEntry()` emitia `ParamCondition[]` compilados; removido o fallback de semear no `perm-gate/rules.yml` do próprio plugin.

## [5.1.2] - 2026-10-12

### Changed

- **Versão formal**: consolida todo o trabalho verificado na linha `compat-legacy` (compat.2 … compat.15) num release formal.

## [5.1.2-compat.15] - 2026-10-12

### Changed

- Texto de prompt segue o idioma da UI (faixa de aviso + registros de aprovação): o `humanBrief` gerado pelo servidor era estocado em inglês cru.

## [5.1.2-compat.14] - 2026-10-12

### Changed

- O comando não fica mais encravado no texto: a typografia do painel de aprovação do host é fixa (`.headline` não preserva quebras de linha), e o layout foi adaptado a ela.

## [5.1.2-compat.13] - 2026-10-11

### Added

- O popup não entrega só códigos internos: `humanBrief()` traduz um ask em três partes legíveis (dúvida, superfície de impacto, o custo de cada botão).
- O registro de aprovação fica revisitável: o mesmo brief desce ao evento de desfecho humano (`humanBrief` + `doubtKinds`).

### Fixed

- Comandos somente-leitura marcados como `target=write` (julgamento por segmento agora); a whitelist de nomes de ferramentas era um vetor de evasão (julgamento por **forma**).

### Known gap

- O painel exibe o brief em inglês (linguagem de auditoria); renderizar as `doubtKinds` nos 9 idiomas exigiria 10 chaves × 9 línguas em `locales.ts`.

## [5.1.2-compat.12] - 2026-10-11

### Fixed

- `reg delete` casava apenas a raiz do hive, não as formas de subchave realmente em uso (`REGISTRY_DESTROY` exigia `\b` após `system`).

## [5.1.2-compat.11] - 2026-10-11

### Added

- Novos módulos puros: `src/redact.ts` (primitiva de ocultação delimitada e idempotente — antes o payload do grader viajava inteiro), `src/ask-context.ts` (uma construção, três projeções), `src/irreversible.ts` (fonte única de irreversibilidade em três camadas), `src/command-normalize.ts` (decodificação de bypass base64/hex/variáveis com quatro peias) e `src/grader-rules.ts` (critério único de classifier e risk).
- `displayReason` do popup; observabilidade de evicção FIFO do `PENDING_CAP`.

### Changed

- `unknown-target` virou categoria de risco **dura**; julgamento por posição do nome do programa; prompt versionado (`v7-terse-budget`, latência medida por `timings.prompt_ms`).

### Fixed

- Backslashes eram removidos de argumentos nus (regras Windows `HKLM\SYSTEM` etc. falhavam em silêncio); o separador de correntes confundia `Select-String -Pattern "…|diskpart"` com execução; `containsCredentialMaterial` negava dureza demais (`Bearer` arbitrário, sondas `Test-Path`); o número da versão do `dsh.plugin.json` defasado do package.json; teste de assento obsoleto corrigido.

## [5.1.2-compat.10] - 2026-10-08

### Removed

- Aposentada a engrenagem flutuante `shell.overlay`: a superfície de configurações é renderizada por `settings.section` em todas as linhas de host.

## [5.1.2-compat.9] - 2026-10-08

### Changed

- Reversão da tabificação da família (decisão do usuário: a porta «自动审查» fica fora da tabificação); `settings.plugins.tab` + assento testável fixados na forma de seção única.

## [5.1.0] - 2026-10-05

### Changed

- Enumeração unificada das 15 linhas rc para os três subpacotes de host.

## [2.6.0] - 2026-09-17

### Added

- **Teste de regra (dry-run) no cartão de configurações**: avalia uma chamada hipotética sem rodar e sem escrever regra.
- `POST /api/dsh-perm-gate/dry-run` — somenti leitura por construção; `src/dry-run.ts` (`runDryRun` / `createDryRunRuntime`) compartilhado entre CLI e a UI.

### Fixed

- O painel reportava `allow` para chamadas que as regras mandam ao humano; a rota "read-only" na verdade rodava o caminho de decisão virado ao host.

## [2.5.0] - 2026-09-17

### Added

- Dimensão de regra `branch` (git branch / remote / branch protegida).

### Fixed

- A cadeia multi-arquivo esvaziava silenciosamente toda dimensão casada; `argv.pipeline` não via o próprio assunto; nove erros pré-existentes de `eslint`.

## [2.4.1] - 2026-09-17

### Fixed

- O histórico de aprovações mostrava a string crua `preset-passthrough` no evento que a produzia.

## [2.4.0] - 2026-09-17

### Changed

- **O classificador LLM P3 é só de escalada — não pode mais negar**; categorias duras mantêm uma distinção meaningful de `neutral`: nunca são aprendidas.

### Behaviour notes

- Sob `approval: never`, um ask que o portal não consegue entregar ainda degrada para passthrough.

## [2.3.0] - 2026-09-17

### Added

- Uma postura-de-lado deixou de ser silenciosa: evento `stand-down` + faixa **GATE OFF**; o cartão «自动审查» afirma o próprio escopo de presets.

### Changed

- O posicionamento documentado do P0 passou a ser delimitado, não global.

### Fixed

- `DEFAULT_GATE_PRESETS` / `resolveGatePresets` movidos de `config.ts` (que importa o serviço) para um módulo puro.

## [2.2.0] - 2026-09-17

### Fixed

- A negação dura P0 ignorava quase todas as ferramentas de shell; `git push --delete` era lido como push ordinário; a detecção de branch protegida disparava com qualquer nome contendo barra.

### Added

- Negação P0 para reescrita de histórico remoto em branch protegida.

### Tests

- Nova suíte `test/git-protected-push.spec.ts` (13 casos), com **falsificação**: reverter cada correção acende exatamente os casos que a guardam; suíte completa 40 arquivos / 459 casos.

## [2.1.2] - 2026-09-15

### Added

- O patch de glifo do composer viaja no pacote (`scripts/patch-permission-glyph.mjs` + bin).

### Changed

- Partes puras exportadas e testáveis; `candidateBundles` também sonda o escopo por perfil sob `$DSH_HOME`.

## [2.1.1] - 2026-09-15

### Added

- **Superfície de execução de rede (opt-in, desligada por padrão)**: proxy HTTP/CONNECT local.
- **Dois níveis «自动审查»** (`permissive` com sandbox de arquivos; `permissive-full` sem).
- Expansão do modelo de regras (seis dimensões novas) e recarga a quente por chokidar.

### Fixed

- Uma conexão bloqueada podia derrubar o host; ferramentas embutidas pediam aprovação; corridas de ciclo de vida do proxy; `permissive-full` sem ícone.

### Changed

- `networkUnattributed` passa a permitir por padrão; `networkUnlisted` pergunta; `DEFAULT_GATE_PRESETS` = `['permissive', 'permissive-full']`.

### Documented

- O proxy de rede é camada de política cooperativa, não fronteira de imposição; varredura de sessões segue o ciclo de vida da sessão.

## [2.0.0] - 2026-09-11

### Fixed

- Sob DSH 0.1.2 o portal se punha de lado em toda chamada e a página Approvals ficava vazia.

### Changed

- A série de versões da linha `main` passou a `2.x`, acompanhando a linha do DSH que serve; o nível de permissão é rotulado «自动审查» em toda superfície, sem ícone.

## [0.2.1-beta.4] - 2026-09-11

### Added

- Estratégia `trustEscalation` no nível Permissive.

### Fixed

- O cartão de configurações semeia a whitelist editável a partir do arquivo de regras; o ouvinte `approval/request` virou porteira respondedora; a metade de navegador parou de importar o `@deepseek-ai/dsh-client-runtime` removido.

### Changed

- Compatibilidade DSH passou a **dois ramos de longa duração**, cada um com sua série, engines e dist-tag; `ctx.slots` declarado por `@deepseek-ai/dsh-client-ui-renderer/client` na linha main; pisos de devDependency elevados; `npm run verify:line`.

## [0.2.1-beta.3] - 2026-09-10

### Added

- `llmAssist` graduado por risco; aprendizado de veredictos (`riskLearning`, limiar 1–10); feixe de eventos de decisão; ícone no seletor de permissões; página de registros de aprovação; sedimentação de aprendizado; receptor selecionável do `llmAssist`; lista predefinida de palavras-chave de bloqueio; plano de revisão de aprovações com instantâneos + diff + reverter; registros terminais de aprovação humana.

### Removed

- O nível **Auto** aposentado saiu do `cordis.patch.yml`; o teste fixa o conjunto exato de chaves de presets.

### Changed

- Suporte a duas versões do DSH (0.1.0-rc.7 … 0.1.2-rc.1) num único artefato; portal ativo só nos `gatePresets`; protocolo de categorias de risco; padrão sensível a caminho para `write`/`edit`.

### Fixed

- `safe` do `llmAssist` passou de fato a auto-permitir; a camada de padrões de escrita nunca rodava na ferramenta de shell primária; detecção de redirecionamento/`tee` estreita; `decideRules` ignorava `args.command`; o portal sobrepunha o nível escolhido pelo usuário; perguntas sobre buscas somente-leitura e ferramentas locais; escrita fora do workspace passava; detecção de credenciais vasculhava corpo de documentos; o `rules.yml` padrão nunca era carregado; `format` vetava `Format-Table`; toda consulta pedia aprovação; a aba Approvals não resolvia session id; eventos estocados com session id vazio; a página de revisão ficava morta numa instalação padrão; palavras dentro de identificadores maiores deixam de vetar.

### Added

- Nível **Permissive**; fontes de auditoria `classifier` / `permissive`; client de navegador (`settings.plugins.tab`); flag CLI `--permissive`; LLM real configurável; migração para whitelist; guias de instalação em quatro idiomas; README.ja/ko expandidos a espelhos integrais do inglês.

## [0.1.0] - 2026-08-30

### Added

- Cadeia de decisão P0–P4: negação dura, concessão de sessão, cadeia estática deny-first, classificador opcional (desligado), `ask`.
- Motor de regras de função pura (glob/regex com limite anti-ReDoS, falha ruidosa, cache por hash).
- Whitelist/blacklist de comandos por decomposição de argv (`sh -c`/`bash -c` recursivo, pipelines, redirecionamentos, recursivo/forçado).
- Concessões de sessão precisas por impressão digital canônica (TTL + maxUses, sem reuso entre alvos).
- Auditoria `{ignorable:true}` com invariante «visível ao modelo ⟺ registrado».
- CLI autônoma de dry-run (`dsh-perm-gate --rules … --tool … --args …`).
- Contrato de função-plugin cordis do DSH (`cordis.patch.yml`, `Config` Schemastery, exports/types).
- README em 4 idiomas (en/zh/ja/ko) e arcabouço Keep-a-Changelog (en + ja + ko).
