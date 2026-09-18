// Tier 2 additions to the simulated shell: getopts, trap, set, mktemp, shellcheck,
// tar, mapfile, readonly, and richer read/local/declare/unset/printf/head/tail/ls.
// Installed over the base command table by commands.ts.
import type { Command, CmdResult } from './commands'
import { globRegex, HOME, type Shell } from './shell'
import { basename as bname, type FsNode } from './vfs'

const ok = (out = ''): CmdResult => ({ out, err: '', code: 0 })
const fail = (err: string, code = 1): CmdResult => ({ out: '', err: err.endsWith('\n') ? err : err + '\n', code })
const lines = (s: string) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'))
const joinLines = (ls: string[]) => (ls.length ? ls.join('\n') + '\n' : '')

let tmpCounter = 0
const randomName = (n = 10) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < n; i++) out += chars[(Math.floor(Math.random() * chars.length) + tmpCounter++) % chars.length]
  return out
}

/* ---------------- shellcheck: a handful of the most common findings ---------------- */

interface Finding { line: number; col: number; code: string; level: 'error' | 'warning' | 'info' | 'style'; message: string }

const SC_WIKI: Record<string, string> = {
  SC2148: 'Tips depend on target shell and yours is unknown. Add a shebang or a \'shell\' directive.',
  SC2086: 'Double quote to prevent globbing and word splitting.',
  SC2006: 'Use $(...) notation instead of legacy backticks `...`.',
  SC2046: 'Quote this to prevent word splitting.',
  SC2068: 'Double quote array expansions to avoid re-splitting elements.',
  SC2164: 'Use \'cd ... || exit\' or \'cd ... || return\' in case cd fails.',
  SC2034: 'This variable appears unused. Verify use (or export if used externally).',
  SC2181: 'Check exit code directly with e.g. \'if mycmd;\', not indirectly with $?.',
  SC2162: 'read without -r will mangle backslashes.',
  SC2115: 'Use "${var:?}" to ensure this never expands to /* .',
  SC2016: 'Expressions don\'t expand in single quotes, use double quotes for that.',
  SC2154: 'Variable is referenced but not assigned.',
  SC2242: 'Can only exit with status 0-255. Other data should be written to stdout/stderr.',
  SC2170: 'Numerical -eq does not dereference in [..]. Expand or use string operator.',
}

/** Strip quoted strings so pattern checks only see unquoted code. */
const stripQuotes = (l: string) => l.replace(/'[^']*'/g, (m) => "'" + ' '.repeat(m.length - 2) + "'").replace(/"(?:[^"\\]|\\.)*"/g, (m) => '"' + ' '.repeat(m.length - 2) + '"')

