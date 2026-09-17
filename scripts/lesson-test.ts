// Runs every shell lesson's reference solution through the simulated shell and
// asserts the checker passes, and that a fresh shell does NOT pass.
import { readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Lesson } from '../src/content/types'
import { shellForTask as build } from '../src/shell/taskRunner'
import { runPython, toRunResult, type PyodideLike } from '../src/python/run'
import { SqlSession } from '../src/sql/run'
import type { SqlJsStatic } from 'sql.js'

let sqljs: SqlJsStatic | null = null
async function sql(): Promise<SqlJsStatic> {
  if (!sqljs) {
    const { default: initSqlJs } = await import('sql.js')
    sqljs = await initSqlJs()
  }
  return sqljs
}

let pyodide: PyodideLike | null = null
async function py(): Promise<PyodideLike> {
  if (!pyodide) {
    const { loadPyodide } = await import('pyodide')
    pyodide = (await loadPyodide()) as unknown as PyodideLike
  }
  return pyodide
}

const dirs = ['linux', 'python', 'sql', 'capstone']
let fails = 0
let count = 0

for (const dir of dirs) {
  let files: string[] = []
  try { files = readdirSync(`src/content/${dir}`).filter((f) => f.endsWith('.ts')) } catch { continue }
  for (const f of files) {
    const mod = await import(pathToFileURL(`src/content/${dir}/${f}`).href)
    const lesson: Lesson = mod.default
    if (!lesson?.id) continue
    count++
    const problems: string[] = []
    if (lesson.concept.trim().split(/\s+/).length > 130) problems.push(`concept is ${lesson.concept.trim().split(/\s+/).length} words (limit 130, spec says 150)`)
    if (/—/.test(JSON.stringify(lesson))) problems.push('contains an em dash')
    if (lesson.quiz.length !== 3) problems.push(`quiz has ${lesson.quiz.length} questions`)
    for (const q of lesson.quiz) if (q.options.length !== 3) problems.push('quiz question without 3 options')
    if (lesson.task.kind === 'shell') {
      const task = lesson.task
      const fresh = build(task)
      const r0 = task.check({ input: '', output: '', ...fresh.snapshotForChecker() })
      if (r0.pass) problems.push('checker passes on a fresh shell')
      if (!task.solution) problems.push('no solution')
      else {
        const sh = build(task)
        if (task.solution.file && task.file) sh.writeFile(task.file, task.solution.file)
        let last = { input: '', output: '' }
        for (const cmd of task.solution.commands ?? []) {
          const out = sh.run(cmd).output
          last = { input: cmd, output: out }
        }
        const r = task.check({ ...last, ...sh.snapshotForChecker() })
        if (!r.pass) problems.push(`solution does not pass: ${r.message}`)
      }
    }
    if (lesson.task.kind === 'python') {
      const task = lesson.task
      const p = await py()
      const runOne = async (code: string) => {
        const argv = task.argv ?? []
        const stdin = task.stdin ?? ''
        const result = await runPython(p, { code, stdin, argv, files: task.seed })
        return toRunResult([{ code, stdin, argv, result }])
      }
      const r0 = await runOne(task.starter ?? '')
      if (task.check(r0).pass) problems.push('checker passes on the starter code')
      if (!task.solution?.file) problems.push('no solution file')
      else {
        const r = await runOne(task.solution.file)
        const c = task.check(r)
        if (!c.pass) problems.push(`solution does not pass: ${c.message}\n    output: ${JSON.stringify(r.output.slice(0, 300))}`)
      }
    }
    if (lesson.task.kind === 'sql') {
      const task = lesson.task
      const SQL = await sql()
      const session = new SqlSession(SQL, task.setup ?? '')
      if (session.setupError) problems.push(session.setupError)
      if (task.check(session.toRunResult()).pass) problems.push('checker passes on an empty console')
      if (!task.solution?.commands?.length) problems.push('no solution commands')
      else {
        // Statements run one at a time, as in the console; the checker sees the whole sequence.
        for (const stmt of task.solution.commands) session.run(stmt)
        const r = session.toRunResult()
        const c = task.check(r)
        if (!c.pass) problems.push(`solution does not pass: ${c.message}\n    output: ${JSON.stringify(r.output.slice(0, 300))}`)
        // Each earlier prefix of the solution must not pass, so the steps have to be done in full.
        const partial = new SqlSession(SQL, task.setup ?? '')
        for (const stmt of task.solution.commands.slice(0, -1)) partial.run(stmt)
        if (task.solution.commands.length > 1 && task.check(partial.toRunResult()).pass) problems.push('checker passes before the last solution statement')
        partial.close()
      }
      session.close()
    }
    if (problems.length) { fails++; console.log(`FAIL ${lesson.id} ${lesson.title}\n  - ${problems.join('\n  - ')}`) }
  }
}
console.log(fails ? `${fails} of ${count} lessons failed` : `ALL ${count} LESSONS PASS`)
process.exit(fails ? 1 : 0)
