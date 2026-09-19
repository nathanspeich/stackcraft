// Simulation module: systemd. Unit files are real files in the virtual filesystem
// (/etc/systemd/system and /lib/systemd/system for the system manager,
// ~/.config/systemd/user for `systemctl --user`). systemctl parses them, runs
// ExecStart through the shell as the unit's user, and keeps unit states, the
// enabled set, and the journal in simState(sh, 'systemd') so checkers can read
// r.state?.sims?.systemd. The built-in ssh, cron, and nginx services stay in
// sh.state.services and are handed to the base systemctl.
import type { CommandTable } from './index'
import { simState } from './index'
import type { Shell } from '../shell'

// Same values as shell.ts exports; kept local because this module is evaluated while shell.ts is still loading.
const HOME = '/home/learner'
const HOSTNAME = 'stackbox'
import type { CmdResult, Command } from '../commands'

/* ---------------- state ---------------- */

export type Scope = 'system' | 'user'

export interface UnitState {
  name: string
  active: 'active' | 'inactive' | 'failed' | 'activating'
  sub: 'running' | 'exited' | 'dead' | 'failed' | 'waiting' | 'auto-restart'
  /** Sim clock (ms) of the last state change. */
  since: number
  /** Main PID while a Type=simple service runs. */
  pid?: number
  /** Last main process: what ran and how it ended. */
  exec?: string
  code?: number
  /** systemd result string: success, exit-code, resources, start-limit-hit. */
  result?: string
  restarts: number
  /** Timers: sim clock of the last and next trigger. */
  lastTrigger?: number
  nextTrigger?: number
  /** Set when the unit failed to load (bad unit file). */
  badSetting?: string
}

export interface JournalLine {
  /** Sim clock (ms). */
  t: number
  scope: Scope
  /** Unit the line belongs to, like backup.service, or '' for general system messages. */
  unit: string
  /** Syslog identifier shown before the PID, like systemd or backup.sh. */
  ident: string
  pid: number
  /** Syslog priority 0..7 (3 err, 4 warning, 5 notice, 6 info). */
  prio: number
  msg: string
  /** Extra catalog text shown by journalctl -x. */
  explain?: string
}

export interface SystemdState {
  /** System-scope units by full name (backup.service, backup.timer). */
  units: Record<string, UnitState>
  /** System-scope units enabled with systemctl enable. */
  enabled: string[]
  /** User-scope (systemctl --user) units and enabled set. */
  user: { units: Record<string, UnitState>; enabled: string[] }
  journal: JournalLine[]
  /** Unit file text as of the last daemon-reload (or first load), keyed "scope/name". */
  loaded: Record<string, string>
  /** Sim clock in ms; advances a little on every systemd command. */
  clock: number
}

/** The simulated machine booted on Mon 2026-09-14 07:26:11 UTC; the clock starts three days later. */
export const BOOT = Date.UTC(2026, 8, 14, 7, 26, 11)
export const CLOCK_START = Date.UTC(2026, 8, 17, 9, 41, 7)
const USER_MANAGER_PID = 1190
/** `since` value of a unit that has never changed state. */
const NEVER = BOOT + 3000

function seedJournal(): JournalLine[] {
  const t = BOOT
  const sys = (msg: string, dt: number, unit = ''): JournalLine => ({ t: t + dt, scope: 'system', unit, ident: 'systemd', pid: 1, prio: 6, msg })
  return [
    { t, scope: 'system', unit: '', ident: 'kernel', pid: 0, prio: 5, msg: 'Linux version 6.8.0-45-generic (buildd@lcy02-amd64-045) (x86_64-linux-gnu-gcc-13)' },
    { t: t + 400, scope: 'system', unit: '', ident: 'kernel', pid: 0, prio: 6, msg: 'virtio_blk virtio1: [vda] 41943040 512-byte logical blocks (21.5 GB/20.0 GiB)' },
    sys('systemd 255.4-1ubuntu8 running in system mode (+PAM +AUDIT +SELINUX +APPARMOR +IMA +SMACK +SECCOMP +GCRYPT -GNUTLS +OPENSSL +ACL +BLKID +CURL +ELFUTILS +FIDO2 +IDN2 -IDN +IPTC +KMOD +LIBCRYPTSETUP +LIBFDISK +PCRE2 -PWQUALITY +P11KIT +QRENCODE +TPM2 +BZIP2 +LZ4 +XZ +ZLIB +ZSTD -BPF_FRAMEWORK -XKBCOMMON +UTMP +SYSVINIT default-hierarchy=unified)', 1200),
    sys('Detected virtualization kvm.', 1250),
    sys(`Hostname set to <${HOSTNAME}>.`, 1300),
    sys('Reached target sysinit.target - System Initialization.', 2100),
    sys('Started cron.service - Regular background program processing daemon.', 2600, 'cron.service'),
    sys('Started ssh.service - OpenBSD Secure Shell server.', 2800, 'ssh.service'),
    sys('Reached target multi-user.target - Multi-User System.', 3000),
    sys('Startup finished in 1.204s (kernel) + 1.921s (userspace) = 3.125s.', 3125),
  ]
}

export function systemdState(sh: Shell): SystemdState {
  const s = simState<Partial<SystemdState>>(sh, 'systemd', () => ({}))
  // Tolerate a lesson seeding only part of the state through machine.sims.systemd.
  s.units ??= {}
  s.enabled ??= []
  s.user ??= { units: {}, enabled: [] }
  s.user.units ??= {}
  s.user.enabled ??= []
  s.journal ??= seedJournal()
  s.loaded ??= {}
  s.clock ??= CLOCK_START
  return s as SystemdState
}

/* ---------------- unit files ---------------- */

const SECTIONS: Record<string, string[]> = {
  Unit: ['Description', 'Documentation', 'After', 'Before', 'Requires', 'Wants', 'Requisite', 'BindsTo', 'PartOf', 'Conflicts', 'Upholds', 'ConditionPathExists', 'ConditionPathIsDirectory', 'StartLimitIntervalSec', 'StartLimitBurst', 'RequiresMountsFor', 'OnFailure', 'DefaultDependencies'],
  Service: ['Type', 'ExecStart', 'ExecStartPre', 'ExecStartPost', 'ExecStop', 'ExecStopPost', 'ExecReload', 'Restart', 'RestartSec', 'User', 'Group', 'WorkingDirectory', 'Environment', 'EnvironmentFile', 'RemainAfterExit', 'TimeoutStartSec', 'TimeoutStopSec', 'TimeoutSec', 'StandardOutput', 'StandardError', 'SyslogIdentifier', 'Nice', 'KillMode', 'KillSignal', 'PIDFile', 'UMask', 'ProtectSystem', 'ProtectHome', 'PrivateTmp', 'NoNewPrivileges', 'ReadWritePaths', 'ReadOnlyPaths', 'LimitNOFILE', 'OOMScoreAdjust', 'SuccessExitStatus', 'RuntimeMaxSec', 'MemoryMax', 'CPUQuota', 'DynamicUser', 'PassEnvironment'],
  Install: ['WantedBy', 'RequiredBy', 'Also', 'Alias', 'DefaultInstance'],
  Timer: ['OnCalendar', 'OnBootSec', 'OnStartupSec', 'OnActiveSec', 'OnUnitActiveSec', 'OnUnitInactiveSec', 'Persistent', 'Unit', 'AccuracySec', 'RandomizedDelaySec', 'WakeSystem', 'RemainAfterElapse', 'FixedRandomDelay'],
}

export interface UnitFile {
  name: string
  path: string
  text: string
  /** Section name to key to every value given (keys may repeat). */
  sections: Record<string, Record<string, string[]>>
  /** Parse-time messages in systemd's own wording, each with the line number when known. */
  problems: { line: number; msg: string }[]
  /** A fatal problem that stops the unit from loading (LoadState bad-setting). */
  fatal?: string
}

const unitType = (name: string) => name.slice(name.lastIndexOf('.') + 1)

export function parseUnitText(name: string, path: string, text: string): UnitFile {
  const uf: UnitFile = { name, path, text, sections: {}, problems: [] }
  let section = ''
  let skipSection = false
  const ls = text.split('\n')
  for (let i = 0; i < ls.length; i++) {
    const raw = ls[i]
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const sec = line.match(/^\[(.*)\]$/)
    if (sec) {
      section = sec[1]
      skipSection = !(section in SECTIONS)
      if (skipSection) uf.problems.push({ line: i + 1, msg: `Unknown section '${section}'. Ignoring.` })
      else uf.sections[section] ??= {}
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 0) { uf.problems.push({ line: i + 1, msg: `Missing '=', ignoring line.` }); continue }
    if (!section) { uf.problems.push({ line: i + 1, msg: `Assignment outside of section. Ignoring.` }); continue }
    if (skipSection) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!SECTIONS[section].includes(key)) {
      const elsewhere = Object.entries(SECTIONS).find(([, keys]) => keys.includes(key))?.[0]
      uf.problems.push({ line: i + 1, msg: `Unknown key name '${key}' in section '${section}', ignoring.${elsewhere ? ` (${key}= belongs in the [${elsewhere}] section.)` : ''}` })
      continue
    }
    ;(uf.sections[section][key] ??= []).push(value)
  }
  const type = unitType(name)
  if (type === 'service') {
    const svc = uf.sections.Service ?? {}
    if (!svc.ExecStart?.length && !svc.ExecStop?.length) uf.fatal = `Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.`
    for (const key of ['ExecStart', 'ExecStartPre', 'ExecStartPost', 'ExecStop', 'ExecReload'] as const) {
      for (const cmd of svc[key] ?? []) {
        const prog = splitCmd(cmd)[0] ?? ''
        if (!prog) uf.fatal ??= `${key}= has no executable. Refusing.`
        else if (!prog.startsWith('/') && prog.includes('/')) uf.fatal ??= `Neither a valid executable name nor an absolute path: ${prog}`
      }
    }
    if (svc.Type?.length && !['simple', 'exec', 'forking', 'oneshot', 'notify', 'notify-reload', 'dbus', 'idle'].includes(last(svc.Type))) uf.problems.push({ line: 0, msg: `Failed to parse service type, ignoring: ${last(svc.Type)}` })
    if (svc.Restart?.length && !['no', 'on-success', 'on-failure', 'on-abnormal', 'on-watchdog', 'on-abort', 'always'].includes(last(svc.Restart))) uf.problems.push({ line: 0, msg: `Failed to parse service restart specifier, ignoring: ${last(svc.Restart)}` })
  }
  if (type === 'timer') {
    const tm = uf.sections.Timer ?? {}
    if (!tm.OnCalendar?.length && !tm.OnBootSec?.length && !tm.OnUnitActiveSec?.length && !tm.OnActiveSec?.length && !tm.OnStartupSec?.length && !tm.OnUnitInactiveSec?.length) uf.fatal = `Timer unit lacks value setting. Refusing.`
    for (const cal of tm.OnCalendar ?? []) if (nextCalendar(cal, CLOCK_START) === null) uf.problems.push({ line: 0, msg: `Failed to parse calendar specification, ignoring: ${cal}` })
    if (tm.OnCalendar?.length && tm.OnCalendar.every((c) => nextCalendar(c, CLOCK_START) === null)) uf.fatal = `Timer unit lacks value setting. Refusing.`
  }
  return uf
}

