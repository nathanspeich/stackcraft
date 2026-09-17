import { useCallback, useEffect, useState } from 'react'
import type { SqlJsStatic } from 'sql.js'
import type { CheckResult, InAppTask } from '../content/types'
import { getSqlJs } from '../sql/client'
import { runSql, toRunResult, type SqlRunResult } from '../sql/run'
import CodeEditor from './CodeEditor'
import TaskFooter from './TaskFooter'
import { Button } from './ui'
import { cx } from '../lib/cx'
import { PlayIcon } from './icons'

function ResultTable({ columns, values }: { columns: string[]; values: unknown[][] }) {
  if (!columns.length) return <p className="px-3 py-2 text-sm text-muted">(no rows)</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse font-mono text-[12px]">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="whitespace-nowrap border-b border-border bg-surface-2 px-3 py-1.5 text-left font-semibold text-muted">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, ri) => (
            <tr key={ri} className="odd:bg-surface/40">
              {row.map((v, ci) => (
                <td key={ci} className={cx('whitespace-nowrap border-b border-border/60 px-3 py-1', v === null && 'italic text-muted')}>{v === null ? 'NULL' : String(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-1 text-[11px] text-muted">{values.length} row{values.length === 1 ? '' : 's'}</p>
    </div>
  )
}

/** SQL task panel: editor, Run, results as scrollable tables, live checker. Every run starts from the lesson's fresh database. */
export default function SqlTask({ task, onPassChange }: { task: InAppTask; onPassChange: (passed: boolean) => void }) {
  const [SQL, setSQL] = useState<SqlJsStatic | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sql, setSql] = useState(task.starter ?? '')
  const [runs, setRuns] = useState<{ sql: string; result: SqlRunResult }[]>([])
  const [result, setResult] = useState<CheckResult | null>(null)
  const [passed, setPassed] = useState(false)

  useEffect(() => {
    let alive = true
    getSqlJs().then((s) => { if (alive) setSQL(s) }).catch((e) => { if (alive) setLoadError((e as Error).message) })
    return () => { alive = false }
  }, [])

  const run = useCallback(() => {
    if (!SQL) return
    const r = runSql(SQL, task.setup ?? '', sql)
    const next = [...runs, { sql, result: r }]
    setRuns(next)
    let check: CheckResult
    try { check = task.check(toRunResult(next)) } catch (e) { check = { pass: false, message: `Checker error: ${(e as Error).message}` } }
    setResult(check)
    if (check.pass && !passed) { setPassed(true); onPassChange(true) }
  }, [SQL, task, sql, runs, passed, onPassChange])

  const last = runs[runs.length - 1]?.result

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line text-[15px]">{task.instructions}</p>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="font-mono text-[11px] text-muted">query.sql</span>
          <span className={cx('text-[11px]', loadError ? 'text-danger' : 'text-muted')}>{loadError ? 'SQLite could not load' : SQL ? 'SQLite ready' : 'Loading SQLite...'}</span>
        </div>
        <CodeEditor value={sql} onChange={setSql} label="SQL editor" indent={2} />
      </div>

      <Button variant="primary" className="w-full" onClick={run} disabled={!SQL} aria-label="Run SQL">
        <PlayIcon /> {SQL ? 'Run' : 'Loading SQLite'}
      </Button>
      <p className="text-xs text-muted">Each run starts from the lesson's fresh database, so your script can be rerun safely.</p>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg">
        <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted">results</div>
        <div className="max-h-96 overflow-y-auto">
          {!last ? (
            <p className="p-3 text-sm text-muted">Press Run to execute your SQL</p>
          ) : (
            last.items.map((it, i) =>
              it.kind === 'message' ? (
                <p key={i} className={cx('px-3 py-2 font-mono text-[12px]', it.text.startsWith('Error') ? 'text-danger' : 'text-muted')}>{it.text}</p>
              ) : (
                <ResultTable key={i} columns={it.set.columns} values={it.set.values} />
              ),
            )
          )}
        </div>
      </div>

      <TaskFooter task={task} result={result} passed={passed} idleText="Your SQL is checked every time you run it." />
    </div>
  )
}
