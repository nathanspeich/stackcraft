// Shared SQL console logic on top of sql.js (SQLite in WebAssembly, with window functions).
// Used by the browser SqlTask panel and the Node test harness.
//
// A session is one open database that lives for the whole task, like the sqlite3
// command-line tool: statements run one at a time and their effects stay until
// the learner resets the database.
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import type { RunResult } from '../content/types'

export interface ResultSet { columns: string[]; values: SqlValue[][] }
export type SqlItem = { kind: 'rows'; set: ResultSet } | { kind: 'message'; text: string }

/** One statement the learner ran, with what came back. */
export interface SqlEntry {
  sql: string
  items: SqlItem[]
  error?: string
}

const MAX_ROWS = 500

/** Split text into statements on semicolons outside quotes and comments (keeps trigger bodies naive). */
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

/** Run one statement on an open database. */
function runStatement(db: Database, stmt: string): SqlEntry {
  const items: SqlItem[] = []
  let error: string | undefined
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
  }
  return { sql: stmt, items, error }
}

/** Render one entry's results as plain text, used for the checker's output field and for tests. */
export function renderText(items: SqlItem[]): string {
  return items
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

export class SqlSession {
  private db: Database
  /** Every statement run since the last reset, oldest first. */
  entries: SqlEntry[] = []
  /** Set when the lesson's own setup script failed, which is a content bug. */
  setupError: string | null = null

  private SQL: SqlJsStatic
  private setup: string

  constructor(SQL: SqlJsStatic, setup: string) {
    this.SQL = SQL
    this.setup = setup
    this.db = this.open()
  }

  private open(): Database {
    const db = new this.SQL.Database()
    this.setupError = null
    try {
      db.exec('PRAGMA foreign_keys = ON')
      if (this.setup.trim()) db.exec(this.setup)
    } catch (e) {
      this.setupError = `Lesson setup failed: ${(e as Error).message}`
    }
    return db
  }

  /** Throw away every change and rebuild the lesson's starting database. */
  reset() {
    this.db.close()
    this.db = this.open()
    this.entries = []
  }

  /** Run what the learner typed. Each statement inside becomes its own entry. Returns the new entries. */
  run(text: string): SqlEntry[] {
    const added: SqlEntry[] = []
    for (const stmt of splitSql(text)) {
      const entry = runStatement(this.db, stmt)
      this.entries.push(entry)
      added.push(entry)
    }
    return added
  }

  /** What the checker sees: the whole sequence of statements and results, plus the database as it stands now. */
  toRunResult(): RunResult {
    const last = this.entries[this.entries.length - 1]
    const sets = this.entries.flatMap((e) => e.items.filter((i): i is { kind: 'rows'; set: ResultSet } => i.kind === 'rows').map((i) => i.set))
    const lastSet = sets[sets.length - 1]
    const rows = lastSet ? lastSet.values.map((row) => Object.fromEntries(lastSet.columns.map((c, i) => [c, row[i]]))) : []
    const snap = snapshot(this.db)
    return {
      input: last?.sql ?? '',
      output: last ? renderText(last.items) : '',
      error: last?.error ?? this.setupError ?? undefined,
      history: this.entries.map((e) => e.sql),
      outputs: this.entries.map((e) => renderText(e.items)),
      rows,
      results: sets,
      tables: snap.tables,
      schema: snap.schema,
    }
  }

  close() {
    this.db.close()
  }
}
