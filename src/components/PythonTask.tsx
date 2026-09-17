import { useCallback, useEffect, useState } from 'react'
import type { CheckResult, InAppTask } from '../content/types'
import { getPythonRunner, type RunnerStatus } from '../python/client'
import { toRunResult, type PyRunResult } from '../python/run'
import CodeEditor from './CodeEditor'
import TaskFooter from './TaskFooter'
import { Button } from './ui'
import { cx } from '../lib/cx'
import { PlayIcon } from './icons'

interface Run { code: string; stdin: string; argv: string[]; result: PyRunResult }

/** Python task panel: editor, optional input and argument boxes, Run button, output, live checker. */
export default function PythonTask({ task, onPassChange }: { task: InAppTask; onPassChange: (passed: boolean) => void }) {
  const runner = getPythonRunner()
  const [status, setStatus] = useState<RunnerStatus>(runner.status)
  const [code, setCode] = useState(task.starter ?? '')
  const [stdin, setStdin] = useState(task.stdin ?? '')
  const [argv, setArgv] = useState((task.argv ?? []).join(' '))
  const [runs, setRuns] = useState<Run[]>([])
  const [output, setOutput] = useState<{ stdout: string; stderr: string } | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [passed, setPassed] = useState(false)

  useEffect(() => {
    const unsub = runner.subscribe(setStatus)
    runner.load().catch(() => { /* status shows the error */ })
    return unsub
  }, [runner])

  const run = useCallback(async () => {
    if (status === 'running') return
    setRunError(null)
    const args = argv.trim() ? argv.trim().split(/\s+/) : []
    try {
      const res = await runner.run({ code, stdin, argv: args, files: task.seed })
      const next = [...runs, { code, stdin, argv: args, result: res }]
      setRuns(next)
      setOutput({ stdout: res.stdout, stderr: res.stderr })
      let check: CheckResult
      try { check = task.check(toRunResult(next)) } catch (e) { check = { pass: false, message: `Checker error: ${(e as Error).message}` } }
      setResult(check)
      if (check.pass && !passed) { setPassed(true); onPassChange(true) }
    } catch (e) {
      setRunError((e as Error).message)
      setOutput(null)
    }
  }, [status, argv, runner, code, stdin, task, runs, passed, onPassChange])

  const busy = status === 'loading' || status === 'running'
  const statusText =
    status === 'loading' ? 'Loading Python (about 12 MB, cached after the first time)...'
    : status === 'running' ? 'Running...'
    : status === 'error' ? 'Python could not load. Check your connection and reload the page.'
    : status === 'ready' ? 'Python 3 ready'
    : 'Python not loaded yet'

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line text-[15px]">{task.instructions}</p>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="font-mono text-[11px] text-muted">main.py</span>
          <span className={cx('text-[11px]', status === 'error' ? 'text-danger' : 'text-muted')}>{statusText}</span>
        </div>
        <CodeEditor value={code} onChange={setCode} label="Python code editor" />
      </div>

      {(task.stdin !== undefined || task.argv !== undefined) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {task.stdin !== undefined && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">Input, one line per input() call</span>
              <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={3} className="block w-full rounded-xl border border-border bg-bg p-2 font-mono text-[13px] outline-none" spellCheck={false} autoCapitalize="off" />
            </label>
          )}
          {task.argv !== undefined && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">Command-line arguments</span>
              <input value={argv} onChange={(e) => setArgv(e.target.value)} className="block min-h-[44px] w-full rounded-xl border border-border bg-bg px-3 font-mono text-[13px] outline-none" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
              <span className="mt-1 block font-mono text-[11px] text-muted">python3 main.py {argv}</span>
            </label>
          )}
        </div>
      )}

      <Button variant="primary" className="w-full" onClick={run} disabled={busy || status === 'error'} aria-label="Run program">
        <PlayIcon /> {status === 'running' ? 'Running' : status === 'loading' ? 'Loading Python' : 'Run'}
      </Button>

      <div className="overflow-hidden rounded-2xl border border-border bg-bg">
        <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted">output</div>
        <pre className="max-h-72 min-h-16 overflow-auto p-3 font-mono text-[13px] leading-relaxed">
          {runError ? <span className="text-danger">{runError}</span> : output ? (
            <>
              {output.stdout}
              {output.stderr && <span className="text-danger">{output.stderr}</span>}
              {!output.stdout && !output.stderr && <span className="text-muted">(no output)</span>}
            </>
          ) : (
            <span className="text-muted">Press Run to execute main.py</span>
          )}
        </pre>
      </div>

      <TaskFooter task={task} result={result} passed={passed} idleText="Your program is checked every time you run it." />
    </div>
  )
}