const last = (a: string[] | undefined) => (a?.length ? a[a.length - 1] : '')
const get = (uf: UnitFile | null, sec: string, key: string) => last(uf?.sections[sec]?.[key])
const getAll = (uf: UnitFile | null, sec: string, key: string) => uf?.sections[sec]?.[key] ?? []
const yes = (v: string) => ['yes', 'true', '1', 'on'].includes(v.toLowerCase())

/** Split an Exec line into words, honouring double and single quotes. */
function splitCmd(cmd: string): string[] {
  const words: string[] = []
  let cur = ''
  let q: string | null = null
  let has = false
  for (const c of cmd) {
    if (q) { if (c === q) q = null; else cur += c; continue }
    if (c === '"' || c === "'") { q = c; has = true; continue }
    if (c === ' ' || c === '\t') { if (has || cur) { words.push(cur); cur = ''; has = false } continue }
    cur += c; has = true
  }
  if (has || cur) words.push(cur)
  return words
}

const unitDir = (scope: Scope) => (scope === 'system' ? '/etc/systemd/system' : `${HOME}/.config/systemd/user`)
const SEARCH_DIRS: Record<Scope, string[]> = { system: ['/etc/systemd/system', '/lib/systemd/system', '/usr/lib/systemd/system'], user: [`${HOME}/.config/systemd/user`, '/usr/lib/systemd/user'] }

/** Timers every Ubuntu box ships with, so list-timers never looks empty. */
const BUILTIN_TIMERS: Record<string, { desc: string; cal: string; activates: string; svcDesc: string; last: number }> = {
  'apt-daily.timer': { desc: 'Daily apt download activities', cal: '*-*-* 6,18:00', activates: 'apt-daily.service', svcDesc: 'Daily apt download activities', last: CLOCK_START - 3.7 * 3600e3 },
  'apt-daily-upgrade.timer': { desc: 'Daily apt upgrade and clean activities', cal: '*-*-* 6:00', activates: 'apt-daily-upgrade.service', svcDesc: 'Daily apt upgrade and clean activities', last: CLOCK_START - 3.4 * 3600e3 },
  'logrotate.timer': { desc: 'Daily rotation of log files', cal: 'daily', activates: 'logrotate.service', svcDesc: 'Rotate log files', last: CLOCK_START - 9.7 * 3600e3 },
  'fstrim.timer': { desc: 'Discard unused filesystem blocks once a week', cal: 'weekly', activates: 'fstrim.service', svcDesc: 'Discard unused filesystem blocks', last: CLOCK_START - 2 * 86400e3 - 9.7 * 3600e3 },
  'man-db.timer': { desc: 'Daily man-db regeneration', cal: 'daily', activates: 'man-db.service', svcDesc: 'Daily man-db regeneration', last: CLOCK_START - 9.7 * 3600e3 },
}

function builtinTimerText(name: string): string {
  const t = BUILTIN_TIMERS[name]
  return `[Unit]\nDescription=${t.desc}\n\n[Timer]\nOnCalendar=${t.cal}\nAccuracySec=1h\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n`
}
function builtinServiceText(name: string): string {
  const base = name.replace(/\.service$/, '')
  const timer = Object.values(BUILTIN_TIMERS).find((t) => t.activates === name)
  if (timer) return `[Unit]\nDescription=${timer.svcDesc}\nDocumentation=man:${base}(8)\n\n[Service]\nType=oneshot\nExecStart=/usr/lib/${base}/${base}\n`
  const texts: Record<string, string> = {
    ssh: `[Unit]\nDescription=OpenBSD Secure Shell server\nDocumentation=man:sshd(8) man:sshd_config(5)\nAfter=network.target auditd.service\nConditionPathExists=!/etc/ssh/sshd_not_to_be_run\n\n[Service]\nEnvironmentFile=-/etc/default/ssh\nExecStartPre=/usr/sbin/sshd -t\nExecStart=/usr/sbin/sshd -D $SSHD_OPTS\nExecReload=/usr/sbin/sshd -t\nExecReload=/bin/kill -HUP $MAINPID\nKillMode=process\nRestart=on-failure\nRestartPreventExitStatus=255\nType=notify\nRuntimeDirectory=sshd\nRuntimeDirectoryMode=0755\n\n[Install]\nWantedBy=multi-user.target\nAlias=sshd.service\n`,
    cron: `[Unit]\nDescription=Regular background program processing daemon\nDocumentation=man:cron(8)\nAfter=remote-fs.target nss-user-lookup.target\n\n[Service]\nEnvironmentFile=-/etc/default/cron\nExecStart=/usr/sbin/cron -f -P $EXTRA_OPTS\nIgnoreSIGPIPE=false\nKillMode=process\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n`,
    nginx: `[Unit]\nDescription=A high performance web server and a reverse proxy server\nDocumentation=man:nginx(8)\nAfter=network.target nss-lookup.target\n\n[Service]\nType=forking\nPIDFile=/run/nginx.pid\nExecStartPre=/usr/sbin/nginx -t -q -g 'daemon on; master_process on;'\nExecStart=/usr/sbin/nginx -g 'daemon on; master_process on;'\nExecReload=/usr/sbin/nginx -g 'daemon on; master_process on;' -s reload\nExecStop=-/sbin/start-stop-daemon --quiet --stop --retry QUIT/5 --pidfile /run/nginx.pid\nTimeoutStopSec=5\nKillMode=mixed\n\n[Install]\nWantedBy=multi-user.target\n`,
  }
  return texts[base] ?? ''
}

type Found =
  | { kind: 'file'; uf: UnitFile; diskText: string; stale: boolean }
  | { kind: 'builtin-service'; base: string; uf: UnitFile }
  | { kind: 'builtin-timer'; uf: UnitFile }

/** Full unit name: "backup" means backup.service. */
export function unitName(raw: string): string {
  return /\.(service|timer|target|socket|mount|path|slice)$/.test(raw) ? raw : raw + '.service'
}

function fileText(sh: Shell, path: string): string | null {
  const n = sh.vfs.get(path)
  return n && n.type === 'file' ? n.content : null
}

/**
 * Find a unit. File units are parsed from the text captured at the last
 * daemon-reload (first use loads them on demand); `stale` means the file on
 * disk has changed since, which real systemd warns about.
 */
function findUnit(sh: Shell, scope: Scope, name: string): Found | null {
  const st = systemdState(sh)
  for (const dir of SEARCH_DIRS[scope]) {
    const path = `${dir}/${name}`
    const diskText = fileText(sh, path)
    if (diskText === null) continue
    const key = `${scope}/${name}`
    if (!(key in st.loaded)) { st.loaded[key] = diskText; logProblems(sh, scope, parseUnitText(name, path, diskText)) }
    const uf = parseUnitText(name, path, st.loaded[key])
    return { kind: 'file', uf, diskText, stale: st.loaded[key] !== diskText }
  }
  if (scope === 'system') {
    if (name in BUILTIN_TIMERS) return { kind: 'builtin-timer', uf: parseUnitText(name, `/lib/systemd/system/${name}`, builtinTimerText(name)) }
    const base = name.replace(/\.service$/, '')
    if (name.endsWith('.service') && base in sh.state.services) return { kind: 'builtin-service', base, uf: parseUnitText(name, `/lib/systemd/system/${name}`, builtinServiceText(name)) }
    const timerSvc = Object.values(BUILTIN_TIMERS).find((t) => t.activates === name)
    if (timerSvc) return { kind: 'builtin-service', base, uf: parseUnitText(name, `/lib/systemd/system/${name}`, builtinServiceText(name)) }
  }
  return null
}

function logProblems(sh: Shell, scope: Scope, uf: UnitFile) {
  for (const p of uf.problems) log(sh, scope, uf.name, 4, `${uf.path}${p.line ? ':' + p.line : ''}: ${p.msg}`)
  if (uf.fatal) {
    log(sh, scope, uf.name, 3, `${uf.name}: ${uf.fatal}`)
    log(sh, scope, uf.name, 3, `${uf.name}: Unit configuration has fatal error, unit will not be started.`)
  }
}

/** List every unit name systemd knows about in a scope: files plus built-ins. */
function allUnitNames(sh: Shell, scope: Scope): string[] {
  const names = new Set<string>()
  for (const dir of SEARCH_DIRS[scope]) {
    const d = sh.vfs.get(dir)
    if (d?.type !== 'dir') continue
    for (const [n, node] of sh.vfs.list(dir)) if (node.type === 'file' && /\.(service|timer)$/.test(n)) names.add(n)
  }
  if (scope === 'system') {
    for (const s of Object.keys(sh.state.services)) names.add(s + '.service')
    for (const [t, v] of Object.entries(BUILTIN_TIMERS)) { names.add(t); names.add(v.activates) }
  }
  return [...names].sort()
}

/* ---------------- clock and formatting ---------------- */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const p2 = (n: number) => String(n).padStart(2, '0')
const fmtTime = (t: number) => { const d = new Date(t); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}` }
/** "Wed 2026-09-17 09:41:07 UTC" */
export const fmtFull = (t: number) => { const d = new Date(t); return `${DAYS[d.getUTCDay()]} ${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${fmtTime(t)} UTC` }
/** "Sep 17 09:41:07" */
const fmtJournal = (t: number) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${fmtTime(t)}` }

/** systemd style time span with at most two units: "2h 15min", "3 days 4h", "45s". */
export function fmtSpan(ms: number): string {
  let s = Math.max(0, Math.round(ms / 1000))
  if (s === 0) return '0s'
  const units: [string, number][] = [['w', 604800], [' day', 86400], ['h', 3600], ['min', 60], ['s', 1]]
  const parts: string[] = []
  for (const [label, size] of units) {
    if (s >= size && parts.length < 2) {
      const n = Math.floor(s / size)
      s -= n * size
      parts.push(label === ' day' ? `${n} day${n === 1 ? '' : 's'}` : label === 'w' ? `${n} week${n === 1 ? '' : 's'}` : `${n}${label}`)
    } else if (parts.length) break
  }
  return parts.join(' ')
}
const ago = (now: number, t: number) => `${fmtSpan(now - t)} ago`

/** "5min", "1h 30min", "30s", "2 days", or a bare number of seconds, to ms. Null if unparsable. */
export function parseSpan(v: string): number | null {
  const s = v.trim()
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) * 1000
  const re = /(\d+(?:\.\d+)?)\s*(usec|us|msec|ms|seconds|second|sec|s|minutes|minute|min|m|hours|hour|hr|h|days|day|d|weeks|week|w)\b/g
  const mult: Record<string, number> = { usec: 0.001, us: 0.001, msec: 1, ms: 1, seconds: 1000, second: 1000, sec: 1000, s: 1000, minutes: 60e3, minute: 60e3, min: 60e3, m: 60e3, hours: 3600e3, hour: 3600e3, hr: 3600e3, h: 3600e3, days: 86400e3, day: 86400e3, d: 86400e3, weeks: 604800e3, week: 604800e3, w: 604800e3 }
  let total = 0
  let matched = ''
  for (const m of s.matchAll(re)) { total += Number(m[1]) * mult[m[2]]; matched += m[0] }
  return matched.replace(/\s/g, '') === s.replace(/\s/g, '') && matched ? total : null
}

