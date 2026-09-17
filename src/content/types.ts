// Lesson data model. Lessons are data files under src/content/<track>/<week>-<day>.ts.

export type Track = 'linux' | 'python' | 'sql' | 'capstone'
export type Tier = 1 | 2 | 3

export interface QuizQuestion {
  question: string
  options: [string, string, string]
  answer: 0 | 1 | 2
  explanation: string
}

/** Result the in-app runner hands to a checker. */
export interface RunResult {
  /** Text the user typed or the final editor contents. */
  input: string
  /** Everything printed to stdout (or the query result rendered as text). */
  output: string
  /** Error text if the run failed. */
  error?: string
  /** Rows returned by the SQL runner, when applicable. */
  rows?: Record<string, unknown>[]
  /** Snapshot of the simulated filesystem for shell lessons. */
  fs?: Record<string, string | null>
}

export interface CheckResult {
  pass: boolean
  message: string
}

/** Tier 1 in-app task, run inside the app with automatic checking. */
export interface InAppTask {
  kind: 'shell' | 'python' | 'sql'
  instructions: string
  starter?: string
  /** Optional seed for the runner: shell files, SQL setup statements, etc. */
  seed?: Record<string, string>
  check: (result: RunResult) => CheckResult
}

/** Tier 1 fallback when the runner cannot verify (sudo, systemctl): a self-check box. */
export interface SelfCheckTask {
  kind: 'selfcheck'
  instructions: string
  steps: string[]
}

export type PasteChecker =
  | { type: 'regex'; pattern: string; flags?: string }
  | { type: 'includes'; text: string; all?: string[] }
  | { type: 'lines'; atLeast: number }

export interface RealStep {
  instruction: string
  command?: string
  pasteLabel: string
  check: PasteChecker[]
  hint: string
}

/** Tier 2 and 3 real-machine project task, verified by pasted output. */
export interface RealTask {
  kind: 'real'
  intro: string
  steps: RealStep[]
}

export type Task = InAppTask | SelfCheckTask | RealTask

export interface Lesson {
  id: string
  tier: Tier
  track: Track
  week: number
  day: number
  title: string
  /** Short concept, under 150 words. Markdown-light: paragraphs separated by blank lines. */
  concept: string
  /** One worked example: a code snippet with a short caption. */
  example: { code: string; language: 'bash' | 'python' | 'sql' | 'text'; caption?: string }
  task: Task
  quiz: QuizQuestion[]
  /** True for lessons whose content is written in a later build phase. */
  placeholder?: boolean
}
