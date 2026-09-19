// Simulation module: users, groups, sudoers, umask, special permission bits, and ACLs.
// /etc/passwd, /etc/group, and /etc/shadow stay the source of truth (so cat and grep
// see the real thing); this module parses and rewrites them. Extra state (umask and a
// mirror of the ACLs) lives in simState(sh, 'users') for the lesson checkers.
import type { CommandTable } from './index'
import { simState } from './index'
import { HOOKS, type CmdResult } from '../commands'
import { dirname, type FsNode } from '../vfs'
import { HOSTNAME, globRegex, type Shell } from '../shell'

export interface UserRec { name: string; uid: number; gid: number; comment: string; home: string; shell: string }
export interface GroupRec { name: string; gid: number; members: string[] }
export interface UsersState {
  /** Current umask, as a number (0o022 by default). */
  umask: number
  /** Extended ACL entries by absolute path, in getfacl form (user:bob:rwx, group:qa:r-x, mask::rwx). */
  acls: Record<string, string[]>
  /** Live view of /etc/passwd keyed by user name. */
  readonly users: Record<string, UserRec>
  /** Live view of /etc/group keyed by group name. */
  readonly groups: Record<string, GroupRec>
  /** Mode (with special bits), owner, and group of everything under /home, /srv, /opt, /tmp, and /etc/sudoers.d. */
  readonly perms: Record<string, { mode: number; owner: string; group: string }>
}

/** Extended ACL attached to a filesystem node. The node's group bits hold the mask while an ACL exists. */
interface Acl { group: number; mask: number; users: Record<string, number>; groups: Record<string, number> }
const ACLS = new WeakMap<FsNode, Acl>()

const ok = (out = ''): CmdResult => ({ out, err: '', code: 0 })
const fail = (err: string, code = 1): CmdResult => ({ out: '', err: err.endsWith('\n') ? err : err + '\n', code })

const SUDOERS = `#
# This file MUST be edited with the 'visudo' command as root.
#
# Please consider adding local content in /etc/sudoers.d/ instead of
# directly modifying this file.
#
# See the man page for details on how to write a sudoers file.
#
Defaults\tenv_reset
Defaults\tmail_badpass
Defaults\tsecure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"
Defaults\tuse_pty

# User privilege specification
root\tALL=(ALL:ALL) ALL

# Members of the admin group may gain root privileges
%admin ALL=(ALL) ALL

# Allow members of group sudo to execute any command
%sudo\tALL=(ALL:ALL) ALL

# See sudoers(5) for more information on "@include" directives:

@includedir /etc/sudoers.d
`
const SUDOERS_README = `#
# The default /etc/sudoers file created on installation of Ubuntu
# includes the following directive:
#
#  @includedir /etc/sudoers.d
#
# This will cause sudo to read and parse any files in the /etc/sudoers.d
# directory that do not end in '~' or contain a '.' character.
#
`

/* ---------- /etc files ---------- */

const readText = (sh: Shell, path: string) => { const n = sh.vfs.get(path); return n?.type === 'file' ? n.content : '' }
const lines = (s: string) => s.split('\n').filter((l) => l.trim() !== '')

function parsePasswd(text: string): UserRec[] {
  return lines(text).map((l) => l.split(':')).filter((f) => f.length >= 7).map((f) => ({ name: f[0], uid: Number(f[2]), gid: Number(f[3]), comment: f[4], home: f[5], shell: f[6] }))
}
function parseGroup(text: string): GroupRec[] {
  return lines(text).map((l) => l.split(':')).filter((f) => f.length >= 3).map((f) => ({ name: f[0], gid: Number(f[2]), members: (f[3] ?? '').split(',').filter(Boolean) }))
}
const fmtPasswd = (u: UserRec) => `${u.name}:x:${u.uid}:${u.gid}:${u.comment}:${u.home}:${u.shell}`
const fmtGroup = (g: GroupRec) => `${g.name}:x:${g.gid}:${g.members.join(',')}`

interface Db { users: UserRec[]; groups: GroupRec[]; shadow: string[][] }
function db(sh: Shell): Db {
  return { users: parsePasswd(readText(sh, '/etc/passwd')), groups: parseGroup(readText(sh, '/etc/group')), shadow: lines(readText(sh, '/etc/shadow')).map((l) => l.split(':')) }
}
function save(sh: Shell, d: Db) {
  sh.vfs.writeFile('/etc/passwd', d.users.map(fmtPasswd).join('\n') + '\n', { owner: 'root' })
  sh.vfs.writeFile('/etc/group', d.groups.map(fmtGroup).join('\n') + '\n', { owner: 'root' })
  sh.vfs.writeFile('/etc/shadow', d.shadow.map((f) => f.join(':')).join('\n') + '\n', { owner: 'root', mode: 0o640 })
}
const byName = <T extends { name: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.name, x])) as Record<string, T>
const userOf = (sh: Shell, name: string) => parsePasswd(readText(sh, '/etc/passwd')).find((u) => u.name === name)
const groupOf = (sh: Shell, name: string) => parseGroup(readText(sh, '/etc/group')).find((g) => g.name === name)
const groupByGid = (sh: Shell, gid: number) => parseGroup(readText(sh, '/etc/group')).find((g) => g.gid === gid)

/** Primary group name of a user (falls back to the user name). */
function primaryGroup(sh: Shell, name: string): string {
  const u = userOf(sh, name)
  return (u && groupByGid(sh, u.gid)?.name) ?? name
}
/** Every group a user belongs to: primary first, then the rest in /etc/group order. */
function groupsOf(sh: Shell, name: string): string[] {
  const u = userOf(sh, name)
  if (!u) return []
  const all = parseGroup(readText(sh, '/etc/group'))
  const primary = all.find((g) => g.gid === u.gid)?.name
  const rest = all.filter((g) => g.members.includes(name) && g.name !== primary).map((g) => g.name)
  return primary ? [primary, ...rest] : rest
}

/* ---------- module state ---------- */

function state(sh: Shell): UsersState {
  const s = simState<Partial<UsersState>>(sh, 'users', () => ({}))
  if (s.umask === undefined) s.umask = 0o022
  if (!s.acls) s.acls = {}
  if (!Object.getOwnPropertyDescriptor(s, 'users')) {
    Object.defineProperty(s, 'users', { enumerable: true, get: () => byName(parsePasswd(readText(sh, '/etc/passwd'))) })
    Object.defineProperty(s, 'groups', { enumerable: true, get: () => byName(parseGroup(readText(sh, '/etc/group'))) })
    Object.defineProperty(s, 'perms', { enumerable: true, get: () => {
      const out: Record<string, { mode: number; owner: string; group: string }> = {}
      for (const root of ['/home', '/srv', '/opt', '/tmp', '/etc/sudoers.d']) sh.vfs.walk(root, (p, n) => { out[p] = { mode: n.mode, owner: n.owner, group: n.group } })
      return out
    } })
    ensureSudoers(sh)
    for (const bin of ['/usr/bin/passwd', '/usr/bin/sudo']) { const n = sh.vfs.get(bin); if (n && n.owner === 'root' && !(n.mode & 0o4000)) n.mode |= 0o4000 }
    adoptHomes(sh)
  }
  return s as UsersState
}