/**
 * Next elapse of an OnCalendar= expression after `now`, in ms, or null when the
 * expression is not understood. Handles the shortcuts (minutely, hourly, daily,
 * weekly, monthly, yearly), "*-*-* HH:MM[:SS]", fixed or wildcard dates like
 * "*-*-01" and "2026-12-24", hour lists like "*-*-* 6,18:00", and weekday
 * prefixes "Mon", "Mon..Fri", "Sat,Sun".
 */
export function nextCalendar(spec: string, now: number): number | null {
  const s = spec.trim().toLowerCase()
  const startOfDay = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
  const shortcuts: Record<string, string> = { minutely: '*-*-* *:*:00', hourly: '*-*-* *:00:00', daily: '*-*-* 00:00:00', midnight: '*-*-* 00:00:00', weekly: 'mon *-*-* 00:00:00', monthly: '*-*-01 00:00:00', yearly: '*-01-01 00:00:00', annually: '*-01-01 00:00:00', quarterly: '*-01,04,07,10-01 00:00:00', semiannually: '*-01,07-01 00:00:00' }
  const expr = shortcuts[s] ?? s
  let words = expr.split(/\s+/).filter(Boolean)
  let dows: Set<number> | null = null
  const dowIdx: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  if (words.length && /^[a-z]{3}/.test(words[0])) {
    dows = new Set()
    for (const part of words[0].split(',')) {
      const range = part.match(/^([a-z]{3})[a-z]*(?:\.\.([a-z]{3})[a-z]*)?$/)
      if (!range || !(range[1] in dowIdx) || (range[2] && !(range[2] in dowIdx))) return null
      const a = dowIdx[range[1]]
      const b = range[2] ? dowIdx[range[2]] : a
      for (let d = a; ; d = (d + 1) % 7) { dows.add(d); if (d === b) break }
    }
    words = words.slice(1)
  }
  let date = '*-*-*'
  let time = '00:00:00'
  if (words.length === 2) [date, time] = words
  else if (words.length === 1) { if (words[0].includes(':')) time = words[0]; else date = words[0] }
  else if (words.length > 2) return null
  const field = (v: string, min: number, max: number): number[] | null => {
    if (v === '*') return null
    const out: number[] = []
    for (const part of v.split(',')) {
      const m = part.match(/^(\d+)(?:\.\.(\d+))?(?:\/(\d+))?$/)
      if (!m) return undefined as unknown as null
      const a = Number(m[1]), b = m[2] ? Number(m[2]) : a, step = m[3] ? Number(m[3]) : 1
      if (a < min || b > max || step < 1) return undefined as unknown as null
      for (let x = a; x <= b; x += step) out.push(x)
    }
    return out
  }
  const dm = date.match(/^(\*|[\d,./]+)-(\*|[\d,./]+)-(\*|[\d,./]+)$/)
  if (!dm) return null
  const years = field(dm[1], 1970, 2200), months = field(dm[2], 1, 12), days = field(dm[3], 1, 31)
  const tm = time.match(/^(\*|[\d,./]+):(\*|[\d,./]+)(?::(\*|[\d,./]+))?$/)
  if (!tm) return null
  const hours = field(tm[1], 0, 23), mins = field(tm[2], 0, 59), secs = tm[3] === undefined ? [0] : field(tm[3], 0, 59)
  if ([years, months, days, hours, mins, secs].some((f) => f === undefined)) return null
  const hourList = hours ?? [...Array(24).keys()]
  const minList = mins ?? [...Array(60).keys()]
  const secList = secs ?? [...Array(60).keys()]
  let day = startOfDay(now)
  for (let i = 0; i < 800; i++, day += 86400e3) {
    const d = new Date(day)
    if (dows && !dows.has(d.getUTCDay())) continue
    if (years && !years.includes(d.getUTCFullYear())) continue
    if (months && !months.includes(d.getUTCMonth() + 1)) continue
    if (days && !days.includes(d.getUTCDate())) continue
    for (const h of hourList) for (const mi of minList) for (const se of secList) {
      const t = day + (h * 3600 + mi * 60 + se) * 1000
      if (t > now) return t
    }
  }
  return null
}

/* ---------------- journal ---------------- */

function log(sh: Shell, scope: Scope, unit: string, prio: number, msg: string, explain?: string, ident = 'systemd', pid?: number): JournalLine {
  const st = systemdState(sh)
  const line: JournalLine = { t: st.clock, scope, unit, ident, pid: pid ?? (scope === 'system' ? 1 : USER_MANAGER_PID), prio, msg, explain }
  st.journal.push(line)
  return line
}

const tick = (sh: Shell, ms = 2000) => { systemdState(sh).clock += ms }

/* ---------------- running ExecStart ---------------- */

const SYSTEMD_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

interface ExecOutcome { code: number; out: string; err: string; prog: string; argv: string[]; step?: string; stepErr?: string }

function unitEnvironment(sh: Shell, uf: UnitFile, user: string): { env: Record<string, string>; missingFile?: string } {
  const home = user === 'root' ? '/root' : `/home/${user}`
  const env: Record<string, string> = { PATH: SYSTEMD_PATH, LANG: 'C.UTF-8', HOME: home, USER: user, LOGNAME: user, SHELL: '/bin/bash', INVOCATION_ID: 'a3f1c2d4e5b64f7a8c9d0e1f2a3b4c5d', JOURNAL_STREAM: '8:31245', SYSTEMD_EXEC_PID: '0' }
  for (const f of getAll(uf, 'Service', 'EnvironmentFile')) {
    const optional = f.startsWith('-')
    const path = optional ? f.slice(1) : f
    const text = fileText(sh, sh.path(path))
    if (text === null) { if (optional) continue; return { env, missingFile: path } }
    for (const line of text.split('\n')) {
      const l = line.trim()
      if (!l || l.startsWith('#')) continue
      const eq = l.indexOf('=')
      if (eq < 0) continue
      const key = l.slice(0, eq).trim().replace(/^export\s+/, '')
      env[key] = l.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, '$2')
    }
  }
  for (const e of getAll(uf, 'Service', 'Environment')) {
    for (const pair of splitCmd(e)) {
      const eq = pair.indexOf('=')
      if (eq > 0) env[pair.slice(0, eq)] = pair.slice(eq + 1)
    }
  }
  return { env }
}

function userExists(sh: Shell, user: string): boolean {
  if (user === 'root' || user === 'learner') return true
  const passwd = fileText(sh, '/etc/passwd') ?? ''
  return passwd.split('\n').some((l) => l.split(':')[0] === user)
}

/** Run one Exec line as `user` with `env`. Returns the exit code, output, and any spawn-step failure (EXEC, CHDIR, USER). */
function runExec(sh: Shell, cmdline: string, user: string, env: Record<string, string>, workdir: string): ExecOutcome {
  let line = cmdline.trim()
  let ignoreFail = false
  while (/^[-@+!:]/.test(line)) { if (line[0] === '-') ignoreFail = true; line = line.slice(1) }
  const words = splitCmd(line).map((w) => w.replace(/\$\{(\w+)\}|\$(\w+)/g, (_m, a, b) => env[a ?? b] ?? ''))
  let prog = words[0] ?? ''
  const base = prog.split('/').pop() || prog
  const outcome = (code: number, step?: string, stepErr?: string): ExecOutcome => ({ code, out: '', err: '', prog, argv: words, step, stepErr })
  if (!prog) return outcome(203, 'EXEC', 'No such file or directory')
  if (!userExists(sh, user)) return outcome(217, 'USER', 'No such process')
  if (!prog.startsWith('/')) {
    const found = SYSTEMD_PATH.split(':').map((d) => `${d}/${prog}`).find((p) => sh.vfs.get(p)?.type === 'file')
    if (!found) return outcome(203, 'EXEC', 'No such file or directory')
    prog = found
  }
  const node = sh.vfs.get(prog)
  if (!node || node.type === 'dir') return outcome(203, 'EXEC', 'No such file or directory')
  const savedUser = sh.user
  sh.user = user
  const execOk = sh.canExec(node)
  sh.user = savedUser
  if (!execOk) return outcome(203, 'EXEC', 'Permission denied')
  if (workdir && sh.vfs.get(workdir)?.type !== 'dir') return outcome(200, 'CHDIR', 'No such file or directory')
  // Run it inside a fresh child context, then restore the interactive shell.
  const saved = { user: sh.user, cwd: sh.cwd, env: sh.env, functions: sh.functions, arrays: sh.arrays, opts: sh.opts, traps: sh.traps, frames: sh.localFrames, tty: sh.tty, positional: sh.positional, scriptName: sh.scriptName }
  sh.user = user
  sh.cwd = workdir || (user === 'root' ? '/' : env.HOME)
  sh.env = { ...env, PWD: sh.cwd }
  sh.functions = {}
  sh.arrays = {}
  sh.traps = {}
  sh.localFrames = []
  sh.tty = false
  let res: CmdResult
  try {
    res = sh.execFile(prog, words.slice(1), '')
  } catch (e) {
    res = { out: '', err: `${base}: ${(e as Error).message}\n`, code: 1 }
  } finally {
    sh.user = saved.user; sh.cwd = saved.cwd; sh.env = saved.env; sh.functions = saved.functions; sh.arrays = saved.arrays
    sh.opts = saved.opts; sh.traps = saved.traps; sh.localFrames = saved.frames; sh.tty = saved.tty; sh.positional = saved.positional; sh.scriptName = saved.scriptName
  }
  return { code: ignoreFail ? 0 : res.code, out: res.out, err: res.err, prog, argv: [prog, ...words.slice(1)] }
}

const statusWord = (code: number) => (code === 0 ? '0/SUCCESS' : code === 203 ? '203/EXEC' : code === 217 ? '217/USER' : code === 200 ? '200/CHDIR' : `${code}/${code === 1 ? 'FAILURE' : 'n/a'}`)

const desc = (uf: UnitFile) => get(uf, 'Unit', 'Description')
const title = (uf: UnitFile) => (desc(uf) ? `${uf.name} - ${desc(uf)}` : uf.name)

