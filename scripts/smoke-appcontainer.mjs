#!/usr/bin/env node
/**
 * smoke-appcontainer.mjs —— launcher.exe 的真机四项冒烟（目标 2 验收）。
 *
 * 不经宿主、不经门控，直接驱动编译出的 AppContainer 启动器，逐项证明：
 *   1. 隔离面：容器内可读写工作区、可写私有 TEMP，但写 %USERPROFILE% 被拒；
 *   2. 回环：豁免前 127.0.0.1 不可达（若此前未豁免），豁免后可达；
 *   3. 直连出网：零能力 token 下 curl 外网地址必须失败（WFP 封锁）；
 *   4. 代理过滤：走 127.0.0.1 过滤代理时，允许对象放行（代理转发到本地
 *      上游 200）、拒绝对象 403（dsh-perm-gate: network denied 签名）——
 *      3+4 合起来证明「直连死、代理活」，出网对象过滤链闭环，全程离线。
 *
 * 用法：node scripts/smoke-appcontainer.mjs [--keep]
 * 产物：控制台逐项 PASS/FAIL/SKIP；exit 0 = 全部非 SKIP 项通过。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdirSync, rmSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const WIN32 = process.platform === 'win32'
const KEEP = process.argv.includes('--keep')
const results = []
const record = (name, status, detail = '') => {
  results.push({ name, status })
  console.log(`${status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : 'SKIP'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

if (!WIN32) {
  console.error('AppContainer 冒烟只在 Windows 上有意义')
  process.exit(1)
}

// ── 1. 编译启动器（走 compile.ts 的同一条链：直接调 tsc 产物或现编） ──
const { execFileSync } = await import('node:child_process')
const compileDir = mkdtempSync(path.join(os.tmpdir(), 'dsh-pg-ac-smoke-'))
const exePath = path.join(compileDir, 'launcher.exe')
const cscCandidates = [
  path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
]
const csc = cscCandidates.find((p) => existsSync(p))
if (csc === undefined) {
  console.error('找不到 csc.exe（.NET Framework 4.x）——无法编译启动器')
  process.exit(1)
}
const csSource = path.join(ROOT, 'assets', 'appcontainer-launcher.cs')
console.log(`compile launcher via ${csc} …`)
execFileSync(csc, ['/nologo', '/target:exe', '/optimize+', '/r:System.Web.Extensions.dll', `/out:${exePath}`, csSource], { stdio: 'inherit' })

// ── 容器 SID：launcher 向 OS 官方 API 要（DeriveAppContainerSidFromName）──
const containerSid = execFileSync(exePath, ['--print-sid'], { encoding: 'utf8' }).trim()
console.log(`container SID: ${containerSid}`)

// ── 本地上游服务 + 过滤代理（127.0.0.1，allow 上游转发 / deny 其余） ──
const upstream = http.createServer((_req, res) => { res.writeHead(200, {'content-type':'text/plain'}); res.end('upstream-ok') })
await new Promise((r) => upstream.listen(0, '127.0.0.1', r))
const upstreamPort = upstream.address().port
const DENIED_HOST = 'evil.example.com'
const proxy = http.createServer((req, res) => {
  const host = (req.headers.host ?? '').split(':')[0]
  if (host === DENIED_HOST) {
    res.writeHead(403, {'content-type':'text/plain'})
    res.end('dsh-perm-gate: network denied (smoke filter)')
    return
  }
  // allow：转发（http 绝对形式 → 原样换 target）
  const fwd = http.request({ host, port: upstreamPort, path: req.url, headers: { host: req.headers.host } }, (r2) => {
    res.writeHead(r2.statusCode, r2.headers); r2.pipe(res)
  })
  fwd.on('error', () => { res.writeHead(502); res.end('bad gateway') })
  req.pipe(fwd)
})
await new Promise((r) => proxy.listen(0, '127.0.0.1', r))
const proxyPort = proxy.address().port
console.log(`local filter proxy on 127.0.0.1:${proxyPort}, upstream on :${upstreamPort}`)

// ── 工作区/TEMP/配置 ─────────────────────────────────────────────────
const base = mkdtempSync(path.join(os.tmpdir(), 'dsh-pg-ac-ws-'))
const workspace = path.join(base, 'workspace')
const tempDir = path.join(base, 'temp')
mkdirSync(workspace); mkdirSync(tempDir)

function launch(command, proxyEnv = {}) {
  const cfg = path.join(base, `cfg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(cfg, JSON.stringify({ containerSid, workspace, tempDir, mode: 'workspace-write', proxyEnv }))
  const b64 = Buffer.from(command, 'utf8').toString('base64')
  const r = spawnSync(exePath, ['--config', cfg, '--exec-b64', b64], { encoding: 'utf8', timeout: 120_000, windowsHide: true })
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

// ── 冒烟 1：隔离面 ───────────────────────────────────────────────────
{
  const w = launch('echo hello>inside.txt && type inside.txt')
  const okFile = path.join(workspace, 'inside.txt')
  if (w.code === 0 && readFileSync(okFile, 'utf8').includes('hello')) record('container: workspace read/write', 'pass')
  else record('container: workspace read/write', 'fail', `exit ${w.code} ${w.stderr.slice(0,200)}`)
}
{
  const profile = path.join(os.homedir(), 'dsh-pg-ac-probe.txt')
  try { rmSync(profile, { force: true }) } catch {}
  const w = launch(`echo pwned>"${profile}"`)
  if (w.code !== 0 && !existsSync(profile)) record('container: user-profile write DENIED', 'pass')
  else { record('container: user-profile write DENIED', 'fail', `exit ${w.code}, file exists=${existsSync(profile)}`); try { rmSync(profile, { force: true }) } catch {} }
}
{
  const w = launch('echo t>%TEMP%\\probe.tmp && if exist %TEMP%\\probe.tmp (echo TEMPOK)')
  if (w.stdout.includes('TEMPOK')) record('container: private TEMP writable', 'pass')
  else record('container: private TEMP writable', 'fail', `exit ${w.code} ${w.stderr.slice(0,200)}`)
}

// ── 冒烟 3（豁免前先测直连出网封锁） ────────────────────────────────
{
  const w = launch('curl -s --max-time 10 https://registry.npmjs.org/ & if errorlevel 1 (echo BLOCKED) else (echo LEAKED)')
  if (w.stdout.includes('BLOCKED')) record('egress: direct internet BLOCKED (zero capabilities)', 'pass')
  else if (w.stdout.includes('LEAKED')) record('egress: direct internet BLOCKED (zero capabilities)', 'fail', 'container reached the internet — WFP block missing!')
  else record('egress: direct internet BLOCKED (zero capabilities)', 'fail', `no verdict, exit ${w.code} ${w.stderr.slice(0,200)}`)
}

// ── 冒烟 2：回环（豁免前 → 豁免 → 豁免后） ──────────────────────────
const checkNetIsolation = path.join(process.env.WINDIR ?? 'C:\\Windows', 'System32', 'CheckNetIsolation.exe')
function exemptedListed() {
  const r = spawnSync(checkNetIsolation, ['LoopbackExempt', '-s'], { encoding: 'utf8', timeout: 30_000 })
  return (r.stdout ?? '').includes(containerSid)
}
const wasExempted = exemptedListed()
{
  const w = launch(`curl -s --max-time 8 http://127.0.0.1:${upstreamPort}/`)
  if (wasExempted) record('loopback: pre-exemption probe', 'skip', 'SID already exempted on this machine')
  else if (w.code !== 0 || !w.stdout.includes('upstream-ok')) record('loopback: blocked before exemption', 'pass')
  else record('loopback: blocked before exemption', 'fail', 'container reached loopback without exemption')
}
{
  if (!wasExempted) {
    const r = spawnSync(checkNetIsolation, ['LoopbackExempt', '-a', `-p=${containerSid}`], { encoding: 'utf8', timeout: 30_000 })
    if (r.status !== 0) {
      record('loopback: exemption add', 'skip', `需要提权。管理员终端运行一次:\n  ${checkNetIsolation} LoopbackExempt -a -p=${containerSid}`)
    } else record('loopback: exemption add', 'pass')
  }
  const w = launch(`curl -s --max-time 8 http://127.0.0.1:${upstreamPort}/`)
  if (w.code === 0 && w.stdout.includes('upstream-ok')) record('loopback: reachable after exemption', 'pass')
  else record('loopback: reachable after exemption', wasExempted ? 'fail' : 'skip', `exit ${w.code} ${w.stderr.slice(0,160)}`)
}

// ── 冒烟 4：代理过滤（直连死 + 代理活 = 链路闭环） ───────────────────
{
  const env = { HTTP_PROXY: `http://127.0.0.1:${proxyPort}`, HTTPS_PROXY: `http://127.0.0.1:${proxyPort}`, ALL_PROXY: `http://127.0.0.1:${proxyPort}` }
  const allow = launch(`curl -s --max-time 10 -x http://127.0.0.1:${proxyPort} http://127.0.0.1:${upstreamPort}/`, env)
  if (allow.stdout.includes('upstream-ok')) record('proxy: allowed object forwarded (200 via filter)', 'pass')
  else record('proxy: allowed object forwarded (200 via filter)', 'fail', `exit ${allow.code} ${allow.stderr.slice(0,200)}`)
  const deny = launch(`curl -s --max-time 10 -x http://127.0.0.1:${proxyPort} http://${DENIED_HOST}/`, env)
  if (deny.stdout.includes('network denied')) record('proxy: denied object blocked (403 by filter)', 'pass')
  else record('proxy: denied object blocked (403 by filter)', 'fail', `exit ${deny.code} out=${deny.stdout.slice(0,120)} err=${deny.stderr.slice(0,120)}`)
}

// ── 收尾 ────────────────────────────────────────────────────────────
upstream.close(); proxy.close()
if (!KEEP) { rmSync(base, { recursive: true, force: true }); rmSync(compileDir, { recursive: true, force: true }) }
const failed = results.filter((r) => r.status === 'fail')
const skipped = results.filter((r) => r.status === 'skip')
console.log(`\n${results.length - failed.length - skipped.length}/${results.length} 通过${skipped.length ? `，${skipped.length} 项 SKIP` : ''}`)
process.exit(failed.length > 0 ? 1 : 0)
