// Simulated Linux shell: tokenizer, expansions, pipelines, redirection, and a
// small bash interpreter (variables, if, for, while, case, functions, arrays,
// getopts, here-docs, traps, set -e, exit codes).
import { VFS, FsError, normalize, dirname, seedFs, type FsNode } from './vfs'
import { COMMANDS, HOOKS, ensureSims, type CmdResult } from './commands'
import { MAN } from './man'
import type { ShellState } from '../content/types'

export type { CmdResult }

class ControlFlow extends Error { out = ''; err = ''; seq = '' }
export class ShellExit extends ControlFlow { code: number; constructor(code: number) { super('exit'); this.code = code } }
class ShellReturn extends ControlFlow { code: number; constructor(code: number) { super('return'); this.code = code } }
class ShellBreak extends ControlFlow {}
class ShellContinue extends ControlFlow {}
const fromCf = (e: ControlFlow, code: number): CmdResult => ({ out: e.out, err: e.err, code, seq: e.seq })
export class Incomplete extends Error {}
/** set -u: a variable was used before it was set. */
export class UnboundVariable extends Error {}

export interface Redir { kind: '>' | '>>' | '<' | '<<' | '<<<' | '2>' | '2>>' | '2>&1' | '>&2' | '1>&2' | '&>'; target?: string; /** Here-doc body. */ body?: string }

export interface ShellOptions { errexit: boolean; nounset: boolean; pipefail: boolean; xtrace: boolean }
const defaultOptions = (): ShellOptions => ({ errexit: false, nounset: false, pipefail: false, xtrace: false })

/** Sentinels used to carry a here-doc body inside a statement string. */
const HD = '\u0003'

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n'

export const HOME = '/home/learner'
export const USER = 'learner'
export const HOSTNAME = 'stackbox'

export const defaultState = (): ShellState => ({
  processes: [
    { pid: 1, user: 'root', cmd: '/sbin/init', cpu: 0, mem: 0.1 },
    { pid: 412, user: 'root', cmd: '/usr/sbin/sshd -D', cpu: 0, mem: 0.2 },
    { pid: 620, user: 'root', cmd: '/usr/sbin/cron -f', cpu: 0, mem: 0.1 },
    { pid: 1183, user: 'learner', cmd: '-bash', cpu: 0, mem: 0.3 },
  ],
  packages: ['bash', 'coreutils', 'grep', 'sed', 'findutils', 'curl', 'python3', 'openssh-client', 'iproute2'],
  crontab: '',
  services: { ssh: 'active', cron: 'active', nginx: 'inactive' },
  lastStatus: 0,
  fileModes: {},
  sims: {},
})

export class Shell {
  vfs = new VFS()
  cwd = HOME
  user = USER
  env: Record<string, string> = {
    HOME, USER, SHELL: '/bin/bash', PATH: '/usr/local/bin:/usr/bin:/bin', PWD: HOME, HOSTNAME, LANG: 'en_US.UTF-8', TERM: 'xterm-256color',
  }
  exported = new Set(['HOME', 'USER', 'SHELL', 'PATH', 'PWD', 'HOSTNAME', 'LANG', 'TERM'])
  functions: Record<string, string[]> = {}
  /** Bash arrays, kept apart from the string environment. $name reads element 0. */
  arrays: Record<string, string[]> = {}
  /** Saved outer values of variables declared with local, one frame per running function. */
  localFrames: Record<string, string | undefined>[] = []
  opts: ShellOptions = defaultOptions()
  traps: Record<string, string> = {}
  /** Depth of if/while/until conditions and negated pipelines, where set -e is suspended. */
  inCondition = 0
  /** getopts: position inside a clustered flag group like -abc. */
  optSub = 0
  /** Set by execList when a failure happened inside a && or || list before its last element (set -e ignores those). */
  private listShortCircuit = false
  lastBgPid = 0
  positional: string[] = []
  scriptName = 'bash'
  history: string[] = []
  outputs: string[] = []
  state: ShellState = defaultState()
  lastStatus = 0
  prevDir = HOME
  clearRequested = false
  /** True while running a command whose stdout goes to the screen (not a pipe or file). */
  tty = true
  jobs: { id: number; pid: number; cmd: string }[] = []
  nextPid = 2000
  /** Files created by editor pane, kept in sync. */
  constructor() { ensureSims(); this.seedSystem() }

  /* ---------- setup ---------- */