/** Make sure /etc/sudoers and /etc/sudoers.d exist (older seeds may lack them). */
function ensureSudoers(sh: Shell) {
  if (!sh.vfs.get('/etc/sudoers')) sh.vfs.writeFile('/etc/sudoers', SUDOERS, { owner: 'root', mode: 0o440 })
  if (!sh.vfs.get('/etc/sudoers.d')) sh.vfs.mkdir('/etc/sudoers.d', { owner: 'root' })
  if (!sh.vfs.get('/etc/sudoers.d/README')) sh.vfs.writeFile('/etc/sudoers.d/README', SUDOERS_README, { owner: 'root', mode: 0o440 })
}

/** Home directories seeded by a lesson belong to learner; hand them to the user named in /etc/passwd. */
function adoptHomes(sh: Shell) {
  for (const u of parsePasswd(readText(sh, '/etc/passwd'))) {
    if (u.name === 'learner' || u.name === 'root' || !u.home.startsWith('/home/')) continue
    const n = sh.vfs.get(u.home)
    if (n?.type === 'dir' && n.owner === 'learner') { n.owner = u.name; n.group = groupByGid(sh, u.gid)?.name ?? u.name; n.mode = 0o750; sh.vfs.walk(u.home, (_p, c) => { if (c.owner === 'learner') { c.owner = u.name; c.group = n.group } }) }
  }
}

/* ---------- sudoers ---------- */

interface SudoRule { who: string; runas: string; tags: string[]; cmds: string[] }
const RULE_RE = /^(\S+)\s+(\S+?)\s*=\s*(?:\(([^)]*)\))?\s*(.*)$/
const TAG_RE = /^(NOPASSWD|PASSWD|NOEXEC|EXEC|SETENV|NOSETENV|LOG_INPUT|LOG_OUTPUT|NOLOG_INPUT|NOLOG_OUTPUT|MAIL|NOMAIL|FOLLOW|NOFOLLOW):\s*/

function sudoersFiles(sh: Shell): [string, string][] {
  const out: [string, string][] = [['/etc/sudoers', readText(sh, '/etc/sudoers')]]
  const d = sh.vfs.get('/etc/sudoers.d')
  if (d?.type === 'dir') for (const [name, n] of sh.vfs.list('/etc/sudoers.d')) if (n.type === 'file' && !name.includes('.') && !name.endsWith('~')) out.push(['/etc/sudoers.d/' + name, n.content])
  return out
}

function parseRules(text: string): SudoRule[] {
  const rules: SudoRule[] = []
  for (const raw of lines(text)) {
    const l = raw.trim()
    if (l.startsWith('#') || l.startsWith('@') || /^Defaults\b/.test(l) || /^(User|Cmnd|Host|Runas)_Alias\b/.test(l)) continue
    const m = l.match(RULE_RE)
    if (!m) continue
    let spec = m[4]
    const tags: string[] = []
    let t: RegExpMatchArray | null
    while ((t = spec.match(TAG_RE))) { tags.push(t[1]); spec = spec.slice(t[0].length) }
    for (const who of m[1].split(',')) rules.push({ who: who.trim(), runas: m[3] ?? 'root', tags, cmds: spec.split(',').map((c) => c.trim()).filter(Boolean) })
  }
  return rules
}

function rulesFor(sh: Shell, user: string): SudoRule[] {
  const groups = groupsOf(sh, user)
  return sudoersFiles(sh).flatMap(([, text]) => parseRules(text)).filter((r) => r.who === 'ALL' || r.who === user || (r.who.startsWith('%') && groups.includes(r.who.slice(1))))
}

const fmtRule = (r: SudoRule) => `(${r.runas.replace(':', ' : ')}) ${r.tags.map((t) => t + ': ').join('')}${r.cmds.join(', ')}`

function listRules(sh: Shell, target: string): CmdResult {
  if (!userOf(sh, target)) return fail(`sudo: unknown user ${target}`)
  const rules = rulesFor(sh, target)
  if (!rules.length) return { out: `User ${target} is not allowed to run sudo on ${HOSTNAME}.\n`, err: '', code: 1 }
  const defaults = lines(readText(sh, '/etc/sudoers')).map((l) => l.trim().match(/^Defaults\s+(.*)$/)?.[1]).filter((x): x is string => Boolean(x)).map((d) => d.replace(/"/g, '').replace(/(?<==.*):/g, '\\:'))
  let out = ''
  if (defaults.length) {
    const wrapped: string[] = []
    let cur = ''
    for (const d of defaults) { const piece = d + (d === defaults[defaults.length - 1] ? '' : ','); if (cur && (cur + ' ' + piece).length > 76) { wrapped.push(cur); cur = piece } else cur = cur ? cur + ' ' + piece : piece }
    if (cur) wrapped.push(cur)
    out += `Matching Defaults entries for ${target} on ${HOSTNAME}:\n    ${wrapped.join('\n    ')}\n\n`
  }
  out += `User ${target} may run the following commands on ${HOSTNAME}:\n` + rules.map((r) => '    ' + fmtRule(r)).join('\n') + '\n'
  return ok(out)
}

function cmdMatches(spec: string, path: string, args: string[]): boolean {
  if (spec === 'ALL') return true
  const [cpath, ...cargs] = spec.split(/\s+/)
  const sameBin = cpath === path || (cpath.split('/').pop() === path.split('/').pop() && /^\/(usr\/)?s?bin\//.test(cpath))
  if (!sameBin) return false
  if (!cargs.length) return true
  if (cargs.length === 1 && cargs[0] === '""') return args.length === 0
  return globRegex(cargs.join(' ')).test(args.join(' '))
}

/** 'ok', 'notin' (no rules at all), or 'denied'. */
function sudoVerdict(sh: Shell, user: string, target: string, path: string, args: string[]): 'ok' | 'notin' | 'denied' {
  const rules = rulesFor(sh, user)
  if (!rules.length) return 'notin'
  for (const r of rules) {
    const runas = r.runas.split(':')[0].split(',').map((x) => x.trim())
    if (!(runas.includes('ALL') || runas.includes(target))) continue
    if (r.cmds.some((c) => cmdMatches(c, path, args))) return 'ok'
  }
  return 'denied'
}

const WHO_RE = /^(%?[\w.+-]+|ALL|[A-Z][A-Z0-9_]*)(\s*,\s*(%?[\w.+-]+|ALL|[A-Z][A-Z0-9_]*))*$/
const CMD_RE = /^!?(ALL|sudoedit|[A-Z][A-Z0-9_]*|\/\S*( .*)?)$/
/** True when one sudoers line is well formed: a comment, a directive, a Defaults line, an alias, or a rule with fully qualified commands. */
function validSudoersLine(l: string): boolean {
  if (l === '' || l.startsWith('#') || /^@include(dir)?\s+\S+$/.test(l) || /^Defaults\b/.test(l) || /^(User|Cmnd|Host|Runas)_Alias\s+[A-Z][A-Z0-9_]*\s*=\s*\S/.test(l)) return true
  const m = l.match(/^(.+?)\s+(\S+?)\s*=\s*(?:\(([^)]*)\)\s*)?(.*)$/)
  if (!m || !WHO_RE.test(m[1].trim()) || !/^[\w.,+-]+$|^ALL$/.test(m[2])) return false
  return m[4].split(',').every((c) => CMD_RE.test(c.trim().replace(TAG_RE, '').replace(TAG_RE, '')))
}
function checkSudoersFile(path: string, text: string, n: FsNode | undefined): { out: string; okay: boolean } {
  const ls = text.split('\n')
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i].trim()
    if (validSudoersLine(l)) continue
    return { out: `>>> ${path}: syntax error near line ${i + 1} <<<\nparse error in ${path} near line ${i + 1}\n`, okay: false }
  }
  let out = `${path}: parsed OK\n`
  if (n && (n.mode & 0o7777) !== 0o440) { out += `${path}: bad permissions, should be mode 0440\n`; return { out, okay: false } }
  if (n && n.owner !== 'root') { out += `${path}: bad owner, should be root\n`; return { out, okay: false } }
  return { out, okay: true }
}