/** Start a file-backed service: run ExecStartPre and ExecStart, log, and set the state. */
function startService(sh: Shell, scope: Scope, uf: UnitFile, unit: UnitState, attempt = 0): CmdResult {
  const st = systemdState(sh)
  const user = get(uf, 'Service', 'User') || (scope === 'system' ? 'root' : 'learner')
  const type = get(uf, 'Service', 'Type') || 'simple'
  const oneshot = type === 'oneshot'
  const remain = yes(get(uf, 'Service', 'RemainAfterExit') || 'no')
  const restart = get(uf, 'Service', 'Restart') || 'no'
  const restartSec = parseSpan(get(uf, 'Service', 'RestartSec') || '100ms') ?? 100
  const workdir = get(uf, 'Service', 'WorkingDirectory')
  const ident = get(uf, 'Service', 'SyslogIdentifier')
  const failedJob = `Job for ${uf.name} failed because the control process exited with error code.\nSee "systemctl status ${uf.name}" and "journalctl -xeu ${uf.name}" for details.\n`

  if (attempt === 0) log(sh, scope, uf.name, 6, oneshot ? `Starting ${title(uf)}...` : `Started ${title(uf)}.`, oneshot ? undefined : `Subject: A start job for unit ${uf.name} has finished successfully\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nA start job for unit ${uf.name} has finished successfully.\n\nThe job identifier is ${1200 + st.journal.length}.`)
  unit.active = 'activating'; unit.sub = 'running'; unit.since = st.clock; unit.result = undefined

  const { env, missingFile } = unitEnvironment(sh, uf, user)
  if (missingFile) {
    log(sh, scope, uf.name, 3, `${uf.name}: Failed to load environment files: No such file or directory`)
    log(sh, scope, uf.name, 3, `${uf.name}: Failed to run 'start' task: No such file or directory`)
    fail(sh, scope, uf, unit, 'resources', true)
    return { out: '', err: failedJob, code: 1 }
  }

  const pid = sh.nextPid++
  const runOne = (cmdline: string, what: 'ExecStartPre' | 'ExecStart'): ExecOutcome => {
    const o = runExec(sh, cmdline, user, env, workdir)
    const base = o.prog.split('/').pop() || o.prog
    if (o.step) {
      log(sh, scope, uf.name, 3, `${uf.name}: ${o.step === 'EXEC' ? (o.stepErr === 'Permission denied' ? `Failed to execute ${o.prog}` : `Unable to locate executable '${o.prog}'`) : o.step === 'USER' ? 'Failed to determine user credentials' : 'Changing to the requested working directory failed'}: ${o.stepErr}`, undefined, `(${base})`, pid)
      log(sh, scope, uf.name, 3, `${uf.name}: Failed at step ${o.step} spawning ${o.prog}: ${o.stepErr}`, undefined, `(${base})`, pid)
      return o
    }
    for (const l of o.out.replace(/\n$/, '').split('\n')) if (l !== '' || o.out.includes('\n\n')) log(sh, scope, uf.name, 6, l, undefined, ident || base, pid)
    for (const l of o.err.replace(/\n$/, '').split('\n')) if (l !== '') log(sh, scope, uf.name, 6, l, undefined, ident || base, pid)
    void what
    return o
  }

  for (const pre of getAll(uf, 'Service', 'ExecStartPre')) {
    const o = runOne(pre, 'ExecStartPre')
    if (o.code !== 0) {
      log(sh, scope, uf.name, 5, `${uf.name}: Control process exited, code=exited, status=${statusWord(o.code)}`)
      unit.exec = `ExecStartPre=${pre}`; unit.code = o.code
      fail(sh, scope, uf, unit, 'exit-code', true)
      return { out: '', err: failedJob, code: 1 }
    }
  }

  const execs = getAll(uf, 'Service', 'ExecStart')
  let outcome: ExecOutcome = { code: 0, out: '', err: '', prog: '', argv: [] }
  for (const cmd of execs) {
    outcome = runOne(cmd, 'ExecStart')
    unit.exec = `ExecStart=${cmd.replace(/^[-@+!:]+/, '')}`
    unit.code = outcome.code
    if (outcome.code !== 0) break
  }
  unit.pid = pid

  if (outcome.code === 0) {
    if (oneshot) {
      unit.pid = undefined
      if (remain) { unit.active = 'active'; unit.sub = 'exited' }
      else { unit.active = 'inactive'; unit.sub = 'dead'; log(sh, scope, uf.name, 6, `${uf.name}: Deactivated successfully.`) }
      unit.result = 'success'
      log(sh, scope, uf.name, 6, `Finished ${title(uf)}.`, `Subject: A start job for unit ${uf.name} has finished successfully\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nA start job for unit ${uf.name} has finished successfully.\n\nThe job identifier is ${1200 + st.journal.length}.`)
    } else {
      // The sim ran the program to completion; treat it as a daemon that stays up.
      unit.active = 'active'; unit.sub = 'running'; unit.result = 'success'
      const node = sh.vfs.get(outcome.prog)
      const cmd = (node?.type === 'file' && !node.content.startsWith('#!builtin') ? ['/bin/bash', ...outcome.argv] : outcome.argv).join(' ')
      sh.state.processes.push({ pid, user, cmd, cpu: 0.2, mem: 0.4 })
    }
    return { out: '', err: '', code: 0 }
  }

  // Failure.
  log(sh, scope, uf.name, 5, `${uf.name}: Main process exited, code=exited, status=${statusWord(outcome.code)}`)
  const wantRestart = restart === 'always' || restart === 'on-failure' || restart === 'on-abnormal' && outcome.code >= 200
  if (wantRestart) {
    if (attempt >= 2 && restartSec < 10000) {
      log(sh, scope, uf.name, 4, `${uf.name}: Start request repeated too quickly.`)
      fail(sh, scope, uf, unit, 'exit-code', oneshot)
      return oneshot ? { out: '', err: failedJob, code: 1 } : { out: '', err: '', code: 0 }
    }
    log(sh, scope, uf.name, 4, `${uf.name}: Failed with result 'exit-code'.`, `Subject: Unit failed\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nThe unit ${uf.name} has entered the 'failed' state with result 'exit-code'.`)
    unit.restarts++
    log(sh, scope, uf.name, 6, `${uf.name}: Scheduled restart job, restart counter is at ${unit.restarts}.`, `Subject: Automatic restarting of a unit has been scheduled\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nAutomatic restarting of the unit ${uf.name} has been scheduled, as the result for\nthe configured Restart= setting for the unit.`)
    if (restartSec >= 10000) {
      // A long RestartSec: the retry is still pending when the learner looks.
      unit.active = 'activating'; unit.sub = 'auto-restart'; unit.result = 'exit-code'; unit.since = st.clock
      return oneshot ? { out: '', err: failedJob, code: 1 } : { out: '', err: '', code: 0 }
    }
    tick(sh, Math.max(1000, restartSec))
    log(sh, scope, uf.name, 6, `Stopped ${title(uf)}.`)
    log(sh, scope, uf.name, 6, oneshot ? `Starting ${title(uf)}...` : `Started ${title(uf)}.`)
    return startService(sh, scope, uf, unit, attempt + 1)
  }
  fail(sh, scope, uf, unit, 'exit-code', oneshot)
  return oneshot ? { out: '', err: failedJob, code: 1 } : { out: '', err: '', code: 0 }
}

function fail(sh: Shell, scope: Scope, uf: UnitFile, unit: UnitState, result: string, jobFailed: boolean) {
  const st = systemdState(sh)
  unit.active = 'failed'; unit.sub = 'failed'; unit.result = result; unit.since = st.clock; unit.pid = undefined
  log(sh, scope, uf.name, 4, `${uf.name}: Failed with result '${result}'.`, `Subject: Unit failed\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nThe unit ${uf.name} has entered the 'failed' state with result '${result}'.`)
  if (jobFailed) log(sh, scope, uf.name, 3, `Failed to start ${title(uf)}.`, `Subject: A start job for unit ${uf.name} has failed\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nA start job for unit ${uf.name} has finished with a failure.\n\nThe job identifier is ${1200 + st.journal.length} and the job result is failed.`)
}

function stopService(sh: Shell, scope: Scope, uf: UnitFile, unit: UnitState) {
  const st = systemdState(sh)
  if (unit.active === 'active' || unit.active === 'activating') {
    if (unit.sub === 'running') log(sh, scope, uf.name, 6, `Stopping ${title(uf)}...`)
    log(sh, scope, uf.name, 6, `${uf.name}: Deactivated successfully.`)
    log(sh, scope, uf.name, 6, `Stopped ${title(uf)}.`, `Subject: A stop job for unit ${uf.name} has finished\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nA stop job for unit ${uf.name} has finished.\n\nThe job identifier is ${1200 + st.journal.length} and the job result is done.`)
  }
  if (unit.pid) sh.state.processes = sh.state.processes.filter((p) => p.pid !== unit.pid)
  unit.active = 'inactive'; unit.sub = 'dead'; unit.since = st.clock; unit.pid = undefined
}

/* ---------------- timers ---------------- */

function timerNext(sh: Shell, uf: UnitFile, now: number, unit?: UnitState): number | null {
  const cals = getAll(uf, 'Timer', 'OnCalendar').map((c) => nextCalendar(c, now)).filter((t): t is number => t !== null)
  const mono: number[] = []
  const boot = parseSpan(get(uf, 'Timer', 'OnBootSec') || get(uf, 'Timer', 'OnStartupSec') || '')
  if (boot !== null) mono.push(BOOT + boot > now ? BOOT + boot : now + boot)
  const active = parseSpan(get(uf, 'Timer', 'OnActiveSec') || '')
  if (active !== null) mono.push((unit?.since ?? now) + active)
  const unitActive = parseSpan(get(uf, 'Timer', 'OnUnitActiveSec') || get(uf, 'Timer', 'OnUnitInactiveSec') || '')
  if (unitActive !== null) mono.push((unit?.lastTrigger ?? now) + unitActive)
  const all = [...cals, ...mono].filter((t) => t > now)
  void sh
  return all.length ? Math.min(...all) : null
}

const timerTarget = (uf: UnitFile) => get(uf, 'Timer', 'Unit') || uf.name.replace(/\.timer$/, '.service')

/* ---------------- systemctl ---------------- */

interface Opts { scope: Scope; all: boolean; now: boolean; type?: string; state?: string; props: string[]; value: boolean; quiet: boolean; failed: boolean; args: string[] }

function parseOpts(args: string[]): Opts | string {
  const o: Opts = { scope: 'system', all: false, now: false, props: [], value: false, quiet: false, failed: false, args: [] }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--user') o.scope = 'user'
    else if (a === '--system') o.scope = 'system'
    else if (a === '--all' || a === '-a') o.all = true
    else if (a === '--now') o.now = true
    else if (a === '--failed') o.failed = true
    else if (a === '--value') o.value = true
    else if (a === '-q' || a === '--quiet') o.quiet = true
    else if (a === '--no-pager' || a === '--no-block' || a === '-l' || a === '--full' || a === '--no-legend' || a === '--plain' || a === '--no-reload' || a === '--wait' || a === '--no-ask-password') continue
    else if (a.startsWith('--type=') || a === '-t' || a === '--type') o.type = a.includes('=') ? a.split('=')[1] : args[++i]
    else if (a.startsWith('--state=') || a === '--state') o.state = a.includes('=') ? a.split('=')[1] : args[++i]
    else if (a.startsWith('--property=') || a === '-p' || a === '--property') o.props.push(...(a.includes('=') ? a.split('=')[1] : args[++i] ?? '').split(','))
    else if (a.startsWith('-n')) continue
    else if (a.startsWith('-')) return `systemctl: invalid option -- '${a.replace(/^-+/, '')}'`
    else o.args.push(a)
  }
  return o
}

const ok = (out = ''): CmdResult => ({ out, err: '', code: 0 })
const err = (msg: string, code = 1): CmdResult => ({ out: '', err: msg.endsWith('\n') ? msg : msg + '\n', code })

function accessDenied(verb: string, name: string): CmdResult {
  if (verb === 'enable' || verb === 'disable') return err(`Failed to ${verb} unit: Access denied`)
  if (verb === 'daemon-reload') return err('Failed to reload daemon: Access denied')
  if (verb === 'reset-failed') return err(`Failed to reset failed state of unit ${name}: Access denied`)
  return err(`Failed to ${verb} ${name}: Access denied\nSee system logs and 'systemctl status ${name}' for details.`)
}

