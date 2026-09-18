import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LESSON_BY_ID, nextLesson } from '../content/lessons'
import { TIER_LABEL, weekPlan } from '../content/curriculum'
import type { InAppTask, QuizQuestion, Task } from '../content/types'
import { XP } from '../game/xp'
import { BADGE_BY_ID } from '../game/badges'
import { playSound } from '../lib/sound'
import { isUnlocked, useStore } from '../store/useStore'
import Celebration from '../components/Celebration'
import ShellTask from '../components/ShellTask'
import PythonTask from '../components/PythonTask'
import SqlTask from '../components/SqlTask'
import RealTaskPanel from '../components/RealTask'
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

/** A list of self-check boxes. Calls onDone(true) once every box is ticked. */
function CheckList({ steps, onDone }: { steps: string[]; onDone: (all: boolean) => void }) {
  const [checks, setChecks] = useState<boolean[]>([])
  return (
    <ul className="space-y-2">
      {steps.map((s, i) => (
        <li key={i}>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-2">
            <input
              type="checkbox"
              className="size-6 shrink-0 accent-[var(--c-accent)]"
              checked={Boolean(checks[i])}
              onChange={(e) => {
                const n = [...checks]; n[i] = e.target.checked; setChecks(n)
                onDone(steps.every((_, k) => n[k]))
              }}
            />
            <span className="whitespace-pre-line text-sm">{s}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

/** In-app runner plus, for capstone lessons, real-machine steps the runner cannot verify. Both must pass. */
function RunnerWithRealSteps({ task, taskKey, onPassChange }: { task: InAppTask; taskKey: string; onPassChange: (passed: boolean) => void }) {
  const [runnerOk, setRunnerOk] = useState(false)
  const [stepsOk, setStepsOk] = useState(!task.realSteps?.length)
  const report = useCallback((r: boolean, s: boolean) => onPassChange(r && s), [onPassChange])
  const onRunner = useCallback((p: boolean) => { setRunnerOk(p); report(p, stepsOk) }, [report, stepsOk])
  const onSteps = useCallback((p: boolean) => { setStepsOk(p); report(runnerOk, p) }, [report, runnerOk])
  const runner =
    task.kind === 'shell' ? <ShellTask key={taskKey} task={task} onPassChange={onRunner} /> :
    task.kind === 'python' ? <PythonTask key={taskKey} task={task} onPassChange={onRunner} /> :
    <SqlTask key={taskKey} task={task} onPassChange={onRunner} />
  if (!task.realSteps?.length) return runner
  return (
    <div className="space-y-4">
      {runner}
      <div className="rounded-2xl border border-capstone/40 bg-capstone/10 p-4">
        <h3 className="font-display text-base font-bold">On your real machine</h3>
        <p className="mb-3 mt-1 text-sm text-muted">The app cannot see your Mac, so these steps are on your honour. Tick each one when it is done.</p>
        <CheckList steps={task.realSteps} onDone={onSteps} />
      </div>
    </div>
  )
}

/** Task panel. Shell tasks run in the simulated terminal, Python in Pyodide, SQL in sql.js, and real-machine tasks are verified from pasted output. */
function TaskPanel({ lessonId, task, taskKey, onPassChange }: { lessonId: string; task: Task; taskKey: string; onPassChange: (passed: boolean) => void }) {
  if (task.kind === 'real') return <RealTaskPanel key={taskKey} lessonId={lessonId} task={task} onPassChange={onPassChange} />
  if (task.kind === 'selfcheck') {
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-line text-[15px]">{task.instructions}</p>
        <CheckList steps={task.steps} onDone={onPassChange} />
      </div>
    )
  }
  return <RunnerWithRealSteps key={taskKey} task={task} taskKey={taskKey} onPassChange={onPassChange} />
}

function Quiz({ questions, onFinish }: { questions: QuizQuestion[]; onFinish: (correct: number) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const q = questions[i]
  const answered = picked !== null
  const pick = (k: number) => { setPicked(k); playSound(k === q.answer ? 'correct' : 'wrong') }
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
                onClick={() => pick(k)}
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
  const [taskPassed, setTaskPassed] = useState(false)
  const onPassChange = useCallback((p: boolean) => setTaskPassed(p), [])
  const [result, setResult] = useState<{ gained: number; weekDone: boolean; tierDone: boolean; correct: number; newBadges: string[]; freezeEarned: boolean } | null>(null)

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
    playSound(r.newBadges.length ? 'badge' : 'complete')
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
          {lesson.task.kind === 'real' && <span className="rounded-full bg-capstone/15 px-2 py-0.5 text-[11px] font-semibold text-capstone">Real machine</span>}
        </div>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight">{lesson.title}</h1>
        {plan && <p className="text-sm text-muted">Week {lesson.week} theme: {plan.title}</p>}
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
          <h2 className="mb-3 font-display text-lg font-bold">{lesson.task.kind === 'real' ? 'On your machine' : 'Your turn'}</h2>
          <TaskPanel lessonId={lesson.id} task={lesson.task} taskKey={lesson.id} onPassChange={onPassChange} />
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
            subtitle={result.gained > 0 ? `+${result.gained} XP total` : 'Already completed, no extra XP'}
          />
          {result.newBadges.length > 0 && (
            <ul className="mx-auto mb-4 flex max-w-xs flex-wrap justify-center gap-2" aria-label="New badges">
              {result.newBadges.map((id) => {
                const b = BADGE_BY_ID.get(id)
                return b ? (
                  <li key={id} className="anim-pop flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 py-1.5 text-sm font-semibold">
                    <span aria-hidden>{b.emoji}</span> {b.name}
                  </li>
                ) : null
              })}
            </ul>
          )}
          {result.freezeEarned && <p className="mb-3 text-center text-sm text-muted">🧊 Streak freeze earned. It covers one missed day automatically.</p>}
          {result.gained > 0 && (
            <ul className="mx-auto max-w-xs space-y-1 text-sm">
              <li className="flex justify-between"><span>Lesson</span><span className="font-mono">+{lesson.task.kind === 'real' ? XP.realLesson : XP.lesson} XP</span></li>
              {hasQuiz && <li className="flex justify-between"><span>Quick check {result.correct}/{lesson.quiz.length}</span><span className="font-mono">+{result.correct * XP.quizCorrect} XP</span></li>}
              {result.weekDone && <li className="flex justify-between"><span>Week bonus</span><span className="font-mono">+{XP.weekBonus} XP</span></li>}
              {result.tierDone && <li className="flex justify-between"><span>Tier bonus</span><span className="font-mono">+{XP.tierBonus} XP</span></li>}
            </ul>
          )}
        </Card>
      )}

      {/* Sticky, thumb-reachable action bar */}
      {(step === 'concept' || step === 'task' || step === 'done') && (
        <div className="sticky bottom-tabbar z-30 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto flex max-w-3xl gap-2">
            {step === 'concept' && (
              <Button variant="track" className="w-full" onClick={() => setStep('task')}>
                Continue to task
              </Button>
            )}
            {step === 'task' && (
              <Button variant="track" className="w-full" disabled={!taskPassed} onClick={() => (hasQuiz ? setStep('quiz') : finish(0))}>
                {taskPassed ? (hasQuiz ? 'Continue to quick check' : 'Finish lesson') : 'Complete the task to continue'}
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
    </div>
  )
}

