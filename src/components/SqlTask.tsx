import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SqlJsStatic } from 'sql.js'
import type { CheckResult, InAppTask } from '../content/types'
import { getSqlJs } from '../sql/client'
import { SqlSession, type SqlEntry } from '../sql/run'
import TaskFooter from './TaskFooter'
import { cx } from '../lib/cx'

const PROMPT = 'sqlite> '

function ResultTable({ columns, values }: { columns: string[]; values: unknown[][] }) {
  if (!columns.length) return <p className="py-1 text-muted">(no rows)</p>
  return (
    <div className="my-1 overflow-x-auto">
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
      <p className="py-1 text-[11px] text-muted">{values.length} row{values.length === 1 ? '' : 's'}</p>
    </div>
  )
}

function Entry({ entry }: { entry: SqlEntry }) {
  return (
    <div className="mb-1">
      <div className="whitespace-pre-wrap break-words font-mono"><span className="text-sql">{PROMPT}</span>{entry.sql}</div>
      {entry.items.map((it, i) =>
        it.kind === 'message' ? (
          <p key={i} className={cx('py-0.5', it.text.startsWith('Error') ? 'text-danger' : 'text-muted')}>{it.text}</p>
        ) : (
          <ResultTable key={i} columns={it.set.columns} values={it.set.values} />
        ),
      )}
    </div>
  )
}

/**
 * SQL console: one statement at a time, like the sqlite3 command-line tool.
 * Results stack up in a log above the input, the database keeps its state between
 * statements, and the checker sees the whole sequence after every run.
 */
