// Simulated Linux shell: tokenizer, expansions, pipelines, redirection, and a
// small bash interpreter (variables, if, for, while, functions, exit codes).
import { VFS, FsError, normalize, dirname, seedFs, type FsNode } from './vfs'
import { COMMANDS, type CmdResult } from './commands'
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

export interface Redir { kind: '>' | '>>' | '<' | '2>' | '2>>' | '2>&1' | '&>'; target?: string }

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
  constructor() { this.seedSystem() }

  /* ---------- setup ---------- */

  seedSystem() {
    const v = this.vfs
    const root = 'root'
    for (const d of ['/bin', '/usr/bin', '/usr/local/bin', '/etc', '/var/log', '/tmp', '/home', '/root', '/proc', '/dev', '/usr/share/man', '/opt', '/srv']) v.mkdir(d, { parents: true, owner: root })
    v.mkdir(HOME, { parents: true })
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

  canRead(n: FsNode) { return this.user === 'root' || n.owner === this.user ? Boolean(n.mode & 0o400) || this.user === 'root' : Boolean(n.mode & 0o004) }
  canWrite(n: FsNode) { return this.user === 'root' || (n.owner === this.user ? Boolean(n.mode & 0o200) : Boolean(n.mode & 0o002)) }
  canExec(n: FsNode) { return n.owner === this.user ? Boolean(n.mode & 0o100) : Boolean(n.mode & 0o011) || (this.user === 'root' && Boolean(n.mode & 0o111)) }

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
      return r.out.replace(/\n+$/, '')
    } finally { this.tty = saved }
  }

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
            const c = this.execStatements(splitStatements(b.cond))
            add(c)
            if (c.code === 0) { combine(this.execStatements(b.body)); ran = true; break }
          }
          if (!ran) { if (elseBody) combine(this.execStatements(elseBody)); else { code = 0; this.lastStatus = 0 } }
          continue
        }
        if (s.startsWith('for ') || s.startsWith('while ') || s.startsWith('until ')) {
          const { header, body, next, stdinFile } = parseLoop(stmts, i)
          i = next
          const savedStdin = this.env.STDIN
          if (stdinFile) this.env.STDIN = this.readFile(stdinFile)
          const runBody = () => {
            try { combine(this.execStatements(body)); return true }
            catch (e) { if (e instanceof ShellContinue) { add(fromCf(e, code)); return true } if (e instanceof ShellBreak) { add(fromCf(e, code)); return false } throw e }
          }
          try {
            if (header.startsWith('for ')) {
              const m = header.match(/^for\s+([A-Za-z_]\w*)(?:\s+in\s*(.*))?$/)
              if (!m) { err += `bash: syntax error near 'for'\n`; seq += `bash: syntax error near 'for'\n`; code = 2; continue }
              const items = m[2] === undefined ? [...this.positional] : this.expandWords(m[2])
              for (const item of items) { this.env[m[1]] = item; if (!runBody()) break }
            } else {
              const isUntil = header.startsWith('until ')
              const cond = header.slice(6)
              let guard = 0
              while (guard++ < 10000) {
                const c = this.execStatements(splitStatements(cond))
                add(c)
                if ((c.code === 0) === isUntil) break
                if (!runBody()) break
              }
              if (guard >= 10000) { err += 'bash: loop stopped after 10000 iterations\n'; seq += 'bash: loop stopped after 10000 iterations\n' }
            }
          } finally {
            if (stdinFile) this.env.STDIN = savedStdin ?? ''
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
        if (['then', 'do', 'done', 'fi', 'else', '}'].includes(s) || s.startsWith('elif ')) {
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
      }
    } catch (e) {
      if (e instanceof ControlFlow) { e.out = out + e.out; e.err = err + e.err; e.seq = seq + e.seq }
      throw e
    }
    return { out, err, code, seq }
  }

  /** A statement: pipelines joined by && and ||. */
  execList(stmt: string): CmdResult {
    const parts = splitList(stmt)
    let out = ''
    let err = ''
    let seq = ''
    let code = 0
    let prevOp: string | null = null
    for (const { text, op } of parts) {
      if (prevOp === '&&' && code !== 0) { prevOp = op; continue }
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
    if (t.startsWith('! ')) { negate = true; t = t.slice(2) }
    let background = false
    if (t.endsWith('&') && !t.endsWith('&&')) { background = true; t = t.slice(0, -1).trim() }
    const cmds = splitPipes(t)
    let stdin = ''
    let out = ''
    let err = ''
    let code = 0
    if (background) {
      const pid = this.nextPid++
      const id = this.jobs.length + 1
      this.jobs.push({ id, pid, cmd: t })
      this.state.processes.push({ pid, user: this.user, cmd: t, cpu: 0, mem: 0.1 })
      return { out: `[${id}] ${pid}\n`, err: '', code: 0 }
    }
    let seq = ''
    for (let k = 0; k < cmds.length; k++) {
      this.tty = k === cmds.length - 1 && !/(^|[^2&])>/.test(cmds[k].replace(/'[^']*'|"[^"]*"/g, ''))
      const r = this.execSimple(cmds[k], stdin)
      this.tty = true
      err += r.err
      code = r.code
      if (k === cmds.length - 1) { out += r.out; seq += r.seq ?? r.err + r.out }
      else { stdin = r.out; seq += r.err }
    }
    if (negate) code = code === 0 ? 1 : 0
    return { out, err, code, seq }
  }

  execSimple(text: string, stdin: string): CmdResult {
    let words: string[]
    let redirs: Redir[]
    try {
      ;({ words, redirs } = tokenize(text, this))
    } catch (e) {
      return { out: '', err: `bash: ${(e as Error).message}\n`, code: 2 }
    }
    // stdin redirection
    for (const r of redirs) {
      if (r.kind === '<' && r.target !== undefined) {
        try { stdin = this.readFile(r.target) } catch (e) { return { out: '', err: `bash: ${(e as Error).message}\n`, code: 1 } }
      }
    }
    // assignments
    while (words.length && /^[A-Za-z_]\w*=/.test(words[0])) {
      const [name, ...rest] = words[0].split('=')
      this.env[name] = rest.join('=')
      words.shift()
      if (words.length === 0) return { out: '', err: '', code: 0 }
    }
    let res: CmdResult
    if (words.length === 0) res = { out: '', err: '', code: 0 }
    else res = this.invoke(words, stdin)
    // output redirection
    for (const r of redirs) {
      if (r.kind === '<') continue
      if (r.kind === '2>&1') { res = { ...res, out: res.out + res.err, err: '' }; continue }
      if (r.target === undefined) continue
      try {
        if (r.kind === '>' || r.kind === '>>') { this.writeFile(r.target, res.out, r.kind === '>>'); res = { ...res, out: '' } }
        else if (r.kind === '2>' || r.kind === '2>>') { this.writeFile(r.target, res.err, r.kind === '2>>'); res = { ...res, err: '' } }
        else if (r.kind === '&>') { this.writeFile(r.target, res.out + res.err); res = { ...res, out: '', err: '' } }
      } catch (e) {
        return { out: '', err: `bash: ${(e as Error).message}\n`, code: 1 }
      }
    }
    return res
  }

  invoke(words: string[], stdin: string): CmdResult {
    const [name, ...args] = words
    if (this.functions[name]) {
      const saved = this.positional
      this.positional = args
      try { return this.execStatements(this.functions[name]) }
      catch (e) { if (e instanceof ShellReturn) return fromCf(e, e.code); throw e }
      finally { this.positional = saved }
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
    return this.runScriptFile(abs, n.content, args, stdin)
  }

  runScriptFile(abs: string, content: string, args: string[], stdin: string): CmdResult {
    const first = content.split('\n')[0]
    if (first.startsWith('#!') && !/(bash|\/sh|\/env sh|\/env bash)/.test(first)) {
      return { out: '', err: `bash: ${abs}: only bash and sh scripts run in this terminal (shebang: ${first})\n`, code: 126 }
    }
    // Scripts run in a child context: cwd and variables do not leak back out.
    const savedCwd = this.cwd
    const savedEnv = { ...this.env }
    const savedFns = { ...this.functions }
    this.env.STDIN = stdin
    try {
      return this.execScript(content, args, abs)
    } finally {
      this.cwd = savedCwd
      this.env = savedEnv
      this.functions = savedFns
    }
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
    return this.env[name] ?? ''
  }

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
export const BUILTIN_ONLY = new Set(['cd', 'export', 'unset', 'source', '.', 'exit', 'return', 'history', 'alias', 'local', 'shift', 'break', 'continue', 'read', 'set', 'type', 'help', 'true', 'false', 'test', '[', '[[', 'exec', 'jobs', 'fg', 'bg', 'wait', 'pushd', 'popd', 'let', 'declare'])

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
    if (c === '(' ) { depth++; cur += c; continue }
    if (c === ')' ) { depth = Math.max(0, depth - 1); cur += c; continue }
    if ((c === '\n' || c === ';') && depth === 0) {
      if (c === ';' && src[i + 1] === ';') { i++ }
      raw.push(cur.trim()); cur = ''
      continue
    }
    if (c === '&' && src[i + 1] !== '&' && src[i - 1] !== '&' && src[i - 1] !== '>' && depth === 0) { cur += c; raw.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (q) throw new Incomplete()
  raw.push(cur.trim())
  const out: string[] = []
  for (let s of raw) {
    if (!s) continue
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
    if (s === 'if' || s.startsWith('if ') || s.startsWith('for ') || s.startsWith('while ') || s.startsWith('until ') || s === '{') depth++
    else if (s === 'fi' || s === 'done' || s === '}') depth--
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
    if (s === 'done' || doneRedir) { if (depth === 0) return { header, body, next: i + 1, stdinFile: doneRedir?.[1] }; depth-- }
    body.push(s)
    i++
  }
  return { header, body, next: i, stdinFile: undefined as string | undefined }
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
  for (let i = 0; i < stmt.length; i++) {
    const c = stmt[i]
    if (q) { cur += c; if (c === '\\') cur += stmt[++i] ?? ''; else if (c === q) q = null; continue }
    if (c === '\\') { cur += c + (stmt[++i] ?? ''); continue }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue }
    if (c === '(') depth++
    if (c === ')') depth--
    if (depth === 0 && (stmt.startsWith('&&', i) || stmt.startsWith('||', i))) {
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

  const pushWord = (w0: string, glob: boolean, split: boolean) => {
    if (w0 === DROP) return
    const w = w0.split(DROP).join('')
    const parts = (split ? w.split(/\s+/).filter(Boolean) : [w]).flatMap((p) => p.split(SPLIT))
    for (const part of parts) {
      const expanded = glob && /[*?]/.test(part) ? expandGlob(part, sh) : [part]
      for (const e of expanded) {
        if (pendingRedir) { pendingRedir.target = e; pendingRedir = null }
        else words.push(e)
      }
    }
  }

  while (i < s.length) {
    while (i < s.length && isSpace(s[i])) i++
    if (i >= s.length) break
    // redirection operators
    const opMatch = s.slice(i).match(/^(2>>|2>&1|2>|&>|>>|>|<)/)
    if (opMatch && (i === 0 || isSpace(s[i - 1]) || true)) {
      const op = opMatch[1] as Redir['kind']
      const r: Redir = { kind: op }
      redirs.push(r)
      i += op.length
      if (op !== '2>&1') pendingRedir = r
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
    const end = s.indexOf('}', i)
    const inner = s.slice(i + 2, end < 0 ? s.length : end)
    if (inner.startsWith('#') && inner.length > 1) return { value: String(sh.getVar(inner.slice(1)).length), next: end + 1 }
    const m = inner.match(/^([A-Za-z_]\w*|[?#@*\d])(?::-(.*)|:=(.*)|:\+(.*)|#(.*)|%(.*))?$/)
    if (!m) return { value: '', next: end + 1 }
    let v = m[1] === '@' && inQuotes ? atExpansion(sh) : sh.getVar(m[1])
    if (m[2] !== undefined && v === '') v = m[2]
    if (m[3] !== undefined && v === '') { v = m[3]; sh.env[m[1]] = v }
    if (m[4] !== undefined) v = v === '' ? '' : m[4]
    if (m[5] !== undefined) { const re = globToRegex(m[5], true); v = v.replace(re, '') }
    if (m[6] !== undefined) { const re = globToRegex(m[6], false, true); v = v.replace(re, '') }
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

function findClose(s: string, from: number, open: string, close: string, count: number): number {
  let depth = count
  for (let i = from; i < s.length; i++) {
    if (s[i] === open) depth++
    else if (s[i] === close) { depth--; if (depth === 0) return i - (count - 1) }
  }
  return s.length
}

function globToRegex(glob: string, anchorStart: boolean, anchorEnd = false): RegExp {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp((anchorStart ? '^' : '') + re + (anchorEnd ? '$' : ''))
}

export function globRegex(pattern: string): RegExp {
  const re = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp('^' + re + '$')
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
  const src = expr.replace(/[A-Za-z_]\w*/g, (name) => {
    const v = sh.getVar(name)
    return v === '' ? '0' : v
  })
  let pos = 0
  const peek = () => src.slice(pos).match(/^\s*(\*\*|<=|>=|==|!=|&&|\|\||[-+*/%()<>!]|\d+)/)?.[1]
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
  const expr_ = andOr
  return expr_()
}