/* ---------- permission helpers ---------- */

const permStr = (p: number) => `${p & 4 ? 'r' : '-'}${p & 2 ? 'w' : '-'}${p & 1 ? 'x' : '-'}`
function parsePerm(s: string): number | null {
  if (/^[0-7]$/.test(s)) return Number(s)
  if (!/^[rwx-]*$/.test(s)) return null
  return (s.includes('r') ? 4 : 0) | (s.includes('w') ? 2 : 0) | (s.includes('x') ? 1 : 0)
}

function aclOf(n: FsNode): Acl {
  let a = ACLS.get(n)
  if (!a) { a = { group: (n.mode >> 3) & 7, mask: (n.mode >> 3) & 7, users: {}, groups: {} }; ACLS.set(n, a) }
  return a
}
const hasExtended = (a: Acl | undefined) => Boolean(a && (Object.keys(a.users).length || Object.keys(a.groups).length))
function recalcMask(n: FsNode, a: Acl) {
  a.mask = [a.group, ...Object.values(a.users), ...Object.values(a.groups)].reduce((x, y) => x | y, 0)
  n.mode = (n.mode & ~0o070) | (a.mask << 3)
}
function aclEntries(n: FsNode): string[] {
  const a = ACLS.get(n)
  if (!hasExtended(a) || !a) return []
  return [...Object.entries(a.users).map(([u, p]) => `user:${u}:${permStr(p)}`), ...Object.entries(a.groups).map(([g, p]) => `group:${g}:${permStr(p)}`), `mask::${permStr(a.mask)}`]
}
function syncAclState(sh: Shell, abs: string, n: FsNode) {
  const st = state(sh)
  const entries = aclEntries(n)
  if (entries.length) st.acls[abs] = entries
  else delete st.acls[abs]
}

function applyDefaults(sh: Shell, abs: string, n: FsNode, keepMode = false) {
  const st = state(sh)
  const parent = sh.vfs.get(dirname(abs))
  const setgid = parent?.type === 'dir' && (parent.mode & 0o2000) !== 0
  if (!keepMode) n.mode = (n.type === 'dir' ? 0o777 : 0o666) & ~st.umask
  if (setgid) { n.group = parent.group; if (n.type === 'dir') n.mode |= 0o2000 }
  else n.group = primaryGroup(sh, n.owner)
}

function needRoot(sh: Shell, cmd: string): CmdResult | null {
  if (sh.user === 'root') return null
  return fail(`${cmd}: Permission denied.\n${cmd}: cannot lock /etc/passwd; try again later.`)
}

/** Long-option aware getopt for the user tools: returns flags, values, operands. */
function opts(args: string[], withValue: string, longs: Record<string, string> = {}) {
  const flags = new Set<string>()
  const values: Record<string, string> = {}
  const operands: string[] = []
  for (let i = 0; i < args.length; i++) {
    let a = args[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      const short = longs[k]
      if (short === undefined) { flags.add(k); continue }
      if (withValue.includes(short)) { values[short] = v ?? args[++i] ?? ''; continue }
      flags.add(short); continue
    }
    if (!a.startsWith('-') || a === '-') { operands.push(a); continue }
    a = a.slice(1)
    for (let k = 0; k < a.length; k++) {
      const c = a[k]
      if (withValue.includes(c)) { const rest = a.slice(k + 1); values[c] = rest !== '' ? rest : args[++i] ?? ''; break }
      flags.add(c)
    }
  }
  return { flags, values, operands }
}

const nextId = (used: number[], from: number) => { let id = from; while (used.includes(id)) id++; return id }

const HELP: Record<string, string> = {
  useradd: 'Usage: useradd [options] LOGIN\n  -m, --create-home     create the home directory\n  -s, --shell SHELL     login shell\n  -g, --gid GROUP       primary group\n  -G, --groups G1,G2    supplementary groups\n  -c, --comment TEXT    full name\n  -d, --home-dir DIR    home directory\n  -r, --system          system account (no home)',
  usermod: 'Usage: usermod [options] LOGIN\n  -aG, --append --groups G   add to supplementary groups\n  -G GROUPS                  replace supplementary groups\n  -g GROUP                   change primary group\n  -s SHELL                   change login shell\n  -c TEXT                    change full name\n  -d DIR [-m]                move home\n  -L / -U                    lock / unlock the password',
  userdel: 'Usage: userdel [options] LOGIN\n  -r, --remove   remove the home directory too',
  groupadd: 'Usage: groupadd [options] GROUP\n  -g, --gid GID   use this gid',
  groupdel: 'Usage: groupdel GROUP',
  gpasswd: 'Usage: gpasswd [option] GROUP\n  -a, --add USER      add USER to GROUP\n  -d, --delete USER   remove USER from GROUP',
  id: 'Usage: id [OPTION]... [USER]\n  -u  print only the user id\n  -g  print only the primary group id\n  -G  print all group ids\n  -n  print names instead of numbers (with -u, -g, -G)',
  groups: 'Usage: groups [USER]...',
  getent: 'Usage: getent passwd|group|shadow [KEY]',
  umask: 'umask: umask [-S] [mode]\n  Print or set the file creation mask.',
  visudo: 'usage: visudo -c [-f sudoers]\n  -c  check the sudoers files for syntax errors',
  getfacl: 'Usage: getfacl FILE...',
  setfacl: 'Usage: setfacl [-R] {-m ACL | -x ACL | -b} FILE...\n  -m u:USER:rwx   set an entry (also g:GROUP:rx, m::rwx, o::r)\n  -x u:USER       remove an entry\n  -b              remove all extended entries\n  -R              recurse',
  chgrp: 'Usage: chgrp [-R] GROUP FILE...',
  passwd: 'Usage: passwd [options] [LOGIN]\n  -S  status\n  -l  lock\n  -u  unlock',
}

/* ---------- install ---------- */

