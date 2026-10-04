/**
 * test-host-compat.mjs —— 本地隔离矩阵执行体（improve-dsh-plugins/enum-peer-migration
 * /INDEX.md §E：`_wt` 工作树 + 离线 tgz 的 CI 前身）。
 *
 * 以 dsh-input-traffic/scripts/test-host-compat.mjs（P2 定型版）为底，按本仓
 * 改编（_tools/host-compat README §3 改编清单）：
 *   - 插件名正则 `dsh-perm-gate-.*\.tgz`；重名归因签名按 `dsh-perm-gate` 过滤；
 *   - **P-G 功能下限**：boot 绿后、宿主存活窗口内，对宿主 webServer 打
 *     `GET /api/dsh-perm-gate/events?since=`（apply() 真正跑过、路由真正注册
 *     才会 200 + events 数组；HTTP 200 即宿主半区功能在位）。宿主半区无槽位、
 *     无 DOM 面，input-traffic 的槽位扫描不适用；headless 矩阵探不到 client
 *     半区（浏览器面沿 paste-dock P1 先例后置 CI 化）。
 *   - **执行体三坑守恒**（P4 tidy-display 定案）：bootOnce 就绪后**不自动杀**，
 *     探针先行、探完杀树；沙箱必须落 os.tmpdir 一族（本执行体沿用 input-traffic
 *     的格子内 sandbox 目录，cells 树不含 packageManager 钉，corepack 走默认
 *     pnpm，无 ERR_PNPM_ADDING_TO_ROOT 风险）；插件包打 tar 用 pnpm pack。
 *
 * 每格 = 一个宿主 rc，流程：
 *   1. tgz 缓存（`pnpm pack @deepseek-ai/dsh@<version>` → `.compat-results/host-tgz/`）；
 *   2. 沙箱安装：`@deepseek-ai/dsh` tgz + **钉宿主自己的 Cordis 线**（INDEX §A 铁律：
 *      cordis 本体 + group/hmr/include/loader/timer 五件，按宿主线 4.0.2/4.0.4 分档），
 *      pnpm `--ignore-scripts`；
 *   3. 插件经**宿主 CLI 自建 profile**：`dsh plugin --profile web add <插件tgz>` ——
 *      peer 闸在装格这一步即咬合（add 日志可判 plugin-blocked）；
 *   4. 引导形态自动协商：A 形 `--profile web --port 0 --no-open`，老线不认顶层
 *      --port/--no-open 时回退 C 形裸启动（会开浏览器）；就绪横幅先到先得。
 *   5. 存活窗口 HTTP 探针（events 路由）→ 杀树 → 归因。
 *
 * 归因（日志签名）：
 *   - ready + 探针 200 + 无签名 → green
 *   - ready 但探针失败          → plugin-inert（挂载了但 apply/路由面缺失）
 *   - /requires the Cordis HMR service/ → host-blocked（宿主引导墙，非插件问题）
 *   - /is incompatible with dsh/（add 或 boot 期）→ plugin-blocked（peer 闸拒入/拒挂）
 *   - 挂载/审计/重名签名        → plugin-blocked
 *
 * 产物：`matrix/<v>/{sandbox, plugin-add.log, boot-*.log, probe.json, result.json}`
 * + 汇总 `results.json`；绿名单写 `verified.json`（sync-hosts 据此下发四语 README
 * 的 Runtime-verified 行）。
 *
 * 用法：
 *   node scripts/test-host-compat.mjs                     # 全量（hosts.mjs 枚举）
 *   node scripts/test-host-compat.mjs --only 0.2.0-rc.2   # 单格复跑
 *   node scripts/test-host-compat.mjs --keep              # 保留 sandbox 便于复查
 *   node scripts/test-host-compat.mjs --force             # 忽略已有结论强制重跑
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { supportedHosts } from './hosts.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const RESULTS = path.join(ROOT, '.compat-results')
const MATRIX = path.join(RESULTS, 'matrix')
const TGZ_CACHE = path.join(RESULTS, 'host-tgz')
// 已有矩阵沉淀的宿主 tgz 缓存（date-wrapper P0 / paste-dock P1，15 格全量）——
// 种子源：命中即硬链接/直拷，不再对宿主跑 pack（pnpm pack 在仓内树上撞
// workspace 钉的坑，tidy-display P4 定案用 npm pack，这里更进一步直接复用）。
const SEED_TGZ_DIRS = [
  path.resolve(ROOT, '..', 'dsh-date-wrapper', '.compat-results', 'host-tgz'),
  path.resolve(ROOT, '..', 'dsh-paste-dock', '.compat-results', 'host-tgz'),
]
// 沙盒基址必须落在「上溯链无 pnpm-workspace.yaml」的中立地（tidy-display 的
// 「放 os.tmpdir」配方在本机已失效）：本仓根有 allowBuilds-only 的 workspace
// 文件（仓内 cwd 撞「packages field missing or empty」），且本机 %USERPROFILE%
// 也有一份——%TEMP% 整棵树同样被污染。E:\test\rewrite-tmp 实测中立（本机
// 矩阵专用路径；CI 化时改成 runner 分配的干净目录）。产物（日志/探针/结论）
// 仍落仓内 cell 目录，与 paste-dock 布局一致。
const SANDBOX_HOME = process.env['DSH_COMPAT_SANDBOX_HOME'] ?? 'E:\\test\\rewrite-tmp\\dsh-perm-gate-compat'
const WIN32 = process.platform === 'win32'
const PNPM = WIN32 ? 'pnpm.cmd' : 'pnpm'
const INSTALL_ARGS = ['install', '--ignore-scripts', '--prefer-offline', '--loglevel=error']
const REGISTRY = '--registry=https://registry.npmjs.org/'

/** INDEX §A 铁律：cordis-plugin-* 钉宿主自己的 Cordis 线（映射表与 paste-dock 执行体一致）。 */
function cordisPin(hostVersion) {
  const [triplet] = hostVersion.split('-')
  const [maj, min, patch] = triplet.split('.').map(Number)
  return [maj, min, patch] >= [0, 1, 7] ? '4.0.4' : '4.0.2'
}
const CORDIS_PLUGIN_PINS = {
  '4.0.2': {
    '@deepseek-ai/cordis-plugin-group': '1.0.2',
    '@deepseek-ai/cordis-plugin-hmr': '1.0.17',
    '@deepseek-ai/cordis-plugin-include': '1.0.7',
    '@deepseek-ai/cordis-plugin-loader': '1.0.3',
    '@deepseek-ai/cordis-plugin-timer': '1.1.4',
  },
  '4.0.4': {
    '@deepseek-ai/cordis-plugin-group': '1.0.4',
    '@deepseek-ai/cordis-plugin-hmr': '1.0.19',
    '@deepseek-ai/cordis-plugin-include': '1.0.9',
    '@deepseek-ai/cordis-plugin-loader': '1.0.5',
    '@deepseek-ai/cordis-plugin-timer': '1.1.6',
  },
}

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined
const keep = args.includes('--keep')
const force = args.includes('--force')
const bootTimeoutSec = args.includes('--timeout') ? Number(args[args.indexOf('--timeout') + 1]) : 90
const versions = only ? [only] : [...supportedHosts]