const notFound = (name: string) => err(`Unit ${name} could not be found.`, 4)
const staleWarning = (name: string) => `Warning: The unit file, source configuration file or drop-ins of ${name} changed on disk. Run 'systemctl daemon-reload' to reload units.\n`

function unitState(st: SystemdState, scope: Scope, name: string): UnitState {
  const units = scope === 'system' ? st.units : st.user.units
  return (units[name] ??= { name, active: 'inactive', sub: 'dead', since: NEVER, restarts: 0 })
}
const enabledList = (st: SystemdState, scope: Scope) => (scope === 'system' ? st.enabled : st.user.enabled)

/** Where enable would put the symlink. */
function wantsDir(scope: Scope, uf: UnitFile): string | null {
  const target = get(uf, 'Install', 'WantedBy') || get(uf, 'Install', 'RequiredBy')
  if (!target) return null
  const kind = get(uf, 'Install', 'WantedBy') ? 'wants' : 'requires'
  return `${unitDir(scope)}/${target}.${kind}`
}

function statusOf(sh: Shell, scope: Scope, found: Found, name: string): CmdResult {
  const st = systemdState(sh)
  const now = st.clock
  const uf = found.uf
  const unit = found.kind === 'builtin-timer' ? { name, active: 'active', sub: 'waiting', since: BOOT + 2900, restarts: 0, lastTrigger: BUILTIN_TIMERS[name].last } as UnitState : unitState(st, scope, name)
  const enabled = found.kind !== 'file' ? 'enabled' : enabledList(st, scope).includes(name) ? 'enabled' : wantsDir(scope, uf) ? 'disabled' : 'static'
  const dot = unit.active === 'active' ? '●' : unit.active === 'failed' ? '×' : unit.active === 'activating' ? '↻' : '○'
  const stale = found.kind === 'file' && found.stale ? staleWarning(name) : ''
  let out = ''
  out += `${dot} ${title(uf)}\n`
  if (uf.fatal) out += `     Loaded: bad-setting (Reason: Unit ${name} has a bad unit file setting.)\n`
  else out += `     Loaded: loaded (${uf.path}; ${enabled}; preset: enabled)\n`
  const activeLine = unit.active === 'failed' ? `failed (Result: ${unit.result ?? 'exit-code'})` : unit.active === 'activating' ? `activating (${unit.sub}) (Result: ${unit.result ?? 'exit-code'})` : `${unit.active} (${unit.sub})`
  out += `     Active: ${activeLine}${unit.since === NEVER ? '' : ` since ${fmtFull(unit.since)}; ${ago(now, unit.since)}`}\n`
  if (name.endsWith('.timer')) {
    const next = found.kind === 'builtin-timer' ? nextCalendar(BUILTIN_TIMERS[name].cal, now) : unit.active === 'active' ? timerNext(sh, uf, now, unit) : null
    out += `    Trigger: ${next ? `${fmtFull(next)}; ${fmtSpan(next - now)} left` : 'n/a'}\n`
    const target = timerTarget(uf)
    const tstate = scope === 'system' && found.kind === 'builtin-timer' ? 'inactive' : (unitState(st, scope, target).active)
    out += `   Triggers: ${tstate === 'active' ? '●' : tstate === 'failed' ? '×' : '○'} ${target}\n`
  } else if (found.kind === 'file') {
    const docs = get(uf, 'Unit', 'Documentation')
    if (docs) out += `       Docs: ${docs}\n`
    const timers = Object.keys(scope === 'system' ? st.units : st.user.units).filter((n) => n.endsWith('.timer') && timerTarget(parseUnitText(n, '', st.loaded[`${scope}/${n}`] ?? '')) === name)
    for (const t of timers) out += `TriggeredBy: ${unitState(st, scope, t).active === 'active' ? '●' : '○'} ${t}\n`
    if (unit.exec && unit.code !== undefined && !(unit.active === 'active' && unit.sub === 'running')) out += `    Process: ${unit.pid ?? sh.nextPid - 1} ${unit.exec} (code=exited, status=${statusWord(unit.code)})\n`
    if (unit.active === 'active' && unit.sub === 'running' && unit.pid) {
      const proc = sh.state.processes.find((p) => p.pid === unit.pid)
      const words = proc?.cmd.split(' ') ?? [name]
      const comm = (words[0] === '/bin/bash' && words[1] ? words[1] : words[0]).split('/').pop()
      out += `   Main PID: ${unit.pid} (${comm})\n      Tasks: 1 (limit: 4556)\n     Memory: 1.2M (peak: 1.5M)\n        CPU: 14ms\n     CGroup: /${scope}.slice/${name}\n             └─${unit.pid} ${proc?.cmd ?? ''}\n`
    } else if (unit.code !== undefined) out += `   Main PID: ${unit.pid ?? sh.nextPid - 1} (code=exited, status=${statusWord(unit.code)})\n        CPU: 14ms\n`
  }
  const lines = st.journal.filter((l) => l.scope === scope && l.unit === name).slice(-10)
  if (lines.length) out += '\n' + lines.map(fmtLine).join('\n') + '\n'
  return { out: stale + out, err: '', code: unit.active === 'active' ? 0 : 3 }
}

const fmtLine = (l: JournalLine) => `${fmtJournal(l.t)} ${HOSTNAME} ${l.ident}[${l.pid}]: ${l.msg}`

function listUnits(sh: Shell, o: Opts): CmdResult {
  const st = systemdState(sh)
  const rows: { name: string; load: string; active: string; sub: string; desc: string }[] = []
  for (const name of allUnitNames(sh, o.scope)) {
    const f = findUnit(sh, o.scope, name)
    if (!f) continue
    if (o.type && unitType(name) !== o.type) continue
    let active: string, sub: string
    if (f.kind === 'builtin-service') {
      const s = sh.state.services[f.base]
      if (s) { active = s; sub = s === 'active' ? 'running' : s === 'failed' ? 'failed' : 'dead' } else { active = 'inactive'; sub = 'dead' }
    } else if (f.kind === 'builtin-timer') { active = 'active'; sub = 'waiting' } else { const u = unitState(st, o.scope, name); active = u.active; sub = u.sub }
    if (o.failed || o.state === 'failed') { if (active !== 'failed') continue }
    else if (o.state && o.state !== active && o.state !== sub) continue
    else if (!o.all && active === 'inactive') continue
    rows.push({ name, load: f.uf.fatal ? 'bad-setting' : 'loaded', active, sub, desc: desc(f.uf) || name })
  }
  if (!rows.length && (o.failed || o.state === 'failed')) return ok(`  UNIT LOAD ACTIVE SUB DESCRIPTION\n0 loaded units listed.\n`)
  const w = Math.max(4, ...rows.map((r) => r.name.length))
  const wl = Math.max(6, ...rows.map((r) => r.load.length)), wa = Math.max(6, ...rows.map((r) => r.active.length)), ws = Math.max(7, ...rows.map((r) => r.sub.length))
  let out = `  ${'UNIT'.padEnd(w)} ${'LOAD'.padEnd(wl)} ${'ACTIVE'.padEnd(wa)} ${'SUB'.padEnd(ws)} DESCRIPTION\n`
  for (const r of rows) out += `${r.active === 'failed' ? '●' : ' '} ${r.name.padEnd(w)} ${r.load.padEnd(wl)} ${r.active.padEnd(wa)} ${r.sub.padEnd(ws)} ${r.desc}\n`
  out += `\nLegend: LOAD   → Reflects whether the unit definition was properly loaded.\n        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.\n        SUB    → The low-level unit activation state, values depend on unit type.\n\n${rows.length} loaded units listed.${o.all ? '' : ' Pass --all to see loaded but inactive units, too.'}\n${o.all ? '' : "To show all installed unit files use 'systemctl list-unit-files'.\n"}`
  return ok(out)
}

function listUnitFiles(sh: Shell, o: Opts): CmdResult {
  const st = systemdState(sh)
  const rows: [string, string][] = []
  for (const name of allUnitNames(sh, o.scope)) {
    if (o.type && unitType(name) !== o.type) continue
    const f = findUnit(sh, o.scope, name)
    if (!f) continue
    const state = f.kind !== 'file' ? (name.endsWith('.timer') || name in sh.state.services ? 'enabled' : 'static') : enabledList(st, o.scope).includes(name) ? 'enabled' : wantsDir(o.scope, f.uf) ? 'disabled' : 'static'
    rows.push([name, state])
  }
  const w = Math.max(9, ...rows.map((r) => r[0].length))
  return ok(`${'UNIT FILE'.padEnd(w)} ${'STATE'.padEnd(9)} PRESET\n${rows.map(([n, s]) => `${n.padEnd(w)} ${s.padEnd(9)} enabled`).join('\n')}\n\n${rows.length} unit files listed.\n`)
}

function listTimers(sh: Shell, o: Opts): CmdResult {
  const st = systemdState(sh)
  const now = st.clock
  const rows: { next: number | null; last: number | null; unit: string; activates: string }[] = []
  for (const name of allUnitNames(sh, o.scope)) {
    if (!name.endsWith('.timer')) continue
    const f = findUnit(sh, o.scope, name)
    if (!f) continue
    if (f.kind === 'builtin-timer') { rows.push({ next: nextCalendar(BUILTIN_TIMERS[name].cal, now), last: BUILTIN_TIMERS[name].last, unit: name, activates: BUILTIN_TIMERS[name].activates }); continue }
    const u = unitState(st, o.scope, name)
    if (u.active !== 'active' && !o.all) continue
    rows.push({ next: u.active === 'active' ? timerNext(sh, f.uf, now, u) : null, last: u.lastTrigger ?? null, unit: name, activates: timerTarget(f.uf) })
  }
  rows.sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity))
  const cells = rows.map((r) => [r.next ? fmtFull(r.next) : '-', r.next ? `${fmtSpan(r.next - now)} left` : '-', r.last ? fmtFull(r.last) : '-', r.last ? ago(now, r.last) : '-', r.unit, r.activates])
  const heads = ['NEXT', 'LEFT', 'LAST', 'PASSED', 'UNIT', 'ACTIVATES']
  const widths = heads.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)))
  const fmt = (c: string[]) => c.map((v, i) => (i === 1 || i === 3 ? v.padStart(widths[i]) : v.padEnd(widths[i]))).join(' ').trimEnd()
  return ok(`${fmt(heads)}\n${cells.map(fmt).join('\n')}${cells.length ? '\n' : ''}\n${rows.length} timers listed.${o.all ? '' : '\nPass --all to see loaded but inactive timers, too.'}\n`)
}

