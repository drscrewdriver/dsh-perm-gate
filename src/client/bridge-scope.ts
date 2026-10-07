/**
 * BridgeDocHandle — T13b 双轨数据源的桥轨（≤0.1.5 settingsScope 不解析时的兜底）。
 *
 * 与原生 SettingsDocHandle（configForms.get / settingsScope.bind）同构：
 * getSnapshot/subscribe/set/unset。读 = POST /api/dsh-perm-gate/settings/describe；
 * 写 = POST …/mutate（ops 转发宿主 settings 服务），成功即用回填描述符刷新快照并
 * 通知订阅者（乐观刷新，无本地第二份状态——权威值始终在宿主服务里）。
 * 初始 describe 拉取在构造时异步发起；拉取完成前快照 status='pending'，卡片据此
 * 呈现加载态。
 */
import type { SettingsDocHandle } from './compat.js'

const DESCRIBE = '/api/dsh-perm-gate/settings/describe'
const MUTATE = '/api/dsh-perm-gate/settings/mutate'

interface Snapshot { status: string; value: unknown; writable: boolean }
interface Descriptor { value?: unknown; revision?: number }
interface BridgeBody { ok?: boolean; code?: string; message?: string; value?: { descriptor?: Descriptor; writable?: boolean } }

export class BridgeDocHandle implements SettingsDocHandle {
  private snapshot: Snapshot = { status: 'pending', value: undefined, writable: true }
  private listeners = new Set<() => void>()
  private revision: number | undefined
  private inflight: Promise<void> | undefined

  constructor() {
    void this.refresh()
  }

  getSnapshot(): Snapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set(field: string, value: unknown): Promise<void> {
    await this.mutate([{ op: 'set', path: [field], value }])
  }

  async unset(field: string): Promise<void> {
    await this.mutate([{ op: 'unset', path: [field] }])
  }

  private notify(): void {
    for (const l of [...this.listeners]) l()
  }

  private async request(path: string, body?: unknown): Promise<BridgeBody> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    if (!response.ok) throw new Error(`bridge ${path} HTTP ${response.status}`)
    return await response.json() as BridgeBody
  }

  private async refresh(): Promise<void> {
    if (this.inflight !== undefined) return this.inflight
    this.inflight = (async () => {
      try {
        const body = await this.request(DESCRIBE)
        if (body.ok && body.value?.descriptor !== undefined) {
          const d = body.value.descriptor
          this.revision = typeof d.revision === 'number' ? d.revision : undefined
          this.snapshot = { status: 'ready', value: d.value, writable: body.value.writable !== false }
        } else {
          this.snapshot = { status: 'error', value: undefined, writable: false }
        }
      } catch {
        this.snapshot = { status: 'error', value: undefined, writable: false }
      } finally {
        this.inflight = undefined
      }
      this.notify()
    })()
    return this.inflight
  }

  private async mutate(ops: Array<{ op: string; path: string[]; value?: unknown }>): Promise<void> {
    const body = await this.request(MUTATE, { ops, expectedRevision: this.revision })
    if (body.ok && body.value?.descriptor !== undefined) {
      const d = body.value.descriptor
      this.revision = typeof d.revision === 'number' ? d.revision : undefined
      this.snapshot = { status: 'ready', value: d.value, writable: this.snapshot.writable }
    } else if (body.code === 'settings-conflict') {
      await this.refresh() // 乐观并发失败：拉权威值再让下次写入带新 revision
    } else {
      throw new Error(`bridge mutate failed: ${body.code ?? 'unknown'} ${body.message ?? ''}`)
    }
    this.notify()
  }
}