/** 顺序跑外部命令，非零退出/超时均带尾巴抛错。（win32 的 pnpm.cmd 必须经 shell 启动） */
function run(cwd, cmd, cmdArgs, label, limitMs = 15 * 60_000, env = process.env) {
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8', shell: WIN32, windowsHide: true, timeout: limitMs, env })
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
    throw new Error(`${label} 超时（>${Math.round(limitMs / 60_000)}min）`)
  }
  if (r.status !== 0) {
    throw new Error(
      `${label} 失败（exit ${r.status}${r.error ? `，${r.error.code ?? r.error.message}` : ''}）\nstdout: ${(r.stdout ?? '').slice(-600)}\nstderr: ${(r.stderr ?? '').slice(-600)}`,
    )
  }
  return r
}

async function ensureTgz(version) {
  await mkdir(TGZ_CACHE, { recursive: true })
  const dest = path.join(TGZ_CACHE, `deepseek-ai-dsh-${version}.tgz`)
  if (existsSync(dest)) return dest
  for (const seed of SEED_TGZ_DIRS) {
    const from = path.join(seed, `deepseek-ai-dsh-${version}.tgz`)
    if (existsSync(from)) {
      await copyFile(from, dest)
      console.log(`       seed host tgz ${version}（${path.relative(ROOT, seed)}）`)
      return dest
    }
  }
  console.log(`       pack host ${version}`)
  await run(TGZ_CACHE, 'npm', ['pack', `@deepseek-ai/dsh@${version}`, `--pack-destination=${TGZ_CACHE}`, '--registry=https://registry.npmjs.org/', '--loglevel=error'], `npm pack host ${version}`)
  return dest
}

