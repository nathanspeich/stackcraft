import { useCallback, useMemo, useState } from 'react'
import type { CheckResult, InAppTask } from '../content/types'
import { runCheck, shellForTask } from '../shell/taskRunner'
import Terminal from './Terminal'
import { Button } from './ui'
import { cx } from '../lib/cx'
import { CheckIcon } from './icons'

/** Shell task panel: optional editor pane, terminal, live checker, hints, and a solution link. */
export default function ShellTask({ task, onPassChange }: { task: InAppTask; onPassChange: (passed: boolean) => void }) {
  const sh = useMemo(() => shellForTask(task), [task])
  const [fileText, setFileText] = useState(task.starter ?? '')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [passed, setPassed] = useState(false)
  const [hintIdx, setHintIdx] = useState(0)
  const [showSolution, setShowSolution] = useState(false)

  const evaluate = useCallback(
    (input: string, output: string) => {
      const r = runCheck(task, sh, input, output)
      setResult(r)
      if (r.pass && !passed) { setPassed(true); onPassChange(true) }
    },
    [task, sh, passed, onPassChange],
  )

  const onEdit = (text: string) => {
    setFileText(text)
    if (task.file) {
      try { sh.writeFile(task.file, text) } catch { /* read-only target */ }
    }
    evaluate('', '')
  }

  const fileName = task.file?.replace('/home/learner/', '~/')
  const hints = task.hints ?? []

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line text-[15px]">{task.instructions}</p>

      {task.file && (
        <div className="overflow-hidden rounded-2xl border border-border bg-bg">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <span className="font-mono text-[11px] text-muted">editor: {fileName}</span>
            <span className="text-[11px] text-muted">saved automatically</span>
          </div>
          <textarea
            value={fileText}
            onChange={(e) => onEdit(e.target.value)}
            rows={Math.min(16, Math.max(6, fileText.split('\n').length + 1))}
            className="block w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-relaxed text-text outline-none"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={`Editor for ${fileName}`}
          />
        </div>
      )}

      <Terminal shell={sh} onRun={evaluate} banner={'Type a command and press Enter (or Run).\nTab completes names, ↑ recalls history, "help" lists commands.'} />

      <div
        className={cx(
          'rounded-2xl border px-4 py-3 text-sm',
          passed ? 'border-linux bg-linux/10' : result && !result.pass && result.message ? 'border-border bg-surface-2' : 'border-dashed border-border text-muted',
        )}
        aria-live="polite"
      >
        {passed ? (
          <span className="flex items-center gap-2 font-semibold text-linux"><CheckIcon /> Task complete. {result?.message}</span>
        ) : result?.message ? (
          <span>{result.message}</span>
        ) : (
          <span>Your work is checked after every command.</span>
        )}
      </div>

      {!passed && (
        <div className="flex flex-wrap items-center gap-2">
          {hints.length > 0 && hintIdx < hints.length && (
            <Button variant="secondary" className="min-h-[44px] text-sm" onClick={() => setHintIdx((i) => i + 1)}>
              {hintIdx === 0 ? 'Show a hint' : `Next hint (${hintIdx}/${hints.length})`}
            </Button>
          )}
          {task.solution && !showSolution && (
            <button type="button" onClick={() => setShowSolution(true)} className="min-h-[44px] px-2 text-xs font-semibold text-muted underline-offset-2 hover:underline">
              show solution
            </button>
          )}
        </div>
      )}
      {hintIdx > 0 && !passed && (
        <ul className="space-y-1.5">
          {hints.slice(0, hintIdx).map((h, i) => (
            <li key={i} className="anim-rise rounded-xl bg-surface-2 px-3 py-2 text-sm">💡 {h}</li>
          ))}
        </ul>
      )}
      {showSolution && task.solution && (
        <div className="anim-rise rounded-2xl border border-border bg-surface-2 p-3 text-sm">
          <p className="mb-2 font-semibold">One way to do it</p>
          {task.solution.file && <pre className="mb-2 overflow-x-auto rounded-lg bg-bg p-2 text-xs">{task.solution.file}</pre>}
          {task.solution.commands && <pre className="overflow-x-auto rounded-lg bg-bg p-2 text-xs">{task.solution.commands.join('\n')}</pre>}
        </div>
      )}
    </div>
  )
}
