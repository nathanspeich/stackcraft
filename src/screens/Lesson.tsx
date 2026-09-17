import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LESSON_BY_ID, nextLesson } from '../content/lessons'
import { TIER_LABEL, weekPlan } from '../content/curriculum'
import type { QuizQuestion, Task } from '../content/types'
import { XP } from '../game/xp'
import { isUnlocked, useStore } from '../store/useStore'
import Celebration from '../components/Celebration'
import CodeBlock from '../components/CodeBlock'
import { Button, Card, LinkButton, TrackPill } from '../components/ui'
import { cx } from '../lib/cx'
import { CheckIcon } from '../components/icons'

type Step = 'concept' | 'task' | 'quiz' | 'done'

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}

/** Task panel. Phase 1 ships the self-check shape; runners plug in here in phases 2 to 4 and paste checks in phase 6. */
function TaskPanel({ task, onPass }: { task: Task; onPass: () => void }) {
  const [checks, setChecks] = useState<boolean[]>([])
  if (task.kind === 'selfcheck') {
    const all = task.steps.every((_, i) => checks[i])
    return (
      <div className="space-y-3">
        <p className="text-[15px]">{task.instructions}</p>
        <ul className="space-y-2">
          {task.steps.map((s, i) => (
            <li key={i}>
              <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-2">
                <input
                  type="checkbox"
                  className="size-6 shrink-0 accent-[var(--c-accent)]"
                  checked={Boolean(checks[i])}
                  onChange={(e) => setChecks((c) => { const n = [...c]; n[i] = e.target.checked; return n })}
                />
                <span className="text-sm">{s}</span>
              </label>
            </li>
          ))}
        </ul>
        <Button onClick={onPass} disabled={!all} className="w-full">Done, continue</Button>
      </div>
    )
  }
  const label = task.kind === 'real' ? 'real-machine paste checks' : `the ${task.kind} runner`
  return (
    <div className="space-y-3">
      <p className="text-[15px]">{'instructions' in task ? task.instructions : task.intro}</p>
      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">This task needs {label}, which arrives in a later build phase.</div>
      <Button onClick={onPass} className="w-full">Skip for now</Button>
    </div>
  )
}

