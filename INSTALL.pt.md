# Guia de instalação

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Português README](./README.pt.md)
- [Installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Guia de instalação em português](./INSTALL.pt.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)
- [Changelog em português](./CHANGELOG.pt.md)

`dsh-perm-gate` versão **2.4.1**. Continue com o [README](./README.md) para a cadeia de decisão,
o formato do arquivo de regras e o nível 自动审查.

## Requisitos

- Uma instalação existente do [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
- Node.js **>= 20** (veja `engines` em `package.json`).
- O CLI `dsh` no seu `PATH`.
- Um perfil para instalar — a metade de navegador só é entregue para o perfil `web`
  (`dsh.client.platform = "web"` em `package.json`).

## Escolha a tag para a sua versão do DSH

Um único build atende às duas linhas do DSH, então qualquer uma das tags instala código
funcional — a tag existe para que uma versão que você fixa permaneça significativa por linha.

| Seu DSH | Instalação |
|----------|---------|
| `0.1.2-alpha.1` ou mais novo (incl. `0.1.5-rc.2`) | `dsh plugin --profile web add dsh-perm-gate` (tag `latest`) |
| até `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

O DSH não impõe o `engines.dsh`, de modo que as tags são o mecanismo de seleção, não uma
porteira de compatibilidade. Veja [RELEASING.md](./RELEASING.md) para entender por que um único
artefato cobre as duas linhas e como as tags são publicadas.

## Instale com a CLI oficial

```sh
dsh plugin --profile web add dsh-perm-gate
```

Isso traz o pacote publicado, aplica o `cordis.patch.yml` dele (o nível de sessão 自动审查 mais a
entrada do plugin) e monta as duas metades.

## Instale a partir da fonte

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` é também o passo `prepublishOnly`, de modo que publicar nunca entrega um
`lib/` desatualizado.

## Ative e configure

Adicione o plugin ao `cordis.yml` do seu perfil:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # tiers where the gate is active at all (default)
```

Comece por [examples/permissions.example.yaml](./examples/permissions.example.yaml)
e recarregue o perfil.

## Atualização

```sh
dsh plugin --profile web update dsh-perm-gate
```

Depois reaplique o perfil para que o arquivo de patch seja relido:

```sh
dsh profile reload --profile web
```

## Depois de um **upgrade do DSH**: reaplique o patch de glifo do composer

O nível 自动审查（高权限） mostra o mesmo glifo escudo+olho que 自动审查 apenas porque
`scripts/patch-permission-glyph.mjs` o acrescentou a um **mapa fechado dentro de um pacote do host
DSH**. O DSH deliberadamente não dá glifo a níveis configurados pelo host — o comentário do próprio
mapa diz *"host-configured names outside the design set get none"* — e os objetos de opção que um
plugin pode influenciar carregam apenas `{value, name, description}`, então não existe costura
alternativa do lado do plugin.

Esse patch edita um arquivo do **host**, portanto um upgrade ou reinstalação do DSH o apaga.
Atualizar *este plugin* não o apaga: o plugin nunca foi dono do glifo, e sua própria contribuição
(`name:` / `description:` em `cordis.patch.yml`) viaja dentro do pacote.

```sh
npx dsh-perm-gate-patch-glyph            # apply the patch
npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is gone
dsh profile reload --profile web
```

O script **viaja dentro deste pacote** — como `scripts/patch-permission-glyph.mjs` e como o bin
`dsh-perm-gate-patch-glyph` — então não é preciso um checkout da fonte. Ele deliberadamente
**não** está ligado ao `postinstall`: edita um pacote do host, e um plugin não deve reescrever seu
harness sem ser convidado. Rodar o DSH não é afetado de nenhum jeito; o nível funciona com ou sem ele.

É idempotente (uma segunda execução é no-op), faz backup do bundle uma vez, e se recusa a gravar um
bundle mal recortado — roda `node --check` no resultado e restaura o backup se falhar — portanto é
seguro executá-lo incondicionalmente após todo upgrade do DSH. Ele localiza o bundle a partir do
binário `node` em execução, de modo que uma troca de versão do nvm ou um symlink de instalação
reapontado não o quebram.

**Reinstalar o plugin não restaura o glifo.** `dsh plugin --profile web add …` encaminha ao pnpm
dentro do diretório do perfil e escreve apenas o `node_modules` do próprio perfil; `-w`
(`--workspace-root`, e o workspace deste perfil é apenas `packages: ['.']`) não muda nada nisso.
O glifo mora na instalação do DSH. Numa instalação de estoque estes não são três cópias, mas
**um arquivo físico**:

| Caminho | O que é |
|------|------------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | a instalação do DSH (pode ser um symlink) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | um **junction** para ela |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | o arquivo patcheado |

Sintoma a observar: o nível continua funcionando e continua regendo corretamente, mas sua linha no
dropdown do composer não tem ícone e o gatilho colapsado renderiza texto simples onde os outros
níveis renderizam glifo + texto.

## Migre dos plugins divididos

O `dsh-perm-gate` funde o portal, a costura de aprovação e o classificador (opcional) que viviam
espalhados entre `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review` e
`dsh-movein-permissions`.

1. Exporte suas listas de regras existentes (deny / allow / ask) e funda-as num único documento
   `permissions.yaml`.
2. Remova os quatro plugins do `cordis.yml` e acrescente a entrada única `dsh-perm-gate` acima.
3. Delete quaisquer sobrescritas de preset que aqueles plugins contribuíam — o `cordis.patch.yml`
   **substitui** `permission.config.presets` por inteiro, de modo que patches por-chave obsoletos de
   outros plugins podem silenciosamente derrubar o nível 自动审查 (ou um embutido).
4. Recarregue o perfil e verifique com `--list` (abaixo).

## Verifique

```sh
# summarize the loaded ruleset (no harness needed)
dsh-perm-gate --rules permissions.yaml --list

# dry-run one call
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

Forma esperada da saída do `--list`:

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

Na interface, **Settings → Plugins → 自动审查** deve renderizar um interruptor mais os quatro
interruptores de estratégia de backend.

## Desinstalação

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Remover o plugin também remove sua contribuição de patch, de modo que o nível 自动审查 desaparece
de novo do seletor de permissões da sessão.

## Solução de problemas

**O nível 自动审查 sumiu do seletor de permissões.**
O patch do bundle do DSH substitui o mapa `permission.config.presets` inteiro em vez de mesclar por
chave. Recarregue o perfil para que o `cordis.patch.yml` seja reaplicado, e garanta que nenhum
plugin posterior sobrescreva `presets`.

**自动审查（高权限） perdeu o ícone no composer.**
Um upgrade ou reinstalação do DSH substituiu o bundle de host no qual o glifo foi patcheado;
reexecutar a instalação do plugin não o traz de volta. Rode `npx dsh-perm-gate-patch-glyph` e
recarregue. O nível em si não é afetado — seu rótulo e sua regência continuam funcionando sem o patch.

**O `--list` reporta `ruleCount: 0` embora meu arquivo de regras exista.**
`rulesFile` é resolvido contra o CWD do processo do harness, não contra o diretório do plugin.
Prefira um caminho absoluto ou confira o CWD do shell. Um documento malformado falha alto na carga —
nunca é desativado em silêncio.

**O `llmAssist` nunca dispara.**
Ele precisa de `classifierEndpoint`, `classifierModel` e `classifierApiKey` (defina-os em
**Settings → Plugins → 自动审查** ou no `cordis.yml`). Qualquer valor ausente ou erro de rede cai
de volta na costura humana — o portal é fail-closed por design.

**A aba Approvals fica vazia.**
O portal tem escopo nos níveis listados em `gatePresets` (padrão `['permissive']`), de modo que não
registra nada enquanto a sessão roda em outro nível — escolha 自动审查 no seletor de permissões para
a sessão que quer ver registrada. Uma sessão que nunca selecionou um preset também está fora do escopo.
Sessões novas começam no nível nomeado pela configuração `permission.defaultPreset`.

**O cartão de configurações mostra "Settings namespace unavailable".**
O plugin não está montado no perfil ativo. Rode `dsh plugin --profile web add dsh-perm-gate` e
recarregue.

**Selecionar `ja` / `ko` falha com `locale "<id>" is not registered`.**
O DSH oficial expõe apenas `zh` / `en` através do `LocaleRuntime`. Veja a nota de compatibilidade no
[README](./README.md).

## Licença

[MIT](./LICENSE)
