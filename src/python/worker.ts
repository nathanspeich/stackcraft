// Web Worker that loads Pyodide from the CDN on first use and runs Python programs.
import { PYODIDE_CDN, runPython, type PyodideLike, type PyRunRequest } from './run'

let pyodide: PyodideLike | null = null
let loading: Promise<PyodideLike> | null = null

async function load(): Promise<PyodideLike> {
  if (pyodide) return pyodide
  if (!loading) {
    loading = (async () => {
      const mod = (await import(/* @vite-ignore */ `${PYODIDE_CDN}/pyodide.mjs`)) as { loadPyodide: (o: { indexURL: string }) => Promise<PyodideLike> }
      const py = await mod.loadPyodide({ indexURL: `${PYODIDE_CDN}/` })
      pyodide = py
      return py
    })()
  }
  return loading
}

self.onmessage = async (e: MessageEvent<{ id: number; type: 'load' | 'run'; req?: PyRunRequest }>) => {
  const { id, type, req } = e.data
  try {
    const py = await load()
    if (type === 'load') { self.postMessage({ id, type: 'ready' }); return }
    const result = await runPython(py, req!)
    self.postMessage({ id, type: 'result', result })
  } catch (err) {
    self.postMessage({ id, type: 'error', message: (err as Error).message })
  }
}