function showProps(sh: Shell, scope: Scope, found: Found, name: string, o: Opts): CmdResult {
  const st = systemdState(sh)
  const uf = found.uf
  const unit = found.kind === 'builtin-timer' ? { name, active: 'active', sub: 'waiting', since: BOOT, restarts: 0 } as UnitState : found.kind === 'builtin-service' ? { name, active: sh.state.services[found.base] ?? 'inactive', sub: sh.state.services[found.base] === 'active' ? 'running' : 'dead', since: BOOT, restarts: 0, pid: sh.state.services[found.base] === 'active' ? 1450 : undefined } as UnitState : unitState(st, scope, name)
  const enabled = found.kind !== 'file' ? 'enabled' : enabledList(st, scope).includes(name) ? 'enabled' : wantsDir(scope, uf) ? 'disabled' : 'static'
  const next = name.endsWith('.timer') && unit.active === 'active' ? (found.kind === 'builtin-timer' ? nextCalendar(BUILTIN_TIMERS[name].cal, st.clock) : timerNext(sh, uf, st.clock, unit)) : null
  const props: Record<string, string> = {
    Id: name, Names: name, Description: desc(uf) || name, LoadState: uf.fatal ? 'bad-setting' : 'loaded', ActiveState: unit.active, SubState: unit.sub, UnitFileState: enabled, UnitFilePreset: 'enabled',
    FragmentPath: uf.path, MainPID: String(unit.pid ?? 0), ExecMainStatus: String(unit.code ?? 0), ExecMainCode: unit.code === undefined ? '0' : '1', Result: unit.result ?? 'success', NRestarts: String(unit.restarts),
    Type: get(uf, 'Service', 'Type') || 'simple', Restart: get(uf, 'Service', 'Restart') || 'no', RestartUSec: get(uf, 'Service', 'RestartSec') || '100ms', User: get(uf, 'Service', 'User'), Group: get(uf, 'Service', 'Group'),
    WorkingDirectory: get(uf, 'Service', 'WorkingDirectory'), Environment: getAll(uf, 'Service', 'Environment').join(' '), EnvironmentFiles: getAll(uf, 'Service', 'EnvironmentFile').map((f) => `${f.replace(/^-/, '')} (ignore_errors=${f.startsWith('-') ? 'yes' : 'no'})`).join(' '),
    ExecStart: getAll(uf, 'Service', 'ExecStart').map((c) => `{ path=${splitCmd(c)[0] ?? ''} ; argv[]=${c} ; ignore_errors=no }`).join(' '), RemainAfterExit: yes(get(uf, 'Service', 'RemainAfterExit') || 'no') ? 'yes' : 'no',
    After: getAll(uf, 'Unit', 'After').join(' '), Before: getAll(uf, 'Unit', 'Before').join(' '), Requires: getAll(uf, 'Unit', 'Requires').join(' '), Wants: getAll(uf, 'Unit', 'Wants').join(' '), WantedBy: getAll(uf, 'Install', 'WantedBy').join(' ') || (found.kind !== 'file' ? 'multi-user.target' : ''),
    ActiveEnterTimestamp: unit.active === 'active' ? fmtFull(unit.since) : '', InactiveEnterTimestamp: unit.active !== 'active' ? fmtFull(unit.since) : '', StateChangeTimestamp: fmtFull(unit.since),
    TimersCalendar: getAll(uf, 'Timer', 'OnCalendar').map((c) => `{ OnCalendar=${c} ; next_elapse=${next ? fmtFull(next) : 'n/a'} }`).join(' '), NextElapseUSecRealtime: next ? fmtFull(next) : 'n/a', LastTriggerUSec: unit.lastTrigger ? fmtFull(unit.lastTrigger) : 'n/a', Persistent: yes(get(uf, 'Timer', 'Persistent') || 'no') ? 'yes' : 'no', Unit: name.endsWith('.timer') ? timerTarget(uf) : '', Triggers: name.endsWith('.timer') ? timerTarget(uf) : '',
  }
  const wanted = o.props.length ? o.props : ['Id', 'Description', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'FragmentPath', 'MainPID', 'ExecMainStatus', 'Result', 'NRestarts', 'Type', 'Restart', 'User', 'ExecStart', 'After', 'Requires', 'Wants', 'WantedBy']
  let out = ''
  for (const p of wanted) {
    if (!(p in props)) { if (o.props.length) continue; else continue }
    out += o.value ? `${props[p]}\n` : `${p}=${props[p]}\n`
  }
  return ok(out)
}

function catUnit(sh: Shell, scope: Scope, name: string): CmdResult {
  const f = findUnit(sh, scope, name)
  if (!f) return err(`No files found for ${name}.`, 1)
  const text = f.kind === 'file' ? f.diskText : f.uf.text
  return ok(`# ${f.uf.path}\n${text}${text.endsWith('\n') ? '' : '\n'}`)
}

function listDependencies(sh: Shell, scope: Scope, found: Found, name: string): CmdResult {
  const st = systemdState(sh)
  const uf = found.uf
  const deps = [...new Set([...getAll(uf, 'Unit', 'Requires'), ...getAll(uf, 'Unit', 'Wants'), ...getAll(uf, 'Unit', 'After')].flatMap((v) => v.split(/\s+/)).filter(Boolean))]
  const implicit = scope === 'system' ? ['system.slice', 'sysinit.target'] : ['app.slice', 'basic.target']
  const all = [...deps, ...implicit.filter((d) => !deps.includes(d))]
  const mark = (d: string) => { const u = (scope === 'system' ? st.units : st.user.units)[d]; return d.endsWith('.target') || d.endsWith('.slice') ? '●' : u ? (u.active === 'active' ? '●' : u.active === 'failed' ? '×' : '○') : '○' }
  return ok(`${name}\n${all.map((d, i) => `${mark(d)} ${i === all.length - 1 ? '└─' : '├─'}${d}`).join('\n')}\n`)
}

function daemonReload(sh: Shell, scope: Scope): CmdResult {
  const st = systemdState(sh)
  for (const key of Object.keys(st.loaded)) if (key.startsWith(scope + '/')) delete st.loaded[key]
  for (const dir of SEARCH_DIRS[scope]) {
    const d = sh.vfs.get(dir)
    if (d?.type !== 'dir') continue
    for (const [n, node] of sh.vfs.list(dir)) {
      if (node.type !== 'file' || !/\.(service|timer)$/.test(n)) continue
      const key = `${scope}/${n}`
      if (key in st.loaded) continue
      st.loaded[key] = node.content
      const uf = parseUnitText(n, `${dir}/${n}`, node.content)
      logProblems(sh, scope, uf)
      const u = (scope === 'system' ? st.units : st.user.units)[n]
      if (u) u.badSetting = uf.fatal
    }
  }
  log(sh, scope, '', 6, 'Reloading requested from client PID ' + (sh.nextPid++) + " ('systemctl')...")
  log(sh, scope, '', 6, 'Reloading...')
  log(sh, scope, '', 6, 'Reloading finished in 212 ms.')
  return ok()
}

function ensureLayout(sh: Shell) {
  for (const d of ['/etc/systemd/system', '/lib/systemd/system']) {
    if (!sh.vfs.get(d)) sh.vfs.mkdir(d, { parents: true, owner: 'root' })
  }
  for (const d of ['/etc/systemd', '/etc/systemd/system', '/lib/systemd', '/lib/systemd/system']) {
    const n = sh.vfs.get(d)
    if (n?.type === 'dir' && n.owner !== 'root') { n.owner = 'root'; n.group = 'root' }
  }
}

function systemctl(sh: Shell, args: string[], base: Command, stdin: string): CmdResult {
  ensureLayout(sh)
  const st = systemdState(sh)
  tick(sh)
  const parsed = parseOpts(args)
  if (typeof parsed === 'string') return err(parsed)
  const o = parsed
  const scope = o.scope
  const [verb, ...rest] = o.args
  if (!verb || verb === 'list-units') return listUnits(sh, o)
  if (verb === 'list-unit-files') return listUnitFiles(sh, o)
  if (verb === 'list-timers') return listTimers(sh, o)
  if (verb === 'daemon-reload') {
    if (scope === 'system' && sh.user !== 'root') return accessDenied('daemon-reload', '')
    return daemonReload(sh, scope)
  }
  if (verb === 'daemon-reexec') return ok()
  if (verb === 'edit') return err(`systemctl edit opens an editor, which this terminal cannot do. Edit the unit file directly (here, in the editor pane; on a real machine with sudo nano /etc/systemd/system/${rest[0] ? unitName(rest[0]) : 'NAME.service'}), then run: sudo systemctl daemon-reload`)
  if (verb === 'status' && !rest.length) {
    const units = Object.values(scope === 'system' ? st.units : st.user.units)
    const failed = units.filter((u) => u.active === 'failed').length + (scope === 'system' ? Object.values(sh.state.services).filter((s) => s === 'failed').length : 0)
    return ok(`● ${HOSTNAME}\n    State: ${failed ? 'degraded' : 'running'}\n    Units: ${186 + units.length} loaded (incl. loaded aliases)\n     Jobs: 0 queued\n   Failed: ${failed} units\n    Since: ${fmtFull(BOOT)}; ${ago(st.clock, BOOT)}\n  systemd: 255.4-1ubuntu8\n   CGroup: /\n           ├─init.scope\n           │ └─1 /sbin/init\n           └─system.slice\n             ├─cron.service\n             │ └─620 /usr/sbin/cron -f\n             └─ssh.service\n               └─412 "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups"\n`)
  }
  if (verb === 'is-system-running') return ok('running\n')
  if (!rest.length) return err(`systemctl: missing unit name after '${verb}'`)

  const VERBS = ['status', 'start', 'stop', 'restart', 'try-restart', 'reload', 'reload-or-restart', 'enable', 'disable', 'is-active', 'is-enabled', 'is-failed', 'cat', 'show', 'list-dependencies', 'reset-failed', 'kill', 'mask', 'unmask']
  if (!VERBS.includes(verb)) return err(`Unknown command verb ${verb}.`)
  if (verb === 'mask' || verb === 'unmask') return err(`systemctl ${verb} is not simulated here. Use disable to stop a unit from starting at boot.`)
  const results: CmdResult[] = []
  for (const raw of rest) results.push(oneUnit(sh, scope, verb, unitName(raw), o, base, args, stdin))
  return { out: results.map((r) => r.out).join(''), err: results.map((r) => r.err).join(''), code: Math.max(...results.map((r) => r.code)) }
}

