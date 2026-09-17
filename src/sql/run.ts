// Shared SQL runner logic on top of sql.js (SQLite in WebAssembly, with window functions).
// Used by the browser SqlTask panel and the Node test harness.
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import type { RunResult } from '../content/types'

export interface ResultSet { columns: string[]; values: SqlValue[][] }

export interface SqlRunResult {
  /** Result sets and row-count messages, in statement order. */
  items: ({ kind: 'rows'; set: ResultSet } | { kind: 'message'; text: string })[]
  error?: string
  tables: Record<string, Record<string, unknown>[]>
  schema: Record<string, string>
}

const MAX_ROWS = 500

/** Split a script into statements on semicolons outside quotes and comments (keeps trigger bodies naive). */
export function splitSql(script: string): string[] {
  const out: string[] = []
  let cur = ''
  let q: string | null = null
  for (let i = 0; i < script.length; i++) {
    const c = script[i]
    if (q) { cur += c; if (c === q) q = null; continue }
    if (c === '-' && script[i + 1] === '-') { while (i < script.length && script[i] !== '\n') i++; cur += '\n'; continue }
    if (c === '/' && script[i + 1] === '*') { const end = script.indexOf('*/', i + 2); i = end < 0 ? script.length : end + 1; continue }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function snapshot(db: Database) {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const schema: Record<string, string> = {}
  const meta = db.exec("SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
  for (const [name, type, sql] of meta[0]?.values ?? []) {
    if (typeof sql === 'string') schema[String(name)] = sql
    if (type === 'table') {
      const stmt = db.prepare(`SELECT * FROM "${String(name).replace(/"/g, '""')}" LIMIT ${MAX_ROWS}`)
      const rows: Record<string, unknown>[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>)
      stmt.free()
      tables[String(name)] = rows
    }
  }
  return { tables, schema }
}

/** Run setup then the script on a fresh in-memory database. */
export function runSql(SQL: SqlJsStatic, setup: string, script: string): SqlRunResult {
  const db = new SQL.Database()
  const items: SqlRunResult['items'] = []
  let error: string | undefined
  try {
    db.exec('PRAGMA foreign_keys = ON')
    if (setup.trim()) db.exec(setup)
  } catch (e) {
    error = `Lesson setup failed: ${(e as Error).message}`
  }
  if (!error) {
    for (const stmt of splitSql(script)) {
      try {
        const upper = stmt.trimStart().slice(0, 12).toUpperCase()
        const returnsRows = /^(SELECT|WITH|EXPLAIN|PRAGMA|VALUES)/.test(upper) || /\bRETURNING\b/i.test(stmt)
        if (returnsRows) {
          const res = db.exec(stmt)
          if (res.length === 0) items.push({ kind: 'rows', set: { columns: [], values: [] } })
          for (const set of res) items.push({ kind: 'rows', set: { columns: set.columns, values: set.values.slice(0, MAX_ROWS) } })
        } else {
          db.run(stmt)
          const n = db.getRowsModified()
          const verb = upper.split(/\s+/)[0]
          items.push({ kind: 'message', text: ['INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(verb) ? `${verb}: ${n} row${n === 1 ? '' : 's'} affected` : `${verb} ok` })
        }
      } catch (e) {
        error = (e as Error).message
        items.push({ kind: 'message', text: `Error: ${error}` })
        break
      }
    }
  }
  const snap = snapshot(db)
  db.close()
  return { items, error, ...snap }
}

/** Render results as plain text, used for the checker's output field and for tests. */
export function renderText(r: SqlRunResult): string {
  return r.items
    .map((it) => {
      if (it.kind === 'message') return it.text
      const { columns, values } = it.set
      if (!columns.length) return '(no rows)'
      const widths = columns.map((c, i) => Math.max(c.length, ...values.map((row) => String(row[i] ?? 'NULL').length)))
      const line = (cells: unknown[]) => cells.map((v, i) => String(v ?? 'NULL').padEnd(widths[i])).join(' | ')
      return [line(columns), widths.map((w) => '-'.repeat(w)).join('-+-'), ...values.map(line), `(${values.length} row${values.length === 1 ? '' : 's'})`].join('\n')
    })
    .join('\n\n')
}

export function toRunResult(runs: { sql: string; result: SqlRunResult }[]): RunResult {
  const last = runs[runs.length - 1]
  const sets = last ? last.result.items.filter((i): i is { kind: 'rows'; set: ResultSet } => i.kind === 'rows').map((i) => i.set) : []
  const lastSet = sets[sets.length - 1]
  const rows = lastSet ? lastSet.values.map((row) => Object.fromEntries(lastSet.columns.map((c, i) => [c, row[i]]))) : []
  return {
    input: last?.sql ?? '',
    output: last ? renderText(last.result) : '',
    error: last?.result.error,
    history: runs.map((r) => r.sql),
    outputs: runs.map((r) => renderText(r.result)),
    rows,
    results: sets,
    tables: last?.result.tables ?? {},
    schema: last?.result.schema ?? {},
  }
}