  seedSystem() {
    const v = this.vfs
    const root = 'root'
    for (const d of ['/bin', '/usr/bin', '/usr/local/bin', '/etc', '/var/log', '/tmp', '/home', '/root', '/proc', '/dev', '/usr/share/man', '/opt', '/srv']) v.mkdir(d, { parents: true, owner: root })
    v.mkdir(HOME, { parents: true })
    const tmp = v.get('/tmp'); if (tmp) tmp.mode = 0o1777
    for (const name of Object.keys(COMMANDS)) if (!BUILTIN_ONLY.has(name)) v.writeFile('/usr/bin/' + name, '#!builtin\n', { owner: root, mode: 0o755 })
    v.writeFile('/etc/passwd', 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nsshd:x:105:65534::/run/sshd:/usr/sbin/nologin\nlearner:x:1000:1000:Learner:/home/learner:/bin/bash\n', { owner: root })
    v.writeFile('/etc/shadow', 'root:$6$rounds=5000$saltsalt$hashhashhashhash:19600:0:99999:7:::\nlearner:$6$rounds=5000$saltsalt$hashhashhashhash:19600:0:99999:7:::\n', { owner: root, mode: 0o640 })
    v.writeFile('/etc/group', 'root:x:0:\nsudo:x:27:learner\nlearner:x:1000:\n', { owner: root })
    v.writeFile('/etc/hostname', HOSTNAME + '\n', { owner: root })
    v.writeFile('/etc/os-release', 'PRETTY_NAME="Ubuntu 24.04 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\n', { owner: root })
    v.writeFile('/etc/hosts', '127.0.0.1 localhost\n127.0.1.1 stackbox\n', { owner: root })
    v.writeFile('/proc/cpuinfo', 'processor\t: 0\nmodel name\t: Stackcraft Virtual CPU\ncpu MHz\t\t: 2400.000\nprocessor\t: 1\nmodel name\t: Stackcraft Virtual CPU\ncpu MHz\t\t: 2400.000\n', { owner: root })
    v.writeFile('/var/log/syslog', '', { owner: root, mode: 0o640 })
    v.writeFile('/var/log/auth.log', '', { owner: root, mode: 0o640 })
    v.writeFile(HOME + '/.bashrc', '# ~/.bashrc: run for every new interactive shell\n\nexport EDITOR=nano\nalias ll="ls -l"\n')
    v.writeFile(HOME + '/.profile', '# ~/.profile: run at login\nif [ -f ~/.bashrc ]; then\n  . ~/.bashrc\nfi\n')
  }

  seed(files: Record<string, string>) { seedFs(this.vfs, files) }

  /* ---------- paths and permissions ---------- */

  path(p: string) { return normalize(p, this.cwd, HOME) }
  get prompt() { return `${this.user === 'root' ? 'root' : USER}@${HOSTNAME}:${this.displayCwd()}${this.user === 'root' ? '#' : '$'} ` }
  displayCwd() { return this.cwd === HOME ? '~' : this.cwd.startsWith(HOME + '/') ? '~' + this.cwd.slice(HOME.length) : this.cwd }

  canRead(n: FsNode) { return HOOKS.access?.(this, n, 'r') ?? (this.user === 'root' || n.owner === this.user ? Boolean(n.mode & 0o400) || this.user === 'root' : Boolean(n.mode & 0o004)) }
  canWrite(n: FsNode) { return HOOKS.access?.(this, n, 'w') ?? (this.user === 'root' || (n.owner === this.user ? Boolean(n.mode & 0o200) : Boolean(n.mode & 0o002))) }
  canExec(n: FsNode) { return HOOKS.access?.(this, n, 'x') ?? (n.owner === this.user ? Boolean(n.mode & 0o100) : Boolean(n.mode & 0o011) || (this.user === 'root' && Boolean(n.mode & 0o111))) }

  readFile(p: string): string {
    const abs = this.path(p)
    const n = this.vfs.get(abs)
    if (!n) throw new FsError(`${p}: No such file or directory`)
    if (n.type === 'dir') throw new FsError(`${p}: Is a directory`)
    if (!this.canRead(n)) throw new FsError(`${p}: Permission denied`)
    return n.content
  }

  writeFile(p: string, content: string, append = false) {
    const abs = this.path(p)
    const n = this.vfs.get(abs)
    if (n) {
      if (!this.canWrite(n)) throw new FsError(`${p}: Permission denied`)
    } else {
      const parent = this.vfs.get(dirname(abs))
      if (!parent) throw new FsError(`${p}: No such file or directory`)
      if (!this.canWrite(parent)) throw new FsError(`${p}: Permission denied`)
    }
    this.vfs.writeFile(abs, content, { append, owner: this.user })
    if (!n) HOOKS.created?.(this, abs, this.vfs.get(abs)!)
  }

  /* ---------- public entry points ---------- */

  /** Run one interactive line. Throws Incomplete when the line opens a block that is not closed. */
  run(line: string): { output: string; code: number } {
    this.clearRequested = false
    const stmts = splitStatements(line)
    if (isIncomplete(stmts)) throw new Incomplete()
    if (line.trim()) this.history.push(line)
    let res: CmdResult
    try {
      res = this.execStatements(stmts)
    } catch (e) {
      if (e instanceof ShellExit) res = fromCf(e, e.code)
      else if (e instanceof ShellReturn) { res = fromCf(e, 1); res.err += 'bash: return: can only `return\' from a function or sourced script\n' }
      else if (e instanceof ShellBreak || e instanceof ShellContinue) res = fromCf(e, 0)
      else throw e
    }
    if (res.seq === undefined) res.seq = res.out + res.err
    this.lastStatus = res.code
    this.state.lastStatus = res.code
    const output = res.seq ?? res.out + res.err
    if (line.trim()) this.outputs.push(output)
    return { output, code: res.code }
  }

  /** Run a script body in the current shell (used by source, bash file, and command substitution). */
  execScript(text: string, args?: string[], name?: string): CmdResult {
    const savedPos = this.positional
    const savedName = this.scriptName
    if (args) { this.positional = args; this.scriptName = name ?? 'bash' }
    try {
      return this.execStatements(splitStatements(text))
    } catch (e) {
      if (e instanceof ShellExit) return fromCf(e, e.code)
      if (e instanceof ShellReturn) return fromCf(e, e.code)
      throw e
    } finally {
      if (args) { this.positional = savedPos; this.scriptName = savedName }
    }
  }

  /** Capture stdout of a script fragment (command substitution). */
  capture(text: string): string {
    const saved = this.tty
    this.tty = false
    try {
      const r = this.execScript(text)
      // stderr of a substitution still reaches the terminal, attached to the command that used it.
      if (r.err) this.capturedErr += r.err
      return r.out.replace(/\n+$/, '')
    } finally { this.tty = saved }
  }
  /** stderr produced inside $( ) while the current command was being expanded. */
  capturedErr = ''

  snapshotForChecker() {
    return {
      history: [...this.history],
      outputs: [...this.outputs],
      fs: this.vfs.snapshot(),
      cwd: this.cwd,
      env: { ...this.env },
      state: { ...this.state, fileModes: this.modes() },
    }
  }

  private modes() {
    const out: Record<string, number> = {}
    this.vfs.walk('/home', (p, n) => { out[p] = n.mode })
    return out
  }

  /* ---------- interpreter ---------- */

  execStatements(stmts: string[]): CmdResult {
    let out = ''
    let err = ''
    let seq = ''
    let code = 0
    let i = 0
    const add = (r: CmdResult) => { out += r.out; err += r.err; seq += r.seq ?? r.out + r.err }
    const combine = (r: CmdResult) => { add(r); code = r.code; this.lastStatus = r.code }
    try {
      while (i < stmts.length) {
        const s = stmts[i]
        if (s === '' || s.startsWith('#')) { i++; continue }
        if (s === 'if' || s.startsWith('if ')) {
          const { branches, elseBody, next } = parseIf(stmts, i)
          i = next
          let ran = false
          for (const b of branches) {
            const c = this.condition(b.cond)
            add(c)
            if (c.code === 0) { combine(this.execStatements(b.body)); ran = true; break }
          }
          if (!ran) { if (elseBody) combine(this.execStatements(elseBody)); else { code = 0; this.lastStatus = 0 } }
          continue
        }
        if (s.startsWith('case ')) {
          const { word, clauses, next } = parseCase(stmts, i)
          i = next
          const value = this.expandWords(word).join(' ')
          let matched = false
          for (const clause of clauses) {
            const hit = clause.patterns.some((p) => globRegex(this.expandPattern(p)).test(value))
            if (hit) { combine(this.execStatements(clause.body)); matched = true; break }
          }
          if (!matched) { code = 0; this.lastStatus = 0 }
          continue
        }
        if (s.startsWith('for ') || s.startsWith('while ') || s.startsWith('until ')) {
          const { header, body, next, stdinFile, tail } = parseLoop(stmts, i)
          i = next
          const savedStdin = this.env.STDIN
          if (stdinFile) this.env.STDIN = this.readFile(stdinFile)
          // "done | cmd" or "done > file": the loop's output is collected and handed on.
          let loopOut = ''
          const runBody = () => {
            try {
              const r = this.execStatements(body)
              if (tail) { loopOut += r.out; err += r.err; seq += r.err; code = r.code; this.lastStatus = r.code }
              else combine(r)
              return true
            }
            catch (e) { if (e instanceof ShellContinue) { add(fromCf(e, code)); return true } if (e instanceof ShellBreak) { add(fromCf(e, code)); return false } throw e }
          }
          try {
            const cfor = header.match(/^for\s*\(\((.*?);(.*?);(.*?)\)\)$/)
            if (cfor) {
              // C-style loop: for ((i=0; i<3; i++))
              evalArith(cfor[1], this)
              let guard = 0
              while (guard++ < 10000 && (cfor[2].trim() === '' || evalArith(cfor[2], this) !== 0)) {
                if (!runBody()) break
                evalArith(cfor[3], this)
              }
            } else if (header.startsWith('for ')) {
              const m = header.match(/^for\s+([A-Za-z_]\w*)(?:\s+in\s*(.*))?$/)
              if (!m) { err += `bash: syntax error near 'for'\n`; seq += `bash: syntax error near 'for'\n`; code = 2; continue }
              const items = m[2] === undefined ? [...this.positional] : this.expandWords(m[2])
              for (const item of items) { this.env[m[1]] = item; if (!runBody()) break }
            } else {
              const isUntil = header.startsWith('until ')
              const cond = header.slice(6)
              let guard = 0
              while (guard++ < 10000) {
                const c = this.condition(cond)
                add(c)
                if ((c.code === 0) === isUntil) break
                if (!runBody()) break
              }
              if (guard >= 10000) { err += 'bash: loop stopped after 10000 iterations\n'; seq += 'bash: loop stopped after 10000 iterations\n' }
            }
          } finally {
            if (stdinFile) this.env.STDIN = savedStdin ?? ''
          }
          if (tail) {
            if (tail.startsWith('|')) combine(this.execPipelineInner(tail.slice(1).trim(), false, loopOut))
            else combine(this.execSimple(`cat ${tail}`, loopOut))
          }
          continue
        }
        if (s.startsWith('FUNC ')) {
          const name = s.slice(5)
          const { body, next } = parseBlock(stmts, i + 1)
          this.functions[name] = body
          i = next
          continue
        }
        if (s === '{') {
          const { body, next } = parseBlock(stmts, i)
          combine(this.execStatements(body))
          i = next
          continue
        }
        if (['then', 'do', 'done', 'fi', 'else', '}', 'esac', ';;'].includes(s) || s.startsWith('elif ')) {
          const msg = `bash: syntax error near unexpected token '${s.split(' ')[0]}'\n`
          err += msg; seq += msg
          code = 2
          i++
          continue
        }
        // A pipeline feeding a compound command: "cmd | while read x; do ...; done"
        const pipeAt = compoundAfterPipe(s)
        if (pipeAt >= 0) {
          const pre = this.execPipeline(s.slice(0, pipeAt))
          err += pre.err; seq += pre.err
          const replaced = [...stmts]
          replaced[i] = s.slice(pipeAt + 1).trim()
          const next = replaced[i].startsWith('if') ? parseIf(replaced, i).next : parseLoop(replaced, i).next
          const savedStdin = this.env.STDIN
          this.env.STDIN = pre.out
          try { combine(this.execStatements(replaced.slice(i, next))) } finally { this.env.STDIN = savedStdin ?? '' }
          i = next
          continue
        }
        combine(this.execList(s))
        i++
        if (code !== 0 && this.inCondition === 0 && !this.listShortCircuit) {
          if (this.traps.ERR) { const t = this.execScript(this.traps.ERR); add(t) }
          if (this.opts.errexit) throw new ShellExit(code)
        }
      }
    } catch (e) {
      if (e instanceof ControlFlow) { e.out = out + e.out; e.err = err + e.err; e.seq = seq + e.seq }
      throw e
    }
    return { out, err, code, seq }
  }

  /** Run an if/while/until condition with set -e suspended, as bash does. */
  condition(text: string): CmdResult {
    this.inCondition++
    try { return this.execStatements(splitStatements(text)) } finally { this.inCondition-- }
  }

  /** Expand variables inside a case pattern without globbing or splitting it. */
  expandPattern(p: string): string {
    const t = p.trim()
    if (/^"(.*)"$/.test(t)) return tokenize(t, this).words[0] ?? ''
    if (/^'(.*)'$/.test(t)) return t.slice(1, -1)
    return t.replace(/\$\{?([A-Za-z_]\w*|\d)\}?/g, (_m, name) => this.getVar(name))
  }

  /** A statement: pipelines joined by && and ||. */
  execList(stmt: string): CmdResult {
    const parts = splitList(stmt)
    let out = ''
    let err = ''
    let seq = ''
    let code = 0
    let prevOp: string | null = null
    this.listShortCircuit = false
    for (const { text, op } of parts) {
      if (prevOp === '&&' && code !== 0) { prevOp = op; this.listShortCircuit = true; continue }
      if (prevOp === '||' && code === 0) { prevOp = op; continue }
      const r = this.execPipeline(text)
      out += r.out; err += r.err; seq += r.seq ?? r.err + r.out; code = r.code
      this.lastStatus = code
      prevOp = op
    }
    return { out, err, code, seq }
  }

  execPipeline(text: string): CmdResult {
    let t = text.trim()
    let negate = false
    if (t.startsWith('! ')) { negate = true; t = t.slice(2); this.inCondition++ }
    try { return this.execPipelineInner(t, negate) } finally { if (negate) this.inCondition-- }
  }

  private execPipelineInner(t: string, negate: boolean, initialStdin = ''): CmdResult {
    let background = false
    if (t.endsWith('&') && !t.endsWith('&&')) { background = true; t = t.slice(0, -1).trim() }
    const cmds = splitPipes(t)
    let stdin = initialStdin
    let out = ''
    let err = ''
    let code = 0
    if (background) {
      const pid = this.nextPid++
      const id = this.jobs.length + 1
      this.lastBgPid = pid
      this.jobs.push({ id, pid, cmd: t })
      this.state.processes.push({ pid, user: this.user, cmd: t, cpu: 0, mem: 0.1 })
      return { out: `[${id}] ${pid}\n`, err: '', code: 0 }
    }
    let seq = ''
    let failed = 0
    for (let k = 0; k < cmds.length; k++) {
      this.tty = k === cmds.length - 1 && !/(^|[^2&])>/.test(cmds[k].replace(/'[^']*'|"[^"]*"/g, ''))
      const r = this.execSimple(cmds[k], stdin)
      this.tty = true
      err += r.err
      code = r.code
      if (r.code !== 0) failed = r.code
      if (k === cmds.length - 1) { out += r.out; seq += r.seq ?? r.err + r.out }
      else { stdin = r.out; seq += r.err }
    }
    if (this.opts.pipefail && code === 0 && failed) code = failed
    if (negate) code = code === 0 ? 1 : 0
    return { out, err, code, seq }
  }

  execSimple(text: string, stdin: string): CmdResult {
    // Array assignment: name=(a b c), name+=(d), name[i]=value
    const arr = text.match(/^\s*([A-Za-z_]\w*)(\+?=)\((.*)\)\s*$/s)
    if (arr) {
      let items: string[]
      try { items = this.expandWords(arr[3]) } catch (e) { return { out: '', err: `bash: ${(e as Error).message}\n`, code: 2 } }
      this.arrays[arr[1]] = arr[2] === '+=' ? [...(this.arrays[arr[1]] ?? []), ...items] : items
      delete this.env[arr[1]]
      return { out: '', err: '', code: 0 }
    }
    const elem = text.match(/^\s*([A-Za-z_]\w*)\[([^\]]+)\]=(.*)$/s)
    if (elem) {
      const idx = evalArith(elem[2], this)
      const list = this.arrays[elem[1]] ?? (this.arrays[elem[1]] = [])
      let value: string
      try { value = this.expandWords(elem[3]).join(' ') } catch (e) { return { out: '', err: `bash: ${(e as Error).message}\n`, code: 2 } }
      list[idx < 0 ? list.length + idx : idx] = value
      return { out: '', err: '', code: 0 }
    }
    // Arithmetic command: (( i++ )) succeeds when the value is non-zero
    const arith = text.match(/^\s*\(\((.*)\)\)\s*$/s)
    if (arith) {
      try { return { out: '', err: '', code: evalArith(arith[1], this) !== 0 ? 0 : 1 } }
      catch (e) { return { out: '', err: `bash: ((: ${(e as Error).message}\n`, code: 1 } }
    }
    let words: string[]
    let redirs: Redir[]
    try {
      ;({ words, redirs } = tokenize(text, this))
    } catch (e) {
      if (e instanceof UnboundVariable) { const ex = new ShellExit(1); ex.err = `bash: ${e.message}\n`; ex.seq = ex.err; throw ex }
      return { out: '', err: `bash: ${(e as Error).message}\n`, code: 2 }
    }
    // stdin redirection: a file, a here-doc, or a here-string
    for (const r of redirs) {
      if (r.kind === '<' && r.target !== undefined) {
        try { stdin = this.readFile(r.target) } catch (e) { return { out: '', err: `bash: ${(e as Error).message}\n`, code: 1 } }
      }
      if (r.kind === '<<' && r.body !== undefined) stdin = r.body
      if (r.kind === '<<<' && r.target !== undefined) stdin = r.target + '\n'
    }
    const trace = (this.capturedErr + (this.opts.xtrace && words.length ? `+ ${words.join(' ')}\n` : ''))
    this.capturedErr = ''
    // assignments
    while (words.length && /^[A-Za-z_]\w*=/.test(words[0])) {
      const [name, ...rest] = words[0].split('=')
      this.env[name] = rest.join('=')
      words.shift()
      if (words.length === 0) return { out: '', err: trace, code: 0, seq: trace }
    }
    let res: CmdResult
    if (words.length === 0) res = { out: '', err: '', code: 0 }
    else res = this.invoke(words, stdin)
    // output redirection
    for (const r of redirs) {
      if (r.kind === '<' || r.kind === '<<' || r.kind === '<<<') continue
      if (r.kind === '2>&1') { res = { out: res.seq ?? res.err + res.out, err: '', code: res.code }; continue }
      if (r.kind === '>&2' || r.kind === '1>&2') { res = { ...res, err: res.err + res.out, out: '' }; continue }
      if (r.target === undefined) continue
      if (r.target === '/dev/null') { res = r.kind === '2>' || r.kind === '2>>' ? { ...res, err: '' } : r.kind === '&>' ? { ...res, out: '', err: '' } : { ...res, out: '' }; continue }
      try {
        if (r.kind === '>' || r.kind === '>>') { this.writeFile(r.target, res.out, r.kind === '>>'); res = { ...res, out: '' } }
        else if (r.kind === '2>' || r.kind === '2>>') { this.writeFile(r.target, res.err, r.kind === '2>>'); res = { ...res, err: '' } }
        else if (r.kind === '&>') { this.writeFile(r.target, res.out + res.err); res = { ...res, out: '', err: '' } }
      } catch (e) {
        return { out: '', err: `bash: ${(e as Error).message}\n`, code: 1 }
      }
    }
    if (trace) res = { ...res, err: trace + res.err, seq: trace + (res.seq ?? res.err + res.out) }
    return res
  }

  invoke(words: string[], stdin: string): CmdResult {
    const [name, ...args] = words
    if (this.functions[name]) {
      const saved = this.positional
      this.positional = args
      this.localFrames.push({})
      try { return this.execStatements(this.functions[name]) }
      catch (e) { if (e instanceof ShellReturn) return fromCf(e, e.code); throw e }
      finally {
        this.positional = saved
        const frame = this.localFrames.pop() ?? {}
        for (const [k, v] of Object.entries(frame)) { if (v === undefined) delete this.env[k]; else this.env[k] = v }
      }
    }
    if (args.includes('--help') && MAN[name] && !['echo', 'printf', 'grep', 'man'].includes(name)) {
      return { out: MAN[name] + '\n', err: '', code: 0 }
    }
    if (BUILTIN_ONLY.has(name) || (COMMANDS[name] && !name.includes('/'))) {
      // Path lookup: a command is available if it is a builtin or an executable on PATH.
      if (!BUILTIN_ONLY.has(name) && !this.findOnPath(name)) return { out: '', err: `${name}: command not found\n`, code: 127 }
      try { return COMMANDS[name](this, args, stdin) }
      catch (e) {
        if (e instanceof FsError) return { out: '', err: `${name}: ${e.message}\n`, code: 1 }
        throw e
      }
    }
    if (name.includes('/')) return this.execFile(name, args, stdin)
    const onPath = this.findOnPath(name)
    if (onPath) return this.execFile(onPath, args, stdin)
    return { out: '', err: `${name}: command not found\n`, code: 127 }
  }

  findOnPath(name: string): string | null {
    for (const dir of (this.env.PATH ?? '').split(':')) {
      const p = dir.replace(/\/$/, '') + '/' + name
      const n = this.vfs.get(p)
      if (n && n.type === 'file' && n.mode & 0o111) return p
    }
    return null
  }

  execFile(path: string, args: string[], stdin: string): CmdResult {
    const abs = this.path(path)
    const n = this.vfs.get(abs)
    if (!n) return { out: '', err: `bash: ${path}: No such file or directory\n`, code: 127 }
    if (n.type === 'dir') return { out: '', err: `bash: ${path}: Is a directory\n`, code: 126 }
    if (!this.canExec(n)) return { out: '', err: `bash: ${path}: Permission denied\n`, code: 126 }
    if (n.content.startsWith('#!builtin')) {
      const cmd = abs.split('/').pop()!
      return COMMANDS[cmd] ? COMMANDS[cmd](this, args, stdin) : { out: '', err: `${cmd}: command not found\n`, code: 127 }
    }
    return this.runScriptFile(abs, n.content, args, stdin, path)
  }

  runScriptFile(abs: string, content: string, args: string[], stdin: string, name = abs): CmdResult {
    const first = content.split('\n')[0]
    if (first.startsWith('#!') && !/(bash|\/sh|\/env sh|\/env bash)/.test(first)) {
      return { out: '', err: `bash: ${abs}: only bash and sh scripts run in this terminal (shebang: ${first})\n`, code: 126 }
    }
    // Scripts run in a child context: cwd, variables, options, and traps do not leak back out.
    const savedCwd = this.cwd
    const savedEnv = { ...this.env }
    const savedFns = { ...this.functions }
    const savedArrays = { ...this.arrays }
    const savedOpts = { ...this.opts }
    const savedTraps = { ...this.traps }
    const savedFrames = this.localFrames
    this.opts = { ...defaultOptions(), xtrace: this.opts.xtrace }
    this.traps = {}
    this.localFrames = []
    this.env.STDIN = stdin
    let res: CmdResult | undefined
    try {
      res = this.execScript(content, args, name)
      return res
    } finally {
      if (this.traps.EXIT) {
        try {
          const t = this.execScript(this.traps.EXIT)
          if (res) { res.out += t.out; res.err += t.err; res.seq = (res.seq ?? '') + (t.seq ?? t.out + t.err) }
        } catch { /* a trap that exits is ignored */ }
      }
      this.cwd = savedCwd
      this.env = savedEnv
      this.functions = savedFns
      this.arrays = savedArrays
      this.opts = savedOpts
      this.traps = savedTraps
      this.localFrames = savedFrames
    }
  }

  /** Declare variables local to the running function (called by the local builtin). */
  declareLocal(name: string, value?: string) {
    const frame = this.localFrames[this.localFrames.length - 1]
    if (frame && !(name in frame)) frame[name] = this.env[name]
    if (value !== undefined) this.env[name] = value
    else if (frame) this.env[name] = ''
  }

  /* ---------- expansion helpers used by commands ---------- */

  expandWords(text: string): string[] { return tokenize(text, this).words }

  getVar(name: string): string {
    if (name === '?') return String(this.lastStatus)
    if (name === '#') return String(this.positional.length)
    if (name === '@' || name === '*') return this.positional.join(' ')
    if (name === '0') return this.scriptName
    if (/^\d+$/.test(name)) return this.positional[Number(name) - 1] ?? ''
    if (name === 'PWD') return this.cwd
    if (name === 'RANDOM') return String(Math.floor(Math.random() * 32768))
    if (name === 'UID') return this.user === 'root' ? '0' : '1000'
    if (name === '$') return '1183'
    if (name === '!') return String(this.lastBgPid)
    if (name === 'LINENO') return '1'
    if (this.env[name] !== undefined) return this.env[name]
    if (this.arrays[name]) return this.arrays[name][0] ?? ''
    if (this.opts.nounset) throw new UnboundVariable(`${name}: unbound variable`)
    return ''
  }

  isSet(name: string) { return this.env[name] !== undefined || this.arrays[name] !== undefined }

  throwExit(code: number): never { throw new ShellExit(code) }
  throwReturn(code: number): never { throw new ShellReturn(code) }
  throwBreak(): never { throw new ShellBreak() }
  throwContinue(): never { throw new ShellContinue() }

  /* ---------- tab completion ---------- */

  complete(line: string): { replaced: string; options: string[] } {
    const m = line.match(/(^|.*\s)(\S*)$/)
    if (!m) return { replaced: line, options: [] }
    const before = m[1]
    const partial = m[2]
    const isCommand = before.trim() === '' || /(\||;|&&|\|\||sudo\s+)$/.test(before)
    let options: string[]
    if (isCommand && !partial.includes('/')) {
      const names = new Set<string>([...Object.keys(COMMANDS), ...Object.keys(this.functions)])
      options = [...names].filter((n) => n.startsWith(partial)).sort()
      if (options.length === 1) return { replaced: before + options[0] + ' ', options }
    } else {
      const slash = partial.lastIndexOf('/')
      const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : ''
      const namePart = slash >= 0 ? partial.slice(slash + 1) : partial
      let entries: [string, FsNode][] = []
      try { entries = this.vfs.list(this.path(dirPart || '.')) } catch { entries = [] }
      options = entries
        .filter(([name]) => name.startsWith(namePart) && (namePart.startsWith('.') || !name.startsWith('.')))
        .map(([name, node]) => dirPart + name + (node.type === 'dir' ? '/' : ''))
      if (options.length === 1) return { replaced: before + options[0] + (options[0].endsWith('/') ? '' : ' '), options }
    }
    if (options.length > 1) {
      const prefix = commonPrefix(options)
      if (prefix.length > partial.length) return { replaced: before + prefix, options }
    }
    return { replaced: line, options }
  }
}

/** Commands that are shell builtins and have no /usr/bin entry. */
export const BUILTIN_ONLY = new Set(['cd', 'export', 'unset', 'source', '.', 'exit', 'return', 'history', 'alias', 'local', 'shift', 'break', 'continue', 'read', 'set', 'type', 'help', 'true', 'false', 'test', '[', '[[', 'exec', 'jobs', 'fg', 'bg', 'wait', 'pushd', 'popd', 'let', 'declare', 'getopts', 'trap', 'readonly', 'mapfile', 'readarray', 'umask', 'shopt', 'command', 'builtin', 'eval', 'times', 'ulimit'])

function commonPrefix(list: string[]) {
  let p = list[0]
  for (const s of list) while (!s.startsWith(p)) p = p.slice(0, -1)
  return p
}

/* ======================= parsing ======================= */

/** Split source into statements at newlines and unquoted semicolons, then pull leading keywords apart. */
export function splitStatements(src: string): string[] {
  const raw: string[] = []
  let cur = ''
  let q: string | null = null
  let depth = 0
  /** Here-docs opened on the current line, collected once the line ends. */
  let pendingDocs: { delim: string; quoted: boolean; strip: boolean; slot: number }[] = []
  let slots: string[] = []
  const finishLine = (i: number): number => {
    // Consume here-doc bodies that follow the line just finished.
    for (const d of pendingDocs) {
      let body = ''
      let found = false
      while (i < src.length) {
        const nl = src.indexOf('\n', i)
        const line = src.slice(i, nl < 0 ? src.length : nl)
        i = nl < 0 ? src.length : nl + 1
        const cmp = d.strip ? line.replace(/^\t+/, '') : line
        if (cmp === d.delim) { found = true; break }
        body += (d.strip ? line.replace(/^\t+/, '') : line) + '\n'
      }
      if (!found) throw new Incomplete()
      slots[d.slot] = HD + (d.quoted ? 'q' : 'e') + HD + body + HD
    }
    pendingDocs = []
    return i
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      cur += c
      if (c === '\\' && q === '"') { cur += src[++i] ?? ''; continue }
      if (c === q) q = null
      continue
    }
    if (c === '\\') { cur += c + (src[++i] ?? ''); continue }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue }
    if (c === '#' && (cur === '' || isSpace(cur[cur.length - 1]))) { while (i < src.length && src[i] !== '\n') i++; i--; continue }
    if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<' && src[i - 1] !== '<' && depth === 0) {
      // Here-doc operator: remember the delimiter, leave a slot marker in the statement.
      let j = i + 2
      let strip = false
      if (src[j] === '-') { strip = true; j++ }
      while (src[j] === ' ' || src[j] === '\t') j++
      let delim = ''
      let quoted = false
      if (src[j] === "'" || src[j] === '"') { const qc = src[j]; const end = src.indexOf(qc, j + 1); delim = src.slice(j + 1, end < 0 ? src.length : end); quoted = true; j = end < 0 ? src.length : end + 1 }
      else { while (j < src.length && !isSpace(src[j]) && src[j] !== ';' && src[j] !== '|' && src[j] !== '&') { if (src[j] === '\\') j++; else delim += src[j]; j++ } }
      const slot = slots.length
      slots.push('')
      pendingDocs.push({ delim, quoted, strip, slot })
      cur += `<<${HD}${slot}${HD}`
      i = j - 1
      continue
    }
    if (c === '(' ) { depth++; cur += c; continue }
    if (c === ')' ) { depth = Math.max(0, depth - 1); cur += c; continue }
    if ((c === '\n' || c === ';') && depth === 0) {
      if (c === ';' && src[i + 1] === ';') { raw.push(cur.trim()); raw.push(';;'); cur = ''; i++; continue }
      raw.push(cur.trim()); cur = ''
      if (c === '\n' && pendingDocs.length) i = finishLine(i + 1) - 1
      continue
    }
    if (c === '&' && src[i + 1] !== '&' && src[i - 1] !== '&' && src[i - 1] !== '>' && depth === 0) { cur += c; raw.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (q || depth > 0) throw new Incomplete()
  raw.push(cur.trim())
  if (pendingDocs.length) finishLine(src.length)
  const out: string[] = []
  for (let s0 of raw) {
    // Put here-doc bodies back in place of their slot markers.
    let s = s0.replace(new RegExp(`<<${HD}(\\d+)${HD}`, 'g'), (_m, n) => '<<' + slots[Number(n)])
    if (!s) continue
    if (s === ';;') { out.push(s); continue }
    // Leading keywords that may share a line with the next command.
    let m: RegExpMatchArray | null
    while ((m = s.match(/^(then|do|else)\s+(.+)$/))) { out.push(m[1]); s = m[2].trim() }
    if ((m = s.match(/^(?:function\s+)?([A-Za-z_]\w*)\s*\(\s*\)\s*(\{?)\s*(.*)$/)) || (m = s.match(/^function\s+([A-Za-z_]\w*)\s*(\{)\s*(.*)$/))) {
      out.push('FUNC ' + m[1])
      if (m[2]) out.push('{')
      if (m[3].trim()) {
        const rest = m[3].trim()
        if (rest.endsWith('}') && !rest.endsWith('\\}')) { out.push(rest.slice(0, -1).trim()); out.push('}') }
        else out.push(rest)
      }
      continue
    }
    if (s.length > 1 && s.endsWith('}') && !s.endsWith('\\}') && s !== '}' && !/\$\{[^}]*\}$/.test(s) && !s.includes('${')) { out.push(s.slice(0, -1).trim()); out.push('}'); continue }
    if (s.startsWith('{ ') ) { out.push('{'); out.push(s.slice(2).trim()); continue }
    out.push(s)
  }
  return out
}

function isIncomplete(stmts: string[]): boolean {
  let depth = 0
  for (const s of stmts) {
    if (s === 'if' || s.startsWith('if ') || s.startsWith('for ') || s.startsWith('while ') || s.startsWith('until ') || s.startsWith('case ') || s === '{') depth++
    else if (s === 'fi' || s === 'done' || /^done\s*[|>]/.test(s) || s === '}' || s === 'esac') depth--
  }
  return depth > 0
}

function parseIf(stmts: string[], start: number) {
  const branches: { cond: string; body: string[] }[] = []
  let elseBody: string[] | null = null
  let i = start
  let cond = stmts[i].replace(/^if\s*/, '')
  i++
  let mode: 'then' | 'else' = 'then'
  let body: string[] = []
  let depth = 0
  const flush = () => { if (mode === 'then') branches.push({ cond, body }); else elseBody = body; body = [] }
  if (stmts[i] === 'then') i++
  while (i < stmts.length) {
    const s = stmts[i]
    if (s === 'if' || s.startsWith('if ')) depth++
    if (s === 'fi') { if (depth === 0) { flush(); return { branches, elseBody, next: i + 1 } } depth-- }
    if (depth === 0) {
      if (s.startsWith('elif ')) { flush(); cond = s.slice(5); mode = 'then'; i++; if (stmts[i] === 'then') i++; continue }
      if (s === 'else') { flush(); mode = 'else'; i++; continue }
    }
    body.push(s)
    i++
  }
  flush()
  return { branches, elseBody, next: i }
}

/** case WORD in PATTERN) body ;; ... esac. Clauses are split by the ';;' statements. */
function parseCase(stmts: string[], start: number) {
  const m = stmts[start].match(/^case\s+(.+?)\s+in(?:\s+(.*))?$/)
  const word = m?.[1] ?? ''
  const clauses: { patterns: string[]; body: string[] }[] = []
  let cur: { patterns: string[]; body: string[] } | null = null
  let depth = 0
  const queue: string[] = m?.[2]?.trim() ? [m[2].trim()] : []
  let i = start + 1
  for (;;) {
    const s = queue.length ? queue.shift()! : i < stmts.length ? stmts[i++] : undefined
    if (s === undefined) break
    if (s.startsWith('case ')) depth++
    if (s === 'esac') {
      if (depth === 0) { if (cur) clauses.push(cur); return { word, clauses, next: i } }
      depth--
    }
    if (depth === 0 && s === ';;') { if (cur) clauses.push(cur); cur = null; continue }
    if (depth === 0 && cur === null) {
      const pm = s.match(/^\(?\s*([^()]*?)\s*\)\s*(.*)$/)
      if (pm) { cur = { patterns: pm[1].split('|').map((p) => p.trim()), body: [] }; if (pm[2].trim()) queue.unshift(pm[2].trim()); continue }
    }
    if (cur) cur.body.push(s)
  }
  if (cur) clauses.push(cur)
  return { word, clauses, next: i }
}

function parseLoop(stmts: string[], start: number) {
  const header = stmts[start]
  let i = start + 1
  if (stmts[i] === 'do') i++
  const body: string[] = []
  let depth = 0
  while (i < stmts.length) {
    const s = stmts[i]
    if (s.startsWith('for ') || s.startsWith('while ') || s.startsWith('until ')) depth++
    const doneRedir = s.match(/^done\s*<\s*(\S+)$/)
    const doneTail = s.match(/^done\s*((?:\||>).*)$/)
    if (s === 'done' || doneRedir || doneTail) { if (depth === 0) return { header, body, next: i + 1, stdinFile: doneRedir?.[1], tail: doneTail?.[1] }; depth-- }
    body.push(s)
    i++
  }
  return { header, body, next: i, stdinFile: undefined as string | undefined, tail: undefined as string | undefined }
}

/** Index of a "|" whose right side starts a compound command, or -1. */
function compoundAfterPipe(stmt: string): number {
  let q: string | null = null
  for (let i = 0; i < stmt.length; i++) {
    const c = stmt[i]
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue }
    if (c === "'" || c === '"') { q = c; continue }
    if (c === '|' && stmt[i + 1] !== '|' && stmt[i - 1] !== '|') {
      const rest = stmt.slice(i + 1).trimStart()
      if (/^(while|until|for|if)\s/.test(rest)) return i
    }
  }
  return -1
}