export function install(base: CommandTable) {
  HOOKS.access = (sh, n, want) => {
    const st = state(sh)
    void st
    if (sh.user === 'root') return want === 'x' ? n.type === 'dir' || (n.mode & 0o111) !== 0 : true
    const bit = want === 'r' ? 4 : want === 'w' ? 2 : 1
    if (n.owner === sh.user) return ((n.mode >> 6) & bit) !== 0
    const groups = groupsOf(sh, sh.user)
    const acl = ACLS.get(n)
    if (acl && hasExtended(acl)) {
      const u = acl.users[sh.user]
      if (u !== undefined) return (u & acl.mask & bit) !== 0
      let matched = false
      let granted = false
      if (groups.includes(n.group)) { matched = true; if (acl.group & acl.mask & bit) granted = true }
      for (const [g, p] of Object.entries(acl.groups)) if (groups.includes(g)) { matched = true; if (p & acl.mask & bit) granted = true }
      if (matched) return granted
    } else if (groups.includes(n.group)) return ((n.mode >> 3) & bit) !== 0
    return (n.mode & bit) !== 0
  }
  HOOKS.created = (sh, abs, n) => applyDefaults(sh, abs, n)
  HOOKS.modeMark = (n) => (hasExtended(ACLS.get(n)) ? '+' : '')

  const help = (name: string, args: string[]) => (args.includes('--help') && HELP[name] ? ok(HELP[name] + '\n') : null)

  base.useradd = (sh, args) => {
    const h = help('useradd', args); if (h) return h
    const r = needRoot(sh, 'useradd'); if (r) return r
    const { flags, values, operands } = opts(args, 'sgGcdu', { 'create-home': 'm', shell: 's', gid: 'g', groups: 'G', comment: 'c', 'home-dir': 'd', uid: 'u', system: 'r', 'no-create-home': 'M' })
    const name = operands[0]
    if (!name) return fail(HELP.useradd)
    if (!/^[a-z_][a-z0-9_-]*$/.test(name)) return fail(`useradd: invalid user name '${name}'`, 3)
    const d = db(sh)
    if (d.users.some((u) => u.name === name)) return fail(`useradd: user '${name}' already exists`, 9)
    const system = flags.has('r')
    const uid = values.u !== undefined ? Number(values.u) : nextId(d.users.map((u) => u.uid), system ? 999 : 1000)
    let gid: number
    if (values.g !== undefined) {
      const g = d.groups.find((x) => x.name === values.g || String(x.gid) === values.g)
      if (!g) return fail(`useradd: group '${values.g}' does not exist`, 6)
      gid = g.gid
    } else {
      if (d.groups.some((g) => g.name === name)) return fail(`useradd: group ${name} exists - if you want to add this user to that group, use -g.`, 9)
      gid = nextId(d.groups.map((g) => g.gid), uid)
      d.groups.push({ name, gid, members: [] })
    }
    const extra = values.G ? values.G.split(',').filter(Boolean) : []
    for (const g of extra) if (!d.groups.some((x) => x.name === g)) return fail(`useradd: group '${g}' does not exist`, 6)
    for (const g of d.groups) if (extra.includes(g.name) && !g.members.includes(name)) g.members.push(name)
    const home = values.d ?? (system ? '/' : `/home/${name}`)
    const shell = values.s ?? (system ? '/usr/sbin/nologin' : '/bin/sh')
    d.users.push({ name, uid, gid, comment: values.c ?? '', home, shell })
    d.shadow.push([name, '!', '20713', '0', '99999', '7', '', '', ''])
    save(sh, d)
    const gname = d.groups.find((g) => g.gid === gid)?.name ?? name
    if (flags.has('m') && !system && !flags.has('M')) {
      if (!sh.vfs.get(home)) {
        sh.vfs.mkdir(home, { parents: true, owner: name })
        sh.vfs.writeFile(home + '/.bashrc', '# ~/.bashrc\n', { owner: name })
        sh.vfs.writeFile(home + '/.profile', '# ~/.profile\n', { owner: name })
        sh.vfs.walk(home, (_p, n) => { n.owner = name; n.group = gname })
        sh.vfs.get(home)!.mode = 0o750
      }
    }
    return ok()
  }
  base.adduser = (sh, args) => {
    const ops = args.filter((a) => !a.startsWith('-'))
    if (ops.length === 2) return base.gpasswd(sh, ['-a', ops[0], ops[1]], '')
    return fail(`adduser: the interactive adduser is not simulated here. Use the low-level tool instead:\n  sudo useradd -m -s /bin/bash${ops[0] ? ' ' + ops[0] : ' NAME'}\nor add a user to a group with: sudo gpasswd -a USER GROUP`)
  }

  base.usermod = (sh, args) => {
    const h = help('usermod', args); if (h) return h
    const r = needRoot(sh, 'usermod'); if (r) return r
    const { flags, values, operands } = opts(args, 'sgGcdl', { append: 'a', shell: 's', gid: 'g', groups: 'G', comment: 'c', home: 'd', 'move-home': 'm', lock: 'L', unlock: 'U', login: 'l' })
    const name = operands[0]
    if (!name) return fail(HELP.usermod)
    if (flags.has('a') && values.G === undefined) return fail('usermod: -a flag is only allowed with the -G flag', 3)
    const d = db(sh)
    const u = d.users.find((x) => x.name === name)
    if (!u) return fail(`usermod: user '${name}' does not exist`, 6)
    if (values.G !== undefined) {
      const want = values.G.split(',').filter(Boolean)
      for (const g of want) if (!d.groups.some((x) => x.name === g)) return fail(`usermod: group '${g}' does not exist`, 6)
      for (const g of d.groups) {
        if (g.gid === u.gid) continue
        if (want.includes(g.name)) { if (!g.members.includes(name)) g.members.push(name) }
        else if (!flags.has('a')) g.members = g.members.filter((m) => m !== name)
      }
    }
    if (values.g !== undefined) {
      const g = d.groups.find((x) => x.name === values.g || String(x.gid) === values.g)
      if (!g) return fail(`usermod: group '${values.g}' does not exist`, 6)
      u.gid = g.gid
    }
    if (values.s !== undefined) u.shell = values.s
    if (values.c !== undefined) u.comment = values.c
    if (values.d !== undefined) {
      const old = u.home
      u.home = values.d
      if (flags.has('m') && sh.vfs.get(old)) { sh.vfs.mkdir(dirname(values.d), { parents: true, owner: 'root' }); sh.vfs.move(old, values.d) }
    }
    const sh_ = d.shadow.find((f) => f[0] === name)
    if (flags.has('L') && sh_ && !sh_[1].startsWith('!')) sh_[1] = '!' + sh_[1]
    if (flags.has('U') && sh_) {
      if (sh_[1] === '!' || sh_[1] === '!*' || sh_[1] === '*') return fail("usermod: unlocking the user's password would result in a passwordless account.\nYou should set a password with usermod -p to unlock the password of this account.", 3)
      sh_[1] = sh_[1].replace(/^!/, '')
    }
    if (values.l !== undefined) {
      if (d.users.some((x) => x.name === values.l)) return fail(`usermod: user '${values.l}' already exists`, 9)
      for (const g of d.groups) g.members = g.members.map((m) => (m === name ? values.l : m))
      if (sh_) sh_[0] = values.l
      u.name = values.l
    }
    save(sh, d)
    return ok()
  }

  base.userdel = (sh, args) => {
    const h = help('userdel', args); if (h) return h
    const r = needRoot(sh, 'userdel'); if (r) return r
    const { flags, operands } = opts(args, '', { remove: 'r', force: 'f' })
    const name = operands[0]
    if (!name) return fail(HELP.userdel)
    const d = db(sh)
    const u = d.users.find((x) => x.name === name)
    if (!u) return fail(`userdel: user '${name}' does not exist`, 6)
    if (name === 'learner' || name === 'root') return fail(`userdel: user ${name} is currently used by process 1183`, 8)
    d.users = d.users.filter((x) => x.name !== name)
    d.shadow = d.shadow.filter((f) => f[0] !== name)
    for (const g of d.groups) g.members = g.members.filter((m) => m !== name)
    const pg = d.groups.find((g) => g.gid === u.gid)
    if (pg && pg.name === name && !pg.members.length && !d.users.some((x) => x.gid === pg.gid)) d.groups = d.groups.filter((g) => g !== pg)
    save(sh, d)
    if (flags.has('r') && sh.vfs.get(u.home) && u.home.startsWith('/home/')) sh.vfs.remove(u.home, { recursive: true })
    return ok()
  }
  base.deluser = (sh, args) => {
    const ops = args.filter((a) => !a.startsWith('-'))
    if (ops.length === 2) return base.gpasswd(sh, ['-d', ops[0], ops[1]], '')
    return base.userdel(sh, args.includes('--remove-home') ? ['-r', ...ops] : ops, '')
  }

  base.groupadd = (sh, args) => {
    const h = help('groupadd', args); if (h) return h
    const r = needRoot(sh, 'groupadd'); if (r) return r
    const { flags, values, operands } = opts(args, 'g', { gid: 'g', system: 'r' })
    const name = operands[0]
    if (!name) return fail(HELP.groupadd)
    if (!/^[a-z_][a-z0-9_-]*$/.test(name)) return fail(`groupadd: '${name}' is not a valid group name`, 3)
    const d = db(sh)
    if (d.groups.some((g) => g.name === name)) return fail(`groupadd: group '${name}' already exists`, 9)
    const gid = values.g !== undefined ? Number(values.g) : nextId(d.groups.map((g) => g.gid), flags.has('r') ? 999 : 1000)
    if (d.groups.some((g) => g.gid === gid)) return fail(`groupadd: GID '${gid}' already exists`, 4)
    d.groups.push({ name, gid, members: [] })
    save(sh, d)
    return ok()
  }
  base.addgroup = (sh, args) => base.groupadd(sh, args.filter((a) => a !== '--system').concat(args.includes('--system') ? ['-r'] : []), '')

  base.groupdel = (sh, args) => {
    const h = help('groupdel', args); if (h) return h
    const r = needRoot(sh, 'groupdel'); if (r) return r
    const name = args.find((a) => !a.startsWith('-'))
    if (!name) return fail(HELP.groupdel)
    const d = db(sh)
    const g = d.groups.find((x) => x.name === name)
    if (!g) return fail(`groupdel: group '${name}' does not exist`, 6)
    const owner = d.users.find((u) => u.gid === g.gid)
    if (owner) return fail(`groupdel: cannot remove the primary group of user '${owner.name}'`, 8)
    d.groups = d.groups.filter((x) => x !== g)
    save(sh, d)
    return ok()
  }
  base.delgroup = (sh, args, stdin) => base.groupdel(sh, args, stdin)

  base.gpasswd = (sh, args) => {
    const h = help('gpasswd', args); if (h) return h
    if (sh.user !== 'root') return fail('gpasswd: Permission denied.')
    const { values, operands } = opts(args, 'ad', { add: 'a', delete: 'd' })
    const group = operands[0]
    if (!group) return fail(HELP.gpasswd)
    const d = db(sh)
    const g = d.groups.find((x) => x.name === group)
    if (!g) return fail(`gpasswd: group '${group}' does not exist in /etc/group`, 3)
    const user = values.a ?? values.d
    if (user === undefined) return fail('gpasswd: changing a group password is not simulated here. Use -a USER or -d USER.')
    if (!d.users.some((u) => u.name === user)) return fail(`gpasswd: user '${user}' does not exist`, 3)
    if (values.a !== undefined) { if (!g.members.includes(user)) g.members.push(user); save(sh, d); return ok(`Adding user ${user} to group ${group}\n`) }
    if (!g.members.includes(user)) return fail(`gpasswd: user '${user}' is not a member of '${group}'`, 3)
    g.members = g.members.filter((m) => m !== user)
    save(sh, d)
    return ok(`Removing user ${user} from group ${group}\n`)
  }

  base.id = (sh, args) => {
    const h = help('id', args); if (h) return h
    const { flags, operands } = opts(args, '', { user: 'u', group: 'g', groups: 'G', name: 'n' })
    const name = operands[0] ?? sh.user
    const u = userOf(sh, name)
    if (!u) return fail(`id: '${name}': no such user`)
    const all = parseGroup(readText(sh, '/etc/group'))
    const primary = all.find((g) => g.gid === u.gid)
    const gs = [primary, ...all.filter((g) => g.members.includes(name) && g !== primary)].filter((g): g is GroupRec => Boolean(g))
    const n = flags.has('n')
    if (flags.has('u')) return ok((n ? u.name : String(u.uid)) + '\n')
    if (flags.has('g')) return ok((n ? primary?.name ?? String(u.gid) : String(u.gid)) + '\n')
    if (flags.has('G')) return ok(gs.map((g) => (n ? g.name : String(g.gid))).join(' ') + '\n')
    return ok(`uid=${u.uid}(${u.name}) gid=${u.gid}(${primary?.name ?? u.gid}) groups=${gs.map((g) => `${g.gid}(${g.name})`).join(',')}\n`)
  }

  base.groups = (sh, args) => {
    const h = help('groups', args); if (h) return h
    const names = args.filter((a) => !a.startsWith('-'))
    if (!names.length) return ok(groupsOf(sh, sh.user).join(' ') + '\n')
    let out = ''
    let err = ''
    for (const nm of names) { if (!userOf(sh, nm)) err += `groups: '${nm}': no such user\n`; else out += `${nm} : ${groupsOf(sh, nm).join(' ')}\n` }
    return { out, err, code: err ? 1 : 0 }
  }

  base.getent = (sh, args) => {
    const h = help('getent', args); if (h) return h
    const [dbName, key] = args.filter((a) => !a.startsWith('-'))
    if (!dbName) return fail(HELP.getent, 2)
    const file = ({ passwd: '/etc/passwd', group: '/etc/group', shadow: '/etc/shadow', hosts: '/etc/hosts' } as Record<string, string>)[dbName]
    if (!file) return fail(`getent: Unknown database: ${dbName}`, 2)
    let text: string
    try { text = sh.readFile(file) } catch (e) { return fail(`getent: ${(e as Error).message}`) }
    const ls = lines(text)
    if (key === undefined) return ok(ls.join('\n') + '\n')
    const hit = ls.filter((l) => l.split(':')[0] === key || (dbName !== 'hosts' && l.split(':')[2] === key) || (dbName === 'hosts' && l.split(/\s+/).includes(key)))
    return hit.length ? ok(hit.join('\n') + '\n') : { out: '', err: '', code: 2 }
  }

  const baseSudo = base.sudo
  base.sudo = (sh, args, stdin) => {
    state(sh)
    let list = false
    let target: string | undefined
    let listUser: string | undefined
    let i = 0
    for (; i < args.length; i++) {
      const a = args[i]
      if (a === '--') { i++; break }
      if (a === '-l' || a === '--list') list = true
      else if (a === '-U') listUser = args[++i]
      else if (a === '-u' || a === '--user') target = args[++i]
      else if (a === '-lU') { list = true; listUser = args[++i] }
      else if (/^-[nkEHSv]+$/.test(a)) { if (a.includes('v') || a.includes('k')) { /* validate or forget: nothing to do */ } }
      else if (a === '-i' || a === '-s') return baseSudo(sh, [a], stdin)
      else if (a === '-h' || a === '--help') return ok('usage: sudo -l [-U user]\nusage: sudo [-u user] command\n')
      else if (a.startsWith('-')) return fail(`sudo: invalid option -- '${a.slice(1)}'\nusage: sudo [-u user] command | sudo -l [-U user]`)
      else break
    }
    const words = args.slice(i)
    if (list) {
      const who = listUser ?? sh.user
      if (listUser && listUser !== sh.user && sh.user !== 'root') {
        const mine = rulesFor(sh, sh.user)
        if (!mine.some((r) => r.cmds.includes('ALL'))) return fail(`Sorry, user ${sh.user} is not allowed to execute 'list' as root on ${HOSTNAME}.`)
      }
      return listRules(sh, who)
    }
    if (!words.length) return fail('sudo: a command is required, like "sudo -u deploy whoami" or "sudo cat /etc/shadow". Use sudo -l to see what you may run.')
    target ??= 'root'
    if (!userOf(sh, target) && target !== 'root') return fail(`sudo: unknown user ${target}`)
    if (sh.user !== 'root') {
      const path = sh.findOnPath(words[0]) ?? (words[0].includes('/') ? sh.path(words[0]) : '/usr/bin/' + words[0])
      const verdict = sudoVerdict(sh, sh.user, target, path, words.slice(1))
      if (verdict === 'notin') return fail(`${sh.user} is not in the sudoers file.`)
      if (verdict === 'denied') return fail(`Sorry, user ${sh.user} is not allowed to execute '${[path, ...words.slice(1)].join(' ')}' as ${target} on ${HOSTNAME}.`)
    }
    if (target === 'root') return baseSudo(sh, words, stdin)
    const saved = sh.user
    sh.user = target
    try { return sh.invoke(words, stdin) } finally { sh.user = saved }
  }

  base.visudo = (sh, args) => {
    const h = help('visudo', args); if (h) return h
    state(sh)
    const { flags, values } = opts(args, 'f', { check: 'c', file: 'f', strict: 's', quiet: 'q' })
    if (!flags.has('c')) {
      const f = values.f ?? '/etc/sudoers.d/NAME'
      return fail(`visudo: this terminal has no interactive editor. Write the rule to a file instead, then check it:\n  echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart *' | sudo tee ${f}\n  sudo chmod 440 ${f}\n  sudo visudo -c`)
    }
    if (sh.user !== 'root') return fail('visudo: /etc/sudoers: Permission denied')
    const files = values.f ? [[sh.path(values.f), readText(sh, sh.path(values.f))] as [string, string]] : sudoersFiles(sh)
    if (values.f && !sh.vfs.get(sh.path(values.f))) return fail(`visudo: unable to open ${values.f}: No such file or directory`)
    let out = ''
    let okay = true
    for (const [path, text] of files) {
      const r = checkSudoersFile(path, text, sh.vfs.get(path))
      out += r.out
      if (!r.okay) okay = false
    }
    return okay ? ok(out) : { out: '', err: out, code: 1 }
  }

  base.umask = (sh, args) => {
    const h = help('umask', args); if (h) return h
    const st = state(sh)
    const { flags, operands } = opts(args, '', {})
    if (!operands.length) {
      if (flags.has('S')) { const p = 0o777 & ~st.umask; return ok(`u=${permStr(p >> 6).replace(/-/g, '')},g=${permStr((p >> 3) & 7).replace(/-/g, '')},o=${permStr(p & 7).replace(/-/g, '')}\n`) }
      return ok('0' + st.umask.toString(8).padStart(3, '0') + '\n')
    }
    const m = operands[0]
    if (/^[0-7]{1,4}$/.test(m)) { st.umask = parseInt(m, 8) & 0o777; return ok() }
    const sym = m.match(/^([ugoa]*)=([rwx]*)(?:,([ugoa]*)=([rwx]*))*$/)
    if (!sym) return fail(`bash: umask: ${m}: invalid symbolic mode operator`)
    let keep = 0
    for (const part of m.split(',')) {
      const [who, perms] = part.split('=')
      const bits = parsePerm(perms) ?? 0
      for (const c of who || 'a') for (const s of c === 'a' ? [6, 3, 0] : [{ u: 6, g: 3, o: 0 }[c] ?? 0]) keep |= bits << s
    }
    st.umask = 0o777 & ~keep
    return ok()
  }

  const baseChmod = base.chmod
  base.chmod = (sh, args) => {
    state(sh)
    const { flags, operands } = opts(args, '', { recursive: 'R' })
    if (operands.length < 2) return fail('chmod: missing operand')
    const [modeSpec, ...files] = operands
    const numeric = /^[0-7]{3,5}$/.test(modeSpec)
    if (!numeric && !/^([ugoa]*[-+=][rwxXst]*)(,[ugoa]*[-+=][rwxXst]*)*$/.test(modeSpec)) return fail(`chmod: invalid mode: '${modeSpec}'`)
    let err = ''
    const setSpecial = (n: FsNode) => {
      if (numeric) {
        const full = parseInt(modeSpec, 8)
        const given = full & 0o7000
        const special = n.type === 'dir' && modeSpec.length < 5 ? given | (n.mode & 0o6000) : given
        n.mode = (n.mode & 0o777) | special
        return
      }
      for (const part of modeSpec.split(',')) {
        const m = part.match(/^([ugoa]*)([-+=])([rwxXst]*)$/)!
        const who = m[1] || 'a'
        let bits = 0
        if (m[3].includes('s')) { if (who.includes('u') || who.includes('a')) bits |= 0o4000; if (who.includes('g') || who.includes('a')) bits |= 0o2000 }
        if (m[3].includes('t')) bits |= 0o1000
        if (m[2] === '+') n.mode |= bits
        else if (m[2] === '-') n.mode &= ~bits
        else { const clear = (who.includes('u') || who.includes('a') ? 0o4000 : 0) | (who.includes('g') || who.includes('a') ? 0o2000 : 0) | (who.includes('o') || who.includes('a') ? 0o1000 : 0); n.mode = (n.mode & ~clear) | bits }
      }
    }
    const basicSpec = numeric ? modeSpec.slice(-3) : modeSpec.split(',').map((p) => p.replace(/[st]/g, '')).filter((p) => !/[-+=]$/.test(p)).join(',')
    for (const f of files) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { err += `chmod: cannot access '${f}': No such file or directory\n`; continue }
      if (sh.user !== 'root' && n.owner !== sh.user) { err += `chmod: changing permissions of '${f}': Operation not permitted\n`; continue }
      const nodes: FsNode[] = [n]
      if (flags.has('R') && n.type === 'dir') sh.vfs.walk(abs, (_p, c) => { if (c !== n) nodes.push(c) })
      const specials = nodes.map((c) => c.mode & 0o7000)
      if (basicSpec) {
        const r = baseChmod(sh, [...(flags.has('R') ? ['-R'] : []), basicSpec, f], '')
        err += r.err
        nodes.forEach((c, k) => { c.mode = (c.mode & 0o777) | specials[k] })
      }
      for (const c of nodes) { setSpecial(c); const a = ACLS.get(c); if (a && hasExtended(a)) { a.mask = (c.mode >> 3) & 7 } }
    }
    return { out: '', err, code: err ? 1 : 0 }
  }

  base.chown = (sh, args) => {
    state(sh)
    const { flags, operands } = opts(args, '', { recursive: 'R' })
    if (operands.length < 2) return fail('chown: missing operand')
    const [spec, ...files] = operands
    if (sh.user !== 'root') return fail(`chown: changing ownership of '${files[0]}': Operation not permitted`)
    const colon = spec.indexOf(':')
    const owner = colon < 0 ? spec : spec.slice(0, colon)
    let group: string | null = colon < 0 ? null : spec.slice(colon + 1)
    if (owner && !userOf(sh, owner)) return fail(`chown: invalid user: '${spec}'`)
    if (group === '' && owner) group = primaryGroup(sh, owner)
    if (group && !groupOf(sh, group)) return fail(`chown: invalid group: '${spec}'`)
    let err = ''
    for (const f of files) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { err += `chown: cannot access '${f}': No such file or directory\n`; continue }
      const set = (x: FsNode) => { if (owner) x.owner = owner; if (group) x.group = group }
      set(n)
      if (flags.has('R') && n.type === 'dir') sh.vfs.walk(abs, (_p, c) => set(c))
    }
    return { out: '', err, code: err ? 1 : 0 }
  }

  base.chgrp = (sh, args) => {
    const h = help('chgrp', args); if (h) return h
    state(sh)
    const { flags, operands } = opts(args, '', { recursive: 'R' })
    if (operands.length < 2) return fail('chgrp: missing operand')
    const [group, ...files] = operands
    if (!groupOf(sh, group)) return fail(`chgrp: invalid group: '${group}'`)
    let err = ''
    for (const f of files) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { err += `chgrp: cannot access '${f}': No such file or directory\n`; continue }
      if (sh.user !== 'root' && (n.owner !== sh.user || !groupsOf(sh, sh.user).includes(group))) { err += `chgrp: changing group of '${f}': Operation not permitted\n`; continue }
      n.group = group
      if (flags.has('R') && n.type === 'dir') sh.vfs.walk(abs, (_p, c) => { c.group = group })
    }
    return { out: '', err, code: err ? 1 : 0 }
  }

  base.getfacl = (sh, args) => {
    const h = help('getfacl', args); if (h) return h
    state(sh)
    const { operands } = opts(args, '', {})
    if (!operands.length) return fail(HELP.getfacl)
    let out = ''
    let err = ''
    for (const f of operands) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { err += `getfacl: ${f}: No such file or directory\n`; continue }
      if (f.startsWith('/')) err += "getfacl: Removing leading '/' from absolute path names\n"
      const a = ACLS.get(n)
      const ext = hasExtended(a) && a
      const flagsLine = n.mode & 0o7000 ? `# flags: ${n.mode & 0o4000 ? 's' : '-'}${n.mode & 0o2000 ? 's' : '-'}${n.mode & 0o1000 ? 't' : '-'}\n` : ''
      out += `# file: ${f.replace(/^\/+/, '')}\n# owner: ${n.owner}\n# group: ${n.group}\n${flagsLine}`
      out += `user::${permStr(n.mode >> 6)}\n`
      if (ext) {
        for (const [u, p] of Object.entries(ext.users)) out += `user:${u}:${permStr(p)}${(p & ext.mask) !== p ? `\t\t#effective:${permStr(p & ext.mask)}` : ''}\n`
        out += `group::${permStr(ext.group)}${(ext.group & ext.mask) !== ext.group ? `\t\t#effective:${permStr(ext.group & ext.mask)}` : ''}\n`
        for (const [g, p] of Object.entries(ext.groups)) out += `group:${g}:${permStr(p)}${(p & ext.mask) !== p ? `\t\t#effective:${permStr(p & ext.mask)}` : ''}\n`
        out += `mask::${permStr(ext.mask)}\n`
      } else out += `group::${permStr((n.mode >> 3) & 7)}\n`
      out += `other::${permStr(n.mode & 7)}\n\n`
    }
    return { out, err, code: err.includes('No such') ? 1 : 0 }
  }

  base.setfacl = (sh, args) => {
    const h = help('setfacl', args); if (h) return h
    state(sh)
    const { flags, values, operands } = opts(args, 'mx', { modify: 'm', remove: 'x', 'remove-all': 'b', recursive: 'R', default: 'd' })
    if (flags.has('d')) return fail('setfacl: default ACLs (-d) are not simulated here. Set entries on the files themselves, or use a setgid directory for group inheritance.')
    if (values.m === undefined && values.x === undefined && !flags.has('b')) return fail('setfacl: one of -m, -x, or -b is needed\n' + HELP.setfacl)
    if (!operands.length) return fail('setfacl: missing file operand\n' + HELP.setfacl)
    let err = ''
    const parseSpec = (spec: string, withPerm: boolean): { kind: string; name: string; perm: number } | string => {
      const parts = spec.split(':')
      if (parts.length < 2) return `setfacl: Option -${withPerm ? 'm' : 'x'}: Invalid argument near character ${spec.length + 1}`
      const kindRaw = parts[0]
      const kind = ({ u: 'u', user: 'u', g: 'g', group: 'g', m: 'm', mask: 'm', o: 'o', other: 'o' } as Record<string, string>)[kindRaw]
      if (!kind) return `setfacl: Option -${withPerm ? 'm' : 'x'}: Invalid argument near character 1`
      const name = parts[1]
      const perm = withPerm ? parsePerm(parts[2] ?? '') : 0
      if (perm === null) return `setfacl: Option -m: Invalid argument near character ${spec.lastIndexOf(':') + 2}`
      if (kind === 'u' && name && !userOf(sh, name)) return `setfacl: Option -${withPerm ? 'm' : 'x'}: Invalid argument near character ${kindRaw.length + 2}`
      if (kind === 'g' && name && !groupOf(sh, name)) return `setfacl: Option -${withPerm ? 'm' : 'x'}: Invalid argument near character ${kindRaw.length + 2}`
      return { kind, name, perm }
    }
    for (const f of operands) {
      const abs = sh.path(f)
      const n = sh.vfs.get(abs)
      if (!n) { err += `setfacl: ${f}: No such file or directory\n`; continue }
      if (sh.user !== 'root' && n.owner !== sh.user) { err += `setfacl: ${f}: Operation not permitted\n`; continue }
      const targets: [string, FsNode][] = [[abs, n]]
      if (flags.has('R') && n.type === 'dir') sh.vfs.walk(abs, (p, c) => { if (c !== n) targets.push([p, c]) })
      for (const [p, node] of targets) {
        if (flags.has('b')) { const a = ACLS.get(node); if (a) { node.mode = (node.mode & ~0o070) | (a.group << 3); ACLS.delete(node) } }
        if (values.m !== undefined) {
          for (const spec of values.m.split(',')) {
            const s = parseSpec(spec.trim(), true)
            if (typeof s === 'string') return fail(s, 2)
            const a = aclOf(node)
            if (s.kind === 'u' && s.name) a.users[s.name] = s.perm
            else if (s.kind === 'u') node.mode = (node.mode & ~0o700) | (s.perm << 6)
            else if (s.kind === 'g' && s.name) a.groups[s.name] = s.perm
            else if (s.kind === 'g') a.group = s.perm
            else if (s.kind === 'o') node.mode = (node.mode & ~0o007) | s.perm
            if (s.kind === 'm') { a.mask = s.perm; node.mode = (node.mode & ~0o070) | (s.perm << 3) }
            else if (hasExtended(a)) recalcMask(node, a)
            else { node.mode = (node.mode & ~0o070) | (a.group << 3); ACLS.delete(node) }
          }
        }
        if (values.x !== undefined) {
          for (const spec of values.x.split(',')) {
            const s = parseSpec(spec.trim(), false)
            if (typeof s === 'string') return fail(s, 2)
            const a = ACLS.get(node)
            if (!a) continue
            if (s.kind === 'u') delete a.users[s.name]
            if (s.kind === 'g') delete a.groups[s.name]
            if (hasExtended(a)) recalcMask(node, a)
            else { node.mode = (node.mode & ~0o070) | (a.group << 3); ACLS.delete(node) }
          }
        }
        syncAclState(sh, p, node)
      }
    }
    return { out: '', err, code: err ? 1 : 0 }
  }

  base.passwd = (sh, args) => {
    const h = help('passwd', args); if (h) return h
    const { flags, operands } = opts(args, '', { status: 'S', lock: 'l', unlock: 'u' })
    const name = operands[0] ?? sh.user
    const d = db(sh)
    const u = d.users.find((x) => x.name === name)
    if (!u) return fail(`passwd: user '${name}' does not exist`)
    if (sh.user !== 'root' && (name !== sh.user || flags.has('S') || flags.has('l') || flags.has('u'))) return fail('passwd: You may not view or modify password information for ' + name + '.')
    const row = d.shadow.find((f) => f[0] === name) ?? (d.shadow.push([name, '!', '20713', '0', '99999', '7', '', '', '']), d.shadow[d.shadow.length - 1])
    if (flags.has('S')) {
      const st = row[1] === '' ? 'NP' : row[1].startsWith('!') || row[1] === '*' ? 'L' : 'P'
      return ok(`${name} ${st} 09/18/2026 ${row[3]} ${row[4]} ${row[5]} -1\n`)
    }
    if (flags.has('l')) { if (!row[1].startsWith('!')) row[1] = '!' + row[1]; save(sh, d); return ok('passwd: password changed.\n') }
    if (flags.has('u')) { row[1] = row[1].replace(/^!(?=.)/, ''); save(sh, d); return ok('passwd: password changed.\n') }
    row[1] = '$6$stackcraft$simulatedhashsimulatedhash'
    save(sh, d)
    return ok('New password: \nRetype new password: \npasswd: password updated successfully\n(this terminal skips the prompts and records a placeholder password)\n')
  }

  const baseCp = base.cp
  base.cp = (sh, args, stdin) => {
    state(sh)
    const files = args.filter((a) => !a.startsWith('-'))
    const dst = files[files.length - 1]
    const before = new Set<FsNode>()
    if (dst) sh.vfs.walk(sh.path(dst), (_p, n) => { before.add(n) })
    const r = baseCp(sh, args, stdin)
    if (dst) sh.vfs.walk(sh.path(dst), (p, n) => { if (!before.has(n)) applyDefaults(sh, p, n, true) })
    return r
  }

  // ls -d: show the directory entry itself (the base ls lists its contents).
  const baseLs = base.ls
  base.ls = (sh, args, stdin) => {
    state(sh)
    const flagStr = args.filter((a) => a.startsWith('-') && a !== '-').join('')
    if (!flagStr.includes('d')) return baseLs(sh, args, stdin)
    const long = flagStr.includes('l')
    const operands = args.filter((a) => !a.startsWith('-') || a === '-')
    let out = ''
    let err = ''
    for (const t of operands.length ? operands : ['.']) {
      const abs = sh.path(t)
      const n = sh.vfs.get(abs)
      if (!n) { err += `ls: cannot access '${t}': No such file or directory\n`; continue }
      if (!long) { out += t + '\n'; continue }
      if (n.type !== 'dir') { out += baseLs(sh, ['-l', t], stdin).out; continue }
      const name = abs === '/' ? '.' : abs.split('/').pop()!
      const listing = baseLs(sh, ['-la', abs === '/' ? '/' : dirname(abs)], stdin).out
      const row = listing.split('\n').find((l) => l.endsWith(' ' + name))
      out += (row ? row.slice(0, row.length - name.length) + t : `${t}`) + '\n'
    }
    return { out, err, code: err ? 2 : 0 }
  }

  // Sticky directories: only the file's owner, the directory's owner, or root may remove or rename an entry.
  const stickyBlocked = (sh: Shell, f: string) => {
    const abs = sh.path(f)
    const parent = sh.vfs.get(dirname(abs))
    const n = sh.vfs.get(abs)
    return Boolean(n && parent && parent.mode & 0o1000 && sh.user !== 'root' && n.owner !== sh.user && parent.owner !== sh.user)
  }
  for (const name of ['rm', 'mv'] as const) {
    const orig = base[name]
    base[name] = (sh, args, stdin) => {
      state(sh)
      const files = args.filter((a) => !a.startsWith('-'))
      const targets = name === 'mv' ? files.slice(0, -1) : files
      const blocked = targets.filter((f) => stickyBlocked(sh, f))
      const rest = args.filter((a) => a.startsWith('-') || !blocked.includes(a))
      const r = rest.some((a) => !a.startsWith('-')) ? orig(sh, rest, stdin) : ok()
      if (name === 'mv' && blocked.length && files.length < 2 + blocked.length) return fail(`mv: cannot move '${blocked[0]}': Operation not permitted`)
      for (const f of blocked) r.err += `${name}: cannot ${name === 'rm' ? 'remove' : 'move'} '${f}': Operation not permitted\n`
      if (blocked.length) r.code = 1
      return r
    }
  }

  const baseStat = base.stat
  base.stat = (sh, args) => {
    state(sh)
    const { values, operands } = opts(args, 'c', { format: 'c' })
    const f = operands[0]
    if (!f) return fail("stat: missing operand\nTry 'stat --help' for more information.")
    const n = sh.vfs.get(sh.path(f))
    if (!n) return fail(`stat: cannot statx '${f}': No such file or directory`)
    const uid = userOf(sh, n.owner)?.uid ?? 0
    const gid = groupOf(sh, n.group)?.gid ?? 0
    if (values.c !== undefined) {
      const map: Record<string, string> = { a: (n.mode & 0o7777).toString(8), A: baseStat(sh, [f], '').out.match(/\/(\S{10})\)/)?.[1] ?? '', U: n.owner, G: n.group, u: String(uid), g: String(gid), n: f, F: n.type === 'dir' ? 'directory' : 'regular file', s: String(n.type === 'file' ? n.content.length : 4096) }
      return ok(values.c.replace(/%(.)/g, (m, c) => map[c] ?? m) + '\n')
    }
    const r = baseStat(sh, args, '')
    r.out = r.out.replace(/Uid: \([^)]*\)/, `Uid: (${String(uid).padStart(5)}/${n.owner.padStart(8)})`).replace(/Gid: \([^)]*\)/, `Gid: (${String(gid).padStart(5)}/${n.group.padStart(8)})`)
    return r
  }
}
