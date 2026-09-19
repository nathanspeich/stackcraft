// Simulation module: net. Interfaces and addresses, listening sockets, DNS,
// curl, ufw over nftables, the SSH server, keys, and fail2ban for the pretend
// Ubuntu box "stackbox" (enp0s1 at 192.168.64.5/24, gateway 192.168.64.1).
// State lives in sh.state.sims.net so checkers can read r.state?.sims?.net.
import type { CmdResult, Command } from '../commands'
import type { Shell } from '../shell'
import { simState, type CommandTable } from './index'

const HOME = '/home/learner'
const HOSTNAME = 'stackbox'
const IFACE = 'enp0s1'
const VM_IP = '192.168.64.5'
const GATEWAY = '192.168.64.1'
const MAC = '52:54:00:12:34:56'
const DATE_HTTP = 'Thu, 18 Sep 2026 09:41:07 GMT'
const CURL_UA = 'curl/8.5.0'

const ok = (out = ''): CmdResult => ({ out, err: '', code: 0 })
const fail = (err: string, code = 1): CmdResult => ({ out: '', err: err.endsWith('\n') ? err : err + '\n', code })
const lines = (s: string) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'))
const joinLines = (ls: string[]) => (ls.length ? ls.join('\n') + '\n' : '')
const isRoot = (sh: Shell) => sh.user === 'root'

/* ======================= state ======================= */

export interface UfwRule {
  action: 'allow' | 'deny' | 'reject' | 'limit'
  direction: 'in' | 'out'
  /** Port number or range like "6000:6007". Undefined means any port. */
  port?: string
  proto?: 'tcp' | 'udp'
  /** Application profile, like OpenSSH. */
  app?: string
  /** Source address or network. Undefined means Anywhere. */
  from?: string
  /** Destination address. Undefined means Anywhere. */
  to?: string
  comment?: string
  v4: boolean
  v6: boolean
}

export interface ListeningSocket { port: number; proto: 'tcp' | 'udp'; proc: string; pid: number; addr?: string }

export interface NetState {
  hostname: string
  iface: string
  ip: string
  gateway: string
  firewall: {
    enabled: boolean
    defaultIn: 'allow' | 'deny' | 'reject'
    defaultOut: 'allow' | 'deny' | 'reject'
    logging: 'off' | 'low' | 'medium' | 'high' | 'full'
    rules: UfwRule[]
  }
  /** Extra listening sockets beyond sshd, nginx, and background http.server processes. */
  listening: ListeningSocket[]
  /** Hosts ssh-copy-id installed the learner's key on. */
  keyCopiedTo: string[]
  /** user@host targets of simulated ssh logins that succeeded. */
  sshLogins: string[]
  /** Addresses banned by hand with fail2ban-client. */
  manualBans: string[]
  /** Addresses unbanned by hand with fail2ban-client. */
  unbanned: string[]
  /** URLs fetched with curl, oldest first. */
  fetched: string[]
}

const initNet = (): NetState => ({
  hostname: HOSTNAME,
  iface: IFACE,
  ip: VM_IP,
  gateway: GATEWAY,
  firewall: { enabled: false, defaultIn: 'deny', defaultOut: 'allow', logging: 'low', rules: [] },
  listening: [],
  keyCopiedTo: [],
  sshLogins: [],
  manualBans: [],
  unbanned: [],
  fetched: [],
})

/** The net state, with defaults filled in for anything a task seed left out. */
export function netState(sh: Shell): NetState {
  const s = simState<Partial<NetState>>(sh, 'net', initNet)
  const d = initNet()
  for (const k of Object.keys(d) as (keyof NetState)[]) if (s[k] === undefined) (s as Record<string, unknown>)[k] = d[k]
  const fw = s.firewall as Partial<NetState['firewall']>
  for (const k of Object.keys(d.firewall) as (keyof NetState['firewall'])[]) if (fw[k] === undefined) (fw as Record<string, unknown>)[k] = d.firewall[k]
  return s as NetState
}

/* ======================= seeded files ======================= */

const SSHD_CONFIG = `# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

# The strategy used for options in the default sshd_config shipped with
# OpenSSH is to specify options with their default value where
# possible, but leave them commented.  Uncommented options override the
# default value.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#AddressFamily any
#ListenAddress 0.0.0.0
#ListenAddress ::

#HostKey /etc/ssh/ssh_host_rsa_key
#HostKey /etc/ssh/ssh_host_ecdsa_key
#HostKey /etc/ssh/ssh_host_ed25519_key

# Logging
#SyslogFacility AUTH
#LogLevel INFO

# Authentication:

#LoginGraceTime 2m
#PermitRootLogin prohibit-password
#StrictModes yes
#MaxAuthTries 6
#MaxSessions 10

#PubkeyAuthentication yes

# Expect .ssh/authorized_keys2 to be disregarded by default in future.
#AuthorizedKeysFile\t.ssh/authorized_keys .ssh/authorized_keys2

# To disable tunneled clear text passwords, change to no here!
#PasswordAuthentication yes
#PermitEmptyPasswords no

# Change to yes to enable challenge-response passwords (beware issues with
# some PAM modules and threads)
KbdInteractiveAuthentication no

# Set this to 'yes' to enable PAM authentication, account processing,
# and session processing.
UsePAM yes

#AllowAgentForwarding yes
#AllowTcpForwarding yes
#GatewayPorts no
X11Forwarding yes
#PermitTTY yes
PrintMotd no
#TCPKeepAlive yes
#ClientAliveInterval 0
#ClientAliveCountMax 3
#UseDNS no
#PidFile /run/sshd.pid
#MaxStartups 10:30:100
#Banner none

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem\tsftp\t/usr/lib/openssh/sftp-server
`

const CLOUD_INIT_CONF = 'PasswordAuthentication no\n'

const SSH_CONFIG = `# This is the ssh client system-wide configuration file.  See
# ssh_config(5) for more information.

Include /etc/ssh/ssh_config.d/*.conf

Host *
#   ForwardAgent no
#   ForwardX11 no
#   PasswordAuthentication yes
#   Port 22
    SendEnv LANG LC_*
    HashKnownHosts yes
    GSSAPIAuthentication yes
`

const RESOLV_CONF = '# This is /run/systemd/resolve/stub-resolv.conf managed by man:systemd-resolved(8).\n# Do not edit.\n#\n# 127.0.0.53 is the systemd-resolved stub resolver.\n# run "resolvectl status" to see details about the uplink DNS servers.\n\nnameserver 127.0.0.53\noptions edns0 trust-ad\nsearch .\n'

const NSSWITCH = '# /etc/nsswitch.conf\n#\n# Name Service Switch configuration file.\n\npasswd:         files systemd\ngroup:          files systemd\nshadow:         files systemd\n\nhosts:          files mdns4_minimal [NOTFOUND=return] dns\nnetworks:       files\n\nprotocols:      db files\nservices:       db files\n'

const SERVICES = `# Network services, Internet style (trimmed)
#
# service-name  port/protocol  [aliases ...]

ftp             21/tcp
ssh             22/tcp
smtp            25/tcp          mail
domain          53/tcp
domain          53/udp
http            80/tcp          www
ntp             123/udp
https           443/tcp
mysql           3306/tcp
postgresql      5432/tcp        postgres
http-alt        8080/tcp        webcache
`

const JAIL_CONF = `# Fail2Ban main configuration file (trimmed). Do NOT edit this file:
# it is replaced on upgrade. Put your changes in /etc/fail2ban/jail.local
# or in a file under /etc/fail2ban/jail.d/.

[DEFAULT]
# "ignoreip" can be a list of IP addresses, CIDR masks or DNS hosts. Fail2ban
# will not ban a host which matches an address in this list.
ignoreip = 127.0.0.1/8 ::1

# "bantime" is the number of seconds that a host is banned.
bantime  = 10m

# A host is banned if it has generated "maxretry" during the last "findtime"
# seconds.
findtime  = 10m

# "maxretry" is the number of failures before a host get banned.
maxretry = 5

# "backend" specifies the backend used to get files modification.
backend = auto

# Default banning action
banaction = iptables-multiport

[sshd]
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
port    = http,https
logpath = %(nginx_error_log)s
`

const JAIL_D_DEBIAN = '[sshd]\nenabled = true\n'

/** Create the config files this module owns if they are missing. Called lazily so unrelated lessons keep a lean /etc. */
function ensureFiles(sh: Shell) {
  const v = sh.vfs
  if (v.get('/etc/ssh/sshd_config')) return
  const root = { owner: 'root' }
  for (const d of ['/etc/ssh/sshd_config.d', '/etc/ssh/ssh_config.d', '/etc/ufw', '/run/sshd']) v.mkdir(d, { parents: true, owner: 'root' })
  v.writeFile('/etc/ssh/sshd_config', SSHD_CONFIG, root)
  v.writeFile('/etc/ssh/sshd_config.d/50-cloud-init.conf', CLOUD_INIT_CONF, root)
  v.writeFile('/etc/ssh/ssh_config', SSH_CONFIG, root)
  v.writeFile('/etc/ssh/ssh_host_ed25519_key.pub', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJf0S9x1c5GnH2v8p4o1s2mPDs3q7b9K2Wl6x0c1lZ3r root@stackbox\n', root)
  v.writeFile('/etc/ssh/ssh_host_ed25519_key', '-----BEGIN OPENSSH PRIVATE KEY-----\n(host key: unreadable by design)\n-----END OPENSSH PRIVATE KEY-----\n', { owner: 'root', mode: 0o600 })
  if (!v.get('/etc/resolv.conf')) v.writeFile('/etc/resolv.conf', RESOLV_CONF, root)
  if (!v.get('/etc/nsswitch.conf')) v.writeFile('/etc/nsswitch.conf', NSSWITCH, root)
  if (!v.get('/etc/services')) v.writeFile('/etc/services', SERVICES, root)
  if (!v.get('/etc/ufw/ufw.conf')) v.writeFile('/etc/ufw/ufw.conf', "# /etc/ufw/ufw.conf\n#\n\n# Set to yes to start on boot. If setting this remotely, be sure to add a rule\n# to allow your remote connection before starting ufw. Eg: 'ufw allow 22/tcp'\nENABLED=no\n\n# Please use the 'ufw' command to set the loglevel.\nLOGLEVEL=low\n", root)
  if (sh.state.packages.includes('fail2ban')) installFail2banFiles(sh)
}

function installFail2banFiles(sh: Shell) {
  const v = sh.vfs
  if (v.get('/etc/fail2ban/jail.conf')) return
  v.mkdir('/etc/fail2ban/jail.d', { parents: true, owner: 'root' })
  v.mkdir('/etc/fail2ban/filter.d', { parents: true, owner: 'root' })
  v.writeFile('/etc/fail2ban/jail.conf', JAIL_CONF, { owner: 'root' })
  v.writeFile('/etc/fail2ban/jail.d/defaults-debian.conf', JAIL_D_DEBIAN, { owner: 'root' })
  v.writeFile('/etc/fail2ban/filter.d/sshd.conf', '[Definition]\nfailregex = ^.*Failed (?:password|publickey) for (?:invalid user )?\\S+ from <HOST>.*$\n            ^.*Invalid user \\S+ from <HOST>.*$\nignoreregex =\n', { owner: 'root' })
  for (const bin of ['fail2ban-client', 'fail2ban-server']) if (!v.get('/usr/bin/' + bin)) v.writeFile('/usr/bin/' + bin, '#!builtin\n', { owner: 'root', mode: 0o755 })
  if (!v.get('/var/log/fail2ban.log')) v.writeFile('/var/log/fail2ban.log', '', { owner: 'root', mode: 0o640 })
}

/* ======================= name resolution ======================= */

interface DnsRecord { A?: string[]; AAAA?: string[]; MX?: string[]; TXT?: string[]; NS?: string[]; ttl?: number }

const DNS: Record<string, DnsRecord> = {
  'example.com': { A: ['93.184.216.34'], AAAA: ['2606:2800:21f:cb07:6820:80da:af6b:8b2c'], MX: ['0 .'], TXT: ['"v=spf1 -all"', '"wgyf8z8cgvm2qmxpnbnldrcltvk4xqfn"'], NS: ['a.iana-servers.net.', 'b.iana-servers.net.'], ttl: 3600 },
  'www.example.com': { A: ['93.184.216.34'], AAAA: ['2606:2800:21f:cb07:6820:80da:af6b:8b2c'], ttl: 3600 },
  'google.com': { A: ['142.250.72.14'], AAAA: ['2607:f8b0:4005:80e::200e'], MX: ['10 smtp.google.com.'], TXT: ['"v=spf1 include:_spf.google.com ~all"'], NS: ['ns1.google.com.', 'ns2.google.com.', 'ns3.google.com.', 'ns4.google.com.'], ttl: 300 },
  'www.google.com': { A: ['142.250.72.4'], AAAA: ['2607:f8b0:4005:80e::2004'], ttl: 300 },
  'github.com': { A: ['140.82.112.3'], MX: ['1 aspmx.l.google.com.', '5 alt1.aspmx.l.google.com.', '5 alt2.aspmx.l.google.com.'], TXT: ['"v=spf1 ip4:192.30.252.0/22 include:_spf.google.com ~all"'], NS: ['dns1.p08.nsone.net.', 'ns-1283.awsdns-32.org.'], ttl: 60 },
  'api.github.com': { A: ['140.82.112.6'], ttl: 60 },
  'httpbin.org': { A: ['54.174.11.29', '3.220.106.32'], NS: ['ns-1051.awsdns-03.org.', 'ns-1795.awsdns-32.co.uk.'], ttl: 300 },
  'ubuntu.com': { A: ['185.125.190.20', '185.125.190.21', '185.125.190.29'], AAAA: ['2620:2d:4000:1::27', '2620:2d:4000:1::28'], MX: ['10 mx.canonical.com.'], NS: ['ns1.canonical.com.', 'ns2.canonical.com.', 'ns3.canonical.com.'], ttl: 600 },
  'archive.ubuntu.com': { A: ['91.189.91.83', '185.125.190.83'], ttl: 600 },
  'wikipedia.org': { A: ['208.80.154.224'], AAAA: ['2620:0:861:ed1a::1'], ttl: 600 },
  'one.one.one.one': { A: ['1.1.1.1', '1.0.0.1'], AAAA: ['2606:4700:4700::1111', '2606:4700:4700::1001'], ttl: 300 },
  'dns.google': { A: ['8.8.8.8', '8.8.4.4'], AAAA: ['2001:4860:4860::8888', '2001:4860:4860::8844'], ttl: 300 },
}

const PTR: Record<string, string> = { '8.8.8.8': 'dns.google.', '8.8.4.4': 'dns.google.', '1.1.1.1': 'one.one.one.one.', '1.0.0.1': 'one.one.one.one.', '192.168.64.1': '_gateway.', '127.0.0.1': 'localhost.', '192.168.64.5': 'stackbox.' }

const isIPv4 = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s)
const isCidrOrIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(s)