function parseBlock(stmts: string[], start: number) {
  let i = start
  if (stmts[i] === '{') i++
  const body: string[] = []
  let depth = 0
  while (i < stmts.length) {
    const s = stmts[i]
    if (s === '{') depth++
    if (s === '}') { if (depth === 0) return { body, next: i + 1 }; depth-- }
    body.push(s)
    i++
  }
  return { body, next: i }
}

/** Split a statement on && and || outside quotes. */
function splitList(stmt: string): { text: string; op: string | null }[] {
  const out: { text: string; op: string | null }[] = []
  let cur = ''
  let q: string | null = null
  let depth = 0
  let inTest = false
  for (let i = 0; i < stmt.length; i++) {
    const c = stmt[i]
    if (q) { cur += c; if (c === '\\') cur += stmt[++i] ?? ''; else if (c === q) q = null; continue }
    if (c === HD) { const end = stmt.indexOf(HD, stmt.indexOf(HD, i + 1) + 1); cur += stmt.slice(i, end + 1); i = end; continue }
    if (c === '\\') { cur += c + (stmt[++i] ?? ''); continue }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue }
    if (stmt.startsWith('[[', i) && (i === 0 || isSpace(stmt[i - 1]))) inTest = true
    if (stmt.startsWith(']]', i)) inTest = false
    if (c === '(') depth++
    if (c === ')') depth--
    if (depth === 0 && !inTest && (stmt.startsWith('&&', i) || stmt.startsWith('||', i))) {
      out.push({ text: cur, op: stmt.substr(i, 2) }); cur = ''; i++; continue
    }
    cur += c
  }
  out.push({ text: cur, op: null })
  return out
}

