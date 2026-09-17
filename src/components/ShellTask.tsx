import { useCallback, useMemo, useState } from 'react'
import type { CheckResult, InAppTask } from '../content/types'
import { runCheck, shellForTask } from '../shell/taskRunner'
import Terminal from './Terminal'
import TaskFooter from './TaskFooter'

/** Shell task panel: optional editor pane, terminal, live checker, hints, and a solution link. */
export default function ShellTask({ task, onPassChange }: { task: InAppTask; onPassChange: (passed: boolean) => void }) {
  const sh = useMemo(() => shellForTask(task), [task])
  const [fileText, setFileText] = useState(task.starter ?? '')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [passed, setPassed] = useState(false)

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

      <TaskFooter task={task} result={result} passed={passed} idleText="Your work is checked after every command." />
    </div>
  )
}
