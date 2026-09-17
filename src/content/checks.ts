// Small helpers for writing task checkers.
import type { CheckResult, RunResult } from './types'

/** True if any command run so far matches. */
export const ran = (r: RunResult, re: RegExp) => (r.history ?? []).some((h) => re.test(h))

/** True if some command matched cmd and its output matched out. */
export function ranWith(r: RunResult, cmd: RegExp, out: RegExp): boolean {
  const h = r.history ?? []
  const o = r.outputs ?? []
  return h.some((c, i) => cmd.test(c) && out.test(o[i] ?? ''))
}

export const fileExists = (r: RunResult, path: string) => Boolean(r.fs && path in r.fs)
export const isDir = (r: RunResult, path: string) => Boolean(r.fs && r.fs[path] === null)
export const fileContent = (r: RunResult, path: string) => (r.fs?.[path] ?? null) as string | null
export const hasExecBit = (r: RunResult, path: string) => Boolean((r.state?.fileModes[path] ?? 0) & 0o100)
export const mode = (r: RunResult, path: string) => r.state?.fileModes[path] ?? 0

/**
 * Evaluate ordered steps. Each step is [done, message-when-not-done].
 * Returns the first unmet step's message so the learner sees what to do next.
 */
export function steps(list: [boolean, string][], done = 'Nice work.'): CheckResult {
  for (const [ok, msg] of list) if (!ok) return { pass: false, message: msg }
  return { pass: true, message: done }
}

/** Standard home directory seed reused by the Linux lessons. */
export const HOME_SEED: Record<string, string> = {
  '/home/learner/projects/notes/ideas.txt': 'Learn the terminal\nBuild a tiny website\nAutomate backups\n',
  '/home/learner/projects/website/index.html': '<!doctype html>\n<html>\n<head><title>My site</title></head>\n<body><h1>Hello, world</h1></body>\n</html>\n',
  '/home/learner/projects/website/style.css': 'body { font-family: sans-serif; }\n',
  '/home/learner/documents/letter.txt': 'Dear future me,\n\nBy the time you read this you will know your way around a terminal.\n\nKeep going.\n',
  '/home/learner/photos/': '',
  '/home/learner/downloads/setup.log': 'installing...\ndone\n',
}

/* ---------- Python helpers ---------- */

/** True if the last program's output contains the text or matches the pattern. */
export const outHas = (r: RunResult, what: string | RegExp) => (typeof what === 'string' ? r.output.includes(what) : what.test(r.output))
/** True if the learner's code contains the text or pattern. */
export const codeHas = (r: RunResult, what: string | RegExp) => (typeof what === 'string' ? r.input.includes(what) : what.test(r.input))
/** The last run finished without a traceback. */
export const noError = (r: RunResult) => !r.error
/** Output lines, trailing whitespace trimmed. */
export const outLines = (r: RunResult) => r.output.replace(/\s+$/, '').split('\n').map((l) => l.replace(/\s+$/, ''))

/* ---------- SQL helpers ---------- */

/** True if the learner's SQL matches the pattern (case-insensitive by default). */
export const sqlHas = (r: RunResult, re: RegExp) => new RegExp(re.source, re.flags.includes('i') ? re.flags : re.flags + 'i').test(r.input)
/** Rows of the last result set. */
export const lastRows = (r: RunResult) => r.rows ?? []
/** Lower-cased column names of the last result set. */
export const lastCols = (r: RunResult) => (r.results?.[r.results.length - 1]?.columns ?? []).map((c) => c.toLowerCase())
/** Rows of a table after the run. */
export const tableRows = (r: RunResult, name: string) => r.tables?.[name] ?? []
/** True if a table or index exists after the run. */
export const hasObject = (r: RunResult, name: string) => Boolean(r.schema && name in r.schema)
/** Values of one column in the last result set, as strings. */
export const column = (r: RunResult, name: string) => lastRows(r).map((row) => String(row[name] ?? row[name.toUpperCase()] ?? row[name.toLowerCase()] ?? 'NULL'))