/** Entries of /etc/hosts as [ip, names[]]. */
function etcHosts(sh: Shell): [string, string[]][] {
  let text = ''
  try { text = sh.vfs.readFile('/etc/hosts') } catch { text = '' }
  const out: [string, string[]][] = []
  for (const raw of lines(text)) {
    const l = raw.replace(/#.*$/, '').trim()
    if (!l) continue
    const [ip, ...names] = l.split(/\s+/)
    if (names.length) out.push([ip, names])
  }
  return out
}

interface Resolved { ip: string; source: 'literal' | 'hosts' | 'dns' }

/** Resolve a name the way glibc does: /etc/hosts first, then DNS. Null when nothing knows the name. */
function resolve(sh: Shell, name: string): Resolved | null {
  const n = name.toLowerCase().replace(/\.$/, '')
  if (isIPv4(n)) return { ip: n, source: 'literal' }
  for (const [ip, names] of etcHosts(sh)) if (names.map((x) => x.toLowerCase()).includes(n)) return { ip, source: 'hosts' }
  if (n === 'localhost') return { ip: '127.0.0.1', source: 'hosts' }
  if (n === HOSTNAME) return { ip: '127.0.1.1', source: 'hosts' }
  const rec = DNS[n]
  if (rec?.A?.length) return { ip: rec.A[0], source: 'dns' }
  return null
}

const isLoopback = (ip: string) => ip.startsWith('127.')
/** True when the address is this machine, seen from itself (loopback) or from the LAN (its own IP). */
const isThisBox = (ip: string) => isLoopback(ip) || ip === VM_IP

/* ======================= sockets ======================= */

interface Sock { proto: 'tcp' | 'udp'; state: 'LISTEN' | 'UNCONN' | 'ESTAB'; addr: string; port: number; peer: string; proc: string; pid: number; fd: number; recvq: number; sendq: number }

function sockets(sh: Shell): Sock[] {
  const s = netState(sh)
  const out: Sock[] = [
    { proto: 'udp', state: 'UNCONN', addr: '127.0.0.53%lo', port: 53, peer: '0.0.0.0:*', proc: 'systemd-resolve', pid: 398, fd: 13, recvq: 0, sendq: 0 },
    { proto: 'tcp', state: 'LISTEN', addr: '0.0.0.0', port: 22, peer: '0.0.0.0:*', proc: 'sshd', pid: 412, fd: 3, recvq: 0, sendq: 128 },
    { proto: 'tcp', state: 'LISTEN', addr: '[::]', port: 22, peer: '[::]:*', proc: 'sshd', pid: 412, fd: 4, recvq: 0, sendq: 128 },
  ]
  if (sh.state.services.nginx === 'active') {
    out.push({ proto: 'tcp', state: 'LISTEN', addr: '0.0.0.0', port: 80, peer: '0.0.0.0:*', proc: 'nginx', pid: 1450, fd: 6, recvq: 0, sendq: 511 })
    out.push({ proto: 'tcp', state: 'LISTEN', addr: '[::]', port: 80, peer: '[::]:*', proc: 'nginx', pid: 1450, fd: 7, recvq: 0, sendq: 511 })
  }
  for (const p of sh.state.processes) {
    const m = p.cmd.match(/http\.server(?:\s+(?:--bind|-b)\s+(\S+))?\s*(\d+)?(?:\s+(?:--bind|-b)\s+(\S+))?/)
    if (m) out.push({ proto: 'tcp', state: 'LISTEN', addr: m[1] ?? m[3] ?? '0.0.0.0', port: Number(m[2] ?? 8000), peer: '0.0.0.0:*', proc: 'python3', pid: p.pid, fd: 3, recvq: 0, sendq: 5 })
    const nc = p.cmd.match(/^nc\s+-\w*l\w*\s+(?:-p\s+)?(\d+)/)
    if (nc) out.push({ proto: 'tcp', state: 'LISTEN', addr: '0.0.0.0', port: Number(nc[1]), peer: '0.0.0.0:*', proc: 'nc', pid: p.pid, fd: 3, recvq: 0, sendq: 1 })
  }
  for (const l of s.listening) out.push({ proto: l.proto, state: l.proto === 'tcp' ? 'LISTEN' : 'UNCONN', addr: l.addr ?? '0.0.0.0', port: l.port, peer: '0.0.0.0:*', proc: l.proc, pid: l.pid, fd: 5, recvq: 0, sendq: 128 })
  // The learner's own ssh session from the Mac.
  out.push({ proto: 'tcp', state: 'ESTAB', addr: VM_IP, port: 22, peer: GATEWAY + ':53422', proc: 'sshd', pid: 1181, fd: 4, recvq: 0, sendq: 0 })
  return out
}

/** The tcp socket listening on a port, if any. */
const listenerOn = (sh: Shell, port: number) => sockets(sh).find((k) => k.proto === 'tcp' && k.state === 'LISTEN' && k.port === port)

/* ======================= firewall logic ======================= */

const APP_PORTS: Record<string, { port: string; proto?: 'tcp' | 'udp' }> = { OpenSSH: { port: '22', proto: 'tcp' }, 'Nginx Full': { port: '80,443', proto: 'tcp' }, 'Nginx HTTP': { port: '80', proto: 'tcp' }, 'Nginx HTTPS': { port: '443', proto: 'tcp' } }
const SERVICE_PORTS: Record<string, { port: string; proto: 'tcp' | 'udp' }> = { ssh: { port: '22', proto: 'tcp' }, http: { port: '80', proto: 'tcp' }, https: { port: '443', proto: 'tcp' }, smtp: { port: '25', proto: 'tcp' }, domain: { port: '53', proto: 'udp' }, ftp: { port: '21', proto: 'tcp' }, mysql: { port: '3306', proto: 'tcp' }, postgresql: { port: '5432', proto: 'tcp' }, ntp: { port: '123', proto: 'udp' } }

function portMatches(spec: string | undefined, port: number): boolean {
  if (spec === undefined) return true
  return spec.split(',').some((p) => {
    const r = p.split(':')
    return r.length === 2 ? port >= Number(r[0]) && port <= Number(r[1]) : Number(p) === port
  })
}

function inNetwork(ip: string, spec: string | undefined): boolean {
  if (!spec || spec === 'Anywhere') return true
  const [net, bitsRaw] = spec.split('/')
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw)
  const n = (a: string) => a.split('.').reduce((acc, o) => ((acc << 8) | Number(o)) >>> 0, 0)
  if (bits === 0) return true
  const mask = (0xffffffff << (32 - bits)) >>> 0
  return (n(ip) & mask) === (n(net) & mask)
}

/** How the firewall treats an incoming tcp connection to a port from a source address. */
function firewallVerdict(sh: Shell, port: number, from = GATEWAY, proto: 'tcp' | 'udp' = 'tcp'): 'allow' | 'drop' | 'reject' {
  const fw = netState(sh).firewall
  if (!fw.enabled) return 'allow'
  for (const r of fw.rules) {
    if (r.direction !== 'in' || !r.v4) continue
    const spec = r.app ? APP_PORTS[r.app] : { port: r.port, proto: r.proto }
    if (spec?.proto && spec.proto !== proto) continue
    if (!portMatches(spec?.port, port)) continue
    if (!inNetwork(from, r.from)) continue
    if (r.to && r.to !== VM_IP) continue
    if (r.action === 'allow' || r.action === 'limit') return 'allow'
    return r.action === 'reject' ? 'reject' : 'drop'
  }
  return fw.defaultIn === 'allow' ? 'allow' : fw.defaultIn === 'reject' ? 'reject' : 'drop'
}

/* ======================= HTTP ======================= */

interface HttpReq { method: string; scheme: 'http' | 'https'; host: string; port: number; path: string; headers: [string, string][]; body: string; auth?: string }
interface HttpRes { version: string; status: number; reason: string; headers: [string, string][]; body: string }
interface NetError { error: string; code: number }

const REASONS: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 418: "I'm a teapot", 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' }

const res = (status: number, headers: [string, string][], body: string, version = 'HTTP/1.1'): HttpRes => ({ version, status, reason: REASONS[status] ?? '', headers, body })

const EXAMPLE_HTML = '<!doctype html>\n<html>\n<head>\n    <title>Example Domain</title>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n</head>\n<body>\n<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents. You may use this\n    domain in literature without prior coordination or asking for permission.</p>\n    <p><a href="https://www.iana.org/domains/example">More information...</a></p>\n</div>\n</body>\n</html>\n'

function jsonBody(obj: unknown) { return JSON.stringify(obj, null, 2) + '\n' }

