// Lazily loads sql.js (the WebAssembly build ships with the app, so it works offline).
import type { SqlJsStatic } from 'sql.js'

let loading: Promise<SqlJsStatic> | null = null

export function getSqlJs(): Promise<SqlJsStatic> {
  if (!loading) {
    loading = (async () => {
      const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
        import('sql.js'),
        import('sql.js/dist/sql-wasm.wasm?url'),
      ])
      return initSqlJs({ locateFile: () => wasmUrl })
    })()
  }
  return loading
}
