import { useState } from 'react'
import type { CheckResult, InAppTask } from '../content/types'
import { Button } from './ui'
import { CheckIcon } from './icons'
import { cx } from '../lib/cx'

/** Shared feedback area under a runner: check status, hints one at a time, and a solution link. */
export default function TaskFooter({ task, result, passed, idleText }: { task: InAppTask; result: CheckResult | null; passed: boolean; idleText: string }) {
  const [hintIdx, setHintIdx] = useState(0)
  const [showSolution, setShowSolution] = useState(false)
  const hints = task.hints ?? []
  return (
    <>
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
          <span>{idleText}</span>
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
    </>
  )
}