function oneUnit(sh: Shell, scope: Scope, verb: string, name: string, o: Opts, base: Command, rawArgs: string[], stdin: string): CmdResult {
  const st = systemdState(sh)
  const found = findUnit(sh, scope, name)
  if (!found) {
    if (verb === 'is-active' || verb === 'is-failed') return { out: o.quiet ? '' : 'inactive\n', err: '', code: verb === 'is-active' ? 3 : 1 }
    if (verb === 'is-enabled') return err(`Failed to get unit file state for ${name}: No such file or directory`)
    if (verb === 'cat') return err(`No files found for ${name}.`)
    if (verb === 'show') return ok(`LoadState=not-found\nActiveState=inactive\nSubState=dead\nUnitFileState=\nId=${name}\nDescription=${name}\n`)
    if (verb === 'status') return notFound(name)
    if (verb === 'reset-failed') return notFound(name)
    if (verb === 'enable' || verb === 'disable') return err(`Failed to ${verb} unit: Unit file ${name} does not exist.`)
    if (['start', 'stop', 'restart', 'reload', 'try-restart', 'reload-or-restart'].includes(verb)) {
      if (scope === 'system' && sh.user !== 'root') return accessDenied(verb, name)
      return err(`Failed to ${verb} ${name}: Unit ${name} not found.`, 5)
    }
    return err(`Unknown command verb ${verb}.`)
  }

  // Built-in services (ssh, cron, nginx) live in sh.state.services and are handled by the base command.
  if (found.kind === 'builtin-service' && found.base in sh.state.services) {
    if (verb === 'cat') return catUnit(sh, scope, name)
    if (verb === 'show') return showProps(sh, scope, found, name, o)
    if (verb === 'list-dependencies') return listDependencies(sh, scope, found, name)
    if (verb === 'is-failed') return { out: sh.state.services[found.base] + '\n', err: '', code: sh.state.services[found.base] === 'failed' ? 0 : 1 }
    if (verb === 'reset-failed') { if (sh.user !== 'root') return accessDenied(verb, name); if (sh.state.services[found.base] === 'failed') sh.state.services[found.base] = 'inactive'; return ok() }
    // Their journal stays with the base command (syslog), so Tier 1 lessons see what they expect.
    return base(sh, rawArgs.filter((a) => !['--now', '--user', '--system', '--no-pager', '-q', '--quiet'].includes(a)), stdin)
  }
  if (found.kind === 'builtin-timer' || found.kind === 'builtin-service') {
    if (verb === 'status') return statusOf(sh, scope, found, name)
    if (verb === 'cat') return catUnit(sh, scope, name)
    if (verb === 'show') return showProps(sh, scope, found, name, o)
    if (verb === 'is-active') return { out: found.kind === 'builtin-timer' ? 'active\n' : 'inactive\n', err: '', code: found.kind === 'builtin-timer' ? 0 : 3 }
    if (verb === 'is-enabled') return ok(found.kind === 'builtin-timer' ? 'enabled\n' : 'static\n')
    if (verb === 'is-failed') return { out: 'inactive\n', err: '', code: 1 }
    if (verb === 'list-dependencies') return listDependencies(sh, scope, found, name)
    if (scope === 'system' && sh.user !== 'root') return accessDenied(verb, name)
    return ok()
  }

  const uf = found.uf
  const unit = unitState(st, scope, name)
  const isTimer = name.endsWith('.timer')
  const readOnly = ['status', 'is-active', 'is-enabled', 'is-failed', 'cat', 'show', 'list-dependencies']
  if (!readOnly.includes(verb) && scope === 'system' && sh.user !== 'root') return accessDenied(verb, name)

  switch (verb) {
    case 'status': return statusOf(sh, scope, found, name)
    case 'cat': return catUnit(sh, scope, name)
    case 'show': return showProps(sh, scope, found, name, o)
    case 'list-dependencies': return listDependencies(sh, scope, found, name)
    case 'is-active': return { out: o.quiet ? '' : unit.active + '\n', err: '', code: unit.active === 'active' ? 0 : 3 }
    case 'is-failed': return { out: o.quiet ? '' : unit.active + '\n', err: '', code: unit.active === 'failed' ? 0 : 1 }
    case 'is-enabled': {
      const state = enabledList(st, scope).includes(name) ? 'enabled' : wantsDir(scope, uf) ? 'disabled' : 'static'
      return { out: o.quiet ? '' : state + '\n', err: '', code: state === 'disabled' ? 1 : 0 }
    }
    case 'reset-failed': {
      if (unit.active === 'failed' || unit.active === 'activating') { unit.active = 'inactive'; unit.sub = 'dead'; unit.since = st.clock; unit.result = undefined }
      unit.restarts = 0
      return ok()
    }
    case 'enable': case 'disable': {
      const dir = wantsDir(scope, uf)
      if (!dir) return err(`The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,\nAlso=, or Alias= settings in the [Install] section, and DefaultInstance= for\ntemplate units). This means they are not meant to be enabled or disabled using systemctl.\n\nPossible reasons for having these kinds of units are:\n• A unit may be statically enabled by being symlinked from another unit's\n  .wants/, .requires/, or .upholds/ directory.\n• A unit's purpose may be to act as a helper for some other unit which has\n  a requirement dependency on it.\n• A unit may be started when needed via activation (socket, path, timer,\n  D-Bus, udev, scripted systemctl call, ...).\n• In case of template units, the unit is meant to be enabled with some\n  instance name specified.`)
      const list = enabledList(st, scope)
      const link = `${dir}/${name}`
      let out = ''
      if (verb === 'enable') {
        if (!list.includes(name)) {
          list.push(name)
          sh.vfs.mkdir(dir, { parents: true, owner: 'root' })
          sh.vfs.writeFile(link, uf.text, { owner: 'root' })
          out += `Created symlink ${link} → ${uf.path}.\n`
        }
        if (o.now) { const r = doStart(sh, scope, uf, unit, isTimer, found); return { out: out + r.out, err: r.err, code: r.code } }
        return ok(out)
      }
      if (list.includes(name)) {
        list.splice(list.indexOf(name), 1)
        if (sh.vfs.get(link)) sh.vfs.remove(link)
        out += `Removed "${link}".\n`
      }
      if (o.now) { if (isTimer) stopTimer(sh, scope, uf, unit); else stopService(sh, scope, uf, unit) }
      return ok(out)
    }
    case 'start': return doStart(sh, scope, uf, unit, isTimer, found)
    case 'stop': {
      if (isTimer) stopTimer(sh, scope, uf, unit); else stopService(sh, scope, uf, unit)
      return ok(found.stale ? staleWarning(name) : '')
    }
    case 'restart': case 'try-restart': case 'reload-or-restart': {
      if (verb === 'try-restart' && unit.active !== 'active') return ok()
      if (isTimer) stopTimer(sh, scope, uf, unit); else stopService(sh, scope, uf, unit)
      tick(sh, 500)
      return doStart(sh, scope, uf, unit, isTimer, found)
    }
    case 'reload': {
      if (unit.active !== 'active') return err(`Failed to reload ${name}: Unit ${name} is not active, cannot reload.`)
      if (!get(uf, 'Service', 'ExecReload')) return err(`Failed to reload ${name}: Job type reload is not applicable for unit ${name}.\nSee system logs and 'systemctl status ${name}' for details.`)
      log(sh, scope, name, 6, `Reloading ${title(uf)}...`); log(sh, scope, name, 6, `Reloaded ${title(uf)}.`)
      return ok()
    }
    case 'kill': return ok()
    default: return err(`Unknown command verb ${verb}.`)
  }
}

function doStart(sh: Shell, scope: Scope, uf: UnitFile, unit: UnitState, isTimer: boolean, found: Found): CmdResult {
  const st = systemdState(sh)
  const name = uf.name
  const warn = found.kind === 'file' && found.stale ? staleWarning(name) : ''
  if (uf.fatal) {
    return { out: warn, err: `Failed to start ${name}: Unit ${name} has a bad unit file setting.\nSee system logs and 'systemctl status ${name}' for details.\n`, code: 1 }
  }
  if (isTimer) {
    const target = timerTarget(uf)
    const tf = findUnit(sh, scope, target)
    if (!tf) {
      log(sh, scope, name, 3, `${name}: Refusing to start, unit ${target} to trigger not loaded.`)
      return { out: warn, err: `Failed to start ${name}: Unit ${target} not found.\n`, code: 5 }
    }
    if (unit.active === 'active') return ok(warn)
    const next = timerNext(sh, uf, st.clock, unit)
    if (next === null) {
      log(sh, scope, name, 3, `${name}: Timer unit lacks value setting. Refusing.`)
      return { out: warn, err: `Failed to start ${name}: Unit ${name} has a bad unit file setting.\n`, code: 1 }
    }
    unit.active = 'active'; unit.sub = 'waiting'; unit.since = st.clock; unit.nextTrigger = next; unit.result = 'success'
    log(sh, scope, name, 6, `Started ${title(uf)}.`, `Subject: A start job for unit ${name} has finished successfully\nDefined-By: systemd\nSupport: http://www.ubuntu.com/support\n\nA start job for unit ${name} has finished successfully.`)
    return ok(warn)
  }
  if (unit.active === 'active' && unit.sub === 'running') return ok(warn)
  const r = startService(sh, scope, uf, unit)
  return { ...r, out: warn + r.out }
}

function stopTimer(sh: Shell, scope: Scope, uf: UnitFile, unit: UnitState) {
  const st = systemdState(sh)
  if (unit.active === 'active') log(sh, scope, uf.name, 6, `Stopped ${title(uf)}.`)
  unit.active = 'inactive'; unit.sub = 'dead'; unit.since = st.clock; unit.nextTrigger = undefined
}

/* ---------------- journalctl ---------------- */

const PRIO: Record<string, number> = { emerg: 0, alert: 1, crit: 2, err: 3, error: 3, warning: 4, warn: 4, notice: 5, info: 6, debug: 7 }

function parseSince(v: string, now: number): number | null {
  const s = v.trim().toLowerCase()
  const day = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
  if (s === 'today') return day(now)
  if (s === 'yesterday') return day(now) - 86400e3
  if (s === 'now') return now
  const rel = s.match(/^(?:-|(.+?)\s+ago)$/)
  if (rel) { const span = parseSpan(rel[1] ?? s.slice(1)); return span === null ? null : now - span }
  if (s.startsWith('-')) { const span = parseSpan(s.slice(1)); return span === null ? null : now - span }
  const abs = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (abs) return Date.UTC(Number(abs[1]), Number(abs[2]) - 1, Number(abs[3]), Number(abs[4] ?? 0), Number(abs[5] ?? 0), Number(abs[6] ?? 0))
  const hm = s.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (hm) return day(now) + (Number(hm[1]) * 3600 + Number(hm[2]) * 60 + Number(hm[3] ?? 0)) * 1000
  return null
}