export default function SqlTask({ task, onPassChange }: { task: InAppTask; onPassChange: (passed: boolean) => void }) {
  const [SQL, setSQL] = useState<SqlJsStatic | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<SqlEntry[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [histIdx, setHistIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [passed, setPassed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let alive = true
    getSqlJs().then((s) => { if (alive) setSQL(s) }).catch((e) => { if (alive) setLoadError((e as Error).message) })
    return () => { alive = false }
  }, [])

  const session = useMemo(() => (SQL ? new SqlSession(SQL, task.setup ?? '') : null), [SQL, task])
  useEffect(() => () => session?.close(), [session])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, notice])

  /** Distinct statements run so far, oldest first, for the arrow keys and history list. */
  const history = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const e of entries) if (!seen.has(e.sql)) { seen.add(e.sql); out.push(e.sql) }
    return out
  }, [entries])

  const evaluate = useCallback(() => {
    if (!session) return
    let check: CheckResult
    try { check = task.check(session.toRunResult()) } catch (e) { check = { pass: false, message: `Checker error: ${(e as Error).message}` } }
    setResult(check)
    if (check.pass && !passed) { setPassed(true); onPassChange(true) }
  }, [session, task, passed, onPassChange])

  const run = useCallback(() => {
    if (!session || !input.trim()) return
    const added = session.run(input)
    setEntries([...session.entries])
    setNotice(null)
    setInput('')
    setHistIdx(null)
    setShowHistory(false)
    if (added.length) evaluate()
    inputRef.current?.focus()
  }, [session, input, evaluate])

  const reset = () => {
    if (!session) return
    session.reset()
    setEntries([])
    setResult(null)
    setNotice('Database reset to the lesson’s starting state. Earlier statements are cleared.')
    inputRef.current?.focus()
  }

  const historyStep = (dir: -1 | 1) => {
    if (!history.length) return
    let idx = histIdx === null ? history.length : histIdx
    if (histIdx === null) setDraft(input)
    idx += dir
    if (idx < 0) idx = 0
    if (idx >= history.length) { setHistIdx(null); setInput(draft); return }
    setHistIdx(idx)
    setInput(history[idx])
  }

  const recall = (sql: string) => {
    setInput(sql)
    setShowHistory(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const onFirstLine = !input.slice(0, el.selectionStart).includes('\n')
    const onLastLine = !input.slice(el.selectionEnd).includes('\n')
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run() }
    else if (e.key === 'ArrowUp' && onFirstLine) { e.preventDefault(); historyStep(-1) }
    else if (e.key === 'ArrowDown' && onLastLine) { e.preventDefault(); historyStep(1) }
  }

  const insert = (text: string) => {
    const el = inputRef.current
    const start = el?.selectionStart ?? input.length
    const end = el?.selectionEnd ?? input.length
    const next = input.slice(0, start) + text + input.slice(end)
    setInput(next)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length) })
  }

  const keyBtn = 'min-h-[44px] min-w-[44px] shrink-0 rounded-lg bg-surface-2 px-2 font-mono text-sm text-text active:brightness-125 disabled:opacity-40'
  const status = loadError ? 'SQLite could not load' : session?.setupError ? 'Lesson setup failed' : SQL ? 'ready' : 'loading...'
  const rows = Math.min(6, Math.max(1, input.split('\n').length))

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line text-[15px]">{task.instructions}</p>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-capstone/70" />
          <span className="size-2.5 rounded-full bg-linux/70" />
          <span className="ml-2 font-mono text-[11px] text-muted">sqlite3 lesson.db</span>
          <span className={cx('ml-auto text-[11px]', loadError || session?.setupError ? 'text-danger' : 'text-muted')}>{status}</span>
        </div>

        <div
          ref={scrollRef}
          className="h-72 overflow-auto p-3 font-mono text-[13px] leading-relaxed sm:h-96"
          onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus() }}
        >
          {entries.length === 0 && !notice && (
            <div className="mb-2 whitespace-pre-wrap font-mono text-muted">{'Type one SQL statement and press Run (or Enter).\nThe result appears here and the database keeps its state for the next statement.\n↑ recalls a previous statement. Shift+Enter adds a line.'}</div>
          )}
          {notice && <p className="mb-2 text-muted">{notice}</p>}
          {session?.setupError && <p className="mb-2 text-danger">{session.setupError}</p>}
          {entries.map((e, i) => <Entry key={i} entry={e} />)}

          {showHistory && (
            <div className="my-2 rounded-xl border border-border bg-surface p-2">
              <p className="mb-1 text-[11px] text-muted">Tap a statement to recall it</p>
              {history.length === 0 ? (
                <p className="text-muted">Nothing run yet.</p>
              ) : (
                <ul className="space-y-1">
                  {[...history].reverse().map((h) => (
                    <li key={h}>
                      <button type="button" onClick={() => recall(h)} className="block w-full min-h-[36px] truncate rounded-lg px-2 py-1 text-left hover:bg-surface-2">{h}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-start">
            <span className="whitespace-pre text-sql">{PROMPT}</span>
            <textarea
              ref={inputRef}
              value={input}
              rows={rows}
              onChange={(e) => { setInput(e.target.value); setHistIdx(null) }}
              onKeyDown={onKey}
              disabled={!session}
              className="min-w-0 flex-1 resize-none bg-transparent font-mono text-[13px] leading-relaxed text-text outline-none disabled:opacity-50"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="send"
              aria-label="SQL statement"
              placeholder={session ? 'SELECT ...' : ''}
            />
          </div>
        </div>

        {/* Helper keys for phone keyboards */}
        <div className="flex gap-1.5 overflow-x-auto border-t border-border p-2">
          <button type="button" className={keyBtn} onClick={() => historyStep(-1)} disabled={!history.length} aria-label="Previous statement">↑</button>
          <button type="button" className={keyBtn} onClick={() => historyStep(1)} disabled={!history.length} aria-label="Next statement">↓</button>
          <button type="button" className={cx(keyBtn, showHistory && 'ring-2 ring-sql')} onClick={() => setShowHistory((v) => !v)} aria-label="Statement history" aria-expanded={showHistory}>history</button>
          {[';', '*', "'", '(', ')', ',', '=', '%'].map((k) => (
            <button key={k} type="button" className={keyBtn} onClick={() => insert(k)} aria-label={`Insert ${k}`}>{k}</button>
          ))}
          <button type="button" className={cx(keyBtn, 'ml-auto bg-sql font-semibold text-on-color')} onClick={run} disabled={!session || !input.trim()} aria-label="Run statement">Run</button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>Changes stay until you reset. Errors do not undo earlier statements.</span>
        <button type="button" onClick={reset} disabled={!session} className="min-h-[44px] shrink-0 px-2 font-semibold text-muted underline-offset-2 hover:underline">
          reset database
        </button>
      </div>

      <TaskFooter task={task} result={result} passed={passed} idleText="Your statements are checked after every run." />
    </div>
  )
}