/** 就绪横幅（宽松：老版本横幅不一定带 dsh 前缀）；带端口捕获供 HTTP 探针。 */
const READY_RE = /https?:\/\/(127\.0\.0\.1|localhost):(\d+)(\/\S*)?/
const HMR_WALL_RE = /requires the Cordis HMR service/
const COMPAT_BLOCK_RE = /is incompatible with dsh/
const AUDIT_RE = /startup audit|failed to mount|mount error|failed to start/i
const DUP_RE = /already (been )?registered|duplicate|conflict/i

function killTree(child) {
  if (child.exitCode !== null) return
  if (WIN32) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
  else child.kill('SIGKILL')
}

/**
 * 启动并**持住**（存活窗口）：resolve 于就绪横幅/提前退出/超时先到先得；
 * 就绪时进程保持运行，由调用方探针后调 stop() 杀树。
 */
function bootHold(binJs, cwd, env, extraArgs, timeoutSec) {
  const child = spawn(process.execPath, [binJs, ...extraArgs], { cwd, env, windowsHide: true })
  let log = ''
  child.stdout.on('data', (d) => { log += d })
  child.stderr.on('data', (d) => { log += d })
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve({ exited: true, code })))
  const timer = new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutSec * 1000))
  const ready = (async () => {
    while (!READY_RE.test(log)) {
      if (child.exitCode !== null) return { exited: true, code: child.exitCode }
      await new Promise((r) => setTimeout(r, 400))
    }
    return { ready: true, url: READY_RE.exec(log)?.[0], port: Number(READY_RE.exec(log)?.[2]) }
  })()
  const pending = Promise.race([exited, timer, ready]).then((outcome) => ({
    outcome,
    log,
    stop: async () => {
      killTree(child)
      await new Promise((r) => setTimeout(r, 300)) // 杀树后给日志冲刷留时间
      return log
    },
  }))
  return pending
}

/**
 * 存活窗口内打 events 路由：200 + JSON + events 数组 = 宿主半区功能在位。
 * webServer 鉴权是签名 cookie（api-gateway isAuthenticated）：先拿 ready 横幅
 * 的 `?token=` 打首页换 Set-Cookie（dsh-auth-<authority>=v1.…），再带 cookie
 * 打 API——客户端就是这条流程。
 */
function probeEvents(port, readyPath, timeoutMs = 10_000) {
  const token = /[?&]token=([^&\s]+)/.exec(readyPath ?? '')?.[1] ?? ''
  const get = (path, cookie) => new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path, timeout: timeoutMs, headers: cookie ? { cookie } : {} },
      (res) => {
        let body = ''
        res.on('data', (d) => { body += d })
        res.on('end', () => resolve({ status: res.statusCode, setCookie: res.headers['set-cookie'], body }))
      },
    )
    req.on('timeout', () => { req.destroy(new Error('probe timeout')) })
    req.on('error', (e) => resolve({ status: 0, setCookie: undefined, body: String(e.message ?? e) }))
  })
  return (async () => {
    const page = await get(`/?token=${encodeURIComponent(token)}`)
    // 老线（≤0.1.1）首页无 token 鉴权：200 且无 Set-Cookie——直接裸打 API。
    const cookie = page.setCookie?.[0]?.split(';')[0]
    if (cookie === undefined && page.status !== 200) {
      return { status: 0, ok: false, body: `no auth cookie from /?token= (status ${page.status})` }
    }
    const api = await get('/api/dsh-perm-gate/events?since=', cookie)
    let parsed
    try { parsed = JSON.parse(api.body) } catch { /* 非 JSON 视为失败 */ }
    return { status: api.status, ok: api.status === 200 && Array.isArray(parsed?.events), body: api.body.slice(0, 300) }
  })()
}