export function shellcheck(source: string): Finding[] {
  const out: Finding[] = []
  const src = source.split('\n')
  const add = (line: number, col: number, code: string, level: Finding['level']) => out.push({ line, col, code, level, message: SC_WIKI[code] })
  if (!src[0]?.startsWith('#!')) add(1, 1, 'SC2148', 'error')
  const assigned = new Set<string>(['PATH', 'HOME', 'USER', 'PWD', 'IFS', 'OPTIND', 'OPTARG', 'REPLY', 'RANDOM', 'LINENO', 'HOSTNAME', 'SHELL', 'EDITOR', 'LANG', 'TERM', 'UID', 'BASH_SOURCE'])
  const used = new Map<string, number>()
  src.forEach((raw, idx) => {
    const line = idx + 1
    const code = raw.replace(/(^|\s)#.*$/, '')
    if (!code.trim()) return
    const s = stripQuotes(code)
    for (const m of code.matchAll(/(?:^|\s|;|&&|\|\|)\s*(?:local |export |readonly |declare(?: -\w+)? )?([A-Za-z_]\w*)(?:\[[^\]]*\])?\+?=/g)) assigned.add(m[1])
    for (const m of code.matchAll(/\bfor\s+([A-Za-z_]\w*)\s+in\b/g)) assigned.add(m[1])
    for (const m of code.matchAll(/\bread\s+(?:-\w+\s+)*([A-Za-z_]\w*)/g)) assigned.add(m[1])
    for (const m of code.matchAll(/\bgetopts\s+\S+\s+([A-Za-z_]\w*)/g)) assigned.add(m[1])
    for (const m of code.matchAll(/\$\{?([A-Za-z_]\w*)/g)) if (!used.has(m[1])) used.set(m[1], line)
    // Unquoted $var / $(..) as a command argument (not inside [[ ]], (( )), or an assignment)
    if (!/\[\[|\(\(/.test(s)) {
      for (const m of s.matchAll(/(?<![=\w"'])\$(?:\{[A-Za-z_]\w*\}|[A-Za-z_]\w*)(?![\w}])/g)) {
        const before = s.slice(0, m.index)
        if (/(?:^|[\s;])\s*(?:echo|printf|export)\s*$/.test(before) && /echo/.test(before)) continue
        if (/=\s*$/.test(before)) continue
        add(line, (m.index ?? 0) + 1, 'SC2086', 'info')
      }
      for (const m of s.matchAll(/(?<!["=])\$\(/g)) add(line, (m.index ?? 0) + 1, 'SC2046', 'warning')
      if (/(?<!")\$@/.test(s)) add(line, s.indexOf('$@') + 1, 'SC2068', 'error')
    }
    if (/`[^`]*`/.test(s)) add(line, s.indexOf('`') + 1, 'SC2006', 'style')
    if (/(^|[;&|]\s*|\bthen\s+|\bdo\s+)cd\s+\S+\s*$/.test(s) && !/\|\||&&|;\s*then|set -e/.test(s)) add(line, s.search(/cd\s/) + 1, 'SC2164', 'warning')
    if (/\$\?\s*(-eq|-ne|==|!=)/.test(s) || /(-eq|-ne|==|!=)\s*\$\?/.test(s)) add(line, s.indexOf('$?') + 1, 'SC2181', 'style')
    if (/\bread\s+(?!-\w*r)/.test(s) && !/\bread\s+(-\w+\s+)*-\w*r/.test(s)) add(line, s.search(/\bread\b/) + 1, 'SC2162', 'info')
    if (/rm\s+-rf?\s+"?\$\{?\w+\}?"?\/\*?\s*$/.test(s) && !/:\?/.test(s)) add(line, s.search(/rm\s/) + 1, 'SC2115', 'warning')
    if (/'[^']*\$[A-Za-z_{][^']*'/.test(code) && !/^\s*trap\b/.test(code)) add(line, code.indexOf("'") + 1, 'SC2016', 'info')
    if (/\bexit\s+(\d{4,}|[3-9]\d\d|2[6-9]\d)\b/.test(s)) add(line, s.search(/\bexit\b/) + 1, 'SC2242', 'error')
  })
  if (/set -e/.test(source)) { /* set -e users still get cd warnings on real shellcheck; keep it simple */ }
  const errexit = /set\s+-\w*e|set\s+-o\s+errexit/.test(source)
  const filtered = out.filter((f) => !(f.code === 'SC2164' && errexit))
  for (const name of assigned) {
    if (!used.has(name) && !['_', 'OPTIND', 'OPTARG', 'PATH', 'IFS', 'REPLY'].includes(name)) {
      const idx = src.findIndex((l) => new RegExp(`(^|\\s)(?:local |export |readonly |declare(?: -\\w+)? )?${name}(\\[[^\\]]*\\])?\\+?=`).test(l))
      if (idx >= 0 && !/export|readonly/.test(src[idx])) filtered.push({ line: idx + 1, col: src[idx].indexOf(name) + 1, code: 'SC2034', level: 'warning', message: SC_WIKI.SC2034 })
    }
  }
  return filtered.sort((a, b) => a.line - b.line || a.col - b.col)
}

function formatFindings(file: string, source: string, findings: Finding[]): string {
  const src = source.split('\n')
  let out = ''
  for (const f of findings) {
    const line = src[f.line - 1] ?? ''
    out += `\nIn ${file} line ${f.line}:\n${line}\n${' '.repeat(Math.max(0, f.col - 1))}^-- ${f.code} (${f.level}): ${f.message}\n`
  }
  const codes = [...new Set(findings.map((f) => f.code))]
  out += '\nFor more information:\n' + codes.map((c) => `  https://www.shellcheck.net/wiki/${c} -- ${SC_WIKI[c]}`).join('\n') + '\n'
  return out
}

/* ---------------- tar: archives stored as a simple text container ---------------- */

const TAR_MAGIC = '#stackcraft-tar\n'
function tarPack(sh: Shell, paths: string[], base: string): { entries: Record<string, string | null>; err: string } {
  const entries: Record<string, string | null> = {}
  let err = ''
  const walk = (rel: string, abs: string) => {
    const n = sh.vfs.get(abs)
    if (!n) { err += `tar: ${rel}: Cannot stat: No such file or directory\n`; return }
    if (n.type === 'dir') {
      entries[rel.replace(/\/$/, '') + '/'] = null
      for (const [name] of sh.vfs.list(abs)) walk(rel.replace(/\/$/, '') + '/' + name, abs + '/' + name)
    } else entries[rel] = n.content
  }
  for (const p of paths) walk(p.replace(/^\.\//, ''), sh.path(base ? base + '/' + p : p))
  return { entries, err }
}

/* ---------------- the extra commands ---------------- */

export function extraCommands(base: Record<string, Command>): Record<string, Command> {
  const baseRead = base.read
  const basePrintf = base.printf
  const baseHead = base.head
  const baseTail = base.tail
  const baseLs = base.ls
  const baseUnset = base.unset
  const baseType = base.type

  const cmds: Record<string, Command> = {
    getopts: (sh, args) => {
      const [optstring, name] = args
      if (!optstring || !name) return fail('getopts: usage: getopts optstring name [arg ...]', 2)
      const silent = optstring.startsWith(':')
      const spec = silent ? optstring.slice(1) : optstring
      const params = args.length > 2 ? args.slice(2) : sh.positional
      let optind = Number(sh.env.OPTIND ?? '1') || 1
      const done = () => { sh.env[name] = '?'; sh.env.OPTIND = String(optind); sh.optSub = 0; return { out: '', err: '', code: 1 } }
      const cur = params[optind - 1]
      if (cur === undefined || !cur.startsWith('-') || cur === '-') return done()
      if (cur === '--') { optind++; return done() }
      const ch = cur[1 + sh.optSub]
      if (ch === undefined) { optind++; sh.optSub = 0; return cmds.getopts(sh, args, '') }
      const at = spec.indexOf(ch)
      const takesArg = at >= 0 && spec[at + 1] === ':'
      let err = ''
      if (at < 0 || ch === ':') {
        sh.env[name] = '?'
        if (silent) sh.env.OPTARG = ch
        else { delete sh.env.OPTARG; err = `${sh.scriptName}: illegal option -- ${ch}\n` }
        sh.optSub++
        if (cur.length <= 1 + sh.optSub) { optind++; sh.optSub = 0 }
        sh.env.OPTIND = String(optind)
        return { out: '', err, code: 0 }
      }
      sh.env[name] = ch
      if (takesArg) {
        const rest = cur.slice(2 + sh.optSub)
        sh.optSub = 0
        if (rest) { sh.env.OPTARG = rest; optind++ }
        else if (params[optind] !== undefined) { sh.env.OPTARG = params[optind]; optind += 2 }
        else {
          optind++
          if (silent) { sh.env[name] = ':'; sh.env.OPTARG = ch }
          else { sh.env[name] = '?'; delete sh.env.OPTARG; err = `${sh.scriptName}: option requires an argument -- ${ch}\n` }
        }
      } else {
        delete sh.env.OPTARG
        sh.optSub++
        if (cur.length <= 1 + sh.optSub) { optind++; sh.optSub = 0 }
      }
      sh.env.OPTIND = String(optind)
      return { out: '', err, code: 0 }
    },

    trap: (sh, args) => {
      if (!args.length || args[0] === '-p') return ok(joinLines(Object.entries(sh.traps).map(([sig, cmd]) => `trap -- '${cmd}' ${sig}`)))
      if (args[0] === '-l') return ok(' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 9) SIGKILL\t15) SIGTERM\n')
      const [action, ...sigs] = args
      if (!sigs.length) return fail('trap: usage: trap [-lp] [[arg] signal_spec ...]', 2)
      for (const raw of sigs) {
        const sig = raw.toUpperCase().replace(/^SIG/, '')
        if (!['EXIT', 'ERR', 'INT', 'TERM', 'HUP', 'QUIT', 'RETURN', 'DEBUG', '0'].includes(sig)) return fail(`trap: ${raw}: invalid signal specification`)
        const key = sig === '0' ? 'EXIT' : sig
        if (action === '-' || action === '') delete sh.traps[key]
        else sh.traps[key] = action
      }
      return ok()
    },

    set: (sh, args) => {
      if (!args.length) return ok(joinLines(Object.keys(sh.env).sort().map((k) => `${k}=${sh.env[k]}`)))
      const list = [...args]
      while (list.length) {
        const a = list.shift()!
        if (a === '--') { sh.positional = list.splice(0); break }
        const on = a.startsWith('-')
        if (!/^[-+]/.test(a)) { sh.positional = [a, ...list.splice(0)]; break }
        if (a.slice(1) === 'o' || a.slice(1) === 'o ') {
          const name = list.shift()
          if (name === 'errexit') sh.opts.errexit = on
          else if (name === 'nounset') sh.opts.nounset = on
          else if (name === 'pipefail') sh.opts.pipefail = on
          else if (name === 'xtrace') sh.opts.xtrace = on
          else if (name === undefined) return ok(`errexit        \t${sh.opts.errexit ? 'on' : 'off'}\nnounset        \t${sh.opts.nounset ? 'on' : 'off'}\npipefail       \t${sh.opts.pipefail ? 'on' : 'off'}\nxtrace         \t${sh.opts.xtrace ? 'on' : 'off'}\n`)
          else return fail(`bash: set: ${name}: invalid option name`, 2)
          continue
        }
        for (const ch of a.slice(1)) {
          if (ch === 'e') sh.opts.errexit = on
          else if (ch === 'u') sh.opts.nounset = on
          else if (ch === 'x') sh.opts.xtrace = on
          else if (ch === 'o') { const name = list.shift(); if (name === 'pipefail') sh.opts.pipefail = on; else if (name === 'errexit') sh.opts.errexit = on; else if (name === 'nounset') sh.opts.nounset = on; else if (name === 'xtrace') sh.opts.xtrace = on; else return fail(`bash: set: ${name}: invalid option name`, 2) }
          else if ('fCBhHmnvkpEt'.includes(ch)) { /* accepted, no effect */ }
          else return fail(`bash: set: -${ch}: invalid option`, 2)
        }
      }
      return ok()
    },

    shopt: () => ok(),
    shift: (sh, args) => {
      const n = args[0] !== undefined ? Number(args[0]) : 1
      if (Number.isNaN(n) || n < 0) return fail(`bash: shift: ${args[0]}: shift count out of range`)
      if (n > sh.positional.length) return { out: '', err: '', code: 1 }
      sh.positional.splice(0, n)
      return ok()
    },
    '[[': (sh, args) => {
      // [[ expr ]] with && and || and glob matching for == and !=.
      const toks = args.filter((a) => a !== ']]')
      const evalOne = (parts: string[]): boolean => {
        if (parts[0] === '!') return !evalOne(parts.slice(1))
        if (parts.length === 3 && (parts[1] === '==' || parts[1] === '=' || parts[1] === '!=')) {
          const hit = globRegex(parts[2]).test(parts[0])
          return parts[1] === '!=' ? !hit : hit
        }
        return base.test(sh, parts, '').code === 0
      }
      let result: boolean | null = null
      let op: string | null = null
      let cur: string[] = []
      const flush = () => {
        const v = evalOne(cur)
        result = result === null ? v : op === '&&' ? result && v : result || v
        cur = []
      }
      for (const tk of toks) {
        if (tk === '&&' || tk === '||') { flush(); op = tk; continue }
        cur.push(tk)
      }
      if (cur.length) flush()
      return { out: '', err: '', code: result ? 0 : 1 }
    },
    umask: (sh, args) => (args.length ? ok() : ok(sh.env.UMASK ?? '0022\n')),

    mktemp: (sh, args) => {
      const dir = args.includes('-d')
      const pIdx = args.indexOf('-p')
      const template = args.find((a) => !a.startsWith('-') && (pIdx < 0 || a !== args[pIdx + 1]))
      const tmpdir = pIdx >= 0 ? sh.path(args[pIdx + 1]) : args.includes('-t') ? '/tmp' : template ? sh.path('.') : '/tmp'
      let name: string
      if (template) {
        if (!/XXX/.test(template)) return fail(`mktemp: too few X's in template '${template}'`)
        name = template.replace(/X{3,}/, (m) => randomName(m.length))
      } else name = 'tmp.' + randomName(10)
      const abs = template && template.includes('/') && pIdx < 0 ? sh.path(name) : tmpdir + '/' + bname(name)
      try {
        if (dir) sh.vfs.mkdir(abs, { owner: sh.user })
        else sh.writeFile(abs, '')
        const n = sh.vfs.get(abs)
        if (n) n.mode = dir ? 0o700 : 0o600
      } catch (e) { return fail(`mktemp: failed to create ${dir ? 'directory' : 'file'} via template '${abs}': ${(e as Error).message}`) }
      return ok(abs + '\n')
    },

    shellcheck: (sh, args) => {
      const files = args.filter((a) => !a.startsWith('-'))
      if (!files.length) return fail('shellcheck: no files specified. Usage: shellcheck script.sh')
      let out = ''
      let code = 0
      for (const f of files) {
        let src: string
        try { src = sh.readFile(f) } catch (e) { return fail(`shellcheck: ${(e as Error).message}`, 2) }
        const findings = shellcheck(src)
        if (findings.length) { code = 1; out += formatFindings(f, src, findings) }
      }
      return { out, err: '', code }
    },

    tar: (sh, args) => {
      // Accept both "tar -czf x.tar.gz dir" and "tar czf x.tar.gz dir".
      const flat = args.length && !args[0].startsWith('-') && /^[a-z]+$/.test(args[0]) ? ['-' + args[0], ...args.slice(1)] : args
      const flags = new Set<string>()
      const operands: string[] = []
      let base = ''
      for (let i = 0; i < flat.length; i++) {
        const a = flat[i]
        if (a === '-C' || a === '--directory') { base = flat[++i]; continue }
        if (a.startsWith('--')) { flags.add(a.slice(2)); continue }
        if (a.startsWith('-')) { for (const ch of a.slice(1)) flags.add(ch); continue }
        operands.push(a)
      }
      const mode = flags.has('c') ? 'c' : flags.has('x') ? 'x' : flags.has('t') ? 't' : null
      if (!mode) return fail("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.", 2)
      const verbose = flags.has('v')
      let file = ''
      if (flags.has('f')) file = operands.shift() ?? ''
      if (!file) return fail('tar: Refusing to read archive contents from terminal (missing -f option)', 2)
      if (mode === 'c') {
        if (!operands.length) return fail('tar: Cowardly refusing to create an empty archive', 2)
        const { entries, err } = tarPack(sh, operands, base)
        if (err) return { out: '', err: err + 'tar: Exiting with failure status due to previous errors\n', code: 2 }
        try { sh.writeFile(file, TAR_MAGIC + JSON.stringify(entries)) } catch (e) { return fail(`tar: ${file}: Cannot open: ${(e as Error).message}`, 2) }
        return ok(verbose ? joinLines(Object.keys(entries)) : '')
      }
      let raw: string
      try { raw = sh.readFile(file) } catch (e) { return fail(`tar: ${file}: Cannot open: ${(e as Error).message}\ntar: Error is not recoverable: exiting now`, 2) }
      if (!raw.startsWith(TAR_MAGIC)) return fail(`tar: This does not look like a tar archive\ntar: Error is not recoverable: exiting now`, 2)
      const entries = JSON.parse(raw.slice(TAR_MAGIC.length)) as Record<string, string | null>
      if (mode === 't') return ok(joinLines(Object.keys(entries)))
      let out = ''
      for (const [rel, content] of Object.entries(entries)) {
        const abs = sh.path((base ? base + '/' : '') + rel)
        if (content === null) sh.vfs.mkdir(abs, { parents: true, owner: sh.user })
        else { sh.vfs.mkdir(abs.slice(0, abs.lastIndexOf('/')) || '/', { parents: true, owner: sh.user }); sh.writeFile(abs, content) }
        if (verbose) out += rel + '\n'
      }
      return ok(out)
    },

    gzip: (sh, args) => { const f = args.find((a) => !a.startsWith('-')); if (!f) return fail('gzip: compressed data not written to a terminal.'); try { const c = sh.readFile(f); sh.writeFile(f + '.gz', c); sh.vfs.remove(sh.path(f)) } catch (e) { return fail(`gzip: ${(e as Error).message}`) } return ok() },
    gunzip: (sh, args) => { const f = args.find((a) => !a.startsWith('-')); if (!f) return fail('gunzip: missing operand'); try { const c = sh.readFile(f); sh.writeFile(f.replace(/\.gz$/, ''), c); sh.vfs.remove(sh.path(f)) } catch (e) { return fail(`gunzip: ${(e as Error).message}`) } return ok() },

    readonly: (sh, args) => { for (const a of args) { const eq = a.indexOf('='); if (eq >= 0) sh.env[a.slice(0, eq)] = a.slice(eq + 1) } return ok() },

    local: (sh, args) => {
      for (const a of args) {
        if (a.startsWith('-')) continue
        const eq = a.indexOf('=')
        if (eq >= 0) sh.declareLocal(a.slice(0, eq), a.slice(eq + 1))
        else sh.declareLocal(a)
      }
      return ok()
    },

    declare: (sh, args) => {
      const flags = args.filter((a) => a.startsWith('-')).join('')
      const rest = args.filter((a) => !a.startsWith('-'))
      if (!rest.length) return ok(joinLines([...Object.keys(sh.env).sort().map((k) => `${k}=${sh.env[k]}`), ...Object.keys(sh.arrays).sort().map((k) => `${k}=(${sh.arrays[k].map((v) => `"${v}"`).join(' ')})`)]))
      for (const a of rest) {
        const eq = a.indexOf('=')
        const name = eq >= 0 ? a.slice(0, eq) : a
        if (flags.includes('a') || flags.includes('A')) { if (!sh.arrays[name]) sh.arrays[name] = []; continue }
        if (flags.includes('p')) return ok(sh.arrays[name] ? `declare -a ${name}=(${sh.arrays[name].map((v) => `"${v}"`).join(' ')})\n` : sh.env[name] !== undefined ? `declare -- ${name}="${sh.env[name]}"\n` : '')
        if (eq >= 0) { if (sh.localFrames.length) sh.declareLocal(name, a.slice(eq + 1)); else sh.env[name] = a.slice(eq + 1) }
        else if (sh.localFrames.length) sh.declareLocal(name)
        if (flags.includes('r')) { /* readonly is not enforced */ }
        if (flags.includes('x')) sh.exported.add(name)
      }
      return ok()
    },

    unset: (sh, args) => {
      for (const a of args) {
        const m = a.match(/^([A-Za-z_]\w*)\[(.+)\]$/)
        if (m && sh.arrays[m[1]]) { sh.arrays[m[1]].splice(Number(m[2]), 1); continue }
        delete sh.arrays[a]
      }
      return baseUnset(sh, args.filter((a) => !a.startsWith('-') && !a.includes('[')), '')
    },

    read: (sh, args, stdin) => {
      // -r (no backslash mangling), -p PROMPT, -a NAME (split into an array), -s, -n, -t accepted.
      const names: string[] = []
      let prompt = ''
      let arrayName: string | null = null
      for (let i = 0; i < args.length; i++) {
        const a = args[i]
        if (a === '-p') prompt = args[++i] ?? ''
        else if (a === '-a') arrayName = args[++i] ?? null
        else if (a === '-n' || a === '-t' || a === '-d') i++
        else if (a.startsWith('-')) { /* -r -s */ }
        else names.push(a)
      }
      const source = stdin || sh.env.STDIN || ''
      if (arrayName) {
        const [first, ...rest] = source.split('\n')
        sh.env.STDIN = rest.join('\n')
        sh.arrays[arrayName] = (first ?? '').trim() === '' ? [] : (first ?? '').trim().split(/\s+/)
        return { out: prompt, err: '', code: source === '' ? 1 : 0 }
      }
      if (names.length <= 1) return baseRead(sh, [...(prompt ? ['-p', prompt] : []), ...names], stdin)
      const [first, ...rest] = source.split('\n')
      sh.env.STDIN = rest.join('\n')
      const words = (first ?? '').trim().split(/\s+/).filter(Boolean)
      names.forEach((n, i) => { sh.env[n] = i === names.length - 1 ? words.slice(i).join(' ') : (words[i] ?? '') })
      return { out: prompt, err: '', code: source === '' ? 1 : 0 }
    },

    mapfile: (sh, args, stdin) => {
      const rest = args.filter((a) => !a.startsWith('-'))
      const name = rest[0] ?? 'MAPFILE'
      const source = stdin || sh.env.STDIN || ''
      sh.arrays[name] = lines(source)
      sh.env.STDIN = ''
      return ok()
    },
    readarray: (sh, args, stdin) => cmds.mapfile(sh, args, stdin),

    printf: (sh, args) => {
      if (args[0] === '-v' && args[1]) { const r = basePrintf(sh, args.slice(2), ''); sh.env[args[1]] = r.out; return { ...r, out: '' } }
      // Support a few more conversions than the base: %5.2f, %05d, %x, %c, %q
      const fmt = args[0] ?? ''
      if (!/%[-0-9.]*[fxXoceq]/.test(fmt)) return basePrintf(sh, args, '')
      const rest = args.slice(1)
      let k = 0
      let out = ''
      const unescape = (s: string) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
      do {
        out += unescape(fmt).replace(/%([-0-9.]*)([sdfxXoceq%])/g, (_m, spec: string, t: string) => {
          if (t === '%') return '%'
          const v = rest[k++] ?? ''
          const width = parseInt(spec.replace(/^-|^0/, '').split('.')[0] || '0', 10)
          const prec = spec.includes('.') ? parseInt(spec.split('.')[1] || '0', 10) : undefined
          let s: string
          if (t === 'd') s = String(Math.trunc(Number(v)) || 0)
          else if (t === 'f') s = (Number(v) || 0).toFixed(prec ?? 6)
          else if (t === 'x') s = (Number(v) || 0).toString(16)
          else if (t === 'X') s = (Number(v) || 0).toString(16).toUpperCase()
          else if (t === 'o') s = (Number(v) || 0).toString(8)
          else if (t === 'c') s = v.charAt(0)
          else if (t === 'e') s = (Number(v) || 0).toExponential(prec ?? 6)
          else if (t === 'q') s = /[\s'"$\\]/.test(v) ? `'${v.replace(/'/g, "'\\''")}'` : v
          else s = prec !== undefined ? v.slice(0, prec) : v
          if (!width) return s
          if (spec.startsWith('-')) return s.padEnd(width)
          return s.padStart(width, spec.startsWith('0') && 'dfxXo'.includes(t) ? '0' : ' ')
        })
      } while (k < rest.length && /%[-0-9.]*[sdfxXoceq]/.test(fmt))
      return ok(out)
    },

    head: (sh, args, stdin) => {
      // head -n -N: everything except the last N lines
      const i = args.findIndex((a) => a === '-n')
      const neg = i >= 0 && /^-\d+$/.test(args[i + 1] ?? '') ? Number(args[i + 1].slice(1)) : null
      if (neg === null) return baseHead(sh, args, stdin)
      const rest = args.filter((_, k) => k !== i && k !== i + 1)
      const r = baseHead(sh, ['-n', '100000', ...rest], stdin)
      const ls = lines(r.out)
      return { ...r, out: joinLines(ls.slice(0, Math.max(0, ls.length - neg))) }
    },
    tail: (sh, args, stdin) => {
      // tail -n +N: from line N onward
      const i = args.findIndex((a) => a === '-n')
      const plus = i >= 0 && /^\+\d+$/.test(args[i + 1] ?? '') ? Number(args[i + 1].slice(1)) : null
      if (plus === null) return baseTail(sh, args, stdin)
      const rest = args.filter((_, k) => k !== i && k !== i + 1)
      const r = baseTail(sh, ['-n', '100000', ...rest], stdin)
      return { ...r, out: joinLines(lines(r.out).slice(Math.max(0, plus - 1))) }
    },
    ls: (sh, args, stdin) => {
      // ls -t (newest first) and -r (reverse) on top of the base listing, single directory only.
      const flags = args.filter((a) => a.startsWith('-') && !a.startsWith('--')).join('')
      if (!flags.includes('t') && !flags.includes('S')) return baseLs(sh, args, stdin)
      const operands = args.filter((a) => !a.startsWith('-'))
      const strippedFlags = args.filter((a) => a.startsWith('-') && !a.startsWith('--')).map((a) => a.replace(/[trS]/g, '')).filter((a) => a !== '-')
      if (operands.length > 1) {
        // Several files named explicitly (usually from a glob): order them by time or size.
        const nodes = operands.map((o) => [o, sh.vfs.get(sh.path(o))] as const)
        if (nodes.some(([, n]) => !n || n.type === 'dir')) return baseLs(sh, args, stdin)
        const k = (n: FsNode) => (flags.includes('S') ? (n.type === 'file' ? n.content.length : 4096) : n.mtime)
        nodes.sort((a, b) => k(b[1]!) - k(a[1]!) || a[0].localeCompare(b[0]))
        if (flags.includes('r')) nodes.reverse()
        return baseLs(sh, [...strippedFlags, ...nodes.map(([o]) => o)], stdin)
      }
      const dir = sh.path(operands[0] ?? '.')
      const node = sh.vfs.get(dir)
      if (!node || node.type !== 'dir') return baseLs(sh, args, stdin)
      const entries: [string, FsNode][] = sh.vfs.list(dir).filter(([n]) => flags.includes('a') || !n.startsWith('.'))
      const key = (n: FsNode) => (flags.includes('S') ? (n.type === 'file' ? n.content.length : 4096) : n.mtime)
      entries.sort((a, b) => key(b[1]) - key(a[1]) || a[0].localeCompare(b[0]))
      if (flags.includes('r')) entries.reverse()
      const r = baseLs(sh, [...strippedFlags, ...(flags.includes('l') ? [] : ['-1']), dir], stdin)
      if (r.code !== 0) return r
      const rows = lines(r.out).filter((l) => !/^total /.test(l))
      const byName = new Map(rows.map((row) => [flags.includes('l') ? row.split(/\s+/).slice(8).join(' ') : row, row]))
      const ordered = entries.map(([n]) => byName.get(n) ?? n)
      if (flags.includes('l')) return ok((rows.length ? `total ${entries.length}\n` : '') + joinLines(ordered))
      return ok(!sh.tty || flags.includes('1') ? joinLines(ordered) : ordered.length ? ordered.join('  ') + '\n' : '')
    },

    command: (sh, args, stdin) => {
      if (args[0] === '-v') { const r = baseType(sh, [args[1]], ''); return r.code === 0 ? ok((sh.findOnPath(args[1]) ?? args[1]) + '\n') : { out: '', err: '', code: 1 } }
      return sh.invoke(args, stdin)
    },
    builtin: (sh, args, stdin) => sh.invoke(args, stdin),
    eval: (sh, args) => sh.execScript(args.join(' ')),
    realpath: (sh, args) => (args.length ? ok(joinLines(args.map((a) => sh.path(a)))) : fail('realpath: missing operand')),
    readlink: (sh, args) => ok(joinLines(args.filter((a) => !a.startsWith('-')).map((a) => sh.path(a)))),
    stat_size: () => ok(),
    wait: () => ok(),
    times: () => ok('0m0.010s 0m0.004s\n0m0.000s 0m0.000s\n'),
    ulimit: () => ok('unlimited\n'),
    md5sum: (sh, args, stdin) => {
      const items: [string, string][] = args.length ? args.map((f) => [f, (() => { try { return sh.readFile(f) } catch { return '' } })()]) : [['-', stdin]]
      return ok(joinLines(items.map(([n, c]) => `${fakeHash(c, 32)}  ${n}`)))
    },
    sha256sum: (sh, args, stdin) => {
      const items: [string, string][] = args.length ? args.map((f) => [f, (() => { try { return sh.readFile(f) } catch { return '' } })()]) : [['-', stdin]]
      return ok(joinLines(items.map(([n, c]) => `${fakeHash(c, 64)}  ${n}`)))
    },
  }
  delete cmds.stat_size
  return cmds
}

/** Deterministic hex digest for checksum commands (not a real hash). */
function fakeHash(text: string, len: number): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < text.length; i++) { h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619); h2 = Math.imul(h2 + text.charCodeAt(i), 2246822519) }
  let out = ''
  let x = h1 >>> 0, y = h2 >>> 0
  while (out.length < len) { x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0; y = Math.imul(y ^ (y >>> 13), 3266489909) >>> 0; out += (x ^ y).toString(16).padStart(8, '0') }
  return out.slice(0, len)
}

export { globRegex, HOME }