function parseQuery(path: string): Record<string, string> {
  const q = path.split('?')[1] ?? ''
  const out: Record<string, string> = {}
  for (const pair of q.split('&')) { if (!pair) continue; const [k, v = ''] = pair.split('='); out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')) }
  return out
}

function headerObj(req: HttpReq): Record<string, string> {
  const h: Record<string, string> = { Accept: '*/*', Host: req.host, 'User-Agent': CURL_UA }
  for (const [k, v] of req.headers) h[k.replace(/(^|-)\w/g, (c) => c.toUpperCase())] = v
  if (req.body) {
    if (!Object.keys(h).some((k) => k.toLowerCase() === 'content-type')) h['Content-Type'] = 'application/x-www-form-urlencoded'
    h['Content-Length'] = String(req.body.length)
  }
  h['X-Amzn-Trace-Id'] = 'Root=1-68cbd0a3-2f1a9b7c0d4e5f6a7b8c9d0e'
  return Object.fromEntries(Object.entries(h).sort(([a], [b]) => a.localeCompare(b)))
}

function httpbin(req: HttpReq): HttpRes {
  const version = req.scheme === 'https' ? 'HTTP/2' : 'HTTP/1.1'
  const json = (status: number, obj: unknown) => res(status, [['date', DATE_HTTP], ['content-type', 'application/json'], ['content-length', String(jsonBody(obj).length)], ['server', 'gunicorn/19.9.0'], ['access-control-allow-origin', '*'], ['access-control-allow-credentials', 'true']], jsonBody(obj), version)
  const p = req.path.split('?')[0].replace(/\/$/, '') || '/'
  const url = `${req.scheme}://httpbin.org${req.path}`
  const headers = headerObj(req)
  const origin = '203.0.113.42'
  const echo = () => {
    const ct = (headers['Content-Type'] ?? '').toLowerCase()
    let parsed: unknown = null
    let form: Record<string, string> = {}
    if (req.body && ct.includes('json')) { try { parsed = JSON.parse(req.body) } catch { parsed = null } }
    else if (req.body) form = parseQuery('?' + req.body)
    return { args: parseQuery(req.path), data: ct.includes('json') || !Object.keys(form).length ? req.body : '', files: {}, form, headers, json: parsed, origin, url }
  }
  const methodOnly = (m: string) => (req.method === m ? json(200, echo()) : res(405, [['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['allow', m + ', OPTIONS'], ['content-length', '178'], ['server', 'gunicorn/19.9.0']], '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<title>405 Method Not Allowed</title>\n<h1>Method Not Allowed</h1>\n<p>The method is not allowed for the requested URL.</p>\n', version))
  if (p === '/get') return req.method === 'GET' || req.method === 'HEAD' ? json(200, { args: parseQuery(req.path), headers, origin, url }) : methodOnly('GET')
  if (p === '/post') return methodOnly('POST')
  if (p === '/put') return methodOnly('PUT')
  if (p === '/patch') return methodOnly('PATCH')
  if (p === '/delete') return methodOnly('DELETE')
  if (p === '/anything' || p.startsWith('/anything/')) return json(200, { ...echo(), method: req.method })
  if (p === '/headers') return json(200, { headers })
  if (p === '/ip') return json(200, { origin })
  if (p === '/user-agent') return json(200, { 'user-agent': headers['User-Agent'] })
  if (p === '/uuid') return json(200, { uuid: '9f1c2b4e-3d6a-4f7b-8c9d-0e1f2a3b4c5d' })
  if (p === '/json') return json(200, { slideshow: { author: 'Yours Truly', date: 'date of publication', slides: [{ title: 'Wake up to WonderWidgets!', type: 'all' }, { items: ['Why <em>WonderWidgets</em> are great', 'Who <em>buys</em> WonderWidgets'], title: 'Overview', type: 'all' }], title: 'Sample Slide Show' } })
  const st = p.match(/^\/status\/(\d{3})$/)
  if (st) { const code = Number(st[1]); return res(code, [['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['content-length', code === 418 ? '135' : '0'], ['server', 'gunicorn/19.9.0']], code === 418 ? "\n    -=[ teapot ]=-\n\n       _...._\n     .'  _ _ `.\n    | .\"` ^ `\". _,\n    \\_;`\"---\"`|//\n      |       ;/\n      \\_     _/\n        `\"\"\"`\n" : '', version) }
  const rd = p.match(/^\/redirect\/(\d+)$/)
  if (rd) { const n = Number(rd[1]); const to = n <= 1 ? '/get' : `/relative-redirect/${n - 1}`; return res(302, [['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['content-length', '215'], ['location', to], ['server', 'gunicorn/19.9.0']], `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<title>Redirecting...</title>\n<h1>Redirecting...</h1>\n<p>You should be redirected automatically to target URL: <a href="${to}">${to}</a>.  If not click the link.\n`, version) }
  const rr = p.match(/^\/relative-redirect\/(\d+)$/)
  if (rr) { const n = Number(rr[1]); const to = n <= 1 ? '/get' : `/relative-redirect/${n - 1}`; return res(302, [['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['content-length', '0'], ['location', to], ['server', 'gunicorn/19.9.0']], '', version) }
  if (p === '/redirect-to') { const to = parseQuery(req.path).url ?? '/get'; return res(302, [['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['content-length', '0'], ['location', to], ['server', 'gunicorn/19.9.0']], '', version) }
  const dl = p.match(/^\/delay\/(\d+)$/)
  if (dl) return json(200, { args: parseQuery(req.path), data: '', files: {}, form: {}, headers, origin, url })
  const ba = p.match(/^\/basic-auth\/([^/]+)\/([^/]+)$/)
  if (ba) return req.auth === `${ba[1]}:${ba[2]}` ? json(200, { authenticated: true, user: ba[1] }) : res(401, [['date', DATE_HTTP], ['content-length', '0'], ['server', 'gunicorn/19.9.0'], ['www-authenticate', 'Basic realm="Fake Realm"']], '', version)
  if (p === '/' ) return res(200, [['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['content-length', '9593'], ['server', 'gunicorn/19.9.0']], '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <title>httpbin.org</title>\n</head>\n<body>\n<h2>httpbin.org: A simple HTTP Request &amp; Response Service.</h2>\n<p>Try /get, /post, /headers, /ip, /status/404, /redirect/1 and /delay/2.</p>\n</body>\n</html>\n', version)
  return res(404, [['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['content-length', '233'], ['server', 'gunicorn/19.9.0']], '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<title>404 Not Found</title>\n<h1>Not Found</h1>\n<p>The requested URL was not found on the server.  If you entered the URL manually please check your spelling and try again.</p>\n', version)
}

const contentType = (name: string) => (/\.html?$/.test(name) ? 'text/html' : /\.css$/.test(name) ? 'text/css' : /\.js$/.test(name) ? 'text/javascript' : /\.json$/.test(name) ? 'application/json' : /\.py$/.test(name) ? 'text/x-python' : /\.(png|jpe?g|gif)$/.test(name) ? 'image/' + name.split('.').pop() : /\.txt$|\.md$|\.csv$|\.log$|\.sh$/.test(name) ? 'text/plain' : 'application/octet-stream')

/** python3 -m http.server serves the learner's home directory (where it was started). */
function pythonHttpServer(sh: Shell, req: HttpReq): HttpRes {
  const h: [string, string][] = [['Server', 'SimpleHTTP/0.6 Python/3.12.3'], ['Date', DATE_HTTP]]
  const p = decodeURIComponent(req.path.split('?')[0])
  const abs = HOME + (p === '/' ? '' : p.replace(/\/$/, ''))
  const node = sh.vfs.get(abs)
  if (!node) return res(404, [...h, ['Connection', 'close'], ['Content-Type', 'text/html;charset=utf-8'], ['Content-Length', '335']], '<!DOCTYPE HTML>\n<html lang="en">\n    <head>\n        <meta charset="utf-8">\n        <title>Error response</title>\n    </head>\n    <body>\n        <h1>Error response</h1>\n        <p>Error code: 404</p>\n        <p>Message: File not found.</p>\n        <p>Error code explanation: 404 - Nothing matches the given URI.</p>\n    </body>\n</html>\n', 'HTTP/1.0')
  if (node.type === 'dir') {
    if (!p.endsWith('/')) return res(301, [...h, ['Location', p + '/'], ['Content-Length', '0']], '', 'HTTP/1.0')
    const index = node.children.get('index.html')
    if (index?.type === 'file') return res(200, [...h, ['Content-type', 'text/html'], ['Content-Length', String(index.content.length)], ['Last-Modified', DATE_HTTP]], index.content, 'HTTP/1.0')
    const items = [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, n]) => `<li><a href="${name}${n.type === 'dir' ? '/' : ''}">${name}${n.type === 'dir' ? '/' : ''}</a></li>`)
    const body = `<!DOCTYPE HTML>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Directory listing for ${p}</title>\n</head>\n<body>\n<h1>Directory listing for ${p}</h1>\n<hr>\n<ul>\n${items.join('\n')}\n</ul>\n<hr>\n</body>\n</html>\n`
    return res(200, [...h, ['Content-type', 'text/html; charset=utf-8'], ['Content-Length', String(body.length)]], body, 'HTTP/1.0')
  }
  return res(200, [...h, ['Content-type', contentType(abs)], ['Content-Length', String(node.content.length)], ['Last-Modified', DATE_HTTP]], node.content, 'HTTP/1.0')
}

const NGINX_HTML = '<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n<style>\nhtml { color-scheme: light dark; }\nbody { width: 35em; margin: 0 auto;\nfont-family: Tahoma, Verdana, Arial, sans-serif; }\n</style>\n</head>\n<body>\n<h1>Welcome to nginx!</h1>\n<p>If you see this page, the web server is successfully installed and\nworking. Further configuration is required.</p>\n\n<p><em>Thank you for using it.</em></p>\n</body>\n</html>\n'

/** Talk to whatever listens locally on a port. */
function localHttp(sh: Shell, req: HttpReq): HttpRes | NetError {
  const sock = listenerOn(sh, req.port)
  if (!sock) return { error: `Failed to connect to ${req.host} port ${req.port} after 0 ms: Couldn't connect to server`, code: 7 }
  if (sock.proc === 'sshd') return { error: 'Received HTTP/0.9 when not allowed', code: 1 }
  if (sock.proc === 'nginx') {
    const p = req.path.split('?')[0]
    if (p === '/' || p === '/index.html' || p === '/index.nginx-debian.html') return res(200, [['Server', 'nginx/1.24.0 (Ubuntu)'], ['Date', DATE_HTTP], ['Content-Type', 'text/html'], ['Content-Length', String(NGINX_HTML.length)], ['Last-Modified', 'Mon, 14 Sep 2026 07:26:11 GMT'], ['Connection', 'keep-alive'], ['ETag', '"68c6a1b3-267"'], ['Accept-Ranges', 'bytes']], NGINX_HTML)
    const body = '<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>nginx/1.24.0 (Ubuntu)</center>\n</body>\n</html>\n'
    return res(404, [['Server', 'nginx/1.24.0 (Ubuntu)'], ['Date', DATE_HTTP], ['Content-Type', 'text/html'], ['Content-Length', String(body.length)], ['Connection', 'keep-alive']], body)
  }
  if (sock.proc === 'python3') return pythonHttpServer(sh, req)
  if (sock.proc === 'nc') return res(200, [['Content-Type', 'text/plain']], '', 'HTTP/1.0')
  const body = `Hello from ${sock.proc} on port ${sock.port}\n`
  return res(200, [['Content-Type', 'text/plain'], ['Content-Length', String(body.length)], ['Date', DATE_HTTP]], body)
}

/** Perform one HTTP request against the pretend internet. */
function httpRequest(sh: Shell, req: HttpReq, maxTime?: number): HttpRes | NetError {
  const r = resolve(sh, req.host)
  if (!r) return { error: `Could not resolve host: ${req.host}`, code: 6 }
  if (r.ip === VM_IP) {
    const v = firewallVerdict(sh, req.port)
    if (v === 'drop') return { error: `Failed to connect to ${req.host} port ${req.port} after ${maxTime ? maxTime * 1000 + 1 : 130001} ms: ${maxTime ? 'Timeout was reached' : "Couldn't connect to server"}`, code: 28 }
    if (v === 'reject') return { error: `Failed to connect to ${req.host} port ${req.port} after 0 ms: Couldn't connect to server`, code: 7 }
  }
  if (isThisBox(r.ip)) return localHttp(sh, req)
  const name = req.host.toLowerCase().replace(/\.$/, '')
  const dnsName = r.source === 'dns' ? name : Object.keys(DNS).find((k) => DNS[k].A?.includes(r.ip)) ?? name
  const path = req.path.split('?')[0]
  const v2 = req.scheme === 'https' ? 'HTTP/2' : 'HTTP/1.1'
  const dl = path.match(/^\/delay\/(\d+)$/)
  if (dnsName === 'httpbin.org' && dl && maxTime !== undefined && Number(dl[1]) > maxTime) return { error: `Operation timed out after ${maxTime * 1000 + 3} milliseconds with 0 bytes received`, code: 28 }
  if (dnsName === 'httpbin.org') return httpbin(req)
  if (dnsName === 'example.com' || dnsName === 'www.example.com') {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res(405, [['Content-Type', 'text/html'], ['Date', DATE_HTTP], ['Server', 'ECS (dcd/7D2C)'], ['Content-Length', '0']], '', v2)
    if (path !== '/' && path !== '/index.html') return res(404, [['Content-Type', 'text/html'], ['Date', DATE_HTTP], ['Server', 'ECS (dcd/7D2C)'], ['Content-Length', '1256']], '<!doctype html>\n<html>\n<head><title>404 - Not Found</title></head>\n<body><h1>404 - Not Found</h1></body>\n</html>\n', v2)
    return res(200, [['Accept-Ranges', 'bytes'], ['Age', '512103'], ['Cache-Control', 'max-age=604800'], ['Content-Type', 'text/html; charset=UTF-8'], ['Date', DATE_HTTP], ['Etag', '"3147526947"'], ['Expires', 'Thu, 25 Sep 2026 09:41:07 GMT'], ['Last-Modified', 'Thu, 17 Oct 2019 07:18:26 GMT'], ['Server', 'ECS (dcd/7D2C)'], ['Vary', 'Accept-Encoding'], ['X-Cache', 'HIT'], ['Content-Length', String(EXAMPLE_HTML.length)]], EXAMPLE_HTML, v2)
  }
  if (dnsName === 'api.github.com') {
    if (path === '/zen') return res(200, [['server', 'GitHub.com'], ['date', DATE_HTTP], ['content-type', 'text/plain;charset=utf-8'], ['content-length', '26'], ['x-ratelimit-limit', '60'], ['x-ratelimit-remaining', '58']], 'Keep it logically awesome.', 'HTTP/2')
    if (path === '/') return res(200, [['server', 'GitHub.com'], ['date', DATE_HTTP], ['content-type', 'application/json; charset=utf-8']], jsonBody({ current_user_url: 'https://api.github.com/user', emojis_url: 'https://api.github.com/emojis', rate_limit_url: 'https://api.github.com/rate_limit' }), 'HTTP/2')
    return res(404, [['server', 'GitHub.com'], ['date', DATE_HTTP], ['content-type', 'application/json; charset=utf-8']], jsonBody({ message: 'Not Found', documentation_url: 'https://docs.github.com/rest', status: '404' }), 'HTTP/2')
  }
  if (dnsName === 'github.com') {
    if (req.scheme === 'http') return res(301, [['Content-Length', '0'], ['Location', 'https://github.com' + req.path]], '', 'HTTP/1.1')
    return res(200, [['server', 'GitHub.com'], ['date', DATE_HTTP], ['content-type', 'text/html; charset=utf-8'], ['x-frame-options', 'deny']], '<!DOCTYPE html>\n<html lang="en">\n<head><title>GitHub: Let\'s build from here</title></head>\n<body>(page trimmed)</body>\n</html>\n', 'HTTP/2')
  }
  if (dnsName === 'google.com' || dnsName === 'www.google.com') {
    if (dnsName === 'google.com') return res(301, [['Location', `${req.scheme}://www.google.com/`], ['Content-Type', 'text/html; charset=UTF-8'], ['Date', DATE_HTTP], ['Content-Length', '219']], '<HTML><HEAD><meta http-equiv="content-type" content="text/html;charset=utf-8">\n<TITLE>301 Moved</TITLE></HEAD><BODY>\n<H1>301 Moved</H1>\nThe document has moved\n<A HREF="http://www.google.com/">here</A>.\r\n</BODY></HTML>\r\n', v2)
    return res(200, [['Date', DATE_HTTP], ['Content-Type', 'text/html; charset=ISO-8859-1'], ['Server', 'gws'], ['X-XSS-Protection', '0']], '<!doctype html><html><head><title>Google</title></head><body>(page trimmed)</body></html>\n', v2)
  }
  if (dnsName === 'ubuntu.com' || dnsName === 'archive.ubuntu.com' || dnsName === 'wikipedia.org') {
    if (req.scheme === 'http' && dnsName !== 'archive.ubuntu.com') return res(301, [['Server', 'nginx'], ['Date', DATE_HTTP], ['Content-Type', 'text/html'], ['Content-Length', '162'], ['Location', `https://${dnsName}${req.path}`]], '<html>\n<head><title>301 Moved Permanently</title></head>\n<body>\n<center><h1>301 Moved Permanently</h1></center>\n<hr><center>nginx</center>\n</body>\n</html>\n', 'HTTP/1.1')
    return res(200, [['Server', 'nginx'], ['Date', DATE_HTTP], ['Content-Type', 'text/html; charset=utf-8']], `<!doctype html>\n<html><head><title>${dnsName}</title></head><body>(page trimmed)</body></html>\n`, v2)
  }
  // Something resolvable (an /etc/hosts entry, a made-up IP) that nothing answers on.
  return { error: `Failed to connect to ${req.host} port ${req.port} after ${maxTime ? maxTime * 1000 + 2 : 131024} ms: ${maxTime ? 'Timeout was reached' : "Couldn't connect to server"}`, code: 28 }
}

/* ======================= curl ======================= */

interface CurlOpts { head: boolean; include: boolean; silent: boolean; showError: boolean; verbose: boolean; output?: string; remoteName: boolean; follow: boolean; method?: string; headers: [string, string][]; data: string[]; maxTime?: number; writeOut?: string; failOnError: boolean; userAgent?: string; auth?: string; urls: string[] }

function parseCurlArgs(args: string[]): CurlOpts | string {
  const o: CurlOpts = { head: false, include: false, silent: false, showError: false, verbose: false, remoteName: false, follow: false, headers: [], data: [], failOnError: false, urls: [] }
  const need = (i: number, name: string) => { if (args[i + 1] === undefined) throw new Error(`option ${name}: requires parameter`) }
  try {
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a === '--') { o.urls.push(...args.slice(i + 1)); break }
      if (a.startsWith('--')) {
        const [name, inline] = a.slice(2).split('=', 2) as [string, string | undefined]
        const val = () => { if (inline !== undefined) return inline; need(i, '--' + name); return args[++i] }
        switch (name) {
          case 'head': o.head = true; break
          case 'include': o.include = true; break
          case 'silent': o.silent = true; break
          case 'show-error': o.showError = true; break
          case 'verbose': o.verbose = true; break
          case 'output': o.output = val(); break
          case 'remote-name': o.remoteName = true; break
          case 'location': o.follow = true; break
          case 'request': o.method = val().toUpperCase(); break
          case 'header': { const h = val(); const c = h.indexOf(':'); if (c > 0) o.headers.push([h.slice(0, c).trim(), h.slice(c + 1).trim()]); break }
          case 'data': case 'data-raw': case 'data-binary': case 'data-urlencode': o.data.push(val()); break
          case 'max-time': o.maxTime = Number(val()); break
          case 'connect-timeout': val(); break
          case 'write-out': o.writeOut = val(); break
          case 'fail': o.failOnError = true; break
          case 'user-agent': o.userAgent = val(); break
          case 'user': o.auth = val(); break
          case 'json': o.data.push(val()); o.headers.push(['Content-Type', 'application/json'], ['Accept', 'application/json']); break
          case 'insecure': case 'compressed': case 'ipv4': case 'ipv6': case 'no-progress-meter': case 'globoff': case 'tlsv1.2': case 'http1.1': case 'http2': break
          case 'retry': case 'retry-delay': case 'resolve': case 'cacert': case 'cookie': case 'referer': case 'proxy': val(); break
          case 'help': return 'help'
          case 'version': return 'version'
          default: return `curl: option --${name}: is unknown\ncurl: try 'curl --help' for more information`
        }
        continue
      }
      if (a.startsWith('-') && a.length > 1) {
        const chars = a.slice(1)
        for (let k = 0; k < chars.length; k++) {
          const c = chars[k]
          const rest = chars.slice(k + 1)
          const val = () => { if (rest) { k = chars.length; return rest } need(i, '-' + c); return args[++i] }
          if (c === 'I') o.head = true
          else if (c === 'i') o.include = true
          else if (c === 's') o.silent = true
          else if (c === 'S') o.showError = true
          else if (c === 'v') o.verbose = true
          else if (c === 'o') o.output = val()
          else if (c === 'O') o.remoteName = true
          else if (c === 'L') o.follow = true
          else if (c === 'X') o.method = val().toUpperCase()
          else if (c === 'H') { const h = val(); const col = h.indexOf(':'); if (col > 0) o.headers.push([h.slice(0, col).trim(), h.slice(col + 1).trim()]) }
          else if (c === 'd') o.data.push(val())
          else if (c === 'm') o.maxTime = Number(val())
          else if (c === 'w') o.writeOut = val()
          else if (c === 'f') o.failOnError = true
          else if (c === 'A') o.userAgent = val()
          else if (c === 'u') o.auth = val()
          else if (c === 'k' || c === '4' || c === '6' || c === 'N') { /* accepted, no effect */ }
          else if (c === 'b' || c === 'e' || c === 'x' || c === 'c') val()
          else if (c === 'h') return 'help'
          else if (c === 'V') return 'version'
          else return `curl: option -${c}: is unknown\ncurl: try 'curl --help' for more information`
        }
        continue
      }
      o.urls.push(a)
    }
  } catch (e) {
    return `curl: ${(e as Error).message}\ncurl: try 'curl --help' for more information`
  }
  return o
}

function parseUrl(raw: string): { scheme: 'http' | 'https'; host: string; port: number; path: string } | null {
  const m = raw.match(/^(?:(https?):\/\/)?([^/:?#]+)(?::(\d+))?(\/[^#]*)?/i)
  if (!m) return null
  const scheme = (m[1]?.toLowerCase() ?? 'http') as 'http' | 'https'
  return { scheme, host: m[2], port: m[3] ? Number(m[3]) : scheme === 'https' ? 443 : 80, path: m[4] || '/' }
}

function curlHelp() {
  return ok('Usage: curl [options...] <url>\n -d, --data <data>          HTTP POST data\n -f, --fail                 Fail fast with no output on HTTP errors\n -H, --header <header/@file> Pass custom header(s) to server\n -i, --include              Include response headers in output\n -I, --head                 Show document info only\n -L, --location             Follow redirects\n -m, --max-time <secs>      Maximum time allowed for transfer\n -o, --output <file>        Write to file instead of stdout\n -O, --remote-name          Write output to file named as remote file\n -s, --silent               Silent mode\n -S, --show-error           Show error even when -s is used\n -u, --user <user:password> Server user and password\n -A, --user-agent <name>    Send User-Agent <name> to server\n -v, --verbose              Make the operation more talkative\n -w, --write-out <format>   Use output FORMAT after completion\n -X, --request <method>     Specify request method to use\n\nThis is not the full help text. Use "curl --help all" on a real machine to see all options.\n')
}

const curl: Command = (sh, args) => {
  const o = parseCurlArgs(args)
  if (typeof o === 'string') {
    if (o === 'help') return curlHelp()
    if (o === 'version') return ok('curl 8.5.0 (aarch64-unknown-linux-gnu) libcurl/8.5.0 OpenSSL/3.0.13 zlib/1.3 nghttp2/1.59.0\nRelease-Date: 2023-12-06\nProtocols: file ftp ftps http https\nFeatures: alt-svc AsynchDNS HSTS HTTP2 HTTPS-proxy IPv6 SSL threadsafe TLS-SRP UnixSockets\n')
    return fail(o, 2)
  }
  if (!o.urls.length) return fail("curl: try 'curl --help' or 'curl --manual' for more information", 2)
  const s = netState(sh)
  let out = ''
  let err = ''
  let code = 0
  for (const raw of o.urls) {
    const u = parseUrl(raw)
    if (!u) { err += `curl: (3) URL rejected: Malformed input to a URL function\n`; code = 3; continue }
    const method = o.method ?? (o.head ? 'HEAD' : o.data.length ? 'POST' : 'GET')
    const headers = [...o.headers]
    if (o.userAgent) headers.push(['User-Agent', o.userAgent])
    let req: HttpReq = { method, scheme: u.scheme, host: u.host, port: u.port, path: u.path, headers, body: o.data.join('&'), auth: o.auth }
    s.fetched.push(raw)
    let result: HttpRes | NetError = httpRequest(sh, req, o.maxTime)
    let hops = 0
    let verbose = ''
    const describe = (rq: HttpReq, rs: HttpRes | NetError) => {
      const ip = resolve(sh, rq.host)?.ip ?? '?'
      let v = `*   Trying ${ip}:${rq.port}...\n* Connected to ${rq.host} (${ip}) port ${rq.port}\n`
      if (rq.scheme === 'https') v += `* ALPN: curl offers h2,http/1.1\n* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n* Server certificate:\n*  subject: CN=${rq.host}\n*  SSL certificate verify ok.\n* using HTTP/2\n`
      const reqLine = rq.scheme === 'https' ? `${rq.method} ${rq.path} HTTP/2` : `${rq.method} ${rq.path} HTTP/1.1`
      const hdrs: [string, string][] = [['Host', rq.host], ['User-Agent', o.userAgent ?? CURL_UA], ['Accept', '*/*'], ...o.headers]
      if (rq.body) hdrs.push(['Content-Length', String(rq.body.length)], ['Content-Type', o.headers.some(([k]) => k.toLowerCase() === 'content-type') ? '' : 'application/x-www-form-urlencoded'])
      v += `> ${reqLine}\n` + hdrs.filter(([, val]) => val !== '').map(([k, val]) => `> ${k}: ${val}\n`).join('') + '>\n'
      if ('error' in rs) return v
      v += `< ${rs.version} ${rs.status}${rs.version === 'HTTP/2' ? ' ' : ' ' + rs.reason}\n` + rs.headers.map(([k, val]) => `< ${k}: ${val}\n`).join('') + '<\n'
      return v
    }
    if (o.verbose) verbose += describe(req, result)
    while (o.follow && !('error' in result) && [301, 302, 303, 307, 308].includes(result.status) && hops < 10) {
      const loc = result.headers.find(([k]) => k.toLowerCase() === 'location')?.[1]
      if (!loc) break
      hops++
      const next = loc.startsWith('/') ? { scheme: req.scheme, host: req.host, port: req.port, path: loc } : parseUrl(loc)
      if (!next) break
      const keepBody = result.status === 307 || result.status === 308
      req = { ...req, ...next, method: keepBody ? req.method : req.method === 'HEAD' ? 'HEAD' : 'GET', body: keepBody ? req.body : '' }
      if (o.verbose) verbose += `* Issue another request to this URL: '${loc.startsWith('/') ? `${req.scheme}://${req.host}${loc}` : loc}'\n`
      result = httpRequest(sh, req, o.maxTime)
      if (o.verbose) verbose += describe(req, result)
    }
    if (o.verbose) err += verbose
    if ('error' in result) {
      if (!o.silent || o.showError) err += `curl: (${result.code}) ${result.error}\n`
      if (o.writeOut) out += o.writeOut.replace(/%\{(http_code|response_code)\}/g, '000').replace(/%\{[a-z_]+\}/g, '').replace(/\\n/g, '\n')
      code = result.code
      continue
    }
    if (o.verbose) err += `* Connection #0 to host ${req.host} left intact\n`
    if (o.failOnError && result.status >= 400) {
      if (!o.silent || o.showError) err += `curl: (22) The requested URL returned error: ${result.status}\n`
      code = 22
      if (o.writeOut) out += o.writeOut.replace(/%\{http_code\}/g, String(result.status)).replace(/\\n/g, '\n')
      continue
    }
    const statusLine = `${result.version} ${result.status}${result.version === 'HTTP/2' ? ' ' : ' ' + result.reason}`
    const headerBlock = statusLine + '\n' + result.headers.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\n'
    const body = method === 'HEAD' ? '' : result.body
    let text = o.head ? headerBlock : o.include ? headerBlock + body : body
    if (o.remoteName || o.output) {
      const target = o.output ?? (u.path.split('?')[0].split('/').pop() || '')
      if (!target) { err += 'curl: (23) Failure writing output to destination\ncurl: Remote file name has no length\n'; code = 23; continue }
      if (target !== '/dev/null') { try { sh.writeFile(target, text) } catch (e) { err += `curl: (23) Failed to open the file ${target}: ${(e as Error).message}\n`; code = 23; continue } }
      if (!o.silent) err += `  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100 ${String(text.length).padStart(5)}  100 ${String(text.length).padStart(5)}    0     0  ${String(Math.max(1000, text.length * 40)).padStart(6)}      0 --:--:-- --:--:-- --:--:-- ${String(Math.max(1000, text.length * 40)).padStart(6)}\n`
      text = ''
    }
    out += text
    if (o.writeOut) {
      const ct = result.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
      out += o.writeOut.replace(/%\{http_code\}/g, String(result.status)).replace(/%\{response_code\}/g, String(result.status)).replace(/%\{content_type\}/g, ct).replace(/%\{time_total\}/g, '0.084213').replace(/%\{size_download\}/g, String(body.length)).replace(/%\{url_effective\}/g, `${req.scheme}://${req.host}${req.port === (req.scheme === 'https' ? 443 : 80) ? '' : ':' + req.port}${req.path}`).replace(/%\{redirect_url\}/g, result.headers.find(([k]) => k.toLowerCase() === 'location')?.[1] ?? '').replace(/%\{remote_ip\}/g, resolve(sh, req.host)?.ip ?? '').replace(/%\{num_redirects\}/g, String(hops)).replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    }
  }
  return { out, err, code }
}

/* ======================= ip, hostname, ping, ss, nc ======================= */

const ip: Command = (_sh, args) => {
  const flags = args.filter((a) => a.startsWith('-'))
  const words = args.filter((a) => !a.startsWith('-'))
  const brief = flags.some((f) => f === '-br' || f === '-brief' || f === '-b')
  const v4only = flags.includes('-4')
  const v6only = flags.includes('-6')
  const sub = words[0] ?? ''
  const rest = words.slice(1)
  const isAddrOrLink = ['addr', 'a', 'address', 'ad', 'link', 'l'].includes(sub)
  const dev = isAddrOrLink ? rest.find((w) => w !== 'show' && w !== 'dev' && w !== 'up') : undefined
  if (dev && dev !== 'lo' && dev !== IFACE) return fail(`Device "${dev}" does not exist.`)
  const ifaces = (dev ? [dev] : ['lo', IFACE])
  if (sub === 'addr' || sub === 'a' || sub === 'address' || sub === 'ad') {
    if (brief) {
      const lo = `lo               UNKNOWN        ${v6only ? '' : '127.0.0.1/8 '}${v4only ? '' : '::1/128 '}`
      const en = `${IFACE.padEnd(16)} UP             ${v6only ? '' : `${VM_IP}/24 `}${v4only ? '' : 'fde4:8dba:82e1:0:5054:ff:fe12:3456/64 fe80::5054:ff:fe12:3456/64 '}`
      return ok(joinLines(ifaces.map((i) => (i === 'lo' ? lo : en))))
    }
    const lo = '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n' + (v6only ? '' : '    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n') + (v4only ? '' : '    inet6 ::1/128 scope host noprefixroute \n       valid_lft forever preferred_lft forever\n')
    const en = `2: ${IFACE}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether ${MAC} brd ff:ff:ff:ff:ff:ff\n` + (v6only ? '' : `    inet ${VM_IP}/24 metric 100 brd 192.168.64.255 scope global dynamic ${IFACE}\n       valid_lft 86050sec preferred_lft 86050sec\n`) + (v4only ? '' : '    inet6 fde4:8dba:82e1:0:5054:ff:fe12:3456/64 scope global dynamic mngtmpaddr noprefixroute \n       valid_lft 2591870sec preferred_lft 604670sec\n    inet6 fe80::5054:ff:fe12:3456/64 scope link \n       valid_lft forever preferred_lft forever\n')
    return ok(ifaces.map((i) => (i === 'lo' ? lo : en)).join(''))
  }
  if (sub === 'link' || sub === 'l') {
    if (brief) return ok(joinLines(ifaces.map((i) => (i === 'lo' ? 'lo               UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP> ' : `${IFACE.padEnd(16)} UP             ${MAC} <BROADCAST,MULTICAST,UP,LOWER_UP> `))))
    return ok(ifaces.map((i) => (i === 'lo' ? '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n' : `2: ${IFACE}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000\n    link/ether ${MAC} brd ff:ff:ff:ff:ff:ff\n`)).join(''))
  }
  if (sub === 'route' || sub === 'r' || sub === 'ro') {
    if (rest[0] === 'get' && rest[1]) {
      const target = rest[1]
      if (!isIPv4(target)) return fail(`Error: any valid prefix is expected rather than "${target}".`)
      if (isLoopback(target) || target === VM_IP) return ok(`local ${target} dev lo src ${target} uid 1000 \n    cache <local> \n`)
      if (inNetwork(target, '192.168.64.0/24')) return ok(`${target} dev ${IFACE} src ${VM_IP} uid 1000 \n    cache \n`)
      return ok(`${target} via ${GATEWAY} dev ${IFACE} src ${VM_IP} uid 1000 \n    cache \n`)
    }
    return ok(`default via ${GATEWAY} dev ${IFACE} proto dhcp src ${VM_IP} metric 100 \n192.168.64.0/24 dev ${IFACE} proto kernel scope link src ${VM_IP} metric 100 \n${GATEWAY} dev ${IFACE} proto dhcp scope link src ${VM_IP} metric 100 \n`)
  }
  if (sub === 'neigh' || sub === 'n' || sub === 'neighbour' || sub === 'neighbor') return ok(`${GATEWAY} dev ${IFACE} lladdr 52:54:00:ab:cd:01 REACHABLE \n`)
  if (sub === '' || sub === 'help') return fail('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | route | neigh }\n       OPTIONS := { -4 | -6 | -br[ief] }', 255)
  return fail(`Object "${sub}" is unknown, try "ip help".`)
}

const ping: Command = (sh, args) => {
  let count: number | undefined
  let host: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-c' || a === '-W' || a === '-i' || a === '-w' || a === '-s' || a === '-I') { const v = args[++i]; if (a === '-c') count = Number(v); continue }
    if (/^-c\d+$/.test(a)) { count = Number(a.slice(2)); continue }
    if (a.startsWith('-')) continue
    host = a
  }
  if (!host) return fail('ping: usage error: Destination address required', 2)
  if (count !== undefined && (!Number.isFinite(count) || count < 1)) return fail(`ping: invalid argument: '${count}': out of range: 1 <= value <= 2147483647`, 1)
  const r = resolve(sh, host)
  if (!r) return fail(`ping: ${host}: Name or service not known`, 2)
  const n = count ?? 4
  const known = isThisBox(r.ip) || r.ip === GATEWAY || Object.values(DNS).some((d) => d.A?.includes(r.ip)) || ['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4', '9.9.9.9'].includes(r.ip)
  if (!known) return { out: `PING ${host} (${r.ip}) 56(84) bytes of data.\n\n--- ${host} ping statistics ---\n${n} packets transmitted, 0 received, 100% packet loss, time ${n * 1000 + 35}ms\n\n`, err: '', code: 1 }
  const base = isThisBox(r.ip) ? 0.04 : r.ip === GATEWAY ? 0.6 : 12.3
  const ttl = isThisBox(r.ip) || r.ip === GATEWAY ? 64 : 56
  const from = isThisBox(r.ip) && host === 'localhost' ? 'localhost (127.0.0.1)' : PTR[r.ip] ? `${PTR[r.ip].slice(0, -1)} (${r.ip})` : r.ip
  const times = Array.from({ length: n }, (_, i) => base + ((i * 7) % 5) * (base < 1 ? 0.01 : 0.9))
  const rows = times.map((t, i) => `64 bytes from ${from}: icmp_seq=${i + 1} ttl=${ttl} time=${t.toFixed(base < 1 ? 3 : 1)} ms`)
  const min = Math.min(...times), max = Math.max(...times), avg = times.reduce((a, b) => a + b, 0) / n
  const f = (x: number) => x.toFixed(3)
  const note = count === undefined ? '(ping keeps going until Ctrl+C on a real machine. Use -c N to send N packets and stop.)\n' : ''
  return ok(`PING ${host} (${r.ip}) 56(84) bytes of data.\n${rows.join('\n')}\n\n--- ${host} ping statistics ---\n${n} packets transmitted, ${n} received, 0% packet loss, time ${(n - 1) * 1000 + 12}ms\nrtt min/avg/max/mdev = ${f(min)}/${f(avg)}/${f(max)}/${f((max - min) / 2)} ms\n${note}`)
}

const ss: Command = (sh, args) => {
  const flagChars = args.filter((a) => a.startsWith('-') && !a.startsWith('--')).map((a) => a.slice(1)).join('')
  const long = args.filter((a) => a.startsWith('--')).map((a) => a.slice(2))
  const has = (c: string, l: string) => flagChars.includes(c) || long.includes(l)
  const tcp = has('t', 'tcp'), udp = has('u', 'udp')
  const listening = has('l', 'listening'), all = has('a', 'all'), procs = has('p', 'processes'), noHeader = has('H', 'no-header')
  if (has('s', 'summary')) return ok(`Total: ${sockets(sh).length + 118}\nTCP:   ${sockets(sh).filter((k) => k.proto === 'tcp').length} (estab 1, closed 0, orphaned 0, timewait 0)\n\nTransport Total     IP        IPv6\nRAW\t  0         0         0\nUDP\t  1         1         0\nTCP\t  ${sockets(sh).filter((k) => k.proto === 'tcp').length}         ${sockets(sh).filter((k) => k.proto === 'tcp' && !k.addr.startsWith('[')).length}         ${sockets(sh).filter((k) => k.addr.startsWith('[')).length}\nINET\t  ${sockets(sh).length + 1}         ${sockets(sh).filter((k) => !k.addr.startsWith('[')).length + 1}         ${sockets(sh).filter((k) => k.addr.startsWith('[')).length}\nFRAG\t  0         0         0\n\n`)
  const filter = args.filter((a) => !a.startsWith('-'))
  let rows = sockets(sh)
  if (tcp && !udp) rows = rows.filter((k) => k.proto === 'tcp')
  if (udp && !tcp) rows = rows.filter((k) => k.proto === 'udp')
  if (!listening && !all) rows = rows.filter((k) => k.state === 'ESTAB')
  else if (listening && !all) rows = rows.filter((k) => k.state !== 'ESTAB')
  if (has('4', 'ipv4')) rows = rows.filter((k) => !k.addr.startsWith('['))
  if (has('6', 'ipv6')) rows = rows.filter((k) => k.addr.startsWith('['))
  const portFilter = filter.join(' ').match(/(?:sport|dport)\s*(?:=\s*)?:?(\d+)/)
  if (portFilter) rows = rows.filter((k) => k.port === Number(portFilter[1]))
  const fmt = rows.map((k) => [k.proto, k.state, String(k.recvq), String(k.sendq), `${k.addr}:${k.port}`, k.peer, procs ? `users:(("${k.proc}",pid=${k.pid},fd=${k.fd}))` : ''])
  const header = ['Netid', 'State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', procs ? 'Process' : '']
  const table = noHeader ? fmt : [header, ...fmt]
  const w = (i: number) => Math.max(...table.map((r) => r[i].length))
  const line = (r: string[]) => `${r[0].padEnd(w(0))} ${r[1].padEnd(w(1))} ${r[2].padEnd(w(2))} ${r[3].padEnd(w(3))} ${r[4].padStart(w(4))} ${r[5].padEnd(w(5))} ${r[6]}`.replace(/\s+$/, '')
  return ok(joinLines(table.map(line)))
}

const nc: Command = (sh, args) => {
  const flags = args.filter((a) => a.startsWith('-')).join('')
  const words = args.filter((a) => !a.startsWith('-'))
  if (flags.includes('l')) return fail('nc: listening sockets are only simulated in the background: run "nc -l PORT &" and check with ss -tulpn.')
  const [host, portRaw] = words
  if (!host || !portRaw) return fail('usage: nc [-46CDdFhklNnrStUuvZz] [-I length] [-i interval] [-M ttl]\n\t  [-m minttl] [-O length] [-P proxy_username] [-p source_port]\n\t  [-q seconds] [-s sourceaddr] [-T keyword] [-V rtable] [-W recvlimit]\n\t  [-w timeout] [-X proxy_protocol] [-x proxy_address[:port]]\n\t  [destination] [port]')
  const port = Number(portRaw)
  const r = resolve(sh, host)
  if (!r) return fail(`nc: getaddrinfo for host "${host}" port ${port}: Name or service not known`)
  const svc = Object.entries(SERVICE_PORTS).find(([, v]) => v.port === String(port))?.[0] ?? '*'
  if (isThisBox(r.ip)) {
    if (r.ip === VM_IP && firewallVerdict(sh, port) !== 'allow') return fail(`nc: connect to ${host} (${r.ip}) port ${port} (tcp) failed: Connection timed out`)
    const sock = listenerOn(sh, port)
    if (!sock) return fail(`nc: connect to ${host} (${r.ip}) port ${port} (tcp) failed: Connection refused`)
    return { out: '', err: `Connection to ${host} (${r.ip}) ${port} port [tcp/${svc}] succeeded!\n`, code: 0 }
  }
  const open = (r.source === 'dns' && (port === 80 || port === 443)) || (port === 22 && r.source === 'dns' && host.includes('github'))
  if (open) return { out: '', err: `Connection to ${host} (${r.ip}) ${port} port [tcp/${svc}] succeeded!\n`, code: 0 }
  return fail(`nc: connect to ${host} (${r.ip}) port ${port} (tcp) failed: Connection timed out`)
}

/* ======================= dns tools ======================= */

const dig: Command = (sh, args) => {
  let name: string | undefined
  let type = 'A'
  let short = false
  let server: string | undefined
  let reverse = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '+short') short = true
    else if (a.startsWith('+')) continue
    else if (a.startsWith('@')) server = a.slice(1)
    else if (a === '-x') { reverse = true; name = args[++i] }
    else if (a === '-t') type = (args[++i] ?? 'A').toUpperCase()
    else if (a.startsWith('-')) continue
    else if (/^(A|AAAA|MX|TXT|NS|CNAME|SOA|PTR|ANY)$/i.test(a) && name) type = a.toUpperCase()
    else name = a
  }
  const srv = server ?? '127.0.0.53'
  const trailer = (status: string, q: string, qt: string, answers: string[], size: number) => `\n; <<>> DiG 9.18.28-0ubuntu0.24.04.1-Ubuntu <<>> ${args.join(' ')}\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${43102 + q.length}\n;; flags: qr rd ra; QUERY: 1, ANSWER: ${answers.length}, AUTHORITY: ${status === 'NXDOMAIN' ? 1 : 0}, ADDITIONAL: 1\n\n;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: ${server ? 1232 : 65494}\n;; QUESTION SECTION:\n;${q}.\t\t\tIN\t${qt}\n\n${answers.length ? `;; ANSWER SECTION:\n${answers.join('\n')}\n\n` : status === 'NXDOMAIN' ? `;; AUTHORITY SECTION:\n${q.split('.').slice(-2).join('.')}.\t\t1800\tIN\tSOA\ta.root-servers.net. nstld.verisign-grs.com. 2026091800 1800 900 604800 86400\n\n` : ''};; Query time: ${server ? 24 : 4} msec\n;; SERVER: ${srv}#53(${srv}) (UDP)\n;; WHEN: Fri Sep 18 09:41:07 UTC 2026\n;; MSG SIZE  rcvd: ${size}\n\n`
  if (!name) return ok(trailer('NOERROR', '', 'NS', ['.\t\t\t518400\tIN\tNS\ta.root-servers.net.', '.\t\t\t518400\tIN\tNS\tb.root-servers.net.', '.\t\t\t518400\tIN\tNS\tc.root-servers.net.'], 239))
  if (reverse) {
    const ptr = PTR[name]
    const q = name.split('.').reverse().join('.') + '.in-addr.arpa'
    if (short) return ptr ? ok(ptr + '\n') : ok()
    return ok(trailer(ptr ? 'NOERROR' : 'NXDOMAIN', q, 'PTR', ptr ? [`${q}.\t\t${ptr === 'localhost.' ? 0 : 3600}\tIN\tPTR\t${ptr}`] : [], ptr ? 87 : 118))
  }
  const n = name.toLowerCase().replace(/\.$/, '')
  const hostsHit = etcHosts(sh).find(([, names]) => names.map((x) => x.toLowerCase()).includes(n))
  const rec = DNS[n]
  if (!rec) {
    // dig asks DNS directly, so /etc/hosts entries do not count.
    if (short) return { out: '', err: hostsHit ? '' : '', code: 0 }
    return ok(trailer('NXDOMAIN', n, type, [], 104 + n.length))
  }
  const ttl = rec.ttl ?? 300
  const answers: string[] = []
  const add = (t: string, vals: string[] | undefined) => { for (const v of vals ?? []) answers.push(`${n}.\t\t${ttl}\tIN\t${t}\t${v}`) }
  if (type === 'ANY') { add('A', rec.A); add('AAAA', rec.AAAA); add('MX', rec.MX); add('TXT', rec.TXT); add('NS', rec.NS) }
  else add(type, (rec as Record<string, string[] | undefined>)[type])
  if (short) return ok(joinLines(answers.map((a) => a.split('\t').slice(5).join('\t'))))
  return ok(trailer('NOERROR', n, type, answers, 56 + answers.length * 16 + n.length))
}

const nslookup: Command = (sh, args) => {
  const words = args.filter((a) => !a.startsWith('-'))
  const typeArg = args.find((a) => /^-(type|query)=/.test(a))?.split('=')[1]?.toUpperCase()
  const name = words[0]
  if (!name) return fail('nslookup: interactive mode is not simulated here. Use nslookup NAME.')
  const server = words[1] ?? '127.0.0.53'
  const head = `Server:\t\t${server}\nAddress:\t${server}#53\n\n`
  if (isIPv4(name)) {
    const ptr = PTR[name]
    if (!ptr) return { out: head + `** server can't find ${name.split('.').reverse().join('.')}.in-addr.arpa: NXDOMAIN\n\n`, err: '', code: 1 }
    return ok(head + `${name.split('.').reverse().join('.')}.in-addr.arpa\tname = ${ptr}\n\nAuthoritative answers can be found from:\n\n`)
  }
  const n = name.toLowerCase()
  const rec = DNS[n]
  if (!rec) {
    const hosts = resolve(sh, n)
    if (hosts && hosts.source === 'hosts') return ok(head + `Name:\t${name}\nAddress: ${hosts.ip}\n\n`)
    return { out: head + `** server can't find ${name}: NXDOMAIN\n\n`, err: '', code: 1 }
  }
  if (typeArg && typeArg !== 'A' && typeArg !== 'AAAA') {
    const vals = (rec as Record<string, string[] | undefined>)[typeArg] ?? []
    if (!vals.length) return ok(head + `*** Can't find ${name}: No answer\n\n`)
    const fmt = (v: string) => (typeArg === 'MX' ? `\tmail exchanger = ${v}` : typeArg === 'NS' ? `\tnameserver = ${v}` : typeArg === 'TXT' ? `\ttext = ${v}` : `\t${v}`)
    return ok(head + 'Non-authoritative answer:\n' + vals.map((v) => `${name}${fmt(v)}`).join('\n') + '\n\nAuthoritative answers can be found from:\n\n')
  }
  const addrs = [...(rec.A ?? []), ...(rec.AAAA ?? [])]
  return ok(head + 'Non-authoritative answer:\n' + addrs.map((a) => `Name:\t${name}\nAddress: ${a}`).join('\n') + '\n\n')
}

const host: Command = (sh, args) => {
  const words = args.filter((a) => !a.startsWith('-'))
  const typeIdx = args.indexOf('-t')
  const type = typeIdx >= 0 ? args[typeIdx + 1]?.toUpperCase() : undefined
  const name = words.filter((w, i) => !(typeIdx >= 0 && args[typeIdx + 1] === w && i === 0))[0]
  if (!name) return fail('Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]\n            [-R number] [-m flag] [-p port] hostname [server]', 1)
  if (isIPv4(name)) {
    const ptr = PTR[name]
    if (!ptr) return fail(`Host ${name.split('.').reverse().join('.')}.in-addr.arpa. not found: 3(NXDOMAIN)`)
    return ok(`${name.split('.').reverse().join('.')}.in-addr.arpa domain name pointer ${ptr}\n`)
  }
  const n = name.toLowerCase()
  const rec = DNS[n]
  if (!rec) {
    const hosts = resolve(sh, n)
    if (hosts && hosts.source === 'hosts') return ok(`${name} has address ${hosts.ip}\n`)
    return fail(`Host ${name} not found: 3(NXDOMAIN)`)
  }
  if (type) {
    const vals = (rec as Record<string, string[] | undefined>)[type] ?? []
    if (!vals.length) return ok(`${name} has no ${type} record\n`)
    return ok(joinLines(vals.map((v) => (type === 'MX' ? `${name} mail is handled by ${v}` : type === 'NS' ? `${name} name server ${v}` : type === 'TXT' ? `${name} descriptive text ${v}` : type === 'AAAA' ? `${name} has IPv6 address ${v}` : `${name} has address ${v}`))))
  }
  const out = [...(rec.A ?? []).map((a) => `${name} has address ${a}`), ...(rec.AAAA ?? []).map((a) => `${name} has IPv6 address ${a}`), ...(rec.MX ?? []).map((m) => `${name} mail is handled by ${m}`)]
  return ok(joinLines(out))
}

const getent: Command = (sh, args) => {
  const [db, ...keys] = args
  if (db === 'hosts' || db === 'ahosts' || db === 'ahostsv4') {
    if (!keys.length) return ok(joinLines(etcHosts(sh).map(([ip, names]) => `${ip.padEnd(15)} ${names.join(' ')}`)))
    let out = ''
    let code = 0
    for (const k of keys) {
      const r = resolve(sh, k)
      if (!r) { code = 2; continue }
      const rec = DNS[k.toLowerCase()]
      const addr = r.source === 'dns' && rec?.AAAA?.length && db === 'hosts' ? rec.AAAA[0] : r.ip
      const names = r.source === 'hosts' ? etcHosts(sh).find(([, ns]) => ns.map((x) => x.toLowerCase()).includes(k.toLowerCase()))?.[1].join(' ') ?? k : k
      out += `${addr.padEnd(15)} ${names}\n`
    }
    return { out, err: '', code }
  }
  if (db === 'services' && keys[0]) {
    const svc = SERVICE_PORTS[keys[0]] ?? Object.entries(SERVICE_PORTS).find(([, v]) => v.port === keys[0])
    if (!svc) return { out: '', err: '', code: 2 }
    const [nm, v] = Array.isArray(svc) ? svc : [keys[0], svc]
    return ok(`${nm.padEnd(21)} ${v.port}/${v.proto}\n`)
  }
  if (db === 'passwd' || db === 'group') {
    let content = ''
    try { content = sh.vfs.readFile('/etc/' + db) } catch { content = '' }
    const ls = lines(content).filter((l) => !keys.length || keys.includes(l.split(':')[0]))
    return { out: joinLines(ls), err: '', code: ls.length ? 0 : 2 }
  }
  return fail('Usage: getent [OPTION...] database [key ...]\nSupported databases here: hosts services passwd group', 1)
}

/* ======================= traceroute and mtr ======================= */

interface Hop { name: string; ip: string; ms: number; lost?: boolean }

function hopsTo(sh: Shell, target: string): Hop[] | null {
  const r = resolve(sh, target)
  if (!r) return null
  if (isThisBox(r.ip)) return [{ name: r.ip === VM_IP ? HOSTNAME : 'localhost', ip: r.ip, ms: 0.05 }]
  if (r.ip === GATEWAY) return [{ name: '_gateway', ip: GATEWAY, ms: 0.6 }]
  const known = Object.values(DNS).some((d) => d.A?.includes(r.ip)) || ['1.1.1.1', '8.8.8.8', '9.9.9.9'].includes(r.ip)
  const hops: Hop[] = [
    { name: '_gateway', ip: GATEWAY, ms: 0.6 },
    { name: '10.0.0.1', ip: '10.0.0.1', ms: 3.2 },
    { name: '*', ip: '', ms: 0, lost: true },
    { name: 'ae-1.r01.example-isp.net', ip: '203.0.113.1', ms: 9.8 },
    { name: 'ix-peer.transit-example.net', ip: '198.51.100.9', ms: 11.4 },
  ]
  if (!known) { hops.push({ name: '*', ip: '', ms: 0, lost: true }, { name: '*', ip: '', ms: 0, lost: true }); return hops }
  hops.push({ name: PTR[r.ip] ? PTR[r.ip].slice(0, -1) : r.ip, ip: r.ip, ms: 12.3 })
  return hops
}

const traceroute: Command = (sh, args) => {
  if (!sh.state.packages.includes('traceroute')) return fail('Command \'traceroute\' not found, but can be installed with:\nsudo apt install traceroute', 127)
  const numeric = args.includes('-n')
  const target = args.filter((a) => !a.startsWith('-')).find((a) => !/^\d+$/.test(a) || a.includes('.'))
  if (!target) return fail('Usage:\n  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] [ -N squeries ] host [ packetlen ]', 2)
  const hops = hopsTo(sh, target)
  if (!hops) return fail(`${target}: Name or service not known\nCannot handle "host" cmdline arg \`${target}' on position 1 (argc 1)`, 2)
  const ip = resolve(sh, target)!.ip
  const rows = hops.map((h, i) => {
    const n = `${String(i + 1).padStart(2)}  `
    if (h.lost) return n + '* * *'
    const label = numeric || h.name === h.ip ? h.ip : `${h.name} (${h.ip})`
    return `${n}${label}  ${h.ms.toFixed(3)} ms  ${(h.ms * 0.97).toFixed(3)} ms  ${(h.ms * 1.02).toFixed(3)} ms`
  })
  const unreached = hops[hops.length - 1].lost
  return ok(`traceroute to ${target} (${ip}), 30 hops max, 60 byte packets\n${rows.join('\n')}\n${unreached ? ' 8  * * *\n 9  * * *\n(trimmed: the real trace would keep printing * * * up to hop 30 because nothing answers at the end)\n' : ''}`)
}

const mtr: Command = (sh, args) => {
  if (!sh.state.packages.includes('mtr') && !sh.state.packages.includes('mtr-tiny')) return fail('Command \'mtr\' not found, but can be installed with:\nsudo apt install mtr-tiny\nsudo apt install mtr', 127)
  const flags = args.filter((a) => a.startsWith('-') && !a.startsWith('--')).join('')
  const report = flags.includes('r') || args.includes('--report')
  const numeric = flags.includes('n') || args.includes('--no-dns')
  const cIdx = args.findIndex((a) => a === '-c' || a === '--report-cycles')
  const count = cIdx >= 0 ? Number(args[cIdx + 1]) : Number(flags.match(/c(\d+)/)?.[1] ?? 10)
  const target = args.filter((a, i) => !a.startsWith('-') && !(cIdx >= 0 && i === cIdx + 1) && !/^\d+$/.test(a))[0]
  if (!target) return fail('mtr: usage: mtr [-r] [-c COUNT] [-n] HOST', 1)
  if (!report) return fail('mtr: the live curses display is not simulated here. Use mtr -r HOST for a report.')
  const hops = hopsTo(sh, target)
  if (!hops) return fail(`mtr: Failed to resolve host: ${target}: Name or service not known`)
  const rows = hops.map((h, i) => {
    const label = h.lost ? '???' : numeric || h.name === h.ip ? h.ip : h.name
    const loss = h.lost ? '100.0' : '0.0%'
    const v = (x: number) => x.toFixed(1).padStart(5)
    return `${String(i + 1).padStart(3)}.|-- ${label.padEnd(26)} ${loss.padStart(5)} ${String(count).padStart(5)} ${v(h.ms)} ${v(h.ms * 1.01)} ${v(h.ms * 0.95)} ${v(h.ms * 1.1)} ${v(h.ms * 0.05)}`
  })
  return ok(`Start: 2026-09-18T09:41:07+0000\nHOST: ${HOSTNAME.padEnd(26)}  Loss%   Snt   Last   Avg  Best  Wrst StDev\n${rows.join('\n')}\n`)
}

/* ======================= ufw ======================= */

function ruleText(r: UfwRule): string {
  const parts: string[] = [r.action]
  if (r.direction === 'out') parts.push('out')
  if (r.app && !r.from && !r.to) return `${parts.join(' ')} ${r.app}`
  if (!r.from && !r.to && r.port) return `${parts.join(' ')} ${r.port}${r.proto ? '/' + r.proto : ''}`
  parts.push('from', r.from ?? 'any')
  if (r.to || r.port || r.app) { parts.push('to', r.to ?? 'any'); if (r.app) parts.push('app', r.app); else if (r.port) parts.push('port', r.port) }
  if (r.proto && !r.app) parts.push('proto', r.proto)
  return parts.join(' ')
}

function ruleTo(r: UfwRule, v6: boolean): string {
  const port = r.app ? r.app : r.port ? `${r.port}${r.proto ? '/' + r.proto : ''}` : r.to ? '' : 'Anywhere'
  const to = r.to ? `${r.to}${port ? ' ' + port : ''}` : port
  return to + (v6 && !r.to ? ' (v6)' : '')
}

function sameRule(a: UfwRule, b: UfwRule) {
  return a.action === b.action && a.direction === b.direction && a.port === b.port && a.proto === b.proto && a.app === b.app && a.from === b.from && a.to === b.to
}

/** Parse the words after allow/deny/reject/limit into a rule. Returns an error string when they make no sense. */
function parseRule(sh: Shell, action: UfwRule['action'], words: string[]): UfwRule | string {
  const r: UfwRule = { action, direction: 'in', v4: true, v6: true }
  let i = 0
  if (words[i] === 'in' || words[i] === 'out') { r.direction = words[i] as 'in' | 'out'; i++ }
  if (words[i] === 'log' || words[i] === 'log-all') i++
  if (words[i] === 'on') { i += 2 }
  const rest = words.slice(i)
  const commentAt = rest.indexOf('comment')
  if (commentAt >= 0) { r.comment = rest.slice(commentAt + 1).join(' ').replace(/^['"]|['"]$/g, ''); rest.splice(commentAt) }
  if (!rest.length) return 'ERROR: Need a port or a rule'
  const apps = ['OpenSSH', ...(sh.state.packages.includes('nginx') ? ['Nginx Full', 'Nginx HTTP', 'Nginx HTTPS'] : [])]
  if (rest.length === 1 || (rest.length === 2 && rest.join(' ') in APP_PORTS)) {
    const spec = rest.join(' ')
    const m = spec.match(/^(\d+(?::\d+)?)(?:\/(tcp|udp))?$/)
    if (m) {
      if (m[1].includes(':') && !m[2]) return `ERROR: Must specify 'tcp' or 'udp' with multiple ports`
      const nums = m[1].split(':').map(Number)
      if (nums.some((n) => n < 1 || n > 65535)) return `ERROR: Bad port '${spec}'`
      r.port = m[1]; if (m[2]) r.proto = m[2] as 'tcp' | 'udp'
      return r
    }
    const svc = spec.match(/^([a-z][\w-]*)(?:\/(tcp|udp))?$/)
    if (svc && SERVICE_PORTS[svc[1]]) { r.port = SERVICE_PORTS[svc[1]].port; r.proto = (svc[2] as 'tcp' | 'udp') ?? SERVICE_PORTS[svc[1]].proto; return r }
    if (apps.includes(spec)) { r.app = spec; return r }
    if (spec in APP_PORTS) return `ERROR: Could not find a profile matching '${spec}'`
    return `ERROR: Bad port '${spec}'`
  }
  for (let k = 0; k < rest.length; k++) {
    const w = rest[k]
    const next = rest[k + 1]
    if (w === 'from') { if (!next) return 'ERROR: Bad source address'; if (next !== 'any') { if (!isCidrOrIp(next)) return `ERROR: Bad source address`; r.from = next; r.v6 = false } k++ }
    else if (w === 'to') { if (!next) return 'ERROR: Bad destination address'; if (next !== 'any') { if (!isCidrOrIp(next)) return `ERROR: Bad destination address`; r.to = next; r.v6 = false } k++ }
    else if (w === 'port') { if (!next || !/^\d+(:\d+)?(,\d+)*$/.test(next)) return `ERROR: Bad port '${next ?? ''}'`; r.port = next; k++ }
    else if (w === 'proto') { if (next !== 'tcp' && next !== 'udp') return `ERROR: Unsupported protocol '${next ?? ''}'`; r.proto = next; k++ }
    else if (w === 'app') { if (!next || !apps.includes(next)) return `ERROR: Could not find a profile matching '${next ?? ''}'`; r.app = next; k++ }
    else return `ERROR: Invalid syntax`
  }
  if (r.port?.includes(':') && !r.proto) return `ERROR: Must specify 'tcp' or 'udp' with multiple ports`
  return r
}

function ufwStatus(sh: Shell, mode: 'plain' | 'verbose' | 'numbered'): string {
  const fw = netState(sh).firewall
  if (!fw.enabled) return 'Status: inactive\n'
  let out = 'Status: active\n'
  if (mode === 'verbose') out += `Logging: ${fw.logging === 'off' ? 'off' : `on (${fw.logging})`}\nDefault: ${fw.defaultIn} (incoming), ${fw.defaultOut} (outgoing), disabled (routed)\nNew profiles: skip\n`
  const entries: [UfwRule, boolean][] = [...fw.rules.filter((r) => r.v4).map((r): [UfwRule, boolean] => [r, false]), ...fw.rules.filter((r) => r.v6).map((r): [UfwRule, boolean] => [r, true])]
  if (!entries.length && mode !== 'verbose') return out
  const pre = mode === 'numbered' ? '     ' : ''
  out += `\n${pre}${'To'.padEnd(27)}${'Action'.padEnd(12)}From\n${pre}${'--'.padEnd(27)}${'------'.padEnd(12)}----\n`
  entries.forEach(([r, v6], i) => {
    const action = r.action.toUpperCase() + (mode === 'plain' ? '' : r.direction === 'out' ? ' OUT' : ' IN')
    const from = r.direction === 'out' ? (r.to ?? 'Anywhere') : (r.from ?? 'Anywhere') + (v6 && !r.from ? ' (v6)' : '')
    const num = mode === 'numbered' ? `[${String(i + 1).padStart(2)}] ` : ''
    const line = `${num}${ruleTo(r, v6).padEnd(27)}${action.padEnd(12)}${from}`
    out += (r.comment ? `${line.padEnd(66 + num.length)} # ${r.comment}` : line).replace(/\s+$/, '') + '\n'
  })
  return out
}

const ufw: Command = (sh, args) => {
  ensureFiles(sh)
  const s = netState(sh)
  const fw = s.firewall
  const force = args.includes('--force')
  const words = args.filter((a) => a !== '--force' && a !== '--dry-run')
  const sub = words[0]
  if (sub === 'version' || sub === '--version') return ok('ufw 0.36.2\nCopyright 2008-2023 Canonical Ltd.\n')
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') return ok('Usage: ufw COMMAND\n\nCommands:\n enable                          enables the firewall\n disable                         disables the firewall\n default ARG                     set default policy\n logging LEVEL                   set logging to LEVEL\n allow ARGS                      add allow rule\n deny ARGS                       add deny rule\n reject ARGS                     add reject rule\n limit ARGS                      add limit rule\n delete RULE|NUM                 delete RULE\n insert NUM RULE                 insert RULE at NUM\n reload                          reload firewall\n reset                           reset firewall\n status                          show firewall status\n status numbered                 show firewall status as numbered list of RULES\n status verbose                  show verbose firewall status\n show ARG                        show firewall report\n version                         display version information\n\nApplication profile commands:\n app list                        list application profiles\n app info PROFILE                show information on PROFILE\n')
  if (!isRoot(sh)) return fail('ERROR: You need to be root to run this script')
  const setEnabled = (on: boolean) => { fw.enabled = on; try { sh.vfs.writeFile('/etc/ufw/ufw.conf', sh.vfs.readFile('/etc/ufw/ufw.conf').replace(/^ENABLED=.*$/m, `ENABLED=${on ? 'yes' : 'no'}`)) } catch { /* config missing */ } }
  const sshAllowed = () => fw.rules.some((r) => r.direction === 'in' && (r.action === 'allow' || r.action === 'limit') && (r.app === 'OpenSSH' || portMatches(r.port, 22)) && (!r.proto || r.proto === 'tcp') && !r.from)
  if (sub === 'status') {
    const mode = words[1] === 'verbose' ? 'verbose' : words[1] === 'numbered' ? 'numbered' : words[1] ? null : 'plain'
    if (!mode) return fail(`ERROR: Invalid syntax`)
    return ok(ufwStatus(sh, mode))
  }
  if (sub === 'enable') {
    let out = ''
    const err = ''
    if (!force) out += 'Command may disrupt existing ssh connections. Proceed with operation (y|n)? y\n'
    setEnabled(true)
    out += 'Firewall is active and enabled on system startup\n'
    if (!sshAllowed() && fw.defaultIn !== 'allow') out += 'WARNING: no rule allows port 22 (SSH). On a real machine your SSH session would now be cut off and you could not log back in. Add one first: sudo ufw allow OpenSSH\n'
    return { out, err, code: 0 }
  }
  if (sub === 'disable') { setEnabled(false); return ok('Firewall stopped and disabled on system startup\n') }
  if (sub === 'reload') return ok(fw.enabled ? 'Firewall reloaded\n' : 'Firewall not enabled (skipping reload)\n')
  if (sub === 'reset') {
    const stamp = '20260918_094107'
    setEnabled(false)
    fw.rules = []
    fw.defaultIn = 'deny'; fw.defaultOut = 'allow'; fw.logging = 'low'
    return ok(`${force ? '' : 'Resetting all rules to installed defaults. This may disrupt existing ssh connections. Proceed with operation (y|n)? y\n'}${['user.rules', 'before.rules', 'after.rules', 'user6.rules', 'before6.rules', 'after6.rules'].map((f) => `Backing up '${f}' to '/etc/ufw/${f}.${stamp}'`).join('\n')}\n\n`)
  }
  if (sub === 'default') {
    const policy = words[1]
    const dir = words[2] ?? 'incoming'
    if (!policy || !['allow', 'deny', 'reject'].includes(policy)) return fail(`ERROR: Unsupported policy '${policy ?? ''}'`)
    if (!['incoming', 'outgoing', 'routed'].includes(dir)) return fail(`ERROR: Unsupported direction '${dir}'`)
    if (dir === 'incoming') fw.defaultIn = policy as 'allow' | 'deny' | 'reject'
    else if (dir === 'outgoing') fw.defaultOut = policy as 'allow' | 'deny' | 'reject'
    return ok(`Default ${dir} policy changed to '${policy}'\n(be sure to update your rules accordingly)\n`)
  }
  if (sub === 'logging') {
    const level = words[1]
    if (!level || !['on', 'off', 'low', 'medium', 'high', 'full'].includes(level)) return fail(`ERROR: Invalid syntax`)
    fw.logging = level === 'on' ? 'low' : (level as NetState['firewall']['logging'])
    return ok(level === 'off' ? 'Logging disabled\n' : 'Logging enabled\n')
  }
  if (sub === 'app') {
    const apps = ['OpenSSH', ...(sh.state.packages.includes('nginx') ? ['Nginx Full', 'Nginx HTTP', 'Nginx HTTPS'] : [])]
    if (words[1] === 'list') return ok('Available applications:\n' + apps.map((a) => `  ${a}`).join('\n') + '\n')
    if (words[1] === 'info') { const a = words.slice(2).join(' '); if (!apps.includes(a)) return fail(`ERROR: Could not find a profile matching '${a}'`); return ok(`Profile: ${a}\nTitle: ${a === 'OpenSSH' ? 'Secure shell server, an rshd replacement' : 'Web Server (Nginx' + (a.endsWith('Full') ? ', HTTP + HTTPS' : a.endsWith('HTTPS') ? ', HTTPS' : ', HTTP') + ')'}\nDescription: ${a === 'OpenSSH' ? 'OpenSSH is a free implementation of the Secure Shell protocol.' : 'Small, but very powerful and efficient web server'}\n\nPort${APP_PORTS[a].port.includes(',') ? 's' : ''}:\n  ${APP_PORTS[a].port}/tcp\n`) }
    return fail('ERROR: Invalid syntax')
  }
  if (sub === 'show') {
    if (words[1] === 'added') return ok('Added user rules (see \'ufw status\' for running firewall):\n' + (fw.rules.length ? fw.rules.map((r) => `ufw ${ruleText(r)}${r.comment ? ` comment '${r.comment}'` : ''}`).join('\n') + '\n' : '(None)\n'))
    if (words[1] === 'listening') return ok(joinLines(sockets(sh).filter((k) => k.state !== 'ESTAB').map((k) => `${k.proto}${k.addr.startsWith('[') ? '6' : ''}:\n  ${k.port} ${k.addr.startsWith('[') ? '' : k.addr.replace('%lo', '') + ' '}(${k.proc})`)))
    return fail('ERROR: Unsupported report: \'' + (words[1] ?? '') + "'\nTry: ufw show added | ufw show listening")
  }
  if (sub === 'delete') {
    if (/^\d+$/.test(words[1] ?? '')) {
      const n = Number(words[1])
      const entries: [UfwRule, boolean][] = [...fw.rules.filter((r) => r.v4).map((r): [UfwRule, boolean] => [r, false]), ...fw.rules.filter((r) => r.v6).map((r): [UfwRule, boolean] => [r, true])]
      if (!fw.enabled) return fail('ERROR: Could not delete rule: firewall is inactive. Use "ufw delete allow PORT" or enable it first.')
      const e = entries[n - 1]
      if (!e) return fail(`ERROR: Could not find rule '${n}'`)
      const [r, v6] = e
      if (v6) r.v6 = false; else r.v4 = false
      if (!r.v4 && !r.v6) fw.rules = fw.rules.filter((x) => x !== r)
      return ok(`${force ? '' : `Deleting:\n ${ruleText(r)}\nProceed with operation (y|n)? y\n`}Rule deleted${v6 ? ' (v6)' : ''}\n`)
    }
    const action = words[1] as UfwRule['action']
    if (!['allow', 'deny', 'reject', 'limit'].includes(action)) return fail('ERROR: Invalid syntax')
    const spec = parseRule(sh, action, words.slice(2))
    if (typeof spec === 'string') return fail(spec)
    const hit = fw.rules.find((r) => sameRule(r, spec))
    if (!hit) return fail(`Could not delete non-existent rule${spec.v6 ? '\nCould not delete non-existent rule (v6)' : ''}`)
    fw.rules = fw.rules.filter((r) => r !== hit)
    return ok(`Rule deleted${hit.v6 ? '\nRule deleted (v6)' : ''}\n`)
  }
  let insertAt: number | undefined
  let cmd = words
  if (sub === 'insert') {
    if (!/^\d+$/.test(words[1] ?? '')) return fail('ERROR: Invalid position \'' + (words[1] ?? '') + "'")
    insertAt = Number(words[1]) - 1
    cmd = words.slice(2)
    if (insertAt > fw.rules.length) return fail(`ERROR: Invalid position '${insertAt + 1}'`)
  }
  const action = cmd[0] as UfwRule['action']
  if (['allow', 'deny', 'reject', 'limit'].includes(action)) {
    const spec = parseRule(sh, action, cmd.slice(1))
    if (typeof spec === 'string') return fail(spec)
    if (fw.rules.some((r) => sameRule(r, spec))) return ok(`Skipping adding existing rule${spec.v6 ? '\nSkipping adding existing rule (v6)' : ''}\n`)
    if (insertAt !== undefined) fw.rules.splice(insertAt, 0, spec); else fw.rules.push(spec)
    const word = fw.enabled ? 'Rule added' : 'Rules updated'
    return ok(`${word}${spec.v6 ? `\n${word} (v6)` : ''}\n`)
  }
  return fail(`ERROR: Invalid syntax\n\nUsage: ufw COMMAND (try 'ufw help')`)
}

function nftRuleset(sh: Shell): string {
  const fw = netState(sh).firewall
  if (!fw.enabled) return ''
  const policy = (p: string) => (p === 'allow' ? 'accept' : 'drop')
  const verdict = (r: UfwRule) => (r.action === 'allow' ? 'accept' : r.action === 'reject' ? 'reject with icmp type port-unreachable' : r.action === 'limit' ? 'ct state new jump ufw-user-limit' : 'drop')
  const user: string[] = []
  for (const r of fw.rules) {
    if (!r.v4 || r.direction !== 'in') continue
    const spec = r.app ? APP_PORTS[r.app] : { port: r.port, proto: r.proto }
    const src = r.from ? `ip saddr ${r.from} ` : ''
    const dst = r.to ? `ip daddr ${r.to} ` : ''
    const ports = spec?.port ? spec.port.includes(':') ? spec.port.replace(':', '-') : spec.port.includes(',') ? `{ ${spec.port.replace(/,/g, ', ')} }` : spec.port : undefined
    const protos: ('tcp' | 'udp')[] = spec?.proto ? [spec.proto] : ports ? ['tcp', 'udp'] : []
    if (!protos.length) user.push(`\t\t${src}${dst}counter packets 0 bytes 0 ${verdict(r)}`)
    for (const p of protos) user.push(`\t\t${src}${dst}${p} dport ${ports} counter packets 0 bytes 0 ${verdict(r)}`)
  }
  const userOut: string[] = fw.rules.filter((r) => r.v4 && r.direction === 'out').map((r) => `\t\t${r.to ? `ip daddr ${r.to} ` : ''}${r.proto ?? 'tcp'} dport ${r.port ?? '0-65535'} counter packets 0 bytes 0 ${verdict(r)}`)
  return `table ip filter {\n\tchain INPUT {\n\t\ttype filter hook input priority filter; policy ${policy(fw.defaultIn)};\n\t\tcounter packets 1842 bytes 213004 jump ufw-before-logging-input\n\t\tcounter packets 1842 bytes 213004 jump ufw-before-input\n\t\tcounter packets 37 bytes 2220 jump ufw-after-input\n\t\tcounter packets 37 bytes 2220 jump ufw-after-logging-input\n\t\tcounter packets 37 bytes 2220 jump ufw-reject-input\n\t\tcounter packets 37 bytes 2220 jump ufw-track-input\n\t}\n\n\tchain FORWARD {\n\t\ttype filter hook forward priority filter; policy drop;\n\t\tcounter packets 0 bytes 0 jump ufw-before-forward\n\t}\n\n\tchain OUTPUT {\n\t\ttype filter hook output priority filter; policy ${policy(fw.defaultOut)};\n\t\tcounter packets 1620 bytes 401233 jump ufw-before-output\n\t\tcounter packets 12 bytes 720 jump ufw-user-output\n\t}\n\n\tchain ufw-before-input {\n\t\tiifname "lo" counter packets 96 bytes 8192 accept\n\t\tct state related,established counter packets 1701 bytes 200811 accept\n\t\tct state invalid counter packets 0 bytes 0 drop\n\t\ticmp type { destination-unreachable, time-exceeded, parameter-problem, echo-request } counter packets 4 bytes 336 accept\n\t\tudp sport 67 udp dport 68 counter packets 0 bytes 0 accept\n\t\tcounter packets 41 bytes 3665 jump ufw-not-local\n\t\tcounter packets 41 bytes 3665 jump ufw-user-input\n\t}\n\n\tchain ufw-user-input {\n${user.join('\n')}${user.length ? '\n' : ''}\t}\n\n\tchain ufw-user-output {\n${userOut.join('\n')}${userOut.length ? '\n' : ''}\t}\n\n\tchain ufw-user-limit {\n\t\tlimit rate 3/minute burst 5 packets counter packets 0 bytes 0 log prefix "[UFW LIMIT BLOCK] " reject with icmp type port-unreachable\n\t}\n\n\tchain ufw-after-input {\n\t\tudp dport 137 counter packets 0 bytes 0 drop\n\t\tudp dport 138 counter packets 0 bytes 0 drop\n\t\ttcp dport 139 counter packets 0 bytes 0 drop\n\t\ttcp dport 445 counter packets 0 bytes 0 drop\n\t}\n\n\tchain ufw-reject-input {\n\t}\n\n\tchain ufw-track-input {\n\t}\n}\n`
}

const nft: Command = (sh, args) => {
  if (!isRoot(sh)) return fail('nft: netlink: Error: Operation not permitted (you must be root)')
  const words = args.filter((a) => !a.startsWith('-'))
  if (words[0] === 'list' && words[1] === 'ruleset') return ok(nftRuleset(sh))
  if (words[0] === 'list' && words[1] === 'tables') return ok(netState(sh).firewall.enabled ? 'table ip filter\ntable ip6 filter\n' : '')
  if (words[0] === 'list' && words[1] === 'chain') {
    const name = words[words.length - 1]
    const rs = nftRuleset(sh)
    const m = rs.match(new RegExp(`\tchain ${name} \\{\n([\\s\\S]*?)\t\\}\n`))
    if (!m) return fail(`Error: No such file or directory\nlist chain ip filter ${name}\n                     ^^^^^^`)
    return ok(`table ip filter {\n\tchain ${name} {\n${m[1]}\t}\n}\n`)
  }
  if (words[0] === '-v' || words[0] === 'version') return ok('nftables v1.0.9 (Old Doc Yak #3)\n')
  return fail('Usage: nft [ options ] [ commands... ]\nSimulated commands: nft list ruleset | nft list tables | nft list chain ip filter CHAIN')
}

/* ======================= sshd config ======================= */

const SSHD_DEFAULTS: [string, string][] = [
  ['port', '22'], ['addressfamily', 'any'], ['listenaddress', '[::]:22'], ['listenaddress', '0.0.0.0:22'], ['usepam', 'yes'], ['logingracetime', '120'], ['x11forwarding', 'yes'], ['permitrootlogin', 'prohibit-password'],
  ['strictmodes', 'yes'], ['maxauthtries', '6'], ['maxsessions', '10'], ['pubkeyauthentication', 'yes'], ['authorizedkeysfile', '.ssh/authorized_keys .ssh/authorized_keys2'], ['passwordauthentication', 'yes'],
  ['permitemptypasswords', 'no'], ['kbdinteractiveauthentication', 'no'], ['clientaliveinterval', '0'], ['clientalivecountmax', '3'], ['tcpkeepalive', 'yes'], ['printmotd', 'no'], ['acceptenv', 'LANG LC_*'],
  ['allowtcpforwarding', 'yes'], ['gatewayports', 'no'], ['permittunnel', 'no'], ['usedns', 'no'], ['pidfile', '/run/sshd.pid'], ['maxstartups', '10:30:100'], ['banner', 'none'], ['loglevel', 'INFO'], ['syslogfacility', 'AUTH'],
  ['subsystem', 'sftp /usr/lib/openssh/sftp-server'],
]
const SSHD_KEYWORDS = new Set([...SSHD_DEFAULTS.map(([k]) => k), 'include', 'hostkey', 'allowusers', 'denyusers', 'allowgroups', 'denygroups', 'match', 'challengeresponseauthentication', 'authenticationmethods', 'permittty', 'allowagentforwarding', 'ciphers', 'macs', 'kexalgorithms', 'authorizedkeyscommand', 'authorizedkeyscommanduser', 'ignorerhosts', 'hostbasedauthentication', 'compression', 'permituserenvironment', 'chrootdirectory', 'forcecommand', 'passwordauthentication', 'listenaddress', 'protocol', 'rekeylimit', 'versionaddendum', 'streamlocalbindunlink', 'ipqos', 'disableforwarding', 'clientaliveinterval', 'x11displayoffset', 'x11uselocalhost', 'pubkeyacceptedalgorithms', 'hostkeyalgorithms', 'casignaturealgorithms', 'permitlisten', 'permitopen', 'setenv', 'securitykeyprovider', 'fingerprinthash', 'exposeauthinfo', 'trustedusercakeys', 'revokedkeys', 'authorizedprincipalsfile', 'gssapiauthentication', 'gssapicleanupcredentials', 'loglevel', 'logverbose', 'syslogfacility'])
const YES_NO = new Set(['usepam', 'x11forwarding', 'strictmodes', 'pubkeyauthentication', 'passwordauthentication', 'permitemptypasswords', 'kbdinteractiveauthentication', 'challengeresponseauthentication', 'tcpkeepalive', 'printmotd', 'allowtcpforwarding', 'allowagentforwarding', 'usedns', 'permittty', 'gatewayports', 'ignorerhosts', 'hostbasedauthentication', 'gssapiauthentication', 'permituserenvironment', 'disableforwarding', 'exposeauthinfo'])

interface SshdParse { effective: Map<string, string>; errors: string[] }

/** Read sshd_config the way sshd does: Include files in order, first value wins, unknown keywords are errors. */
function parseSshdConfig(sh: Shell): SshdParse {
  ensureFiles(sh)
  const effective = new Map<string, string>()
  const errors: string[] = []
  const seen = new Set<string>()
  const walk = (path: string) => {
    if (seen.has(path)) return
    seen.add(path)
    let text = ''
    try { text = sh.vfs.readFile(path) } catch { return }
    let inMatch = false
    lines(text).forEach((raw, i) => {
      const l = raw.trim()
      if (!l || l.startsWith('#')) return
      const m = l.match(/^(\S+)\s*[=\s]\s*(.*)$/)
      const key = (m ? m[1] : l).toLowerCase()
      const value = m ? m[2].trim() : ''
      if (!SSHD_KEYWORDS.has(key)) { errors.push(`${path}: line ${i + 1}: Bad configuration option: ${m ? m[1] : l}`); return }
      if (!value && key !== 'match') { errors.push(`${path} line ${i + 1}: missing argument.`); return }
      if (YES_NO.has(key) && !/^(yes|no)$/i.test(value)) { errors.push(`${path} line ${i + 1}: Bad yes/no argument: ${value}`); return }
      if (key === 'permitrootlogin' && !/^(yes|no|prohibit-password|without-password|forced-commands-only)$/i.test(value)) { errors.push(`${path} line ${i + 1}: Bad PermitRootLogin argument: ${value}`); return }
      if (key === 'port' && !/^\d+$/.test(value)) { errors.push(`${path} line ${i + 1}: Badly formatted port number.`); return }
      if ((key === 'maxauthtries' || key === 'maxsessions' || key === 'clientaliveinterval' || key === 'clientalivecountmax' || key === 'logingracetime') && !/^\d+[smhdw]?$/.test(value)) { errors.push(`${path} line ${i + 1}: integer expression expected: ${value}`); return }
      if (key === 'match') { inMatch = true; return }
      if (inMatch) return
      if (key === 'include') {
        const dir = value.replace(/\/[^/]*$/, '')
        const glob = new RegExp('^' + value.split('/').pop()!.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
        let entries: [string, unknown][] = []
        try { entries = sh.vfs.list(dir) } catch { entries = [] }
        for (const [name] of entries) if (glob.test(name)) walk(dir + '/' + name)
        return
      }
      const k = key === 'challengeresponseauthentication' ? 'kbdinteractiveauthentication' : key
      if (k === 'listenaddress' || k === 'hostkey' || k === 'acceptenv' || k === 'subsystem') { if (!effective.has(k)) effective.set(k, value); return }
      if (!effective.has(k)) effective.set(k, value)
    })
  }
  walk('/etc/ssh/sshd_config')
  return { effective, errors }
}

export function sshdSetting(sh: Shell, key: string): string {
  const { effective } = parseSshdConfig(sh)
  return effective.get(key) ?? SSHD_DEFAULTS.find(([k]) => k === key)?.[1] ?? ''
}

const sshd: Command = (sh, args) => {
  ensureFiles(sh)
  if (!isRoot(sh)) return fail('Could not load host key: /etc/ssh/ssh_host_rsa_key\nCould not load host key: /etc/ssh/ssh_host_ecdsa_key\nCould not load host key: /etc/ssh/ssh_host_ed25519_key\nsshd: no hostkeys available -- exiting.')
  const { effective, errors } = parseSshdConfig(sh)
  if (args.includes('-t') || args.includes('-T')) {
    if (errors.length) return fail(errors.join('\n') + `\n/etc/ssh/sshd_config: terminating, ${errors.length} bad configuration option${errors.length > 1 ? 's' : ''}`, 255)
    if (args.includes('-t')) return ok()
    const out: string[] = []
    const done = new Set<string>()
    for (const [k, d] of SSHD_DEFAULTS) {
      if (k === 'listenaddress') { if (!done.has(k)) { const v = effective.get(k); out.push(v ? `listenaddress ${v}` : `listenaddress [::]:${effective.get('port') ?? '22'}`, ...(v ? [] : [`listenaddress 0.0.0.0:${effective.get('port') ?? '22'}`])); done.add(k) } continue }
      out.push(`${k} ${effective.get(k) ?? d}`)
    }
    for (const k of ['allowusers', 'denyusers', 'allowgroups', 'denygroups', 'authenticationmethods', 'permittty', 'allowagentforwarding']) if (effective.has(k)) out.push(`${k} ${effective.get(k)}`)
    return ok(joinLines(out))
  }
  if (args.includes('-V') || args.includes('--version')) return ok('OpenSSH_9.6p1 Ubuntu-3ubuntu13.5, OpenSSL 3.0.13 30 Jan 2024\n')
  return fail('sshd re-exec requires execution with an absolute path\n(Start the server with "sudo systemctl restart ssh". Use sshd -t to test the config and sshd -T to print the effective settings.)')
}

/* ======================= ssh keys, ssh-copy-id, ssh ======================= */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function pseudo(seed: string, n: number, alphabet = B64): string {
  let h = 2166136261
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  let out = ''
  for (let i = 0; i < n; i++) { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; out += alphabet[h % alphabet.length] }
  return out
}

function publicKeyLine(type: string, comment: string, seed: string) {
  if (type === 'rsa') return `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ${pseudo(seed, 372)} ${comment}`
  if (type === 'ecdsa') return `ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBB${pseudo(seed, 87)} ${comment}`
  return `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${pseudo(seed, 43)} ${comment}`
}

const fingerprint = (pub: string) => 'SHA256:' + pseudo('fp:' + pub.split(' ').slice(0, 2).join(' '), 43)

function randomart(type: string, seed: string): string {
  const w = 17, h = 9
  const grid = Array.from({ length: h }, () => Array(w).fill(0) as number[])
  let x = 8, y = 4
  const bits = pseudo(seed, 64, '0123')
  for (const b of bits) {
    const d = Number(b)
    x = Math.max(0, Math.min(w - 1, x + (d % 2 === 0 ? -1 : 1)))
    y = Math.max(0, Math.min(h - 1, y + (d < 2 ? -1 : 1)))
    grid[y][x]++
  }
  const chars = ' .o+=*BOX@%&#/^'
  const rows = grid.map((r) => '|' + r.map((v) => chars[Math.min(v, chars.length - 1)]).join('') + '|')
  rows[4] = rows[4].slice(0, 9) + 'S' + rows[4].slice(10)
  rows[y] = rows[y].slice(0, x + 1) + 'E' + rows[y].slice(x + 2)
  const head = `[${type === 'rsa' ? 'RSA 3072' : type === 'ecdsa' ? 'ECDSA 256' : 'ED25519 256'}]`
  const pad = (s: string) => { const total = w - s.length; const l = Math.floor(total / 2); return '+' + '-'.repeat(l) + s + '-'.repeat(total - l) + '+' }
  return [pad(head), ...rows, pad('[SHA256]')].join('\n')
}

function homeOf(_sh: Shell, user: string) { return user === 'root' ? '/root' : user === 'learner' ? HOME : `/home/${user}` }

function ensureSshDir(sh: Shell, user: string) {
  const dir = homeOf(sh, user) + '/.ssh'
  if (!sh.vfs.get(dir)) { sh.vfs.mkdir(dir, { parents: true, owner: user }); const n = sh.vfs.get(dir); if (n) n.mode = 0o700 }
  return dir
}

const sshKeygen: Command = (sh, args) => {
  let type = 'ed25519'
  let file: string | undefined
  let comment: string | undefined
  let show: 'l' | 'y' | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-t') type = (args[++i] ?? '').toLowerCase()
    else if (a === '-f') file = args[++i]
    else if (a === '-C') comment = args[++i]
    else if (a === '-N' || a === '-b' || a === '-a' || a === '-E' || a === '-P') i++
    else if (a === '-l') show = 'l'
    else if (a === '-y') show = 'y'
    else if (a === '-q') continue
    else if (a.startsWith('-')) return fail(`ssh-keygen: unknown option -- ${a.slice(1)}\nusage: ssh-keygen [-q] [-a rounds] [-b bits] [-C comment] [-f output_keyfile]\n                  [-m format] [-N new_passphrase] [-O option]\n                  [-t ecdsa | ed25519 | rsa]`, 255)
  }
  if (!['ed25519', 'rsa', 'ecdsa'].includes(type)) return fail(`unknown key type ${type}`, 255)
  if (show) {
    if (!file) return fail('ssh-keygen: -f is required with -l or -y in this terminal (it would prompt for the path on a real machine).', 255)
    const p = sh.path(file)
    let pub = ''
    try { pub = sh.readFile(p.endsWith('.pub') || show === 'y' ? p : p + '.pub') } catch { try { pub = sh.readFile(p) } catch { return fail(`${file}: No such file or directory`, 255) } }
    if (show === 'y') {
      if (pub.includes('PRIVATE KEY')) { try { pub = sh.readFile(p + '.pub') } catch { return fail(`Load key "${file}": invalid format`, 255) } }
      return ok(pub.trim() + '\n')
    }
    const first = lines(pub)[0] ?? ''
    if (!first.startsWith('ssh-') && !first.startsWith('ecdsa-')) return fail(`${file} is not a public key file.`, 255)
    const bits = first.startsWith('ssh-rsa') ? '3072' : '256'
    const [, , ...c] = first.split(' ')
    return ok(`${bits} ${fingerprint(first)} ${c.join(' ')} (${first.startsWith('ssh-rsa') ? 'RSA' : first.startsWith('ecdsa') ? 'ECDSA' : 'ED25519'})\n`)
  }
  const dir = ensureSshDir(sh, sh.user)
  const target = file ? sh.path(file) : `${dir}/id_${type}`
  const label = type === 'rsa' ? 'rsa' : type === 'ecdsa' ? 'ecdsa' : 'ed25519'
  let out = `Generating public/private ${label} key pair.\n`
  if (!file) out += `Enter file in which to save the key (${target}): \n`
  if (sh.vfs.get(target)) return { out: out + `${target} already exists.\nOverwrite (y/n)? n\n`, err: '', code: 1 }
  out += 'Enter passphrase (empty for no passphrase): \nEnter same passphrase again: \n'
  const cmt = comment ?? `${sh.user}@${HOSTNAME}`
  const pub = publicKeyLine(type, cmt, target + cmt + sh.history.length)
  try {
    sh.writeFile(target, `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n${pseudo('priv' + pub, 70)}\n${pseudo('priv2' + pub, 70)}\n${pseudo('priv3' + pub, 36)}=\n-----END OPENSSH PRIVATE KEY-----\n`)
    sh.writeFile(target + '.pub', pub + '\n')
  } catch (e) { return fail(`Saving key "${target}" failed: ${(e as Error).message}`, 1) }
  const priv = sh.vfs.get(target); if (priv) priv.mode = 0o600
  out += `Your identification has been saved in ${target}\nYour public key has been saved in ${target}.pub\nThe key fingerprint is:\n${fingerprint(pub)} ${cmt}\nThe key's randomart image is:\n${randomart(type, pub)}\n`
  return ok(out)
}

/** The learner's first public key on disk, if any. */
function defaultPubKey(sh: Shell, explicit?: string): { path: string; line: string } | null {
  const dir = homeOf(sh, sh.user) + '/.ssh'
  const candidates = explicit ? [sh.path(explicit.endsWith('.pub') ? explicit : explicit + '.pub')] : ['id_ed25519.pub', 'id_rsa.pub', 'id_ecdsa.pub'].map((f) => `${dir}/${f}`)
  for (const p of candidates) {
    const n = sh.vfs.get(p)
    if (n?.type === 'file') return { path: p, line: n.content.trim() }
  }
  return null
}

function parseTarget(sh: Shell, args: string[]): { user: string; host: string; port: number; identity?: string; command: string[] } | string {
  let user: string | undefined
  let port = 22
  let identity: string | undefined
  let target: string | undefined
  let command: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (target) { command = args.slice(i); break }
    if (a === '-p' || a === '-l' || a === '-i' || a === '-o' || a === '-F' || a === '-J' || a === '-L' || a === '-R' || a === '-W') {
      const v = args[++i]
      if (a === '-p') port = Number(v)
      if (a === '-l') user = v
      if (a === '-i') identity = v
      continue
    }
    if (a.startsWith('-')) continue
    target = a
  }
  if (!target) return 'usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file]\n           [-J destination] [-L address] [-l login_name] [-m mac_spec]\n           [-O ctl_cmd] [-o option] [-P tag] [-p port] [-Q query_option]\n           [-R address] [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]]\n           destination [command [argument ...]]'
  const at = target.lastIndexOf('@')
  const host = at >= 0 ? target.slice(at + 1) : target
  if (at >= 0) user = target.slice(0, at)
  return { user: user ?? sh.user, host, port, identity, command }
}

function knownHostLine(host: string, ip: string) {
  return `${host === ip ? ip : `${host},${ip}`} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJf0S9x1c5GnH2v8p4o1s2mPDs3q7b9K2Wl6x0c1lZ3r`
}

/** First-contact fingerprint prompt, remembered in ~/.ssh/known_hosts. */
function trustHost(sh: Shell, host: string, ip: string): string {
  const dir = ensureSshDir(sh, sh.user)
  const path = dir + '/known_hosts'
  let text = ''
  try { text = sh.vfs.readFile(path) } catch { text = '' }
  if (text.split('\n').some((l) => l.split(' ')[0].split(',').includes(host))) return ''
  sh.vfs.writeFile(path, text + knownHostLine(host, ip) + '\n', { owner: sh.user })
  return `The authenticity of host '${host} (${ip})' can't be established.\nED25519 key fingerprint is SHA256:Uq3nrl3vX4g0G8Z2xY9J1K5tQwHhZbF6VfaB1R2C9sM.\nThis key is not known by any other names.\nAre you sure you want to continue connecting (yes/no/[fingerprint])? yes\nWarning: Permanently added '${host}' (ED25519) to the list of known hosts.\n`
}

const sshCopyId: Command = (sh, args) => {
  let identity: string | undefined
  let target: string | undefined
  let port = 22
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-i') identity = args[++i]
    else if (a === '-p') port = Number(args[++i])
    else if (a === '-o') i++
    else if (a === '-f' || a === '-n') continue
    else if (a.startsWith('-')) return fail(`Unknown option: ${a}\nUsage: /usr/bin/ssh-copy-id [-h|-?|-f|-n|-s|-x] [-i [identity_file]] [-p port] [-F alternative ssh_config file] [-t target_path] [[-o <ssh -o options>] ...] [user@]hostname`)
    else target = a
  }
  if (!target) return fail('Usage: /usr/bin/ssh-copy-id [-h|-?|-f|-n|-s|-x] [-i [identity_file]] [-p port] [-F alternative ssh_config file] [-t target_path] [[-o <ssh -o options>] ...] [user@]hostname')
  const key = defaultPubKey(sh, identity)
  if (!key) return fail('/usr/bin/ssh-copy-id: ERROR: No identities found')
  const at = target.lastIndexOf('@')
  const user = at >= 0 ? target.slice(0, at) : sh.user
  const hostName = at >= 0 ? target.slice(at + 1) : target
  const s = netState(sh)
  const r = resolve(sh, hostName)
  const info = `/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "${key.path}"\n/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n`
  if (!r) return fail(`${info}/usr/bin/ssh-copy-id: ERROR: ssh: Could not resolve hostname ${hostName}: Name or service not known`)
  if (!isThisBox(r.ip)) {
    s.keyCopiedTo.push(`${user}@${hostName}`)
    return ok(`${info}/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new key(s)\n${user}@${hostName}'s password: \n(simulated: this terminal cannot reach ${hostName}, so the key was not really installed there. On a real machine the next lines mean it worked.)\n\nNumber of key(s) added: 1\n\nNow try logging into the machine, with:   "ssh '${user}@${hostName}'"\nand check to make sure that only the key(s) you wanted were added.\n\n`)
  }
  if (r.ip === VM_IP && firewallVerdict(sh, port) !== 'allow') return fail(`${info}/usr/bin/ssh-copy-id: ERROR: ssh: connect to host ${hostName} port ${port}: Connection timed out`)
  const authPath = homeOf(sh, user) + '/.ssh/authorized_keys'
  let existing = ''
  try { existing = sh.vfs.readFile(authPath) } catch { existing = '' }
  if (existing.split('\n').some((l) => l.trim() === key.line)) return ok(`${info}\n/usr/bin/ssh-copy-id: WARNING: All keys were skipped because they already exist on the remote system.\n\t\t(if you think this is a mistake, you may want to use -f option)\n\n`)
  if (sshdSetting(sh, 'passwordauthentication') !== 'yes' || (user === 'root' && sshdSetting(sh, 'permitrootlogin') !== 'yes')) {
    return fail(`${info}/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new key(s)\n${user}@${hostName}: Permission denied (publickey).\n(sshd on this box refuses password logins, so ssh-copy-id has no way in. Append the key by hand instead: cat ${key.path} >> ~/.ssh/authorized_keys)`, 1)
  }
  if (!['learner', 'root'].includes(user)) return fail(`${info}${user}@${hostName}: Permission denied (publickey,password).`)
  ensureSshDir(sh, user)
  sh.vfs.writeFile(authPath, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + key.line + '\n', { owner: user, mode: 0o600 })
  s.keyCopiedTo.push(`${user}@${hostName}`)
  return ok(`${info}/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new key(s)\n${user}@${hostName}'s password: \n\nNumber of key(s) added: 1\n\nNow try logging into the machine, with:   "ssh '${user}@${hostName}'"\nand check to make sure that only the key(s) you wanted were added.\n\n`)
}

const ssh: Command = (sh, args) => {
  const t = parseTarget(sh, args)
  if (typeof t === 'string') return fail(t, 255)
  if (args.includes('-V')) return ok('OpenSSH_9.6p1 Ubuntu-3ubuntu13.5, OpenSSL 3.0.13 30 Jan 2024\n')
  const s = netState(sh)
  const r = resolve(sh, t.host)
  if (!r) return fail(`ssh: Could not resolve hostname ${t.host}: Name or service not known`, 255)
  if (!isThisBox(r.ip)) {
    s.sshLogins.push(`${t.user}@${t.host}:attempted`)
    return fail(`ssh: connect to host ${t.host} port ${t.port}: this terminal cannot open real network connections. Do this step on your real machine.`, 255)
  }
  if (r.ip === VM_IP) {
    const v = firewallVerdict(sh, t.port)
    if (v === 'drop') return fail(`ssh: connect to host ${t.host} port ${t.port}: Connection timed out`, 255)
    if (v === 'reject') return fail(`ssh: connect to host ${t.host} port ${t.port}: Connection refused`, 255)
  }
  const sock = listenerOn(sh, t.port)
  if (!sock || sock.proc !== 'sshd') return fail(sock ? `kex_exchange_identification: Connection closed by remote host\nConnection closed by ${r.ip} port ${t.port}` : `ssh: connect to host ${t.host} port ${t.port}: Connection refused`, 255)
  const trust = trustHost(sh, t.host, r.ip)
  let out = ''
  const key = defaultPubKey(sh, t.identity)
  let auth = ''
  try { auth = sh.vfs.readFile(homeOf(sh, t.user) + '/.ssh/authorized_keys') } catch { auth = '' }
  const keyOk = Boolean(key && sshdSetting(sh, 'pubkeyauthentication') === 'yes' && auth.split('\n').some((l) => l.trim() === key.line))
  const rootLogin = sshdSetting(sh, 'permitrootlogin')
  const pwOk = sshdSetting(sh, 'passwordauthentication') === 'yes'
  const knownUser = ['learner', 'root'].includes(t.user)
  const methods = 'publickey' + (pwOk ? ',password' : '')
  let how: string
  const denied = (msg: string): CmdResult => ({ out: '', err: trust + msg + '\n', code: 255 })
  if (t.user === 'root' && rootLogin === 'no') return denied(`${t.user}@${t.host}: Permission denied (${methods}).`)
  if (keyOk && knownUser) how = `your ${key!.path.includes('rsa') ? 'RSA' : 'ED25519'} key ${key!.path.replace(HOME, '~').replace(/\.pub$/, '')}`
  else if (t.user === 'root' && rootLogin !== 'yes') return denied(`root@${t.host}: Permission denied (publickey).`)
  else if (pwOk && knownUser) { out += `${t.user}@${t.host}'s password: \n`; how = 'your password (simulated)' }
  else return denied(`${t.user}@${t.host}: Permission denied (${methods}).`)
  s.sshLogins.push(`${t.user}@${t.host}`)
  if (t.command.length) {
    const cmd = t.command.join(' ')
    if (t.user === sh.user) { const r2 = sh.execScript(cmd); return { out: out + r2.out, err: trust + r2.err, code: r2.code } }
    return { out: out + `(simulated) would run as ${t.user} on ${HOSTNAME}: ${cmd}\n`, err: trust, code: 0 }
  }
  return { err: trust, code: 0, out: out + `Welcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-45-generic aarch64)\n\n * Documentation:  https://help.ubuntu.com\n * Management:     https://landscape.canonical.com\n * Support:        https://ubuntu.com/pro\n\nLast login: Thu Sep 17 08:12:44 2026 from ${GATEWAY}\n(simulated) Logged in to ${HOSTNAME} as ${t.user} with ${how}. This terminal does not open real sessions, so you are still in your own shell. On a real machine you would type exit to come back.\n` }
}

/* ======================= fail2ban ======================= */

function parseIni(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  let section = 'DEFAULT'
  for (const raw of lines(text)) {
    const l = raw.trim()
    if (!l || l.startsWith('#') || l.startsWith(';')) continue
    const sec = l.match(/^\[(.+)\]$/)
    if (sec) { section = sec[1]; out[section] ??= {}; continue }
    const kv = l.match(/^([^=]+?)\s*=\s*(.*)$/)
    if (kv) { out[section] ??= {}; out[section][kv[1].trim()] = kv[2].trim() }
  }
  return out
}

function seconds(v: string): number {
  const m = v.trim().match(/^(-?\d+)\s*([smhdw]?)$/)
  if (!m) return Number(v) || 0
  return Number(m[1]) * ({ '': 1, s: 1, m: 60, h: 3600, d: 86400, w: 604800 } as Record<string, number>)[m[2]]
}

interface JailInfo { name: string; enabled: boolean; maxretry: number; bantime: number; findtime: number; logpath: string; ignoreip: string[] }

function jails(sh: Shell): JailInfo[] {
  const read = (p: string) => { try { return sh.vfs.readFile(p) } catch { return '' } }
  const merged: Record<string, Record<string, string>> = {}
  const apply = (cfg: Record<string, Record<string, string>>) => { for (const [sec, kv] of Object.entries(cfg)) { merged[sec] ??= {}; Object.assign(merged[sec], kv) } }
  apply(parseIni(read('/etc/fail2ban/jail.conf')))
  let entries: [string, unknown][] = []
  try { entries = sh.vfs.list('/etc/fail2ban/jail.d') } catch { entries = [] }
  for (const [name] of entries) if (name.endsWith('.conf')) apply(parseIni(read('/etc/fail2ban/jail.d/' + name)))
  apply(parseIni(read('/etc/fail2ban/jail.local')))
  const d = merged.DEFAULT ?? {}
  const out: JailInfo[] = []
  for (const [name, kv] of Object.entries(merged)) {
    if (name === 'DEFAULT') continue
    const get = (k: string, fallback: string) => kv[k] ?? d[k] ?? fallback
    out.push({ name, enabled: /^(true|yes|on|1)$/i.test(get('enabled', 'false')), maxretry: Number(get('maxretry', '5')), bantime: seconds(get('bantime', '10m')), findtime: seconds(get('findtime', '10m')), logpath: name === 'sshd' ? '/var/log/auth.log' : get('logpath', '/var/log/' + name + '.log').replace(/%\(\w+\)s/, '/var/log/' + name + '.log'), ignoreip: get('ignoreip', '127.0.0.1/8 ::1').split(/\s+/) })
  }
  return out
}

function sshFailures(sh: Shell): Record<string, number> {
  let text = ''
  try { text = sh.vfs.readFile('/var/log/auth.log') } catch { text = '' }
  const out: Record<string, number> = {}
  for (const l of lines(text)) {
    const m = l.match(/(?:Failed (?:password|publickey) for (?:invalid user )?\S+|Invalid user \S+) from (\d{1,3}(?:\.\d{1,3}){3})/)
    if (m) out[m[1]] = (out[m[1]] ?? 0) + 1
  }
  return out
}

function bannedIn(sh: Shell, jail: JailInfo): { banned: string[]; failed: number; currentlyFailed: number } {
  const s = netState(sh)
  const failures = jail.name === 'sshd' ? sshFailures(sh) : {}
  const banned = new Set<string>()
  let currentlyFailed = 0
  for (const [ip, n] of Object.entries(failures)) {
    if (jail.ignoreip.some((spec) => inNetwork(ip, spec))) continue
    if (n >= jail.maxretry) banned.add(ip); else currentlyFailed += n
  }
  for (const ip of s.manualBans) banned.add(ip)
  for (const ip of s.unbanned) banned.delete(ip)
  return { banned: [...banned], failed: Object.values(failures).reduce((a, b) => a + b, 0), currentlyFailed }
}

const fail2banClient: Command = (sh, args) => {
  if (!sh.state.packages.includes('fail2ban')) return fail("Command 'fail2ban-client' not found, but can be installed with:\nsudo apt install fail2ban", 127)
  installFail2banFiles(sh)
  const s = netState(sh)
  const words = args.filter((a) => !a.startsWith('-'))
  const [sub, a1, a2, a3] = words
  if (sub === 'version' || sub === '-V' || args.includes('-V') || args.includes('--version')) return ok('1.0.2\n')
  if (!sub || sub === 'help' || sub === '-h') return ok('Usage: fail2ban-client [OPTIONS] <COMMAND>\n\nFail2Ban v1.0.2 reads log file that contains password failure report\nand bans the corresponding IP addresses using firewall rules.\n\nCommands simulated here:\n  ping                       tests if the server is alive\n  status                     gets the current status of the server\n  status <JAIL>              gets the current status of <JAIL>\n  reload                     reloads the configuration\n  get <JAIL> <PROPERTY>      maxretry | bantime | findtime | banned | logpath\n  set <JAIL> banip <IP>      manually ban <IP>\n  set <JAIL> unbanip <IP>    manually unban <IP>\n  unban --all | <IP>         unban addresses\n')
  if (!isRoot(sh)) return fail('ERROR  Permission denied to socket: /var/run/fail2ban/fail2ban.sock, (you must be root)', 255)
  if (sh.state.services.fail2ban !== 'active') return fail('ERROR   Failed to access socket path: /var/run/fail2ban/fail2ban.sock. Is fail2ban running?', 255)
  const all = jails(sh)
  const enabled = all.filter((j) => j.enabled)
  const findJail = (name: string | undefined) => { const j = enabled.find((x) => x.name === name); return j }
  if (sub === 'ping') return ok('Server replied: pong\n')
  if (sub === 'reload') return ok('OK\n')
  if (sub === 'status') {
    if (!a1) return ok(`Status\n|- Number of jail:\t${enabled.length}\n\`- Jail list:\t${enabled.map((j) => j.name).join(', ')}\n`)
    const j = findJail(a1)
    if (!j) return fail(`ERROR   NOK: ('Sorry but the jail \\'${a1}\\' does not exist',)\nSorry but the jail '${a1}' does not exist`, 255)
    const b = bannedIn(sh, j)
    return ok(`Status for the jail: ${j.name}\n|- Filter\n|  |- Currently failed:\t${b.currentlyFailed}\n|  |- Total failed:\t${b.failed}\n|  \`- File list:\t${j.logpath}\n\`- Actions\n   |- Currently banned:\t${b.banned.length}\n   |- Total banned:\t${b.banned.length}\n   \`- Banned IP list:\t${b.banned.join(' ')}\n`)
  }
  if (sub === 'get') {
    const j = findJail(a1)
    if (!j) return fail(`ERROR   NOK: ('Sorry but the jail \\'${a1 ?? ''}\\' does not exist',)\nSorry but the jail '${a1 ?? ''}' does not exist`, 255)
    if (a2 === 'maxretry') return ok(j.maxretry + '\n')
    if (a2 === 'bantime') return ok(j.bantime + '\n')
    if (a2 === 'findtime') return ok(j.findtime + '\n')
    if (a2 === 'logpath') return ok(`Current monitored log file(s):\n\`- ${j.logpath}\n`)
    if (a2 === 'banned' || a2 === 'banip') return ok(JSON.stringify(bannedIn(sh, j).banned).replace(/"/g, "'") + '\n')
    if (a2 === 'ignoreip') return ok(`These IP addresses/networks are ignored:\n${j.ignoreip.map((i) => '`- ' + i).join('\n')}\n`)
    return fail(`ERROR   NOK: ('Invalid command',)\nInvalid command`, 255)
  }
  if (sub === 'set') {
    const j = findJail(a1)
    if (!j) return fail(`ERROR   NOK: ('Sorry but the jail \\'${a1 ?? ''}\\' does not exist',)\nSorry but the jail '${a1 ?? ''}' does not exist`, 255)
    if (a2 === 'banip' && a3 && isIPv4(a3)) { s.unbanned = s.unbanned.filter((x) => x !== a3); if (!s.manualBans.includes(a3)) s.manualBans.push(a3); return ok('1\n') }
    if (a2 === 'unbanip' && a3) { const was = bannedIn(sh, j).banned.includes(a3); s.manualBans = s.manualBans.filter((x) => x !== a3); if (!s.unbanned.includes(a3)) s.unbanned.push(a3); return was ? ok('1\n') : fail(`ERROR   NOK: ('${a3} is not banned',)\n${a3} is not banned`, 255) }
    return fail(`ERROR   NOK: ('Invalid command',)\nInvalid command`, 255)
  }
  if (sub === 'unban') {
    if (args.includes('--all')) { for (const j of enabled) for (const ip of bannedIn(sh, j).banned) s.unbanned.push(ip); s.manualBans = []; return ok(String(enabled.reduce((n, j) => n + bannedIn(sh, j).banned.length, 0)) + '\n') }
    if (a1) { s.manualBans = s.manualBans.filter((x) => x !== a1); s.unbanned.push(a1); return ok('1\n') }
  }
  return fail(`ERROR   NOK: ('Invalid command',)\nInvalid command`, 255)
}

/* ======================= install ======================= */

const EXTRA_PACKAGES: Record<string, string> = { traceroute: '1:2.1.3-1', mtr: '0.95-1.1build2', 'mtr-tiny': '0.95-1.1build2', dnsutils: '1:9.18.28-0ubuntu0.24.04.1', 'bind9-dnsutils': '1:9.18.28-0ubuntu0.24.04.1', 'openssh-server': '1:9.6p1-3ubuntu13.5', nftables: '1.0.9-1build1', netcat: '1.226-1ubuntu2', 'netcat-openbsd': '1.226-1ubuntu2', iputils: '3:20240117-1build1' }
const PREINSTALLED = new Set(['ufw', 'openssh-server', 'openssh-client', 'iproute2', 'nftables', 'bind9-dnsutils', 'netcat-openbsd', 'iputils', 'curl', 'python3'])

export function install(base: CommandTable) {
  const wrapEtc = (name: string) => {
    const b = base[name]
    if (!b) return
    base[name] = (sh, args, stdin) => { if (args.some((a) => a.includes('/etc'))) ensureFiles(sh); return b(sh, args, stdin) }
  }
  for (const n of ['cd', 'ls', 'cat', 'grep', 'head', 'tail', 'less', 'more', 'sed', 'tee', 'find', 'wc', 'stat', 'file', 'diff', 'cp', 'nl', 'tree', 'du', 'touch', 'chmod', 'chown', 'rm', 'mv', 'echo', 'test', '[']) wrapEtc(n)
  const baseSudo = base.sudo
  base.sudo = (sh, args, stdin) => { ensureFiles(sh); return baseSudo(sh, args, stdin) }

  const baseApt = base.apt
  base.apt = (sh, args, stdin) => {
    const sub = args.find((a) => !a.startsWith('-'))
    const pkgs = args.filter((a) => a !== sub && !a.startsWith('-'))
    if (sub === 'install' && isRoot(sh) && pkgs.length && pkgs.every((p) => p in EXTRA_PACKAGES || PREINSTALLED.has(p) || sh.state.packages.includes(p))) {
      let out = ''
      for (const p of pkgs) {
        if (PREINSTALLED.has(p) || sh.state.packages.includes(p)) { out += `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n${p} is already the newest version${EXTRA_PACKAGES[p] ? ` (${EXTRA_PACKAGES[p]})` : ''}.\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n`; continue }
        sh.state.packages.push(p)
        if (p === 'mtr-tiny' && !sh.state.packages.includes('mtr')) sh.state.packages.push('mtr')
        out += `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following NEW packages will be installed:\n  ${p}\n0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.\nGet:1 http://archive.ubuntu.com/ubuntu noble/main arm64 ${p} arm64 ${EXTRA_PACKAGES[p]} [65.9 kB]\nFetched 65.9 kB in 0s (312 kB/s)\nSelecting previously unselected package ${p}.\nUnpacking ${p} (${EXTRA_PACKAGES[p]}) ...\nSetting up ${p} (${EXTRA_PACKAGES[p]}) ...\nProcessing triggers for man-db (2.12.0-4build2) ...\n`
      }
      return ok(out)
    }
    if (sub === 'install' && pkgs.some((p) => p in EXTRA_PACKAGES)) {
      // Mixed with base packages: let the base handle the ones it knows, then add ours.
      const r = baseApt(sh, [sub, ...pkgs.filter((p) => !(p in EXTRA_PACKAGES))], stdin)
      if (r.code === 0) for (const p of pkgs.filter((p) => p in EXTRA_PACKAGES)) if (!sh.state.packages.includes(p)) sh.state.packages.push(p)
      return r
    }
    const r = baseApt(sh, args, stdin)
    if (sub === 'install' && r.code === 0 && pkgs.includes('fail2ban')) {
      installFail2banFiles(sh)
      sh.state.services.fail2ban = 'active'
      r.out += 'Created symlink /etc/systemd/system/multi-user.target.wants/fail2ban.service → /usr/lib/systemd/system/fail2ban.service.\n'
    }
    if ((sub === 'remove' || sub === 'purge') && r.code === 0 && pkgs.includes('fail2ban')) delete sh.state.services.fail2ban
    if (sub === 'search' && pkgs[0]) { const extra = Object.keys(EXTRA_PACKAGES).filter((k) => k.includes(pkgs[0])).map((k) => `${k}/noble ${EXTRA_PACKAGES[k]} arm64\n  ${k} package`); if (extra.length) r.out += joinLines(extra) }
    return r
  }
  base['apt-get'] = (sh, args, stdin) => base.apt(sh, args, stdin)

  const baseHostname = base.hostname
  base.hostname = (sh, args, stdin) => {
    if (args.includes('-I') || args.includes('--all-ip-addresses')) return ok(`${VM_IP} \n`)
    if (args.includes('-i') || args.includes('--ip-address')) return ok('127.0.1.1\n')
    if (args.includes('-f') || args.includes('--fqdn') || args.includes('-s') || args.includes('--short') || args.includes('-d')) return ok(args.includes('-d') ? '\n' : HOSTNAME + '\n')
    return baseHostname(sh, args, stdin)
  }

  base.ip = ip
  base.ping = ping
  base.ss = ss
  base.curl = curl
  base.nc = nc
  base.netcat = nc
  base.dig = dig
  base.nslookup = nslookup
  base.host = host
  base.getent = getent
  base.traceroute = traceroute
  base.mtr = mtr
  base.ufw = ufw
  base.nft = nft
  base.sshd = sshd
  base['ssh-keygen'] = sshKeygen
  base['ssh-copy-id'] = sshCopyId
  base.ssh = ssh
  base['fail2ban-client'] = fail2banClient
  base['fail2ban-server'] = () => fail('fail2ban-server: the server is managed by systemd here. Use "sudo systemctl status fail2ban" and "sudo fail2ban-client status".')
  base.resolvectl = (sh, args) => (args[0] === 'status' || !args.length ? ok(`Global\n         Protocols: -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported\n  resolv.conf mode: stub\n\nLink 2 (${IFACE})\n    Current Scopes: DNS\n         Protocols: +DefaultRoute -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported\nCurrent DNS Server: ${GATEWAY}\n       DNS Servers: ${GATEWAY}\n`) : args[0] === 'query' && args[1] ? (resolve(sh, args[1]) ? ok(`${args[1]}: ${resolve(sh, args[1])!.ip}${DNS[args[1].toLowerCase()]?.AAAA?.length ? `\n${' '.repeat(args[1].length + 2)}${DNS[args[1].toLowerCase()]!.AAAA![0]}` : ''}\n\n-- Information acquired via protocol DNS in 3.2ms.\n-- Data is authenticated: no; Data was acquired via local or encrypted transport: no\n`) : fail(`${args[1]}: resolve call failed: '${args[1]}' not found`, 1)) : fail('Usage: resolvectl status | resolvectl query NAME'))
}