function splitPipes(stmt: string): string[] {
  const out: string[] = []
  let cur = ''
  let q: string | null = null
  let depth = 0
  for (let i = 0; i < stmt.length; i++) {
    const c = stmt[i]
    if (q) { cur += c; if (c === '\\') cur += stmt[++i] ?? ''; else if (c === q) q = null; continue }
    if (c === HD) { const end = stmt.indexOf(HD, stmt.indexOf(HD, i + 1) + 1); cur += stmt.slice(i, end + 1); i = end; continue }
    if (c === '\\') { cur += c + (stmt[++i] ?? ''); continue }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === '|' && depth === 0 && stmt[i + 1] !== '|' && stmt[i - 1] !== '|') { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}

/** Tokenize one simple command: expansions, quote removal, globbing, redirections. */
export function tokenize(text: string, sh: Shell): { words: string[]; redirs: Redir[] } {
  const words: string[] = []
  const redirs: Redir[] = []
  let i = 0
  const s = text
  let pendingRedir: Redir | null = null
  /** Leading NAME=value words are assignments: their values are never split or globbed. */
  let onlyAssignments = true

  const pushWord = (w0: string, glob: boolean, split: boolean) => {
    if (w0 === DROP) return
    const w = w0.split(DROP).join('')
    const isAssign = onlyAssignments && !pendingRedir && /^[A-Za-z_]\w*\+?=/.test(w)
    if (!isAssign && !pendingRedir) onlyAssignments = false
    const parts = (split && !isAssign ? w.split(/\s+/).filter(Boolean) : [w]).flatMap((p) => p.split(SPLIT))
    for (const part of parts) {
      const expanded = glob && !isAssign && words[0] !== '[[' && /[*?]/.test(part) ? expandGlob(part, sh) : [part]
      for (const e of expanded) {
        if (pendingRedir) { pendingRedir.target = e; pendingRedir = null }
        else words.push(e)
      }
    }
  }

  while (i < s.length) {
    while (i < s.length && isSpace(s[i])) i++
    if (i >= s.length) break
    // here-doc body carried from splitStatements: <<\u0003(q|e)\u0003body\u0003
    if (s.startsWith('<<' + HD, i)) {
      const mode = s[i + 3]
      const end = s.indexOf(HD, i + 5)
      const raw = s.slice(i + 5, end < 0 ? s.length : end)
      redirs.push({ kind: '<<', body: mode === 'q' ? raw : expandHeredoc(raw, sh) })
      i = end < 0 ? s.length : end + 1
      continue
    }
    // redirection operators
    const opMatch = s.slice(i).match(/^(2>>|2>&1|1>&2|>&2|2>|&>|>>|>|<<<|<)/)
    if (opMatch) {
      const op = opMatch[1] as Redir['kind']
      const r: Redir = { kind: op }
      redirs.push(r)
      i += op.length
      if (op !== '2>&1' && op !== '>&2' && op !== '1>&2') pendingRedir = r
      continue
    }
    let word = ''
    let quoted = false
    let hadUnquotedExpansion = false
    let first = true
    while (i < s.length && !isSpace(s[i])) {
      const c = s[i]
      if (c === '>' || c === '<') break
      if (c === "'") {
        quoted = true
        const end = s.indexOf("'", i + 1)
        if (end < 0) throw new Error('unexpected EOF while looking for matching quote')
        word += s.slice(i + 1, end)
        i = end + 1
      } else if (c === '"') {
        quoted = true
        i++
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\' && '"$`\\'.includes(s[i + 1] ?? '')) { word += s[i + 1]; i += 2; continue }
          if (s[i] === '$') { const r = expandDollar(s, i, sh, true); word += r.value; i = r.next; continue }
          if (s[i] === '`') { const end = s.indexOf('`', i + 1); word += sh.capture(s.slice(i + 1, end < 0 ? s.length : end)); i = end < 0 ? s.length : end + 1; continue }
          word += s[i++]
        }
        if (i >= s.length) throw new Error('unexpected EOF while looking for matching quote')
        i++
      } else if (c === '\\') {
        quoted = true
        word += s[i + 1] ?? ''
        i += 2
      } else if (c === '$') {
        const r = expandDollar(s, i, sh)
        word += r.value
        hadUnquotedExpansion = true
        i = r.next
      } else if (c === '`') {
        const end = s.indexOf('`', i + 1)
        word += sh.capture(s.slice(i + 1, end < 0 ? s.length : end))
        hadUnquotedExpansion = true
        i = end < 0 ? s.length : end + 1
      } else if (c === '~' && first && (s[i + 1] === '/' || s[i + 1] === undefined || isSpace(s[i + 1]))) {
        word += HOME
        i++
      } else {
        word += c
        i++
      }
      first = false
    }
    if (hadUnquotedExpansion && !quoted && word.trim() === '') continue
    pushWord(word, !quoted, hadUnquotedExpansion && !quoted)
  }
  return { words, redirs }
}

