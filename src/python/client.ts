// Main-thread wrapper around the Pyodide worker with a run timeout.
import type { PyRunRequest, PyRunResult } from './run'

export type RunnerStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'

const RUN_TIMEOUT_MS = 20000

export class PythonRunner {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  status: RunnerStatus = 'idle'
  listeners = new Set<(s: RunnerStatus) => void>()

  private setStatus(s: RunnerStatus) {
    this.status = s
    for (const l of this.listeners) l(s)
  }

  subscribe(l: (s: RunnerStatus) => void) {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }

  private spawn() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<{ id: number; type: string; result?: PyRunResult; message?: string }>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      this.pending.delete(e.data.id)
      if (e.data.type === 'error') p.reject(new Error(e.data.message))
      else p.resolve(e.data.result)
    }
    this.worker.onerror = (e) => {
      this.setStatus('error')
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'Python worker failed'))
      this.pending.clear()
    }
  }

  private post<T>(msg: { type: 'load' | 'run'; req?: PyRunRequest }, timeoutMs?: number): Promise<T> {
    if (!this.worker) this.spawn()
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = timeoutMs
        ? setTimeout(() => {
            this.pending.delete(id)
            this.worker?.terminate()
            this.worker = null
            this.setStatus('idle')
            reject(new Error(`Your program ran for more than ${timeoutMs / 1000} seconds and was stopped. Check for an infinite loop.`))
          }, timeoutMs)
        : null
      this.pending.set(id, {
        resolve: (v) => { if (timer) clearTimeout(timer); resolve(v as T) },
        reject: (e) => { if (timer) clearTimeout(timer); reject(e) },
      })
      this.worker!.postMessage({ id, ...msg })
    })
  }

  /** Start loading the runtime (safe to call more than once). */
  async load() {
    if (this.status === 'ready' || this.status === 'loading' || this.status === 'running') return
    this.setStatus('loading')
    try {
      await this.post<void>({ type: 'load' })
      this.setStatus('ready')
    } catch (e) {
      this.setStatus('error')
      throw e
    }
  }

  async run(req: PyRunRequest): Promise<PyRunResult> {
    if (this.status !== 'ready') await this.load()
    this.setStatus('running')
    try {
      const r = await this.post<PyRunResult>({ type: 'run', req }, RUN_TIMEOUT_MS)
      this.setStatus('ready')
      return r
    } catch (e) {
      if (this.status === 'running') this.setStatus('ready')
      throw e
    }
  }
}

let shared: PythonRunner | null = null
/** One runner for the whole app so Pyodide loads once per session. */
export function getPythonRunner() {
  if (!shared) shared = new PythonRunner()
  return shared
}