function Quiz({ questions, onFinish }: { questions: QuizQuestion[]; onFinish: (correct: number) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const q = questions[i]
  const answered = picked !== null
  const next = () => {
    if (i + 1 >= questions.length) onFinish(correct + (picked === q.answer ? 1 : 0))
    else { if (picked === q.answer) setCorrect((c) => c + 1); setI(i + 1); setPicked(null) }
  }
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Question {i + 1} of {questions.length}</p>
      <p className="font-display text-lg font-bold">{q.question}</p>
      <ul className="space-y-2">
        {q.options.map((opt, k) => {
          const state = !answered ? 'idle' : k === q.answer ? 'right' : k === picked ? 'wrong' : 'dim'
          return (
            <li key={k}>
              <button
                type="button"
                disabled={answered}
                onClick={() => setPicked(k)}
                className={cx(
                  'flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left text-sm transition',
                  state === 'idle' && 'border-border bg-surface-2 hover:border-muted',
                  state === 'right' && 'border-linux bg-linux/15',
                  state === 'wrong' && 'border-danger bg-danger/15',
                  state === 'dim' && 'border-border opacity-60',
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">{String.fromCharCode(65 + k)}</span>
                {opt}
              </button>
            </li>
          )
        })}
      </ul>
      {answered && (
        <div className="anim-rise rounded-2xl bg-surface-2 p-3 text-sm">
          <span className="font-semibold">{picked === q.answer ? 'Correct. ' : 'Not quite. '}</span>
          {q.explanation}
        </div>
      )}
      <Button onClick={next} disabled={!answered} className="w-full">{i + 1 >= questions.length ? 'Finish' : 'Next question'}</Button>
    </div>
  )
}

export default function LessonScreen() {
  const { id = '' } = useParams()
  // Remount on id change so step and result reset without effects.
  return <LessonView key={id} id={id} />
}

function LessonView({ id }: { id: string }) {
  const navigate = useNavigate()
  const lesson = LESSON_BY_ID.get(id)
  const state = useStore()
  const completeLesson = useStore((s) => s.completeLesson)
  const unlockLesson = useStore((s) => s.unlockLesson)
  const [step, setStep] = useState<Step>('concept')
  const [result, setResult] = useState<{ gained: number; weekDone: boolean; tierDone: boolean; correct: number } | null>(null)

  useEffect(() => { window.scrollTo({ top: 0 }) }, [])
  const open = lesson ? isUnlocked(state, lesson.id) : false
  const following = useMemo(() => (lesson ? nextLesson(lesson.id) : undefined), [lesson])

  if (!lesson) {
    return (
      <Card>
        <p>That lesson does not exist.</p>
        <LinkButton to="/map" variant="secondary" className="mt-4">Back to map</LinkButton>
      </Card>
    )
  }
  if (!open) {
    return (
      <Card>
        <h1 className="font-display text-2xl font-bold">Locked</h1>
        <p className="mt-2 text-muted">Finish the previous lesson first, or unlock this one now.</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => unlockLesson(lesson.id)} className="flex-1">Unlock</Button>
          <LinkButton to="/map" variant="secondary" className="flex-1">Map</LinkButton>
        </div>
      </Card>
    )
  }

  const finish = (correct: number) => {
    const r = completeLesson(lesson.id, correct, lesson.quiz.length)
    setResult({ ...r, correct })
    setStep('done')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const plan = weekPlan(lesson.week)
  const steps: Step[] = ['concept', 'task', 'quiz', 'done']
  const stepIdx = steps.indexOf(step)
  const hasQuiz = lesson.quiz.length > 0

  return (
    <div data-track={lesson.track} className="space-y-4">
      <header>
        <Link to="/map" className="inline-flex min-h-[44px] items-center -ml-2 px-2 text-sm font-semibold text-muted">← Map</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TrackPill track={lesson.track} />
          <span className="text-xs text-muted">Week {lesson.week} · Day {lesson.day} · {TIER_LABEL[lesson.tier]}</span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight">{lesson.title}</h1>
        {plan && <p className="text-sm text-muted">{plan.title}</p>}
        <ol className="mt-3 flex gap-1.5" aria-label="Lesson progress">
          {['Concept', 'Task', 'Quiz', 'Done'].map((label, i) => (
            <li key={label} className={cx('h-1.5 flex-1 rounded-full', i <= stepIdx ? 'bg-track' : 'bg-surface-2')} title={label} />
          ))}
        </ol>
      </header>

      {step === 'concept' && (
        <>
          <Card>
            {lesson.placeholder && <p className="mb-3 inline-block rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">Placeholder</p>}
            <Paragraphs text={lesson.concept} />
          </Card>
          <Card>
            <h2 className="mb-3 font-display text-lg font-bold">Worked example</h2>
            <CodeBlock code={lesson.example.code} language={lesson.example.language} caption={lesson.example.caption} />
          </Card>
        </>
      )}

      {step === 'task' && (
        <Card>
          <h2 className="mb-3 font-display text-lg font-bold">Your turn</h2>
          <TaskPanel task={lesson.task} onPass={() => (hasQuiz ? setStep('quiz') : finish(0))} />
        </Card>
      )}

      {step === 'quiz' && (
        <Card>
          <h2 className="mb-3 font-display text-lg font-bold">Quick check</h2>
          <Quiz questions={lesson.quiz} onFinish={finish} />
        </Card>
      )}

      {step === 'done' && result && (
        <Card>
          <Celebration
            title={result.tierDone ? `Tier ${lesson.tier} complete!` : result.weekDone ? `Week ${lesson.week} complete!` : 'Lesson complete!'}
            subtitle={result.gained > 0 ? `+${result.gained} XP` : 'Already completed, no extra XP'}
          />
          <ul className="mx-auto max-w-xs space-y-1 text-sm text-muted">
            {hasQuiz && <li className="flex justify-between"><span>Quick check</span><span className="font-mono">{result.correct}/{lesson.quiz.length} · +{result.correct * XP.quizCorrect} XP</span></li>}
            {result.weekDone && <li className="flex justify-between"><span>Week bonus</span><span className="font-mono">+{XP.weekBonus} XP</span></li>}
            {result.tierDone && <li className="flex justify-between"><span>Tier bonus</span><span className="font-mono">+{XP.tierBonus} XP</span></li>}
          </ul>
        </Card>
      )}

      {/* Sticky, thumb-reachable action bar */}
      {(step === 'concept' || step === 'done') && (
        <div className="fixed inset-x-0 bottom-[56px] z-30 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto flex max-w-3xl gap-2">
            {step === 'concept' && (
              <Button variant="track" className="w-full" onClick={() => setStep('task')}>
                Continue to task
              </Button>
            )}
            {step === 'done' && (
              <>
                <LinkButton to="/" variant="secondary" className="flex-1">Home</LinkButton>
                {following ? (
                  <Button variant="track" className="flex-[2]" onClick={() => navigate(`/lesson/${following.id}`)}>
                    <CheckIcon /> Next: Day {following.day}
                  </Button>
                ) : (
                  <LinkButton to="/map" variant="track" className="flex-[2]">Back to map</LinkButton>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {step === 'concept' && <div className="h-16 md:hidden" aria-hidden />}
    </div>
  )
}

