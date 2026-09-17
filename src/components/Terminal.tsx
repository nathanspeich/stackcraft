import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Incomplete, type Shell } from '../shell/shell'
import { cx } from '../lib/cx'

interface Entry { prompt: string; cmd: string; output: string }

export interface TerminalProps {
  shell: Shell
  onRun?: (cmd: string, output: string) => void
  className?: string
  /** Shown once at the top of an empty terminal. */
  banner?: string
}

/**
 * Terminal UI for the simulated shell: scrollback, prompt, up and down history,
 * tab completion, and a helper key row for phone keyboards.
 */
export default function Terminal({ shell, onRun, className, banner }: TerminalProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [completions, setCompletions] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [, force] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, pending, completions])

  const prompt = pending.length ? '> ' : shell.prompt

  const submit = () => {
    const line = input
    const full = [...pending, line].join('\n')
    setInput('')
    setCompletions([])
    setHistIdx(null)
    let output = ''
    try {
      const r = shell.run(full)
      output = r.output
    } catch (e) {
      if (e instanceof Incomplete) {
        setPending((p) => [...p, line])
        setEntries((es) => [...es, { prompt, cmd: line, output: '' }])
        return
      }
      output = `bash: internal error: ${(e as Error).message}\n`
    }
    setPending([])
    if (shell.clearRequested) setEntries([])
    else setEntries((es) => [...es, { prompt, cmd: line, output }])
    force((n) => n + 1)
    onRun?.(full, output)
  }

  const historyStep = (dir: -1 | 1) => {
    const h = shell.history
    if (!h.length) return
    let idx = histIdx === null ? h.length : histIdx
    if (histIdx === null) setDraft(input)
    idx += dir
    if (idx < 0) idx = 0
    if (idx >= h.length) { setHistIdx(null); setInput(draft); return }
    setHistIdx(idx)
    setInput(h[idx])
  }

  const complete = () => {
    const { replaced, options } = shell.complete(input)
    setInput(replaced)
    setCompletions(options.length > 1 ? options : [])
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); historyStep(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); historyStep(1) }
    else if (e.key === 'Tab') { e.preventDefault(); complete() }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setEntries([]) }
    else if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); setPending([]); setInput(''); setEntries((es) => [...es, { prompt, cmd: input + '^C', output: '' }]) }
  }

  const insert = (text: string) => {
    const el = inputRef.current
    const start = el?.selectionStart ?? input.length
    const end = el?.selectionEnd ?? input.length
    const next = input.slice(0, start) + text + input.slice(end)
    setInput(next)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length) })
  }

  const keyBtn = 'min-h-[40px] min-w-[40px] rounded-lg bg-surface-2 px-2 font-mono text-sm text-text active:brightness-125'

  return (
    <div className={cx('overflow-hidden rounded-2xl border border-border bg-bg', className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
        <span className="size-2.5 rounded-full bg-danger/70" />
        <span className="size-2.5 rounded-full bg-capstone/70" />
        <span className="size-2.5 rounded-full bg-linux/70" />
        <span className="ml-2 font-mono text-[11px] text-muted">learner@stackbox: {shell.displayCwd()}</span>
      </div>
      <div
        ref={scrollRef}
        className="h-64 overflow-auto p-3 font-mono text-[13px] leading-relaxed sm:h-80"
        onClick={() => inputRef.current?.focus()}
      >
        {entries.length === 0 && banner && <pre className="mb-2 text-muted">{banner}</pre>}
        {entries.map((e, i) => (
          <div key={i}>
            <pre className="whitespace-pre"><span className="text-linux">{e.prompt}</span>{e.cmd}</pre>
            {e.output && <pre className="whitespace-pre">{e.output.replace(/\n$/, '')}</pre>}
          </div>
        ))}
        {completions.length > 0 && <pre className="text-muted">{completions.join('  ')}</pre>}
        <div className="flex">
          <span className="whitespace-pre text-linux">{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setCompletions([]) }}
            onKeyDown={onKey}
            className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-text outline-none"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            aria-label="Terminal input"
          />
        </div>
      </div>
      {/* Helper keys for phone keyboards */}
      <div className="flex gap-1.5 overflow-x-auto border-t border-border p-2">
        <button type="button" className={keyBtn} onClick={complete} aria-label="Tab completion">Tab</button>
        <button type="button" className={keyBtn} onClick={() => historyStep(-1)} aria-label="Previous command">↑</button>
        <button type="button" className={keyBtn} onClick={() => historyStep(1)} aria-label="Next command">↓</button>
        {['|', '>', '>>', '~', '-', '*', '$', '"'].map((k) => (
          <button key={k} type="button" className={keyBtn} onClick={() => insert(k)} aria-label={`Insert ${k}`}>{k}</button>
        ))}
        <button type="button" className={cx(keyBtn, 'ml-auto text-muted')} onClick={() => setEntries([])} aria-label="Clear screen">clear</button>
        <button type="button" className={cx(keyBtn, 'bg-accent text-on-color font-semibold')} onClick={submit} aria-label="Run command">Run</button>
      </div>
    </div>
  )
}