async function runCell(version) {
  const cell = path.join(MATRIX, version)
  // 沙盒在 os.tmpdir（逃出仓库树，见 SANDBOX_HOME 注释）；先清残再建。
  const sandbox = path.join(SANDBOX_HOME, version)
  const homeDir = path.join(sandbox, 'home')
  const userProfile = path.join(sandbox, 'user')
  const workspace = path.join(sandbox, 'workspace')
  await rm(sandbox, { recursive: true, force: true })
  for (const dir of [sandbox, userProfile, workspace]) await mkdir(dir, { recursive: true })
  const env = { ...process.env, DSH_HOME: homeDir, USERPROFILE: userProfile }
  const checks = { version, notes: [] }

  // 1-2. 宿主 tgz + 钉线安装（宿主 + cordis 五件套）
  const hostTgz = await ensureTgz(version)
  const cordis = cordisPin(version)
  const hostDir = path.join(sandbox)
  if (!existsSync(path.join(hostDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))) {
    const pins = { '@deepseek-ai/cordis': cordis, ...CORDIS_PLUGIN_PINS[cordis] }
    await writeFile(path.join(hostDir, 'package.json'), JSON.stringify({
      name: 'dsh-host-cell',
      private: true,
      dependencies: { '@deepseek-ai/dsh': pathToFileURL(hostTgz).href, ...pins },
    }, null, 2))
    console.log(`       install host ${version}（cordis 线 ${cordis}）…`)
    await run(hostDir, PNPM, INSTALL_ARGS, `install host ${version}`)
  }
  checks.hostInstalled = JSON.parse(await readFile(path.join(hostDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8')).version === version
  if (!checks.hostInstalled) throw new Error(`宿主安装版本与格子不符: ${version}`)
  const binJs = path.join(hostDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')

  // 3. 打插件包 → 宿主 CLI 自建 profile 并装入（peer 闸在此步咬合）
  console.log(`       pack plugin …`)
  await run(ROOT, 'npm', ['pack', `--pack-destination=${cell}`, '--loglevel=error'], 'npm pack plugin')
  const packed = (await readdir(cell)).find((f) => /^dsh-perm-gate-.*\.tgz$/.test(f))
  if (!packed) throw new Error('插件 tgz 打包失败')
  const pluginTgz = path.join(cell, packed)
  // 直接用 node 起 bin.js：`cmd /c <file.js>` 依赖 .js 文件关联，本机关联缺失
  // 时静默 exit 0（模板坑，input-traffic 形态在本机翻车实录）——node 直启零歧义。
  // npm_config_ignore_workspace_root_check：宿主内部 pnpm add 落在 profile
  // workspace 根，pnpm 默认拒装（ERR_PNPM_ADDING_TO_ROOT，farm 同坑同解）。
  const addRun = spawnSync(process.execPath,
    [binJs, 'plugin', '--profile', 'web', 'add', pluginTgz, REGISTRY],
    { cwd: sandbox, encoding: 'utf8', shell: false, windowsHide: true, timeout: 10 * 60_000,
      env: { ...env, npm_config_ignore_workspace_root_check: 'true' } })
  const addLog = `${addRun.stdout ?? ''}${addRun.stderr ?? ''}`
  await writeFile(path.join(cell, 'plugin-add.log'), addLog)
  checks.pluginAdded = addRun.status === 0
  if (!checks.pluginAdded) {
    if (COMPAT_BLOCK_RE.test(addLog)) {
      checks.verdict = 'plugin-blocked'
      checks.notes.push('plugin add 阶段 peer 闸拒绝')
      await writeResult(cell, checks)
      return checks
    }
    throw new Error(`dsh plugin add 失败（exit ${addRun.status}）\n${addLog.slice(-600)}`)
  }

  // 4. 引导形态协商：A 形（--port 0 --no-open）→ C 形（裸启动，会开浏览器）
  const shapes = [
    ['A', ['--profile', 'web', '--port', '0', '--no-open']],
    ['C', ['--profile', 'web']],
  ]
  let boot = { outcome: {}, log: '', stop: async () => '' }
  let shapeUsed
  for (const [shape, extra] of shapes) {
    boot = await bootHold(binJs, workspace, env, extra, bootTimeoutSec)
    shapeUsed = shape
    await writeFile(path.join(cell, `boot-${shape}.log`), boot.log)
    if (boot.outcome.ready || HMR_WALL_RE.test(boot.log) || COMPAT_BLOCK_RE.test(boot.log)) break
    if (shape === 'C') break
    checks.notes.push(`A 形旗标不被 ${version} 接受，回退 C 形`)
    await boot.stop()
  }

  try {
    // 5. 归因（日志签名）+ 存活窗口 HTTP 探针
    checks.booted = Boolean(boot.outcome.ready)
    checks.bootShape = shapeUsed
    if (checks.booted) {
      checks.noMountError = !AUDIT_RE.test(boot.log)
      checks.noDupContext = !boot.log.split('\n').some((line) => /dsh-perm-gate/.test(line) && DUP_RE.test(line))
      checks.noCompatBlock = !COMPAT_BLOCK_RE.test(boot.log)
      if (checks.noMountError && checks.noCompatBlock) {
        const port = boot.outcome.port
        const probe = port ? await probeEvents(port, boot.outcome.url) : { status: 0, ok: false, body: 'no port in ready banner' }
        await writeFile(path.join(cell, 'probe.json'), JSON.stringify(probe, null, 2) + '\n')
        checks.probe = probe.ok ? 'ok' : `fail(${probe.status})`
        checks.verdict = checks.noMountError && checks.noDupContext && checks.noCompatBlock && probe.ok
          ? 'green'
          : 'plugin-inert'
        if (!probe.ok) checks.notes.push(`events 探针未过（HTTP ${probe.status}）：宿主半区路由面缺失？`)
      } else {
        checks.verdict = 'plugin-blocked'
      }
      if (!checks.noDupContext) checks.notes.push('疑似重名注册签名')
    } else if (HMR_WALL_RE.test(boot.log)) {
      checks.verdict = 'host-blocked'
      checks.notes.push('宿主 hmr 引导墙（基座对照亦然）——宿主侧问题，非插件不兼容')
    } else if (COMPAT_BLOCK_RE.test(boot.log)) {
      checks.verdict = 'plugin-blocked'
      checks.notes.push('boot 阶段 peer 闸拦截')
    } else {
      checks.verdict = 'plugin-blocked'
      checks.notes.push(`未就绪且无已知签名（${boot.outcome.exited ? `exit ${boot.outcome.code}` : '超时'}），见 boot 日志`)
    }
    checks.green = checks.verdict === 'green'
    await writeResult(cell, checks)
    return checks
  } finally {
    await boot.stop()
  }
}

async function writeResult(cell, checks) {
  await writeFile(path.join(cell, 'result.json'), JSON.stringify(checks, null, 2) + '\n')
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
await mkdir(MATRIX, { recursive: true })
const results = []
for (const version of versions) {
  const cellResult = path.join(MATRIX, version, 'result.json')
  if (!force && existsSync(cellResult)) {
    const prev = JSON.parse(await readFile(cellResult, 'utf8'))
    if (prev.green || prev.verdict === 'host-blocked') {
      console.log(`skip   ${version}（已有结论 ${prev.verdict}，--force 重跑）`)
      results.push(prev)
      continue
    }
  }
  process.stdout.write(`cell   ${version} … `)
  try {
    const checks = await runCell(version)
    console.log(`${checks.verdict.toUpperCase()}${checks.notes.length ? `（${checks.notes.join('；')}）` : ''}`)
    results.push(checks)
  } catch (error) {
    console.log('ERROR')
    const checks = { version, verdict: 'error', green: false, error: String(error.message ?? error) }
    results.push(checks)
    await mkdir(path.join(MATRIX, version), { recursive: true })
    await writeResult(path.join(MATRIX, version), checks)
  }
  if (!keep) await rm(path.join(SANDBOX_HOME, version), { recursive: true, force: true })
}

const verified = results.filter((r) => r.green).map((r) => r.version)
const inert = results.filter((r) => r.verdict === 'plugin-inert').map((r) => r.version)
const pluginBlocked = results.filter((r) => r.verdict === 'plugin-blocked').map((r) => r.version)
const hostBlocked = results.filter((r) => r.verdict === 'host-blocked').map((r) => r.version)
await writeFile(path.join(RESULTS, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
await writeFile(path.join(RESULTS, 'verified.json'), JSON.stringify({ generatedAt: new Date().toISOString(), verified, inert, pluginBlocked, hostBlocked }, null, 2) + '\n')
console.log(`\n绿 ${verified.length}/${results.length}: ${verified.join(', ') || '（无）'}`)
if (inert.length) console.log(`枚举在列但功能下限缺失（plugin-inert）${inert.length}: ${inert.join(', ')}`)
if (pluginBlocked.length) console.log(`插件不兼容 ${pluginBlocked.length}: ${pluginBlocked.join(', ')}`)
if (hostBlocked.length) console.log(`宿主阻塞（不可判定）${hostBlocked.length}: ${hostBlocked.join(', ')}`)
if (!only) console.log('下一步：node scripts/sync-hosts.mjs --write  # 把 verified 清单下发四语 README')
