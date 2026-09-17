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
  /** The last command typed, or the final editor contents. */
  input: string
  /** Output of the last run (stdout and stderr together, or the query result as text). */
  output: string
  /** Error text if the run failed. */
  error?: string
  /** Every command run so far in this task, oldest first (shell lessons). */
  history?: string[]
  /** Output of every command run so far, aligned with history (shell lessons). */
  outputs?: string[]
  /** Snapshot of the simulated filesystem: path to content, or null for a directory. */
  fs?: Record<string, string | null>
  /** Current directory of the simulated shell. */
  cwd?: string
  /** Environment of the simulated shell. */
  env?: Record<string, string>
  /** Extra simulated state: processes, packages, crontab, and so on. */
  state?: ShellState
  /** SQL lessons: rows of the last result set, as objects keyed by column name. */
  rows?: Record<string, unknown>[]
  /** SQL lessons: every result set of the last run, in order. */
  results?: { columns: string[]; values: unknown[][] }[]
  /** SQL lessons: every user table after the run, as row objects. */
  tables?: Record<string, Record<string, unknown>[]>
  /** SQL lessons: CREATE statements from sqlite_master, keyed by object name. */
  schema?: Record<string, string>
}

/** Simulated machine state the shell exposes to checkers. */
export interface ShellState {
  processes: { pid: number; user: string; cmd: string; cpu: number; mem: number }[]
  packages: string[]
  crontab: string
  services: Record<string, 'active' | 'inactive' | 'failed'>
  lastStatus: number
  fileModes: Record<string, number>
}

export interface CheckResult {
  pass: boolean
  message: string
}

/** Tier 1 in-app task, run inside the app with automatic checking. */
export interface InAppTask {
  kind: 'shell' | 'python' | 'sql'
  instructions: string
  /** Starter code shown in the editor (python, sql) or written to `file` (shell). */
  starter?: string
  /** Shell lessons: path of a file to edit in the editor pane above the terminal. */
  file?: string
  /** Seed for the runner: shell files (path to content, trailing slash for a directory) or SQL setup. */
  seed?: Record<string, string>
  /** Shell lessons: starting directory. Defaults to the home directory. */
  cwd?: string
  /** Shell lessons: extra machine state, such as processes or services. */
  machine?: Partial<ShellState>
  /** Python lessons: default text fed to input() calls, one line per call. Shown as an editable box when set. */
  stdin?: string
  /** Python lessons: default command-line arguments. Shown as an editable box when set. */
  argv?: string[]
  /** SQL lessons: statements that build the lesson's database before each run. */
  setup?: string
  /** Short hints shown one at a time on request. */
  hints?: string[]
  /** Reference solution, used by tests and by the "show solution" link. */
  solution?: { commands?: string[]; file?: string }
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
  /** Badge awarded when the lesson is completed. */
  badge?: string
  /** True for lessons whose content is written in a later build phase. */
  placeholder?: boolean
}
