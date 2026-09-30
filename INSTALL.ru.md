# Руководство по установке

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

`dsh-perm-gate` версии **2.4.1**. Продолжайте с [README](./README.ru.md) — там цепочка
решений, формат файла правил и уровень 自动审查.

## Требования

- Существующая установка [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
- Node.js **>= 20** (см. `engines` в `package.json`).
- CLI `dsh` в вашем `PATH`.
- Профиль, в который выполняется установка — браузерная половина поставляется только для профиля
  `web` (`dsh.client.platform = "web"` в `package.json`).

## Выберите тег под вашу версию DSH

Одна сборка обслуживает обе линии DSH, так что любой из двух тегов устанавливает работающий код —
тег существует затем, чтобы зафиксированная версия оставалась осмысленной в пределах линии.

| Ваш DSH | Установка |
|----------|---------|
| `0.1.2-alpha.1` или новее (вкл. `0.1.5-rc.2`) | `dsh plugin --profile web add dsh-perm-gate` (тег `latest`) |
| до `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH не проверяет `engines.dsh`, поэтому теги — механизм выбора, а не барьер совместимости. См.
[RELEASING.md](./RELEASING.md): почему один артефакт покрывает обе линии и как публикуются теги.

## Установка официальной CLI

```sh
dsh plugin --profile web add dsh-perm-gate
```

Это подтягивает опубликованный пакет, применяет его `cordis.patch.yml` (уровень сессии
自动审查 плюс запись плагина) и собирает обе половины.

## Установка из исходников

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` — это и шаг `prepublishOnly`, так что публикация никогда не поставит устаревший
`lib/`.

## Включение и настройка

Добавьте плагин в `cordis.yml` вашего профиля:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # tiers where the gate is active at all (default)
```

Оттолкнитесь от
[examples/permissions.example.yaml](./examples/permissions.example.yaml), затем перезагрузите
профиль.

## Обновление

```sh
dsh plugin --profile web update dsh-perm-gate
```

Затем повторно примените профиль, чтобы файл патча был перечитан:

```sh
dsh profile reload --profile web
```

## После обновления **DSH**: повторно примените патч глифа композера

Уровень 自动审查（高权限） показывает тот же глиф «щит+глаз», что и 自动审查, только потому,
что `scripts/patch-permission-glyph.mjs` добавил его в **закрытую карту внутри хостового пакета
DSH**. DSH по дизайну не даёт глифов уровням, конфигурируемым хостом, — комментарий самой карты
гласит *«host-configured names outside the design set get none»*, — а объекты опций, на которые
плагин может влиять, несут лишь `{value, name, description}`; никакой плагинной точки входа
вместо этого нет.

Тот патч правит **хостовый** файл, поэтому обновление или переустановка DSH его стирает.
Обновление *самого плагина* — нет: плагин никогда не владел глифом, а его собственный вклад
(`name:` / `description:` в `cordis.patch.yml`) едет внутри пакета.

```sh
npx dsh-perm-gate-patch-glyph            # apply the patch
npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is gone
dsh profile reload --profile web
```

Скрипт **едет внутри этого пакета** — как `scripts/patch-permission-glyph.mjs` и как bin
`dsh-perm-gate-patch-glyph` — так что чекаут исходников не нужен. Он сознательно **не** подключён
к `postinstall`: он правит хостовый пакет, а плагин не должен переписывать свой харнесс без
приглашения. Работающий DSH в любом случае не затронут; уровень работает и без него.

Он идемпотентен (второй прогон — no-op), однократно делает резервную копию бандла и отказывается
писать неверно нарезанный бандл — он прогоняет `node --check` по результату и восстанавливает
резервную копию при неудаче, — поэтому его можно безусловно запускать после каждого обновления
DSH. Он находит бандл по запущенному бинарнику `node`, так что смена версии nvm или перепрошитый
симлинк установки его не сломают.

**Переустановка плагина не возвращает глиф.** `dsh plugin --profile web add …` перенаправляет в
pnpm внутри каталога профиля и пишет только собственный `node_modules` профиля; `-w`
(`--workspace-root`, а workspace этого профиля — просто `packages: ['.']`) ничего не меняет.
Глиф живёт в установке DSH. На стандартной установке это не три копии, а **один физический
файл**:

| Путь | Что это |
|------|------------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | установка DSH (может быть симлинком) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | **junction** в неё |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | пропатченный файл |

Симптом, по которому искать: уровень работает и корректно регулирует, но его строка в выпадающем
списке композера без иконки, и свёрнутый триггер рендерит простой текст там, где остальные уровни
рендерят глиф + текст.

## Миграция с раздельных плагинов

`dsh-perm-gate` объединяет ворота, шов одобрения и (опциональный) классификатор, которые раньше
жили в `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review` и `dsh-movein-permissions`.

1. Экспортируйте существующие списки правил (deny / allow / ask) и слейте их в один документ
   `permissions.yaml`.
2. Удалите четыре плагина из `cordis.yml` и добавьте единственную запись `dsh-perm-gate` выше.
3. Удалите все переопределения пресетов, которые вносили эти плагины, — `cordis.patch.yml`
   **заменяет** `permission.config.presets` целиком, так что устаревшие по-ключевые патчи других
   плагинов могут молча лишить вас уровня 自动审查 (или встроенного).
4. Перезагрузите профиль и проверьте через `--list` (ниже).

## Проверка

```sh
# summarize the loaded ruleset (no harness needed)
dsh-perm-gate --rules permissions.yaml --list

# dry-run one call
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

Ожидаемая форма вывода `--list`:

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

В интерфейсе **Настройки → Плагины → 自动审查** должен показать один переключатель плюс четыре
тумблера серверных стратегий.

## Удаление

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Удаление плагина убирает и его патч-вклад, так что уровень 自动审查 снова исчезает из селектора
разрешений сессии.

## Устранение неполадок

**Уровня 自动审查 нет в селекторе разрешений.**
Патч бандла DSH заменяет всю карту `permission.config.presets`, а не сливает по ключам.
Перезагрузите профиль, чтобы `cordis.patch.yml` был применён заново, и убедитесь, что ни один
более поздний плагин не перезаписывает `presets`.

**自动审查（高权限） потерял иконку в композере.**
Обновление или переустановка DSH заменила хостовый бандл, в который был впаян глиф; повторная
установка плагина его не вернёт. Выполните `npx dsh-perm-gate-patch-glyph` и перезагрузите.
Сам уровень не затронут — подпись и регулирование работают и без патча.

**`--list` сообщает `ruleCount: 0`, хотя мой файл правил существует.**
`rulesFile` разрешается относительно CWD процесса харнесса, а не каталога плагина. Предпочтите
абсолютный путь или проверьте CWD оболочки. Некорректный документ громко падает при загрузке —
он никогда не отключается молча.

**`llmAssist` никогда не срабатывает.**
Ему нужны `classifierEndpoint`, `classifierModel` и `classifierApiKey` (задайте их в
**Настройки → Плагины → 自动审查** или в `cordis.yml`). Любое отсутствующее значение или сетевая
ошибка возвращает решение человеческому шову — ворота по построению fail-closed.

**Вкладка Approvals пустует.**
Ворота ограничены уровнями из `gatePresets` (по умолчанию `['permissive']`), поэтому пока сессия
работает на другом уровне, они ничего не записывают — выберите 自动审查 в селекторе разрешений
той сессии, которую хотите видеть записанной. Сессия, ни разу не выбиравшая пресет, тоже вне
охвата. Новые сессии стартуют на уровне, названном настройкой `permission.defaultPreset`.

**Карточка настроек показывает "Settings namespace unavailable".**
Плагин не собран в активный профиль. Выполните
`dsh plugin --profile web add dsh-perm-gate` и перезагрузите.

**Выбор `ja` / `ko` падает с `locale "<id>" is not registered`.**
Официальный DSH предоставляет через `LocaleRuntime` только `zh` / `en`. См. примечание о
совместимости в [README](./README.ru.md).

## Лицензия

[MIT](./LICENSE)
