import { useCallback, useEffect, useState } from 'react'
import type { RealStep, RealTask } from '../content/types'
import { checkPaste } from '../content/paste'
import { evidenceFor, useStore } from '../store/useStore'
import { playSound } from '../lib/sound'
import CodeBlock from './CodeBlock'
import { Button } from './ui'
import { CheckIcon } from './icons'
import { cx } from '../lib/cx'

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('space-y-2', className)}>
      {text.split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
    </div>
  )
}

/** One paste-verified step: instruction, copyable command, paste box, check, hint, and the cannot-paste link. */
function StepCard({ lessonId, index, step, done, skipped, onDone }: { lessonId: string; index: number; step: RealStep; done: boolean; skipped: boolean; onDone: () => void }) {
  const record = useStore((s) => s.recordEvidence)
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ pass: boolean; message: string } | null>(null)
  const [failed, setFailed] = useState(0)
  const [pasteNote, setPasteNote] = useState<string | null>(null)
  const [editing, setEditing] = useState(!done)

  const check = () => {
    const r = checkPaste(text, step.check)
    setResult(r)
    if (r.pass) {
      record(lessonId, index, text, false)
      playSound('correct')
      setEditing(false)
      onDone()
    } else {
      setFailed((n) => n + 1)
      playSound('wrong')
    }
  }
  const skip = () => {
    record(lessonId, index, text.trim() ? text : '(marked done without a paste)', true)
    setEditing(false)
    onDone()
  }
  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) { setText(t); setPasteNote(null) } else setPasteNote('Clipboard is empty.')
    } catch {
      setPasteNote('Your browser did not allow reading the clipboard. Long-press the box and choose Paste instead.')
    }
  }

  return (
    <li className={cx('rounded-2xl border p-4', done ? (skipped ? 'border-capstone/50 bg-capstone/5' : 'border-linux/50 bg-linux/5') : 'border-border bg-surface-2/40')}>
      <div className="flex items-start gap-3">
        <span className={cx('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold', done ? (skipped ? 'border-capstone bg-capstone text-on-color' : 'border-linux bg-linux text-on-color') : 'border-border text-muted')}>
          {done ? <CheckIcon size={14} /> : index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <Paragraphs text={step.instruction} className="text-[15px]" />
          {step.command && <CodeBlock code={step.command} language="bash" caption="run this" />}
          {done && !editing ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={cx('font-semibold', skipped ? 'text-capstone' : 'text-linux')}>{skipped ? 'Marked done without a paste. Not counted toward badges.' : 'Verified from your paste.'}</span>
              <button type="button" onClick={() => { setEditing(true); setResult(null) }} className="min-h-[44px] px-2 text-xs font-semibold text-muted underline-offset-2 hover:underline">paste again</button>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">{step.pasteLabel}</span>
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setResult(null) }}
                  rows={6}
                  className="block w-full resize-y rounded-xl border border-border bg-bg p-3 font-mono text-[13px] leading-relaxed text-text outline-none"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder="Paste the terminal output here"
                  aria-label={step.pasteLabel}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="min-h-[44px] text-sm" onClick={pasteFromClipboard}>Paste from clipboard</Button>
                <Button variant="track" className="min-h-[44px] flex-1 text-sm" onClick={check} disabled={!text.trim()}>Check</Button>
              </div>
              {pasteNote && <p className="text-xs text-muted">{pasteNote}</p>}
              {result && (
                <p className={cx('anim-rise rounded-xl px-3 py-2 text-sm', result.pass ? 'bg-linux/15 text-linux' : 'bg-surface-2')} aria-live="polite">{result.message}</p>
              )}
              {failed > 0 && !result?.pass && <p className="anim-rise rounded-xl bg-surface-2 px-3 py-2 text-sm">💡 {step.hint}</p>}
              <button type="button" onClick={skip} className="min-h-[44px] px-1 text-xs font-semibold text-muted underline-offset-2 hover:underline">
                I did this but cannot paste
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * Real-machine project task. The app never talks to the learner's machine: it only reads what they paste.
 * Evidence is kept in the store so finished steps stay finished when the lesson is reopened.
 */
export default function RealTaskPanel({ lessonId, task, onPassChange }: { lessonId: string; task: RealTask; onPassChange: (passed: boolean) => void }) {
  const evidence = useStore((s) => s.evidence)
  const noticeDismissed = useStore((s) => s.realNoticeDismissed)
  const dismiss = useStore((s) => s.dismissRealNotice)
  const by = evidenceFor(evidence, lessonId)
  const doneCount = task.steps.filter((_, i) => by.has(i)).length
  const allDone = doneCount === task.steps.length

  useEffect(() => { onPassChange(allDone) }, [allDone, onPassChange])
  const onDone = useCallback(() => { /* evidence drives allDone via the store */ }, [])

  return (
    <div className="space-y-4">
      <Paragraphs text={task.intro} className="text-[15px] leading-relaxed" />
      {noticeDismissed ? (
        <p className="text-xs text-muted">Nothing here talks to your Mac or the VM. The app only reads what you paste.</p>
      ) : (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-semibold">How project days work</p>
          <p className="mt-1">You do the work in your terminal, then paste the output into the boxes below. The app never connects to your machine or runs anything on it. It only reads the text you paste and checks it for a few expected patterns.</p>
          <p className="mt-1">Copy on the laptop and paste on the phone if you like. Each verified step is kept in your Profile under project evidence.</p>
          <Button variant="secondary" className="mt-3 min-h-[44px] text-sm" onClick={dismiss}>Got it</Button>
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{task.steps.length} step{task.steps.length === 1 ? '' : 's'}, each verified from a paste</span>
        <span className="font-mono">{doneCount}/{task.steps.length}</span>
      </div>
      <ol className="space-y-3">
        {task.steps.map((s, i) => {
          const e = by.get(i)
          return <StepCard key={i} lessonId={lessonId} index={i} step={s} done={Boolean(e)} skipped={Boolean(e?.skipped)} onDone={onDone} />
        })}
      </ol>
      {allDone && (
        <p className="flex items-center gap-2 rounded-2xl border border-linux bg-linux/10 px-4 py-3 text-sm font-semibold text-linux" aria-live="polite">
          <CheckIcon /> Every step is done. Continue below.
        </p>
      )}
    </div>
  )
}