function expandDollar(s: string, i: number, sh: Shell, inQuotes = false): { value: string; next: number } {
  // $(( arithmetic ))
  if (s.startsWith('$((', i)) {
    const end = findClose(s, i + 3, '(', ')', 2)
    const expr = s.slice(i + 3, end)
    return { value: String(evalArith(expr, sh)), next: end + 2 }
  }
  if (s.startsWith('$(', i)) {
    const end = findClose(s, i + 2, '(', ')', 1)
    return { value: sh.capture(s.slice(i + 2, end)), next: end + 1 }
  }
  if (s.startsWith('${', i)) {
    const end = findBrace(s, i + 2)
    const inner = s.slice(i + 2, end < 0 ? s.length : end)
    // Arrays: ${#a[@]} ${!a[@]} ${a[@]} ${a[*]} ${a[i]} ${a[@]:off:len}
    const am = inner.match(/^([#!]?)([A-Za-z_]\w*)\[([^\]]+)\](?::(-?\d+)(?::(\d+))?)?$/)
    if (am) {
      const list = sh.arrays[am[2]] ?? (sh.env[am[2]] !== undefined ? [sh.env[am[2]]] : [])
      const idx = am[3].trim()
      if (am[1] === '#') return { value: String(idx === '@' || idx === '*' ? list.length : (list[evalArith(idx, sh)] ?? '').length), next: end + 1 }
      if (am[1] === '!') return { value: list.map((_, k) => String(k)).join(' '), next: end + 1 }
      if (idx === '@' || idx === '*') {
        let items = list
        if (am[4] !== undefined) { const off = Number(am[4]); items = am[5] !== undefined ? list.slice(off, off + Number(am[5])) : list.slice(off) }
        if (idx === '@' && inQuotes) return { value: items.length ? items.join(SPLIT) : DROP, next: end + 1 }
        return { value: items.join(' '), next: end + 1 }
      }
      const k = evalArith(idx, sh)
      return { value: list[k < 0 ? list.length + k : k] ?? '', next: end + 1 }
    }
    if (inner.startsWith('#') && inner.length > 1) return { value: String(sh.getVar(inner.slice(1)).length), next: end + 1 }
    if (inner.startsWith('!') && inner.length > 1) return { value: sh.getVar(sh.getVar(inner.slice(1))), next: end + 1 }
    const m = inner.match(/^([A-Za-z_]\w*|[?#@*\d$!])(?::-(.*)|:=(.*)|:\+(.*)|:\?(.*)|##(.*)|#(.*)|%%(.*)|%(.*)|\/\/(.*?)\/(.*)|\/(.*?)\/(.*)|:(-?\d+)(?::(\d+))?|(\^\^|,,|\^|,))?$/s)
    if (!m) return { value: '', next: end + 1 }
    const name = m[1]
    let v: string
    if (name === '@' && inQuotes) v = atExpansion(sh)
    else if (m[2] !== undefined || m[3] !== undefined || m[4] !== undefined || m[5] !== undefined) v = sh.isSet(name) || /^[?#@*\d$!]$/.test(name) ? sh.getVar(name) : ''
    else v = sh.getVar(name)
    if (m[2] !== undefined && v === '') v = m[2]
    if (m[3] !== undefined && v === '') { v = m[3]; sh.env[name] = v }
    if (m[4] !== undefined) v = v === '' ? '' : m[4]
    if (m[5] !== undefined && v === '') throw new UnboundVariable(`${name}: ${m[5] || 'parameter null or not set'}`)
    if (m[6] !== undefined) v = v.replace(globToRegex(m[6], true, false, true), '')
    if (m[7] !== undefined) v = v.replace(globToRegex(m[7], true), '')
    if (m[8] !== undefined) v = v.replace(globToRegex(m[8], false, true, true), '')
    if (m[9] !== undefined) v = v.replace(globToRegex(m[9], false, true), '')
    if (m[10] !== undefined) v = v.replace(new RegExp(globToRegex(m[10], false).source, 'g'), m[11] ?? '')
    if (m[12] !== undefined) v = v.replace(globToRegex(m[12], false), m[13] ?? '')
    if (m[14] !== undefined) { const off = Number(m[14]); const start = off < 0 ? Math.max(0, v.length + off) : off; v = m[15] !== undefined ? v.slice(start, start + Number(m[15])) : v.slice(start) }
    if (m[16] === '^^') v = v.toUpperCase()
    else if (m[16] === ',,') v = v.toLowerCase()
    else if (m[16] === '^') v = v.charAt(0).toUpperCase() + v.slice(1)
    else if (m[16] === ',') v = v.charAt(0).toLowerCase() + v.slice(1)
    return { value: v, next: end + 1 }
  }
  const m = s.slice(i + 1).match(/^([A-Za-z_]\w*|[?#@*\d!$])/)
  if (!m) return { value: '$', next: i + 1 }
  return { value: m[1] === '@' && inQuotes ? atExpansion(sh) : sh.getVar(m[1]), next: i + 1 + m[1].length }
}

/** "$@" inside double quotes: each positional becomes its own word (SPLIT sentinel), none becomes no word (DROP). */
const SPLIT = '\u0001'
const DROP = '\u0002'
const atExpansion = (sh: Shell) => (sh.positional.length ? sh.positional.join(SPLIT) : DROP)

/** Index of the '}' closing a ${ that opened at from, allowing nested ${ } inside. */
function findBrace(s: string, from: number): number {
  let depth = 1
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue }
    if (s.startsWith('${', i)) { depth++; i++; continue }
    if (s[i] === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

/** Expand $var, ${...}, $( ) and backslash escapes inside an unquoted here-doc body. */
function expandHeredoc(body: string, sh: Shell): string {
  let out = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '\\' && (body[i + 1] === '$' || body[i + 1] === '\\' || body[i + 1] === '`')) { out += body[i + 1]; i++; continue }
    if (c === '$') { const r = expandDollar(body, i, sh, true); out += r.value; i = r.next - 1; continue }
    if (c === '`') { const end = body.indexOf('`', i + 1); out += sh.capture(body.slice(i + 1, end < 0 ? body.length : end)); i = end < 0 ? body.length : end; continue }
    out += c
  }
  return out
}

function findClose(s: string, from: number, open: string, close: string, count: number): number {
  let depth = count
  for (let i = from; i < s.length; i++) {
    if (s[i] === open) depth++
    else if (s[i] === close) { depth--; if (depth === 0) return i - (count - 1) }
  }
  return s.length
}

function globToRegex(glob: string, anchorStart: boolean, anchorEnd = false, greedy = false): RegExp {
  const re = glob.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, greedy ? '.*' : '.*?').replace(/\?/g, '.')
  return new RegExp((anchorStart ? '^' : '') + re + (anchorEnd ? '$' : ''))
}

export function globRegex(pattern: string): RegExp {
  // Character classes like [Yy] and [0-9] pass through; other regex characters are escaped.
  const re = pattern.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\[!/g, '[^')
  try { return new RegExp('^' + re + '$') } catch { return new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }
}

function expandGlob(pattern: string, sh: Shell): string[] {
  const slash = pattern.lastIndexOf('/')
  const dirPart = slash >= 0 ? pattern.slice(0, slash + 1) : ''
  const namePart = slash >= 0 ? pattern.slice(slash + 1) : pattern
  let entries: [string, FsNode][]
  try { entries = sh.vfs.list(sh.path(dirPart || '.')) } catch { return [pattern] }
  const re = globRegex(namePart)
  const matches = entries.map(([n]) => n).filter((n) => re.test(n) && (namePart.startsWith('.') || !n.startsWith('.'))).map((n) => dirPart + n)
  return matches.length ? matches : [pattern]
}

/** Tiny arithmetic evaluator for $(( )). */
export function evalArith(expr: string, sh: Shell): number {
  // Several expressions separated by commas: the last one is the value.
  const parts = splitTopLevel(expr, ',')
  if (parts.length > 1) { let v = 0; for (const p of parts) v = evalArith(p, sh); return v }
  const t = expr.trim()
  // Assignment forms: x=expr, x+=expr, x++, ++x, x--, --x
  let m = t.match(/^([A-Za-z_]\w*)\s*(\+\+|--)$/) || t.match(/^(\+\+|--)\s*([A-Za-z_]\w*)$/)
  if (m) {
    const post = /^[A-Za-z_]/.test(m[1])
    const name = post ? m[1] : m[2]
    const op = post ? m[2] : m[1]
    const before = Number(sh.env[name] ?? sh.arrays[name]?.[0] ?? 0) || 0
    const after = op === '++' ? before + 1 : before - 1
    sh.env[name] = String(after)
    return post ? before : after
  }
  m = t.match(/^([A-Za-z_]\w*)\s*([-+*/%]|\*\*)?=(?!=)\s*(.*)$/s)
  if (m) {
    const rhs = evalArith(m[3], sh)
    const cur = Number(sh.env[m[1]] ?? 0) || 0
    const ops: Record<string, (a: number, b: number) => number> = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => Math.trunc(a / b), '%': (a, b) => a % b, '**': (a, b) => a ** b }
    const v = m[2] ? ops[m[2]](cur, rhs) : rhs
    sh.env[m[1]] = String(v)
    return v
  }
  const src = expr.replace(/[A-Za-z_]\w*/g, (name) => {
    const v = sh.env[name] ?? sh.arrays[name]?.[0] ?? (/^[?#]$/.test(name) ? sh.getVar(name) : '')
    return v === '' || Number.isNaN(Number(v)) ? '0' : v
  })
  let pos = 0
  const peek = () => src.slice(pos).match(/^\s*(\*\*|<=|>=|==|!=|&&|\|\||[-+*/%()<>!?:]|\d+)/)?.[1]
  const take = () => { const t = peek(); if (t) pos += src.slice(pos).indexOf(t) + t.length; return t }
  const primary = (): number => {
    const t = take()
    if (t === '(') { const v = expr_(); take(); return v }
    if (t === '-') return -primary()
    if (t === '!') return primary() ? 0 : 1
    if (t === undefined) return 0
    return Number(t)
  }
  const pow = (): number => { let l = primary(); while (peek() === '**') { take(); l = l ** primary() } return l }
  const mul = (): number => { let l = pow(); for (;;) { const t = peek(); if (t === '*' || t === '/' || t === '%') { take(); const r = pow(); l = t === '*' ? l * r : t === '/' ? Math.trunc(l / r) : l % r } else return l } }
  const add = (): number => { let l = mul(); for (;;) { const t = peek(); if (t === '+' || t === '-') { take(); const r = mul(); l = t === '+' ? l + r : l - r } else return l } }
  const cmp = (): number => { let l = add(); for (;;) { const t = peek(); if (t === '<' || t === '>' || t === '<=' || t === '>=' || t === '==' || t === '!=') { take(); const r = add(); l = Number(t === '<' ? l < r : t === '>' ? l > r : t === '<=' ? l <= r : t === '>=' ? l >= r : t === '==' ? l === r : l !== r) } else return l } }
  const andOr = (): number => { let l = cmp(); for (;;) { const t = peek(); if (t === '&&' || t === '||') { take(); const r = cmp(); l = Number(t === '&&' ? l && r : l || r) } else return l } }
  const ternary = (): number => { const c = andOr(); if (peek() === '?') { take(); const a = ternary(); if (peek() === ':') take(); const b = ternary(); return c ? a : b } return c }
  const expr_ = ternary
  return expr_()
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const c of s) {
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}
