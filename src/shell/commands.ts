// Built-in command implementations for the simulated shell.
import { FsError, basename as bname, dirname as dname, type FsNode } from './vfs'
import { MAN, summary } from './man'
import { globRegex, HOME, HOSTNAME, type Shell } from './shell'

export interface CmdResult { out: string; err: string; code: number; /** stdout and stderr interleaved in order, for display */ seq?: string }
export type Command = (sh: Shell, args: string[], stdin: string) => CmdResult

const ok = (out = ''): CmdResult => ({ out, err: '', code: 0 })
const fail = (err: string, code = 1): CmdResult => ({ out: '', err: err.endsWith('\n') ? err : err + '\n', code })

/** Split "-la file" style args into flags and operands. */
function parseArgs(args: string[], withValue: string[] = []) {
  const flags = new Set<string>()
  const values: Record<string, string> = {}
  const operands: string[] = []
  let onlyOperands = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (onlyOperands || a === '-' || !a.startsWith('-')) { operands.push(a); continue }
    if (a === '--') { onlyOperands = true; continue }
    if (a.startsWith('--')) { flags.add(a.slice(2)); continue }
    const chars = a.slice(1)
    for (let k = 0; k < chars.length; k++) {
      const c = chars[k]
      if (withValue.includes(c)) {
        const rest = chars.slice(k + 1)
        values[c] = rest !== '' ? rest : args[++i] ?? ''
        break
      }
      flags.add(c)
    }
  }
  return { flags, values, operands }
}

/** Read named files or stdin, returning [label, content] pairs. Errors go to err. */
function inputs(sh: Shell, files: string[], stdin: string): { items: [string, string][]; err: string } {
  if (files.length === 0) return { items: [['-', stdin]], err: '' }
  const items: [string, string][] = []
  let err = ''
  for (const f of files) {
    if (f === '-') { items.push(['-', stdin]); continue }
    try { items.push([f, sh.readFile(f)]) } catch (e) { err += `${(e as Error).message}\n` }
  }
  return { items, err }
}

const lines = (s: string) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'))
const joinLines = (ls: string[]) => (ls.length ? ls.join('\n') + '\n' : '')