function journalctl(sh: Shell, args: string[], base: Command, stdin: string): CmdResult {
  ensureLayout(sh)
  const st = systemdState(sh)
  const units: string[] = []
  const idents: string[] = []
  let n: number | null = null
  let reverse = false, catalog = false, kernel = false, follow = false
  let since: string | null = null, until: string | null = null, prio: string | null = null, output = 'short', grep: string | null = null
  let scope: Scope = 'system'
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    const val = (flag: string): string => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : a.length > flag.length && !a.startsWith('--') ? a.slice(flag.length) : args[++i] ?? '')
    if (a === '-u' || a.startsWith('--unit') || (a.startsWith('-u') && !a.startsWith('--'))) units.push(unitName(val('-u')))
    else if (a === '-t' || a.startsWith('--identifier') || (a.startsWith('-t') && !a.startsWith('--'))) idents.push(val('-t'))
    else if (a === '-n' || a.startsWith('--lines')) { const v = a.includes('=') ? a.split('=')[1] : /^\d+$/.test(args[i + 1] ?? '') ? args[++i] : '10'; n = Number(v) }
    else if (/^-n\d+$/.test(a)) n = Number(a.slice(2))
    else if (a === '--since' || a.startsWith('--since=') || a === '-S') since = val('--since')
    else if (a === '--until' || a.startsWith('--until=') || a === '-U') until = val('--until')
    else if (a === '-p' || a.startsWith('--priority') || (a.startsWith('-p') && !a.startsWith('--'))) prio = val('-p')
    else if (a === '-o' || a.startsWith('--output') || (a.startsWith('-o') && !a.startsWith('--'))) output = val('-o')
    else if (a === '-g' || a.startsWith('--grep') || (a.startsWith('-g') && !a.startsWith('--'))) grep = val('-g')
    else if (a === '--user') scope = 'user'
    else if (a === '--system' || a === '--no-pager' || a === '-q' || a === '--quiet' || a === '--no-hostname' || a === '-a' || a === '--all' || a === '-l' || a === '--full') continue
    else if (a === '-b' || a === '--boot' || a.startsWith('--boot=')) continue
    else if (a === '-k' || a === '--dmesg') kernel = true
    else if (/^-[a-z]{2,}$/.test(a)) {
      // Clustered short flags like -xe, -xeu (the last letter may take a value).
      const chars = a.slice(1).split('')
      for (let k = 0; k < chars.length; k++) {
        const c = chars[k]
        if (c === 'x') catalog = true
        else if (c === 'e') n ??= 1000
        else if (c === 'r') reverse = true
        else if (c === 'b' || c === 'q' || c === 'a' || c === 'l') continue
        else if (c === 'f') follow = true
        else if (c === 'k') kernel = true
        else if (c === 'u') { units.push(unitName(chars.slice(k + 1).join('') || args[++i] || '')); break }
        else if (c === 'n') { const rest = chars.slice(k + 1).join(''); n = Number(rest || (/^\d+$/.test(args[i + 1] ?? '') ? args[++i] : '10')); break }
        else if (c === 'p') { prio = chars.slice(k + 1).join('') || args[++i] || ''; break }
        else if (c === 'o') { output = chars.slice(k + 1).join('') || args[++i] || 'short'; break }
        else return err(`journalctl: invalid option -- '${c}'`)
      }
    }
    else if (a === '-x' || a === '--catalog') catalog = true
    else if (a === '-e' || a === '--pager-end') n ??= 1000
    else if (a === '-r' || a === '--reverse') reverse = true
    else if (a === '-f' || a === '--follow') follow = true
    else if (a.startsWith('-')) return err(`journalctl: invalid option -- '${a.replace(/^-+/, '')}'`)
    else if (a.includes('=')) { const [k, v] = a.split('='); if (k === '_SYSTEMD_UNIT' || k === 'UNIT') units.push(unitName(v)); else if (k === 'SYSLOG_IDENTIFIER') idents.push(v) }
    else return err(`Failed to add match '${a}': Invalid argument`)
  }
  if (follow) return err(`journalctl -f follows the journal live, which this terminal cannot do. Run it on a real machine to watch lines arrive; here, use journalctl${units.map((u) => ` -u ${u}`).join('')} -n 20 instead.`)
  const now = st.clock
  let from: number | null = null, to: number | null = null
  if (since !== null) { from = parseSince(since, now); if (from === null) return err(`Failed to parse timestamp: ${since}`) }
  if (until !== null) { to = parseSince(until, now); if (to === null) return err(`Failed to parse timestamp: ${until}`) }
  let maxPrio: number | null = null
  if (prio !== null) {
    const p = prio.split('..')[prio.includes('..') ? 1 : 0]
    maxPrio = p in PRIO ? PRIO[p] : /^\d$/.test(p) ? Number(p) : null
    if (maxPrio === null) return err(`Failed to parse priority: ${prio}`)
    if (prio.includes('..')) { const lo = prio.split('..')[0]; maxPrio = Math.max(maxPrio, lo in PRIO ? PRIO[lo] : Number(lo)) }
  }
  let lines = st.journal.filter((l) => l.scope === scope)
  if (units.length) lines = lines.filter((l) => units.includes(l.unit))
  if (idents.length) lines = lines.filter((l) => idents.includes(l.ident))
  if (kernel) lines = lines.filter((l) => l.ident === 'kernel')
  if (from !== null) lines = lines.filter((l) => l.t >= (from as number))
  if (to !== null) lines = lines.filter((l) => l.t <= (to as number))
  if (maxPrio !== null) lines = lines.filter((l) => l.prio <= (maxPrio as number))
  if (grep !== null) { let re: RegExp; try { re = new RegExp(grep, 'i') } catch { return err(`Failed to compile pattern: ${grep}`) } lines = lines.filter((l) => re.test(l.msg)) }
  // A built-in service with nothing in the sim journal: let the base command answer from syslog.
  if (!lines.length && units.length && scope === 'system' && units.every((u) => u.replace(/\.service$/, '') in sh.state.services)) return base(sh, args, stdin)
  if (!lines.length) return ok('-- No entries --\n')
  if (n !== null) lines = lines.slice(-n)
  if (reverse) lines = [...lines].reverse()
  const fmt = (l: JournalLine) => {
    if (output === 'cat') return l.msg
    if (output === 'short-iso') return `${new Date(l.t).toISOString().replace(/\.\d+Z$/, '+0000')} ${HOSTNAME} ${l.ident}[${l.pid}]: ${l.msg}`
    if (output === 'verbose' || output === 'json') return `${fmtLine(l)}\n    PRIORITY=${l.prio}\n    _SYSTEMD_UNIT=${l.unit || 'init.scope'}\n    SYSLOG_IDENTIFIER=${l.ident}`
    const text = fmtLine(l)
    return catalog && l.explain ? text + '\n' + l.explain.split('\n').map((e) => '░░ ' + e).join('\n') : text
  }
  const header = output === 'cat' || n !== null && n < lines.length ? '' : ''
  return ok(header + lines.map(fmt).join('\n') + '\n')
}

/* ---------------- systemd-analyze ---------------- */

function analyze(sh: Shell, args: string[]): CmdResult {
  ensureLayout(sh)
  const [sub, ...rest] = args.filter((a) => !a.startsWith('--'))
  if (!sub || sub === 'time') return ok('Startup finished in 1.204s (kernel) + 1.921s (userspace) = 3.125s\nmulti-user.target reached after 1.880s in userspace.\n')
  if (sub === 'calendar') {
    if (!rest.length) return err('systemd-analyze calendar: expected a calendar specification, like: systemd-analyze calendar daily')
    let out = ''
    for (const spec of rest) {
      const next = nextCalendar(spec, systemdState(sh).clock)
      if (next === null) return err(`Failed to parse calendar specification '${spec}': Invalid argument`)
      const shortcuts: Record<string, string> = { minutely: '*-*-* *:*:00', hourly: '*-*-* *:00:00', daily: '*-*-* 00:00:00', weekly: 'Mon *-*-* 00:00:00', monthly: '*-*-01 00:00:00', yearly: '*-01-01 00:00:00' }
      out += `  Original form: ${spec}\nNormalized form: ${shortcuts[spec.toLowerCase()] ?? spec}\n    Next elapse: ${fmtFull(next)}\n       From now: ${fmtSpan(next - systemdState(sh).clock)} left\n`
    }
    return ok(out)
  }
  if (sub === 'timespan') {
    let out = ''
    for (const v of rest) { const ms = parseSpan(v); if (ms === null) return err(`Failed to parse time span '${v}': Invalid argument`); out += `Original: ${v}\n      μs: ${ms * 1000}\n   Human: ${fmtSpan(ms)}\n` }
    return ok(out)
  }
  if (sub !== 'verify') return err(`systemd-analyze: unknown verb '${sub}'. Try: systemd-analyze verify FILE, systemd-analyze calendar SPEC`)
  if (!rest.length) return err('systemd-analyze verify: expected at least one unit file, like: systemd-analyze verify /etc/systemd/system/backup.service')
  let out = ''
  let bad = false
  for (const f of rest) {
    const abs = f.includes('/') ? sh.path(f) : `/etc/systemd/system/${unitName(f)}`
    const text = fileText(sh, abs)
    if (text === null) { out += `Failed to prepare filename ${f}: No such file or directory\n`; bad = true; continue }
    const name = abs.split('/').pop()!
    if (!/\.(service|timer|target|socket|mount|path)$/.test(name)) { out += `Failed to load unit file ${f}: unit name must end in .service, .timer, or another unit suffix\n`; bad = true; continue }
    const uf = parseUnitText(name, abs, text)
    for (const p of uf.problems) out += `${abs}${p.line ? ':' + p.line : ''}: ${p.msg}\n`
    if (uf.fatal) { out += `${name}: ${uf.fatal}\n`; bad = true; continue }
    if (name.endsWith('.service')) {
      const user = get(uf, 'Service', 'User') || 'root'
      if (!userExists(sh, user)) { out += `${name}: User ${user} does not exist (Failed to determine user credentials: No such process)\n`; bad = true }
      for (const key of ['ExecStartPre', 'ExecStart', 'ExecStop', 'ExecReload'] as const) {
        for (const cmd of getAll(uf, 'Service', key)) {
          const prog = splitCmd(cmd.replace(/^[-@+!:]+/, ''))[0] ?? ''
          const path = prog.startsWith('/') ? prog : SYSTEMD_PATH.split(':').map((d) => `${d}/${prog}`).find((p) => sh.vfs.get(p)?.type === 'file') ?? null
          if (!path) { out += `${name}: Executable "${prog}" not found in path "${SYSTEMD_PATH}"\n`; bad = true; continue }
          const node = sh.vfs.get(path)
          if (!node || node.type !== 'file') { out += `${name}: Command ${prog} is not executable: No such file or directory\n`; bad = true; continue }
          const saved = sh.user; sh.user = user; const x = sh.canExec(node); sh.user = saved
          if (!x) { out += `${name}: Command ${prog} is not executable: Permission denied\n`; bad = true }
        }
      }
      for (const ef of getAll(uf, 'Service', 'EnvironmentFile')) if (!ef.startsWith('-') && fileText(sh, sh.path(ef)) === null) out += `${name}: EnvironmentFile=${ef} does not exist (the unit will fail with result 'resources'; prefix the path with - to make it optional)\n`
      const wd = get(uf, 'Service', 'WorkingDirectory')
      if (wd && sh.vfs.get(sh.path(wd))?.type !== 'dir') { out += `${name}: WorkingDirectory=${wd} does not exist\n`; bad = true }
      if (get(uf, 'Service', 'Type') === 'oneshot' && get(uf, 'Service', 'Restart') === 'always') { out += `${name}: Service has Restart= setting other than no, on-failure, on-abnormal, or on-abort, which isn't allowed for Type=oneshot services. Refusing.\n`; bad = true }
    }
    if (name.endsWith('.timer')) {
      const target = timerTarget(uf)
      if (!fileText(sh, `/etc/systemd/system/${target}`) && !fileText(sh, `/lib/systemd/system/${target}`) && !(target.replace(/\.service$/, '') in sh.state.services)) out += `${name}: Unit to trigger not loaded: ${target} (write ${target} next to the timer, or set Unit= to the service it should start)\n`
    }
  }
  return { out: '', err: out, code: bad ? 1 : 0 }
}

/* ---------------- install ---------------- */

export function install(base: CommandTable) {
  const baseSystemctl = base.systemctl
  const baseJournalctl = base.journalctl
  base.systemctl = (sh, args, stdin) => systemctl(sh, args, baseSystemctl, stdin)
  base.journalctl = (sh, args, stdin) => journalctl(sh, args, baseJournalctl, stdin)
  base['systemd-analyze'] = (sh, args) => analyze(sh, args)
}