function modeString(n: FsNode) {
  const m = n.mode
  const bits = (v: number) => `${v & 4 ? 'r' : '-'}${v & 2 ? 'w' : '-'}${v & 1 ? 'x' : '-'}`
  return (n.type === 'dir' ? 'd' : '-') + bits(m >> 6) + bits((m >> 3) & 7) + bits(m & 7)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(ms: number) {
  const d = new Date(ms)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function sizeOf(n: FsNode): number {
  if (n.type === 'file') return n.content.length
  let s = 4096
  for (const c of n.children.values()) s += sizeOf(c)
  return s
}
const human = (b: number) => (b < 1024 ? `${b}` : b < 1024 * 1024 ? `${(b / 1024).toFixed(b < 10240 ? 1 : 0)}K` : `${(b / 1048576).toFixed(1)}M`)

function toRegex(pattern: string, flags: string, extended: boolean): RegExp {
  try {
    const p = extended ? pattern : pattern.replace(/\\([|+?(){}])/g, '$1').replace(/(?<!\\)[|+?(){}]/g, '\\$&')
    return new RegExp(p, flags)
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
  }
}

function expandSet(set: string): string[] {
  const classes: Record<string, string> = {
    '[:upper:]': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '[:lower:]': 'abcdefghijklmnopqrstuvwxyz', '[:digit:]': '0123456789',
    '[:space:]': ' \t\n', '[:alpha:]': 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', '[:punct:]': '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
  }
  for (const [k, v] of Object.entries(classes)) set = set.split(k).join(v)
  set = set.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  const out: string[] = []
  for (let i = 0; i < set.length; i++) {
    if (set[i + 1] === '-' && set[i + 2]) {
      for (let c = set.charCodeAt(i); c <= set.charCodeAt(i + 2); c++) out.push(String.fromCharCode(c))
      i += 2
    } else out.push(set[i])
  }
  return out
}

const unescape = (s: string) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')

function needRoot(sh: Shell, what: string): CmdResult | null {
  if (sh.user === 'root') return null
  return fail(`${what}: Permission denied (try running it with sudo)`)
}

export const COMMANDS: Record<string, Command> = {
  pwd: (sh) => ok(sh.cwd + '\n'),

  cd: (sh, args) => {
    let target = args[0] ?? HOME
    if (target === '-') target = sh.prevDir
    const abs = sh.path(target)
    const n = sh.vfs.get(abs)
    if (!n) return fail(`bash: cd: ${args[0]}: No such file or directory`)
    if (n.type !== 'dir') return fail(`bash: cd: ${args[0]}: Not a directory`)
    if (!(sh.user === 'root' || n.mode & 0o001 || (n.owner === sh.user && n.mode & 0o100))) return fail(`bash: cd: ${args[0]}: Permission denied`)
    sh.prevDir = sh.cwd
    sh.cwd = abs
    sh.env.PWD = abs
    return ok(args[0] === '-' ? abs + '\n' : '')
  },

  ls: (sh, args) => {
    const { flags, operands } = parseArgs(args)
    const long = flags.has('l')
    const all = flags.has('a') || flags.has('A')
    const h = flags.has('h')
    const targets = operands.length ? operands : ['.']
    let out = ''
    let err = ''
    const fmt = (name: string, n: FsNode) => {
      if (!long) return name
      const size = h ? human(sizeOf(n)) : String(n.type === 'dir' ? 4096 : n.content.length)
      const links = n.type === 'dir' ? n.children.size + 2 : 1
      return `${modeString(n)} ${links} ${n.owner.padEnd(7)} ${n.group.padEnd(7)} ${size.padStart(6)} ${fmtDate(n.mtime)} ${name}`
    }
    const listDir = (abs: string) => {
      const entries = sh.vfs.list(abs).filter(([name]) => all || !name.startsWith('.'))
      const dirNode = sh.vfs.get(abs)!
      const rows: string[] = []
      if (all && long) { rows.push(fmt('.', dirNode)); rows.push(fmt('..', sh.vfs.get(dname(abs)) ?? dirNode)) }
      else if (all) rows.push('.', '..')
      for (const [name, n] of entries) rows.push(fmt(name, n))
      if (long) return (rows.length ? `total ${entries.length}\n` : '') + joinLines(rows)
      if (!sh.tty || flags.has('1')) return joinLines(rows)
      return rows.length ? rows.join('  ') + '\n' : ''
    }
    const dirs: string[] = []
    const files: string[] = []
    for (const t of targets) {
      const abs = sh.path(t)
      const n = sh.vfs.get(abs)
      if (!n) { err += `ls: cannot access '${t}': No such file or directory\n`; continue }
      if (n.type === 'dir') {
        if (!(sh.user === 'root' || n.mode & 0o004 || (n.owner === sh.user && n.mode & 0o400))) { err += `ls: cannot open directory '${t}': Permission denied\n`; continue }
        dirs.push(t)
      } else files.push(fmt(t, n))
    }
    if (files.length) out += long || !sh.tty || flags.has('1') ? joinLines(files) : files.join('  ') + '\n'
    for (const d of dirs) {
      if (targets.length > 1) out += `${d}:\n`
      out += listDir(sh.path(d))
      if (targets.length > 1) out += '\n'
    }
    return { out, err, code: err ? 2 : 0 }
  },

  mkdir: (sh, args) => {
    const { flags, operands } = parseArgs(args)
    if (!operands.length) return fail('mkdir: missing operand')
    let err = ''
    for (const d of operands) {
      const abs = sh.path(d)
      try {
        const parent = sh.vfs.get(dname(abs))
        if (parent && !sh.canWrite(parent)) throw new FsError(`cannot create directory '${d}': Permission denied`)
        sh.vfs.mkdir(abs, { parents: flags.has('p'), owner: sh.user })
      } catch (e) { err += `mkdir: ${(e as Error).message.replace(abs, d)}\n` }
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  rmdir: (sh, args) => {
    let err = ''
    for (const d of args) {
      const n = sh.vfs.get(sh.path(d))
      if (!n) err += `rmdir: failed to remove '${d}': No such file or directory\n`
      else if (n.type !== 'dir') err += `rmdir: failed to remove '${d}': Not a directory\n`
      else if (n.children.size) err += `rmdir: failed to remove '${d}': Directory not empty\n`
      else sh.vfs.remove(sh.path(d), { recursive: true })
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  touch: (sh, args) => {
    const { operands } = parseArgs(args)
    if (!operands.length) return fail('touch: missing file operand')
    let err = ''
    for (const f of operands) {
      try {
        const abs = sh.path(f)
        if (sh.vfs.get(abs)) sh.vfs.touch(abs)
        else sh.writeFile(f, '')
      } catch (e) { err += `touch: cannot touch '${f}': ${(e as Error).message.replace(/^.*: /, '')}\n` }
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  cp: (sh, args) => {
    const { flags, operands } = parseArgs(args)
    if (operands.length < 2) return fail(operands.length ? `cp: missing destination file operand after '${operands[0]}'` : 'cp: missing file operand')
    const dst = operands[operands.length - 1]
    const srcs = operands.slice(0, -1)
    let err = ''
    for (const s of srcs) {
      try {
        const n = sh.vfs.get(sh.path(s))
        if (n && !sh.canRead(n)) throw new FsError(`cannot open '${s}' for reading: Permission denied`)
        const target = sh.vfs.isDir(sh.path(dst)) ? sh.path(dst) + '/' + bname(s) : sh.path(dst)
        const parent = sh.vfs.get(dname(target))
        if (parent && !sh.canWrite(parent)) throw new FsError(`cannot create regular file '${dst}': Permission denied`)
        sh.vfs.copy(sh.path(s), sh.path(dst), { recursive: flags.has('r') || flags.has('R') || flags.has('a') })
        const copied = sh.vfs.get(target)
        if (copied) { copied.owner = sh.user; copied.group = sh.user }
      } catch (e) { err += `cp: ${(e as Error).message}\n` }
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  mv: (sh, args) => {
    const { operands } = parseArgs(args)
    if (operands.length < 2) return fail(operands.length ? `mv: missing destination file operand after '${operands[0]}'` : 'mv: missing file operand')
    const dst = operands[operands.length - 1]
    let err = ''
    for (const s of operands.slice(0, -1)) {
      try {
        const n = sh.vfs.get(sh.path(s))
        if (!n) throw new FsError(`cannot stat '${s}': No such file or directory`)
        const srcParent = sh.vfs.get(dname(sh.path(s)))!
        if (!sh.canWrite(srcParent)) throw new FsError(`cannot move '${s}': Permission denied`)
        sh.vfs.move(sh.path(s), sh.path(dst))
      } catch (e) { err += `mv: ${(e as Error).message}\n` }
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  rm: (sh, args) => {
    const { flags, operands } = parseArgs(args)
    if (!operands.length) return fail('rm: missing operand')
    const recursive = flags.has('r') || flags.has('R')
    let err = ''
    for (const f of operands) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { if (!flags.has('f')) err += `rm: cannot remove '${f}': No such file or directory\n`; continue }
      const parent = sh.vfs.get(dname(abs))!
      if (!sh.canWrite(parent)) { err += `rm: cannot remove '${f}': Permission denied\n`; continue }
      try { sh.vfs.remove(abs, { recursive }) } catch (e) { err += `rm: ${(e as Error).message}\n` }
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  cat: (sh, args, stdin) => {
    const { flags, operands } = parseArgs(args)
    const { items, err } = inputs(sh, operands, stdin)
    let out = items.map(([, c]) => c).join('')
    if (flags.has('n')) out = joinLines(lines(out).map((l, i) => `${String(i + 1).padStart(6)}\t${l}`))
    return { out, err: err.replace(/^/gm, 'cat: ').replace(/^cat: $/m, ''), code: err ? 1 : 0 }
  },

  less: (sh, args, stdin) => {
    const r = COMMANDS.cat(sh, args, stdin)
    if (r.code === 0) r.out += '(END) less shows one screen at a time on a real terminal. Press q there to quit.\n'
    return r
  },
  more: (sh, args, stdin) => COMMANDS.less(sh, args, stdin),

  head: (sh, args, stdin) => {
    const numeric = args.find((a) => /^-\d+$/.test(a))
    const rest = args.filter((a) => !/^-\d+$/.test(a))
    const { values, operands } = parseArgs(rest, ['n'])
    const n = numeric ? Number(numeric.slice(1)) : values.n !== undefined ? Number(values.n) : 10
    const { items, err } = inputs(sh, operands, stdin)
    const out = items.map(([name, c]) => (items.length > 1 ? `==> ${name} <==\n` : '') + joinLines(lines(c).slice(0, n))).join('\n')
    return { out, err: err.replace(/^(.)/gm, 'head: $1'), code: err ? 1 : 0 }
  },

  tail: (sh, args, stdin) => {
    const numeric = args.find((a) => /^-\d+$/.test(a))
    const rest = args.filter((a) => !/^-\d+$/.test(a))
    const { values, operands, flags } = parseArgs(rest, ['n'])
    const n = numeric ? Number(numeric.slice(1)) : values.n !== undefined ? Number(values.n) : 10
    const { items, err } = inputs(sh, operands, stdin)
    let out = items.map(([name, c]) => (items.length > 1 ? `==> ${name} <==\n` : '') + joinLines(lines(c).slice(-n))).join('\n')
    if (flags.has('f')) out += '(tail -f keeps watching on a real terminal. Press Ctrl+C there to stop.)\n'
    return { out, err: err.replace(/^(.)/gm, 'tail: $1'), code: err ? 1 : 0 }
  },

  echo: (_sh, args) => {
    let noNewline = false
    let escapes = false
    let i = 0
    while (i < args.length && /^-[neE]+$/.test(args[i])) {
      if (args[i].includes('n')) noNewline = true
      if (args[i].includes('e')) escapes = true
      i++
    }
    let text = args.slice(i).join(' ')
    if (escapes) text = unescape(text)
    return ok(text + (noNewline ? '' : '\n'))
  },

  printf: (_sh, args) => {
    if (!args.length) return fail('printf: usage: printf FORMAT [ARGUMENTS]')
    const fmt = unescape(args[0])
    const rest = args.slice(1)
    let k = 0
    let out = ''
    do {
      out += fmt.replace(/%(-?\d*)([sd%])/g, (_m, w, t) => {
        if (t === '%') return '%'
        const v = rest[k++] ?? ''
        const s = t === 'd' ? String(Number(v) || 0) : v
        const width = Number(w)
        return width ? (w.startsWith('-') ? s.padEnd(-width) : s.padStart(width)) : s
      })
    } while (k < rest.length && /%[sd]/.test(fmt))
    return ok(out)
  },

  grep: (sh, args, stdin) => {
    const { flags, operands } = parseArgs(args.filter((a) => a !== '--color=auto'))
    if (!operands.length) return fail('Usage: grep [OPTION]... PATTERN [FILE]...', 2)
    const [pattern, ...files] = operands
    const re = toRegex(pattern, flags.has('i') ? 'i' : '', flags.has('E'))
    const invert = flags.has('v')
    const targets: string[] = []
    let err = ''
    if (flags.has('r') || flags.has('R')) {
      for (const f of files.length ? files : ['.']) {
        const abs = sh.path(f)
        if (!sh.vfs.get(abs)) { err += `grep: ${f}: No such file or directory\n`; continue }
        sh.vfs.walk(abs, (p, n) => { if (n.type === 'file') targets.push(f === '.' ? p.slice(abs.length + 1) : f.replace(/\/$/, '') + p.slice(abs.length)) })
      }
    } else targets.push(...files)
    const { items, err: e2 } = inputs(sh, targets, stdin)
    err += e2.replace(/^(.)/gm, 'grep: $1')
    let out = ''
    let any = false
    const many = items.length > 1 || flags.has('r') || flags.has('R')
    for (const [name, content] of items) {
      const ls = lines(content)
      let count = 0
      ls.forEach((l, i) => {
        const hit = re.test(l) !== invert
        if (!hit) return
        any = true
        count++
        if (flags.has('c') || flags.has('l')) return
        out += (many ? `${name}:` : '') + (flags.has('n') ? `${i + 1}:` : '') + l + '\n'
      })
      if (flags.has('c')) out += (many ? `${name}:` : '') + count + '\n'
      if (flags.has('l') && count) out += name + '\n'
    }
    return { out, err, code: err ? 2 : any ? 0 : 1 }
  },

  find: (sh, args) => {
    const paths: string[] = []
    let i = 0
    while (i < args.length && !args[i].startsWith('-')) paths.push(args[i++])
    if (!paths.length) paths.push('.')
    let nameRe: RegExp | null = null
    let type: string | null = null
    for (; i < args.length; i++) {
      if (args[i] === '-name') nameRe = globRegex(args[++i] ?? '')
      else if (args[i] === '-iname') nameRe = new RegExp(globRegex(args[++i] ?? '').source, 'i')
      else if (args[i] === '-type') type = args[++i]
      else if (args[i] === '-print') continue
      else return fail(`find: unknown predicate '${args[i]}'`)
    }
    let out = ''
    let err = ''
    for (const p of paths) {
      const abs = sh.path(p)
      if (!sh.vfs.get(abs)) { err += `find: '${p}': No such file or directory\n`; continue }
      sh.vfs.walk(abs, (full, n) => {
        const shown = p.replace(/\/$/, '') + full.slice(abs.length)
        if (type === 'f' && n.type !== 'file') return
        if (type === 'd' && n.type !== 'dir') return
        if (nameRe && !nameRe.test(bname(full))) return
        out += (shown === '' ? '/' : shown) + '\n'
      })
    }
    return { out, err, code: err ? 1 : 0 }
  },

  wc: (sh, args, stdin) => {
    const { flags, operands } = parseArgs(args)
    const { items, err } = inputs(sh, operands, stdin)
    const showAll = !flags.has('l') && !flags.has('w') && !flags.has('c')
    let out = ''
    const totals = [0, 0, 0]
    const row = (l: number, w: number, c: number, name: string) => {
      const cols: string[] = []
      if (showAll || flags.has('l')) cols.push(String(l).padStart(showAll ? 7 : 0))
      if (showAll || flags.has('w')) cols.push(String(w).padStart(showAll ? 7 : 0))
      if (showAll || flags.has('c')) cols.push(String(c).padStart(showAll ? 7 : 0))
      return cols.join(' ') + (name === '-' ? '' : ' ' + name) + '\n'
    }
    for (const [name, c] of items) {
      const l = (c.match(/\n/g) ?? []).length
      const w = c.split(/\s+/).filter(Boolean).length
      totals[0] += l; totals[1] += w; totals[2] += c.length
      out += row(l, w, c.length, name)
    }
    if (items.length > 1) out += row(totals[0], totals[1], totals[2], 'total')
    return { out, err: err.replace(/^(.)/gm, 'wc: $1'), code: err ? 1 : 0 }
  },

  sort: (sh, args, stdin) => {
    const { flags, values, operands } = parseArgs(args, ['k', 't'])
    const { items, err } = inputs(sh, operands, stdin)
    let ls = items.flatMap(([, c]) => lines(c))
    const key = values.k ? Number(values.k.split(',')[0]) - 1 : -1
    const sep = values.t
    const field = (l: string) => (key < 0 ? l : (sep ? l.split(sep) : l.trim().split(/\s+/))[key] ?? '')
    ls.sort((a, b) => {
      const fa = field(a)
      const fb = field(b)
      if (flags.has('n')) return (parseFloat(fa) || 0) - (parseFloat(fb) || 0) || a.localeCompare(b)
      return fa.localeCompare(fb) || a.localeCompare(b)
    })
    if (flags.has('r')) ls.reverse()
    if (flags.has('u')) ls = ls.filter((l, i) => i === 0 || l !== ls[i - 1])
    return { out: joinLines(ls), err, code: err ? 2 : 0 }
  },

  uniq: (sh, args, stdin) => {
    const { flags, operands } = parseArgs(args)
    const { items, err } = inputs(sh, operands.slice(0, 1), stdin)
    const ls = items.flatMap(([, c]) => lines(c))
    const groups: { line: string; n: number }[] = []
    for (const l of ls) {
      const last = groups[groups.length - 1]
      if (last && last.line === l) last.n++
      else groups.push({ line: l, n: 1 })
    }
    let out = groups
    if (flags.has('d')) out = out.filter((g) => g.n > 1)
    if (flags.has('u')) out = out.filter((g) => g.n === 1)
    return { out: joinLines(out.map((g) => (flags.has('c') ? `${String(g.n).padStart(7)} ${g.line}` : g.line))), err, code: err ? 1 : 0 }
  },

  cut: (sh, args, stdin) => {
    const { values, operands } = parseArgs(args, ['d', 'f', 'c'])
    if (values.f === undefined && values.c === undefined) return fail('cut: you must specify a list of bytes, characters, or fields')
    const { items, err } = inputs(sh, operands, stdin)
    const ranges = (spec: string) => spec.split(',').map((r) => { const [a, b] = r.split('-'); return [Number(a) || 1, b === undefined ? Number(a) : b === '' ? Infinity : Number(b)] as [number, number] })
    const pick = (parts: string[], spec: string) => {
      const rs = ranges(spec)
      return parts.filter((_, i) => rs.some(([a, b]) => i + 1 >= a && i + 1 <= b))
    }
    const out = items.flatMap(([, c]) => lines(c)).map((l) => {
      if (values.c !== undefined) return pick(l.split(''), values.c).join('')
      const d = values.d ?? '\t'
      if (!l.includes(d)) return l
      return pick(l.split(d), values.f).join(d)
    })
    return { out: joinLines(out), err, code: err ? 1 : 0 }
  },

  tr: (_sh, args, stdin) => {
    const { flags, operands } = parseArgs(args)
    if (!operands.length) return fail('tr: missing operand')
    const set1 = expandSet(operands[0])
    if (flags.has('d')) return ok([...stdin].filter((c) => !set1.includes(c)).join(''))
    if (operands.length < 2) return fail('tr: missing operand after SET1')
    const set2 = expandSet(operands[1])
    const map = new Map<string, string>()
    set1.forEach((c, i) => map.set(c, set2[Math.min(i, set2.length - 1)]))
    let out = [...stdin].map((c) => map.get(c) ?? c).join('')
    if (flags.has('s')) out = out.replace(new RegExp(`([${set2.map((c) => c.replace(/[\\\]^-]/g, '\\$&')).join('')}])\\1+`, 'g'), '$1')
    return ok(out)
  },

  sed: (sh, args, stdin) => {
    const scripts: string[] = []
    const files: string[] = []
    let quiet = false
    let inPlace = false
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a === '-n') quiet = true
      else if (a === '-i') inPlace = true
      else if (a === '-e') scripts.push(args[++i])
      else if (a.startsWith('-')) return fail(`sed: unknown option ${a}`)
      else if (!scripts.length) scripts.push(a)
      else files.push(a)
    }
    if (!scripts.length) return fail('Usage: sed [OPTION]... {script} [input-file]...')
    const { items, err } = inputs(sh, files, stdin)
    let allOut = ''
    for (const [name, content] of items) {
      let ls = lines(content)
      const printed: string[] = []
      for (const script of scripts) {
        const parts = script.split(';').map((s) => s.trim()).filter(Boolean)
        for (const cmd of parts) {
          let m: RegExpMatchArray | null
          if ((m = cmd.match(/^(?:(\d+|\/[^/]*\/)(?:,(\d+|\$))?)?s(.)(.*?)\3(.*?)\3([gip]*)$/))) {
            const [, addr, addrEnd, , pat, rep, fl] = m
            const re = toRegex(pat, (fl.includes('g') ? 'g' : '') + (fl.includes('i') ? 'i' : ''), true)
            const inRange = rangeTest(addr, addrEnd)
            ls = ls.map((l, i) => (inRange(l, i, ls.length) ? l.replace(re, rep.replace(/\\(\d)/g, '$$$1').replace(/&/g, '$&')) : l))
            if (fl.includes('p')) ls.forEach((l, i) => { if (inRange(l, i, ls.length) && re.test(l)) printed.push(l) })
          } else if ((m = cmd.match(/^(\d+|\/[^/]*\/|\$)(?:,(\d+|\$))?([dp])$/))) {
            const inRange = rangeTest(m[1], m[2])
            if (m[3] === 'd') ls = ls.filter((l, i) => !inRange(l, i, ls.length))
            else ls.forEach((l, i) => { if (inRange(l, i, ls.length)) printed.push(l) })
          } else if (cmd === 'p') printed.push(...ls)
          else return fail(`sed: -e expression #1, char 0: unknown command: '${cmd}'`)
        }
      }
      const result = quiet ? joinLines(printed) : joinLines(ls) + (printed.length ? joinLines(printed) : '')
      if (inPlace && name !== '-') sh.writeFile(name, joinLines(ls))
      else allOut += result
    }
    return { out: allOut, err: err.replace(/^(.)/gm, 'sed: $1'), code: err ? 2 : 0 }
  },

  chmod: (sh, args) => {
    const { operands, flags } = parseArgs(args)
    if (operands.length < 2) return fail('chmod: missing operand')
    const [mode, ...files] = operands
    let err = ''
    const apply = (n: FsNode) => {
      if (/^[0-7]{3,4}$/.test(mode)) { n.mode = parseInt(mode.slice(-3), 8); return }
      const m = mode.match(/^([ugoa]*)([-+=])([rwxX]*)$/)
      if (!m) throw new FsError(`invalid mode: '${mode}'`)
      const who = m[1] || 'a'
      let bits = 0
      if (m[3].includes('r')) bits |= 4
      if (m[3].includes('w')) bits |= 2
      if (m[3].includes('x') || (m[3].includes('X') && (n.type === 'dir' || n.mode & 0o111))) bits |= 1
      const shifts = [...(who.includes('a') ? 'ugo' : who)].map((c) => ({ u: 6, g: 3, o: 0 })[c] ?? 0)
      for (const s of shifts) {
        if (m[2] === '+') n.mode |= bits << s
        else if (m[2] === '-') n.mode &= ~(bits << s)
        else n.mode = (n.mode & ~(7 << s)) | (bits << s)
      }
    }
    for (const f of files) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { err += `chmod: cannot access '${f}': No such file or directory\n`; continue }
      if (sh.user !== 'root' && n.owner !== sh.user) { err += `chmod: changing permissions of '${f}': Operation not permitted\n`; continue }
      try {
        apply(n)
        if ((flags.has('R')) && n.type === 'dir') sh.vfs.walk(abs, (_p, c) => apply(c))
      } catch (e) { err += `chmod: ${(e as Error).message}\n` }
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  chown: (sh, args) => {
    const { operands, flags } = parseArgs(args)
    if (operands.length < 2) return fail('chown: missing operand')
    const [spec, ...files] = operands
    const [owner, group] = spec.split(':')
    if (sh.user !== 'root') return fail(`chown: changing ownership of '${files[0]}': Operation not permitted`)
    let err = ''
    for (const f of files) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { err += `chown: cannot access '${f}': No such file or directory\n`; continue }
      const set = (x: FsNode) => { if (owner) x.owner = owner; x.group = group ?? owner }
      set(n)
      if (flags.has('R') && n.type === 'dir') sh.vfs.walk(abs, (_p, c) => set(c))
    }
    return { out: '', err, code: err ? 1 : 0 }
  },

  whoami: (sh) => ok(sh.user + '\n'),
  id: (sh, args) => {
    const u = args[0] ?? sh.user
    if (u === 'root') return ok('uid=0(root) gid=0(root) groups=0(root)\n')
    if (u === 'learner') return ok('uid=1000(learner) gid=1000(learner) groups=1000(learner),27(sudo)\n')
    return fail(`id: '${u}': no such user`)
  },
  groups: (sh, args) => ok(((args[0] ?? sh.user) === 'root' ? 'root' : 'learner sudo') + '\n'),

  man: (_sh, args) => {
    if (!args.length) return fail('What manual page do you want?\nFor example, try \'man ls\'.')
    const page = MAN[args[args.length - 1]]
    if (!page) return fail(`No manual entry for ${args[args.length - 1]}`, 16)
    const [title, ...rest] = page.split('\n')
    return ok(`${args[args.length - 1].toUpperCase()}(1)\n\nNAME\n       ${title}\n\n${rest.map((l) => '       ' + l).join('\n')}\n\n(On a real system man opens a pager. Press q to quit, / to search.)\n`)
  },

  help: (sh) => ok('Commands this terminal understands:\n' + Object.keys(COMMANDS).sort().join('  ') + '\n\nType "man COMMAND" or "COMMAND --help" for details.\n' + (Object.keys(sh.functions).length ? 'Functions: ' + Object.keys(sh.functions).join(' ') + '\n' : '')),

  which: (sh, args) => {
    let out = ''
    let code = 0
    for (const a of args) {
      const p = sh.findOnPath(a)
      if (p) out += p + '\n'
      else code = 1
    }
    return { out, err: '', code }
  },

  type: (sh, args) => {
    let out = ''
    let err = ''
    for (const a of args) {
      if (sh.functions[a]) out += `${a} is a function\n`
      else if (['cd', 'export', 'source', '.', 'exit', 'history', 'alias', 'unset', 'read', 'test', '['].includes(a)) out += `${a} is a shell builtin\n`
      else { const p = sh.findOnPath(a); if (p) out += `${a} is ${p}\n`; else err += `bash: type: ${a}: not found\n` }
    }
    return { out, err, code: err ? 1 : 0 }
  },

  history: (sh) => ok(joinLines(sh.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`))),
  clear: (sh) => { sh.clearRequested = true; return ok() },
  alias: (_sh, args) => (args.length ? ok() : ok("alias ll='ls -l'\n")),

  sudo: (sh, args, stdin) => {
    if (!args.length || args[0] === '-i' || args[0] === '-s') return fail('sudo: an interactive root shell is not simulated here. Put sudo in front of a single command instead, like "sudo cat /etc/shadow".')
    if (args[0] === '-u') { const u = args[1]; args = args.slice(2); if (u !== 'root') return fail(`sudo: unknown user ${u}`) }
    const saved = sh.user
    sh.user = 'root'
    try { return sh.invoke(args, stdin) } finally { sh.user = saved }
  },
  su: () => fail('su: interactive root shells are not simulated here. Use sudo in front of a command instead.'),
  passwd: () => fail('passwd: changing passwords is not simulated here.'),
  useradd: (sh, args) => needRoot(sh, 'useradd') ?? (args.length ? ok() : fail('Usage: useradd [options] LOGIN')),

  ps: (sh, args) => {
    const all = args.some((a) => /a|e/.test(a))
    const procs = all ? sh.state.processes : sh.state.processes.filter((p) => p.user === 'learner')
    if (args[0] === 'aux' || args[0] === '-aux') {
      return ok('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n' + joinLines(procs.map((p) => `${p.user.padEnd(11)} ${String(p.pid).padStart(5)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${'12340'.padStart(6)} ${'2048'.padStart(5)} ${(p.user === 'learner' ? 'pts/0' : '?').padEnd(8)} ${p.cpu > 50 ? 'R' : 'S'}    09:00   0:0${Math.floor(p.cpu / 10)} ${p.cmd}`)))
    }
    if (all) return ok('UID          PID    PPID  C STIME TTY          TIME CMD\n' + joinLines(procs.map((p) => `${p.user.padEnd(10)} ${String(p.pid).padStart(5)}       1  ${p.cpu > 50 ? '9' : '0'} 09:00 ?        00:00:0${Math.floor(p.cpu / 10)} ${p.cmd}`)))
    return ok('    PID TTY          TIME CMD\n' + joinLines(procs.map((p) => `${String(p.pid).padStart(7)} pts/0    00:00:00 ${bname(p.cmd.split(' ')[0])}`)))
  },

  top: (sh) => {
    const procs = [...sh.state.processes].sort((a, b) => b.cpu - a.cpu)
    const load = (procs.reduce((s, p) => s + p.cpu, 0) / 100).toFixed(2)
    return ok(`top - 09:41:07 up 3 days,  2:15,  1 user,  load average: ${load}, ${load}, ${load}\nTasks: ${procs.length} total,   ${procs.filter((p) => p.cpu > 50).length} running, ${procs.filter((p) => p.cpu <= 50).length} sleeping,   0 stopped,   0 zombie\n%Cpu(s): ${Math.min(99, procs.reduce((s, p) => s + p.cpu, 0)).toFixed(1)} us,  0.7 sy,  0.0 ni, 90.1 id\nMiB Mem :   3924.0 total,   2210.5 free,    812.3 used,    901.2 buff/cache\n\n    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n` + joinLines(procs.slice(0, 10).map((p) => `${String(p.pid).padStart(7)} ${p.user.padEnd(9)} 20   0   12340   2048   1536 ${p.cpu > 50 ? 'R' : 'S'} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)}   0:0${Math.floor(p.cpu / 10)}.00 ${bname(p.cmd.split(' ')[0])}`)) + '\n(top refreshes live on a real terminal. Press q there to quit.)\n')
  },
  htop: (sh, args, stdin) => COMMANDS.top(sh, args, stdin),

  kill: (sh, args) => {
    const { operands } = parseArgs(args)
    if (!operands.length) return fail('kill: usage: kill [-9] pid ...')
    let err = ''
    for (const o of operands) {
      const pid = Number(o)
      const idx = sh.state.processes.findIndex((p) => p.pid === pid)
      if (Number.isNaN(pid)) { err += `kill: ${o}: arguments must be process or job IDs\n`; continue }
      if (idx < 0) { err += `kill: (${pid}): No such process\n`; continue }
      const p = sh.state.processes[idx]
      if (p.user !== sh.user && sh.user !== 'root') { err += `kill: (${pid}): Operation not permitted\n`; continue }
      if (pid === 1) { err += `kill: (1): Operation not permitted\n`; continue }
      sh.state.processes.splice(idx, 1)
      sh.jobs = sh.jobs.filter((j) => j.pid !== pid)
    }
    return { out: '', err, code: err ? 1 : 0 }
  },
  killall: (sh, args) => {
    const name = args.filter((a) => !a.startsWith('-'))[0]
    if (!name) return fail('Usage: killall NAME')
    const before = sh.state.processes.length
    sh.state.processes = sh.state.processes.filter((p) => !(bname(p.cmd.split(' ')[0]) === name && (p.user === sh.user || sh.user === 'root')))
    return before === sh.state.processes.length ? fail(`${name}: no process found`) : ok()
  },
  pkill: (sh, args) => {
    const name = args.filter((a) => !a.startsWith('-'))[0]
    if (!name) return fail('Usage: pkill NAME')
    const before = sh.state.processes.length
    sh.state.processes = sh.state.processes.filter((p) => !(p.cmd.includes(name) && (p.user === sh.user || sh.user === 'root')))
    return { out: '', err: '', code: before === sh.state.processes.length ? 1 : 0 }
  },
  jobs: (sh) => ok(joinLines(sh.jobs.map((j) => `[${j.id}]+  Running                 ${j.cmd} &`))),
  fg: (sh) => (sh.jobs.length ? ok(`${sh.jobs[sh.jobs.length - 1].cmd}\n(brought to the foreground; on a real terminal Ctrl+Z would suspend it again)\n`) : fail('bash: fg: current: no such job')),
  bg: (sh) => (sh.jobs.length ? ok(`[${sh.jobs[sh.jobs.length - 1].id}]+ ${sh.jobs[sh.jobs.length - 1].cmd} &\n`) : fail('bash: bg: current: no such job')),
  wait: () => ok(),
  sleep: (_sh, args) => (args.length && !Number.isNaN(Number(args[0])) ? ok() : fail('sleep: missing operand')),

  df: (_sh, args) => {
    const h = args.includes('-h')
    const rows = h
      ? ['Filesystem      Size  Used Avail Use% Mounted on', '/dev/vda1        20G  6.1G   13G  33% /', 'tmpfs           2.0G     0  2.0G   0% /dev/shm', '/dev/vda15      105M  6.1M   99M   6% /boot/efi']
      : ['Filesystem     1K-blocks    Used Available Use% Mounted on', '/dev/vda1       20511312 6389760  13056896  33% /', 'tmpfs            2009592       0   2009592   0% /dev/shm', '/dev/vda15        106858    6186    100672   6% /boot/efi']
    return ok(joinLines(rows))
  },
  du: (sh, args) => {
    const { flags, operands } = parseArgs(args)
    const targets = operands.length ? operands : ['.']
    let out = ''
    let err = ''
    for (const t of targets) {
      const abs = sh.path(t)
      const n = sh.vfs.get(abs)
      if (!n) { err += `du: cannot access '${t}': No such file or directory\n`; continue }
      const fmt = (b: number) => (flags.has('h') ? human(b) : String(Math.ceil(b / 1024)))
      if (flags.has('s') || n.type === 'file') out += `${fmt(sizeOf(n))}\t${t}\n`
      else sh.vfs.walk(abs, (p, c) => { if (c.type === 'dir') out += `${fmt(sizeOf(c))}\t${t.replace(/\/$/, '') + p.slice(abs.length)}\n` })
    }
    return { out, err, code: err ? 1 : 0 }
  },
  free: (_sh, args) => ok(args.includes('-h')
    ? '               total        used        free      shared  buff/cache   available\nMem:           3.8Gi       812Mi       2.2Gi       1.0Mi       901Mi       2.8Gi\nSwap:          1.0Gi          0B       1.0Gi\n'
    : '               total        used        free      shared  buff/cache   available\nMem:         4018176      831744     2263552        1024      922880     2937856\nSwap:        1048572           0     1048572\n'),
  uname: (_sh, args) => {
    const a = args[0] ?? ''
    if (a === '-a' || a === '--all') return ok(`Linux ${HOSTNAME} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux\n`)
    if (a === '-r') return ok('6.8.0-45-generic\n')
    if (a === '-m') return ok('x86_64\n')
    if (a === '-n') return ok(HOSTNAME + '\n')
    return ok('Linux\n')
  },
  uptime: () => ok(' 09:41:07 up 3 days,  2:15,  1 user,  load average: 0.08, 0.05, 0.01\n'),
  hostname: () => ok(HOSTNAME + '\n'),
  date: () => ok(new Date().toString().replace(/ GMT.*$/, '') + '\n'),

  apt: (sh, args) => {
    const sub = args.find((a) => !a.startsWith('-'))
    const rest = args.filter((a) => a !== sub && !a.startsWith('-'))
    const known = ['htop', 'tree', 'git', 'nginx', 'sqlite3', 'vim', 'jq', 'cowsay', 'curl', 'python3', 'python3-pip', 'tmux', 'zip', 'unzip', 'net-tools', 'nmap', 'ufw', 'fail2ban', 'docker.io', 'shellcheck']
    if (sub === 'update') {
      const r = needRoot(sh, 'apt'); if (r) return fail('Reading package lists... Done\nE: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/', 100)
      return ok('Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nGet:2 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]\nReading package lists... Done\nBuilding dependency tree... Done\nAll packages are up to date.\n')
    }
    if (sub === 'install') {
      if (sh.user !== 'root') return fail('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?', 100)
      if (!rest.length) return fail('E: Missing package name')
      let out = ''
      for (const p of rest) {
        if (!known.includes(p)) return fail(`Reading package lists... Done\nE: Unable to locate package ${p}`, 100)
        if (sh.state.packages.includes(p)) { out += `${p} is already the newest version.\n`; continue }
        sh.state.packages.push(p)
        const bin = p === 'docker.io' ? 'docker' : p
        if (!sh.vfs.get('/usr/bin/' + bin)) sh.vfs.writeFile('/usr/bin/' + bin, '#!builtin\n', { owner: 'root', mode: 0o755 })
        out += `Reading package lists... Done\nBuilding dependency tree... Done\nThe following NEW packages will be installed:\n  ${p}\nGet:1 http://archive.ubuntu.com/ubuntu noble/main amd64 ${p} amd64 [123 kB]\nUnpacking ${p} ...\nSetting up ${p} ...\n`
      }
      return ok(out)
    }
    if (sub === 'remove' || sub === 'purge') {
      if (sh.user !== 'root') return fail('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?', 100)
      for (const p of rest) { sh.state.packages = sh.state.packages.filter((x) => x !== p) }
      return ok(`Removing ${rest.join(' ')} ...\n`)
    }
    if (sub === 'list') return ok(joinLines([...sh.state.packages].sort().map((p) => `${p}/noble,now 1.0-1 amd64 [installed]`)))
    if (sub === 'search') return ok(joinLines(known.filter((k) => k.includes(rest[0] ?? '')).map((k) => `${k}/noble 1.0-1 amd64\n  ${k} package`)))
    if (sub === 'show') return known.includes(rest[0]) ? ok(`Package: ${rest[0]}\nVersion: 1.0-1\nDescription: ${rest[0]} package\n`) : fail(`E: No packages found`)
    if (sub === 'upgrade') return needRoot(sh, 'apt') ?? ok('Reading package lists... Done\nCalculating upgrade... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n')
    return fail('apt: usage: apt update | install PKG | remove PKG | list --installed | search WORD | show PKG', 1)
  },
  'apt-get': (sh, args, stdin) => COMMANDS.apt(sh, args, stdin),
  tree: (sh, args) => {
    const start = sh.path(args.find((a) => !a.startsWith('-')) ?? '.')
    if (!sh.vfs.isDir(start)) return fail(`${args[0]} [error opening dir]`)
    let out = (args[0] ?? '.') + '\n'
    let dirs = 0
    let files = 0
    const walk = (p: string, prefix: string) => {
      const entries = sh.vfs.list(p).filter(([n]) => !n.startsWith('.'))
      entries.forEach(([name, n], i) => {
        const last = i === entries.length - 1
        out += `${prefix}${last ? '└── ' : '├── '}${name}\n`
        if (n.type === 'dir') { dirs++; walk(p + '/' + name, prefix + (last ? '    ' : '│   ')) } else files++
      })
    }
    walk(start, '')
    return ok(out + `\n${dirs} directories, ${files} files\n`)
  },

  ip: (_sh, args) => {
    const sub = args[0] ?? ''
    if (sub.startsWith('a') || sub === 'address') return ok('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n2: enp0s1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff\n    inet 192.168.64.5/24 brd 192.168.64.255 scope global dynamic enp0s1\n       valid_lft 86050sec preferred_lft 86050sec\n')
    if (sub.startsWith('r')) return ok('default via 192.168.64.1 dev enp0s1 proto dhcp metric 100\n192.168.64.0/24 dev enp0s1 proto kernel scope link src 192.168.64.5\n')
    if (sub.startsWith('l')) return ok('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT\n2: enp0s1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT\n')
    return fail('Usage: ip addr | ip route | ip link')
  },
  ping: (_sh, args) => {
    const { values, operands } = parseArgs(args, ['c'])
    const host = operands[0]
    if (!host) return fail('ping: usage error: Destination address required', 2)
    const count = values.c ? Number(values.c) : 4
    const ipFor: Record<string, string> = { localhost: '127.0.0.1', '127.0.0.1': '127.0.0.1', 'example.com': '93.184.216.34', 'google.com': '142.250.72.14', '1.1.1.1': '1.1.1.1', '8.8.8.8': '8.8.8.8', 'github.com': '140.82.112.3', '192.168.64.1': '192.168.64.1' }
    const ip = ipFor[host]
    if (!ip) return fail(`ping: ${host}: Name or service not known`, 2)
    const rows = Array.from({ length: count }, (_, i) => `64 bytes from ${ip}: icmp_seq=${i + 1} ttl=56 time=${(12 + (i * 7) % 5 + 0.3).toFixed(1)} ms`)
    return ok(`PING ${host} (${ip}) 56(84) bytes of data.\n${rows.join('\n')}\n\n--- ${host} ping statistics ---\n${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 1000 - 1000}ms\nrtt min/avg/max/mdev = 12.3/13.9/16.3/1.4 ms\n`)
  },
  curl: (sh, args) => {
    const { flags, values, operands } = parseArgs(args, ['o', 'X', 'H', 'd'])
    const url = operands[0]
    if (!url) return fail("curl: try 'curl --help' for more information", 2)
    const responses: Record<string, [string, string]> = {
      'example.com': ['HTTP/1.1 200 OK\nContent-Type: text/html; charset=UTF-8\nContent-Length: 148\nServer: ECS\n', '<!doctype html>\n<html>\n<head><title>Example Domain</title></head>\n<body>\n<h1>Example Domain</h1>\n<p>This domain is for use in illustrative examples.</p>\n</body>\n</html>\n'],
      'api.github.com/zen': ['HTTP/2 200\ncontent-type: text/plain;charset=utf-8\n', 'Keep it logically awesome.'],
      'httpbin.org/ip': ['HTTP/2 200\ncontent-type: application/json\n', '{\n  "origin": "203.0.113.42"\n}\n'],
      'httpbin.org/get': ['HTTP/2 200\ncontent-type: application/json\n', '{\n  "args": {},\n  "headers": {"Host": "httpbin.org", "User-Agent": "curl/8.5.0"},\n  "url": "https://httpbin.org/get"\n}\n'],
      'localhost:8000': ['HTTP/1.0 200 OK\nServer: SimpleHTTP/0.6 Python/3.12\nContent-type: text/html\n', '<!DOCTYPE HTML>\n<html>\n<head><title>Directory listing for /</title></head>\n<body>\n<h1>Directory listing for /</h1>\n<ul>\n<li><a href="index.html">index.html</a></li>\n</ul>\n</body>\n</html>\n'],
      'localhost': ['HTTP/1.1 200 OK\nServer: nginx/1.24.0\nContent-Type: text/html\n', '<!DOCTYPE html>\n<html>\n<head><title>Welcome to nginx!</title></head>\n<body>\n<h1>Welcome to nginx!</h1>\n</body>\n</html>\n'],
    }
    const key = url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')
    const hit = responses[key] ?? (key.startsWith('localhost') && sh.state.services.nginx === 'active' ? responses.localhost : undefined)
    if (key.startsWith('localhost') && !responses[key] && sh.state.services.nginx !== 'active') return fail(`curl: (7) Failed to connect to localhost port ${key.split(':')[1] ?? 80} after 0 ms: Connection refused`, 7)
    if (!hit) return fail(`curl: (6) Could not resolve host: ${key.split('/')[0]}`, 6)
    const [headers, body] = hit
    const out = flags.has('I') ? headers + '\n' : flags.has('i') ? headers + '\n' + body : body
    if (values.o) { sh.writeFile(values.o, body); return ok(flags.has('s') ? '' : `  % Total    % Received % Xferd  Average Speed\n100   ${body.length}  100   ${body.length}    0     0   9876      0\n`) }
    return ok(out)
  },
  wget: (sh, args) => {
    const url = args.find((a) => !a.startsWith('-'))
    if (!url) return fail('wget: missing URL')
    const r = COMMANDS.curl(sh, ['-s', url], '')
    if (r.code !== 0) return fail(`wget: unable to resolve host address '${url}'`, 4)
    const name = bname(url.replace(/\/$/, '')) || 'index.html'
    sh.writeFile(name.includes('.') ? name : 'index.html', r.out)
    return ok(`--2026-09-17 09:41:07--  ${url}\nResolving ... connected.\nHTTP request sent, awaiting response... 200 OK\nLength: ${r.out.length}\nSaving to: '${name.includes('.') ? name : 'index.html'}'\n\n'${name.includes('.') ? name : 'index.html'}' saved [${r.out.length}/${r.out.length}]\n`)
  },
  ss: (sh, args) => {
    const rows = ['Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process', 'udp   UNCONN 0      0        127.0.0.53%lo:53         0.0.0.0:*     users:(("systemd-resolve",pid=398,fd=13))', 'tcp   LISTEN 0      128            0.0.0.0:22         0.0.0.0:*     users:(("sshd",pid=412,fd=3))']
    if (sh.state.services.nginx === 'active') rows.push('tcp   LISTEN 0      511            0.0.0.0:80         0.0.0.0:*     users:(("nginx",pid=1450,fd=6))')
    for (const p of sh.state.processes) { const m = p.cmd.match(/http\.server\s*(\d+)?/); if (m) rows.push(`tcp   LISTEN 0      5              0.0.0.0:${m[1] ?? 8000}       0.0.0.0:*     users:(("python3",pid=${p.pid},fd=3))`) }
    const a = args.join('')
    return ok(joinLines(a.includes('l') || a === '' ? rows : rows.slice(0, 1)))
  },
  ssh: (_sh, args) => (args.length ? fail(`ssh: connect to host ${args[args.length - 1].split('@').pop()} port 22: this terminal cannot open real network connections. Do this step on your real machine.`, 255) : fail('usage: ssh [user@]hostname [command]', 255)),
  scp: () => fail('scp: this terminal cannot copy over the network. Do this step on your real machine.'),

  env: (sh) => ok(joinLines([...sh.exported].filter((k) => sh.env[k] !== undefined).map((k) => `${k}=${sh.env[k]}`))),
  printenv: (sh, args) => (args.length ? (sh.env[args[0]] !== undefined ? ok(sh.env[args[0]] + '\n') : { out: '', err: '', code: 1 }) : COMMANDS.env(sh, [], '')),
  export: (sh, args) => {
    if (!args.length || args[0] === '-p') return ok(joinLines([...sh.exported].filter((k) => sh.env[k] !== undefined).map((k) => `declare -x ${k}="${sh.env[k]}"`)))
    for (const a of args) {
      const eq = a.indexOf('=')
      const name = eq < 0 ? a : a.slice(0, eq)
      if (!/^[A-Za-z_]\w*$/.test(name)) return fail(`bash: export: '${a}': not a valid identifier`)
      if (eq >= 0) sh.env[name] = a.slice(eq + 1)
      sh.exported.add(name)
    }
    return ok()
  },
  unset: (sh, args) => { for (const a of args) { delete sh.env[a]; sh.exported.delete(a) } return ok() },
  local: (sh, args) => { for (const a of args) { const eq = a.indexOf('='); if (eq >= 0) sh.env[a.slice(0, eq)] = a.slice(eq + 1) } return ok() },
  declare: (sh, args) => COMMANDS.local(sh, args.filter((a) => !a.startsWith('-')), ''),
  set: () => ok(),
  shift: (sh) => { sh.positional.shift(); return ok() },
  let: (sh, args) => { for (const a of args) { const m = a.match(/^([A-Za-z_]\w*)=(.*)$/); if (m) sh.env[m[1]] = String(evalArithSafe(sh, m[2])) } return ok() },

  source: (sh, args) => {
    if (!args.length) return fail('bash: source: filename argument required', 2)
    let content: string
    try { content = sh.readFile(args[0]) } catch (e) { return fail(`bash: ${(e as Error).message}`) }
    return sh.execScript(content, args.slice(1), args[0])
  },
  '.': (sh, args, stdin) => COMMANDS.source(sh, args, stdin),
  bash: (sh, args, stdin) => {
    const { flags, operands } = parseArgs(args)
    if (flags.has('c')) return sh.execScript(operands.join(' '))
    if (!operands.length) return stdin ? sh.execScript(stdin) : fail('bash: an interactive sub-shell is not simulated. Run "bash script.sh" or "bash -c \'command\'".')
    let content: string
    try { content = sh.readFile(operands[0]) } catch (e) { return fail(`bash: ${(e as Error).message}`, 127) }
    const abs = sh.path(operands[0])
    const r = sh.runScriptFile(abs, content, operands.slice(1), stdin)
    if (flags.has('x')) r.out = content.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => '+ ' + l).join('\n') + '\n' + r.out
    return r
  },
  sh: (sh, args, stdin) => COMMANDS.bash(sh, args, stdin),
  exec: (sh, args, stdin) => (args.length ? sh.invoke(args, stdin) : ok()),

  test: (sh, args) => ({ out: '', err: '', code: evalTest(sh, args) ? 0 : 1 }),
  '[': (sh, args) => {
    if (args[args.length - 1] !== ']') return fail("bash: [: missing ']'", 2)
    return COMMANDS.test(sh, args.slice(0, -1), '')
  },
  '[[': (sh, args) => COMMANDS.test(sh, args.filter((a) => a !== ']]'), ''),
  true: () => ok(),
  false: () => ({ out: '', err: '', code: 1 }),
  exit: (sh, args) => sh.throwExit(args[0] !== undefined ? Number(args[0]) || 0 : sh.lastStatus),
  return: (sh, args) => sh.throwReturn(args[0] !== undefined ? Number(args[0]) || 0 : sh.lastStatus),
  break: (sh) => sh.throwBreak(),
  continue: (sh) => sh.throwContinue(),
  read: (sh, args, stdin) => {
    const { flags, values, operands } = parseArgs(args, ['p'])
    void flags
    const source = stdin || sh.env.STDIN || ''
    const [first, ...restLines] = source.split('\n')
    sh.env.STDIN = restLines.join('\n')
    const name = operands[0] ?? 'REPLY'
    sh.env[name] = (first ?? '').trim()
    return { out: values.p ?? '', err: '', code: source === '' ? 1 : 0 }
  },
  seq: (_sh, args) => {
    const nums = args.map(Number)
    if (!nums.length || nums.some(Number.isNaN)) return fail('seq: missing operand')
    const [a, b, c] = nums.length === 1 ? [1, nums[0], 1] : nums.length === 2 ? [nums[0], nums[1], 1] : [nums[0], nums[2], nums[1]]
    const out: number[] = []
    for (let i = a; c > 0 ? i <= b : i >= b; i += c) out.push(i)
    return ok(joinLines(out.map(String)))
  },
  tee: (sh, args, stdin) => {
    const { flags, operands } = parseArgs(args)
    for (const f of operands) sh.writeFile(f, stdin, flags.has('a'))
    return ok(stdin)
  },
  xargs: (sh, args, stdin) => {
    const items = stdin.split(/\s+/).filter(Boolean)
    const cmd = args.length ? args : ['echo']
    return sh.invoke([...cmd, ...items], '')
  },
  basename: (_sh, args) => (args.length ? ok(bname(args[0]).replace(args[1] ? new RegExp(args[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') : /$^/, '') + '\n') : fail('basename: missing operand')),
  dirname: (_sh, args) => (args.length ? ok(dname(args[0]) + '\n') : fail('dirname: missing operand')),
  tac: (sh, args, stdin) => { const { items, err } = inputs(sh, args, stdin); return { out: joinLines(items.flatMap(([, c]) => lines(c)).reverse()), err, code: err ? 1 : 0 } },
  rev: (sh, args, stdin) => { const { items, err } = inputs(sh, args, stdin); return { out: joinLines(items.flatMap(([, c]) => lines(c)).map((l) => [...l].reverse().join(''))), err, code: err ? 1 : 0 } },
  nl: (sh, args, stdin) => { const { items, err } = inputs(sh, args, stdin); return { out: joinLines(items.flatMap(([, c]) => lines(c)).map((l, i) => `${String(i + 1).padStart(6)}\t${l}`)), err, code: err ? 1 : 0 } },
  diff: (sh, args) => {
    if (args.length < 2) return fail('diff: missing operand')
    let a: string, b: string
    try { a = sh.readFile(args[0]); b = sh.readFile(args[1]) } catch (e) { return fail(`diff: ${(e as Error).message}`, 2) }
    if (a === b) return ok()
    const la = lines(a), lb = lines(b)
    let out = ''
    const max = Math.max(la.length, lb.length)
    for (let i = 0; i < max; i++) if (la[i] !== lb[i]) { if (la[i] !== undefined) out += `< ${la[i]}\n`; if (lb[i] !== undefined) out += `> ${lb[i]}\n` }
    return { out: `${la.length}c${lb.length}\n` + out, err: '', code: 1 }
  },
  file: (sh, args) => {
    let out = ''
    let err = ''
    for (const f of args) {
      const n = sh.vfs.get(sh.path(f))
      if (!n) { err += `${f}: cannot open (No such file or directory)\n`; continue }
      out += `${f}: ${n.type === 'dir' ? 'directory' : n.content === '' ? 'empty' : n.content.startsWith('#!') ? `${n.content.split('\n')[0].slice(2)} script, ASCII text executable` : 'ASCII text'}\n`
    }
    return { out, err, code: err ? 1 : 0 }
  },
  stat: (sh, args) => {
    const n = sh.vfs.get(sh.path(args[0] ?? ''))
    if (!n) return fail(`stat: cannot statx '${args[0]}': No such file or directory`)
    return ok(`  File: ${args[0]}\n  Size: ${sizeOf(n)}\t\tBlocks: 8\tIO Block: 4096   ${n.type === 'dir' ? 'directory' : 'regular file'}\nAccess: (0${n.mode.toString(8)}/${modeString(n)})  Uid: (${n.owner === 'root' ? '   0/    root' : '1000/ learner'})   Gid: (${n.group === 'root' ? '   0/    root' : '1000/ learner'})\nModify: ${new Date(n.mtime).toISOString().replace('T', ' ').slice(0, 19)}\n`)
  },
  ln: (sh, args) => {
    const { operands } = parseArgs(args)
    if (operands.length < 2) return fail('ln: missing file operand')
    try { sh.vfs.copy(sh.path(operands[0]), sh.path(operands[1]), { recursive: true }) } catch (e) { return fail(`ln: ${(e as Error).message}`) }
    return ok()
  },
  yes: () => ok('y\ny\ny\n(yes would print forever on a real terminal. Press Ctrl+C there to stop it.)\n'),
  python3: (sh, args) => {
    if (args[0] === '--version' || args[0] === '-V') return ok('Python 3.12.3\n')
    if (args[0] === '-m' && args[1] === 'http.server') { const port = args[2] ?? '8000'; return ok(`Serving HTTP on 0.0.0.0 port ${port} (http://0.0.0.0:${port}/) ...\n(This would block the terminal on a real machine. Add & to run it in the background.)\n`) }
    if (args[0] === '-c') return ok('(Python code runs in the Python lessons, where a real interpreter is loaded.)\n')
    if (args.length && !args[0].startsWith('-')) { try { sh.readFile(args[0]) } catch { return fail(`python3: can't open file '${sh.path(args[0])}': [Errno 2] No such file or directory`, 2) } return ok('(Python scripts run in the Python lessons, where a real interpreter is loaded.)\n') }
    return ok('Python 3.12.3 (main) [GCC 13.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n(The interactive Python shell is not simulated here. Python lessons use a real interpreter.)\n')
  },
  python: (sh, args, stdin) => COMMANDS.python3(sh, args, stdin),
  git: () => fail('git: version control is covered in Tier 3 on your real machine. This terminal does not simulate repositories.'),
  nano: () => fail('nano: this terminal has no interactive editors. Use the editor pane above the terminal, or write files with echo and > or >>.'),
  vim: () => fail('vim: this terminal has no interactive editors. Use the editor pane above the terminal, or write files with echo and > or >>.'),
  vi: (sh, args, stdin) => COMMANDS.vim(sh, args, stdin),

  crontab: (sh, args) => {
    if (args[0] === '-l') return sh.state.crontab ? ok(sh.state.crontab.endsWith('\n') ? sh.state.crontab : sh.state.crontab + '\n') : fail(`no crontab for ${sh.user}`)
    if (args[0] === '-r') { sh.state.crontab = ''; return ok() }
    if (args[0] === '-e') return fail('crontab: no interactive editor here. Write your schedule to a file in the editor pane, then run "crontab FILE" to install it.')
    if (!args.length) return fail('usage: crontab -l | crontab FILE | crontab -r')
    let content: string
    try { content = sh.readFile(args[0]) } catch (e) { return fail(`crontab: ${(e as Error).message}`) }
    const bad = lines(content).find((l) => l.trim() && !l.trim().startsWith('#') && !/^(\S+\s+){5}\S/.test(l.trim()) && !/^@(reboot|daily|hourly|weekly|monthly)\s+\S/.test(l.trim()))
    if (bad) return fail(`"${args[0]}": bad minute; errors in crontab file, can't install.\nOffending line: ${bad}`)
    sh.state.crontab = content
    return ok()
  },
  systemctl: (sh, args) => {
    const [sub, unitRaw] = args.filter((a) => !a.startsWith('-'))
    const unit = unitRaw?.replace(/\.service$/, '')
    const services = sh.state.services
    if (!sub || sub === 'list-units') return ok('  UNIT            LOAD   ACTIVE   SUB     DESCRIPTION\n' + joinLines(Object.entries(services).map(([u, s]) => `  ${(u + '.service').padEnd(15)} loaded ${s.padEnd(8)} ${s === 'active' ? 'running' : s === 'failed' ? 'failed ' : 'dead   '} ${({ ssh: 'OpenBSD Secure Shell server', cron: 'Regular background program processing daemon', nginx: 'A high performance web server' } as Record<string, string>)[u] ?? u}`)))
    if (!unit) return fail(`systemctl: missing unit name after '${sub}'`)
    if (!(unit in services)) return fail(`Unit ${unit}.service could not be found.`, 4)
    const desc = ({ ssh: 'OpenBSD Secure Shell server', cron: 'Regular background program processing daemon', nginx: 'A high performance web server and a reverse proxy server' } as Record<string, string>)[unit] ?? unit
    if (sub === 'status') {
      const s = services[unit]
      const dot = s === 'active' ? '●' : s === 'failed' ? '×' : '○'
      return { out: `${dot} ${unit}.service - ${desc}\n     Loaded: loaded (/lib/systemd/system/${unit}.service; enabled; preset: enabled)\n     Active: ${s === 'active' ? 'active (running)' : s === 'failed' ? 'failed (Result: exit-code)' : 'inactive (dead)'} since Mon 2026-09-14 07:26:11 UTC; 3 days ago\n   Main PID: ${s === 'active' ? '1450 (' + unit + ')' : '(code=exited, status=' + (s === 'failed' ? '1/FAILURE' : '0/SUCCESS') + ')'}\n\nSep 17 09:40:01 ${HOSTNAME} systemd[1]: ${s === 'active' ? `Started ${desc}.` : s === 'failed' ? `${unit}.service: Main process exited, code=exited, status=1/FAILURE` : `Stopped ${desc}.`}\n`, err: '', code: s === 'active' ? 0 : 3 }
    }
    if (sub === 'is-active') return { out: services[unit] + '\n', err: '', code: services[unit] === 'active' ? 0 : 3 }
    if (sub === 'is-enabled') return ok('enabled\n')
    const r = needRoot(sh, `systemctl ${sub}`)
    if (r) return fail(`Failed to ${sub} ${unit}.service: Access denied\nSee system logs and 'systemctl status ${unit}.service' for details.`, 1)
    if (sub === 'start' || sub === 'restart') { services[unit] = 'active'; return ok() }
    if (sub === 'stop') { services[unit] = 'inactive'; return ok() }
    if (sub === 'enable') return ok(`Created symlink /etc/systemd/system/multi-user.target.wants/${unit}.service → /lib/systemd/system/${unit}.service.\n`)
    if (sub === 'disable') return ok(`Removed "/etc/systemd/system/multi-user.target.wants/${unit}.service".\n`)
    if (sub === 'reload') return ok()
    return fail(`Unknown command verb ${sub}.`)
  },
  journalctl: (sh, args) => {
    const { values, operands } = parseArgs(args, ['u', 'n'])
    void operands
    const unit = values.u?.replace(/\.service$/, '')
    const n = values.n ? Number(values.n) : 10
    let content = ''
    try { content = sh.vfs.get('/var/log/syslog')?.type === 'file' ? (sh.vfs.get('/var/log/syslog') as { content: string }).content : '' } catch { content = '' }
    let ls = lines(content)
    if (unit) ls = ls.filter((l) => l.includes(unit))
    if (!ls.length) return ok('-- No entries --\n')
    return ok(joinLines(ls.slice(-n)))
  },
  dmesg: (sh) => (sh.user === 'root' ? ok('[    0.000000] Linux version 6.8.0-45-generic (buildd@lcy02-amd64-045) (x86_64-linux-gnu-gcc-13)\n[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-6.8.0-45-generic root=/dev/vda1 ro\n[    0.412345] virtio_blk virtio1: [vda] 41943040 512-byte logical blocks (21.5 GB/20.0 GiB)\n[    1.203456] EXT4-fs (vda1): mounted filesystem with ordered data mode.\n[  184.556677] Out of memory: Killed process 2211 (python3) total-vm:3812000kB\n') : fail('dmesg: read kernel buffer failed: Operation not permitted')),
}

function evalArithSafe(sh: Shell, expr: string): number {
  return Number(sh.expandWords(`$((${expr}))`)[0] ?? 0)
}

function rangeTest(addr: string | undefined, addrEnd: string | undefined) {
  if (!addr) return () => true
  const match = (a: string, l: string, i: number, total: number) => (a === '$' ? i === total - 1 : a.startsWith('/') ? toRegex(a.slice(1, -1), '', true).test(l) : i + 1 === Number(a))
  if (!addrEnd) return (l: string, i: number, total: number) => match(addr, l, i, total)
  return (_l: string, i: number, total: number) => i + 1 >= Number(addr) && (addrEnd === '$' ? true : i + 1 <= Number(addrEnd)) && i < total
}

/** Evaluate [ ] test expressions. */
function evalTest(sh: Shell, args: string[]): boolean {
  if (args.length === 0) return false
  if (args[0] === '!') return !evalTest(sh, args.slice(1))
  const orIdx = args.indexOf('-o')
  if (orIdx > 0) return evalTest(sh, args.slice(0, orIdx)) || evalTest(sh, args.slice(orIdx + 1))
  const andIdx = args.indexOf('-a')
  if (andIdx > 0) return evalTest(sh, args.slice(0, andIdx)) && evalTest(sh, args.slice(andIdx + 1))
  if (args.length === 1) return args[0] !== ''
  if (args.length === 2) {
    const [op, v] = args
    const n = sh.vfs.get(sh.path(v))
    switch (op) {
      case '-z': return v === ''
      case '-n': return v !== ''
      case '-e': return Boolean(n)
      case '-f': return n?.type === 'file'
      case '-d': return n?.type === 'dir'
      case '-s': return n?.type === 'file' && n.content.length > 0
      case '-r': return Boolean(n && sh.canRead(n))
      case '-w': return Boolean(n && sh.canWrite(n))
      case '-x': return Boolean(n && sh.canExec(n))
      default: return false
    }
  }
  const [a, op, b] = args
  const na = Number(a), nb = Number(b)
  switch (op) {
    case '=': case '==': return a === b
    case '!=': return a !== b
    case '-eq': return na === nb
    case '-ne': return na !== nb
    case '-lt': return na < nb
    case '-le': return na <= nb
    case '-gt': return na > nb
    case '-ge': return na >= nb
    case '<': return a < b
    case '>': return a > b
    case '=~': return toRegex(b, '', true).test(a)
    default: return false
  }
}

export const commandSummary = summary
