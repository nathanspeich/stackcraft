// Simulation module: docker. A pretend Docker Engine for the Tier 2 container lessons.
// Images, containers, volumes, networks, and compose projects live in simState(sh, 'docker'),
// so lesson checkers can read them through r.state?.sims?.docker. Nothing here touches a
// real daemon: container "processes" are a small interpreter for the handful of commands the
// lessons need (echo, ls, cat, env, python inventory.py, psql, and so on).
import type { CommandTable } from './index'
import { simState } from './index'
import type { Shell } from '../shell'
import type { CmdResult } from '../commands'
import { normalize, dirname, basename } from '../vfs'

export interface DockerImage {
  repo: string
  tag: string
  id: string
  /** Bytes, for the SIZE column. */
  size: number
  created: number
  /** Image family the runtime behaves like (ubuntu, python, nginx, ...). */
  family: Family
  /** Files added by COPY/ADD, keyed by absolute container path. */
  files: Record<string, string>
  workdir: string
  env: Record<string, string>
  cmd: string[] | null
  entrypoint: string[] | null
  expose: string[]
  /** Dockerfile layer instructions, for docker history and the lessons. */
  layers: string[]
  /** Base image reference for built images. */
  base?: string
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  command: string[]
  status: 'running' | 'exited' | 'created'
  exitCode: number
  ports: { host: string; cont: string }[]
  volumes: { src: string; dst: string; named: boolean }[]
  env: Record<string, string>
  logs: string
  created: number
  finished: number
  rm: boolean
  /** Files written inside the container (on top of the image), keyed by absolute path. */
  files: Record<string, string>
  workdir: string
  network: string
  /** Compose project and service, when started by docker compose. */
  project?: string
  service?: string
  ip: string
}

export interface DockerState {
  installed: boolean
  images: DockerImage[]
  containers: DockerContainer[]
  /** Named volumes: name to its files (relative path to content). */
  volumes: Record<string, Record<string, string>>
  networks: string[]
  /** Compose projects by name: the compose file used and its services. */
  projects: Record<string, { file: string; services: string[] }>
  seq: number
}

type Family = 'hello' | 'ubuntu' | 'alpine' | 'python' | 'nginx' | 'postgres' | 'redis' | 'busybox'

const ok = (out = ''): CmdResult => ({ out, err: '', code: 0 })
const fail = (err: string, code = 1): CmdResult => ({ out: '', err: err.endsWith('\n') ? err : err + '\n', code })

/** Fresh state for a machine with Docker installed. Lessons seed it with machine: { sims: { docker: dockerInstalled() } }. */
export function dockerInstalled(): DockerState {
  return { installed: true, images: [], containers: [], volumes: {}, networks: ['bridge', 'host', 'none'], projects: {}, seq: 1 }
}

/** Shells whose seeded state (from a lesson's machine.sims) has been cloned, so lessons never share one mutable object. */
const cloned = new WeakSet<Shell>()

function state(sh: Shell): DockerState {
  if (!cloned.has(sh)) { cloned.add(sh); if (sh.state.sims.docker) sh.state.sims.docker = structuredClone(sh.state.sims.docker) }
  const st = simState<Partial<DockerState>>(sh, 'docker', () => ({ ...dockerInstalled(), installed: false }))
  const d = dockerInstalled()
  for (const k of Object.keys(d) as (keyof DockerState)[]) if (st[k] === undefined) (st as Record<string, unknown>)[k] = d[k]
  return st as DockerState
}

/* ---------- ids, names, time ---------- */

function hex(seed: number, len: number): string {
  let x = (seed * 2654435761 + 12345) >>> 0
  let s = ''
  while (s.length < len) {
    x ^= x << 13; x >>>= 0
    x ^= x >>> 17
    x ^= x << 5; x >>>= 0
    s += x.toString(16).padStart(8, '0')
  }
  return s.slice(0, len)
}
const newId = (st: DockerState) => hex(st.seq++ * 7919 + 17, 64)

const ADJ = ['admiring', 'bold', 'clever', 'eager', 'gentle', 'happy', 'jolly', 'keen', 'lucid', 'nifty', 'quirky', 'sharp', 'vibrant', 'wizardly', 'zen']
const SUR = ['turing', 'hopper', 'lovelace', 'ritchie', 'thompson', 'torvalds', 'knuth', 'curie', 'noether', 'hamilton', 'dijkstra', 'lamport', 'wozniak', 'kernighan', 'pike']
function randomName(st: DockerState): string {
  for (;;) {
    const n = st.seq++
    const name = `${ADJ[n % ADJ.length]}_${SUR[Math.floor(n / ADJ.length + n) % SUR.length]}`
    if (!st.containers.some((c) => c.name === name)) return name
  }
}

function ago(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s} second${s === 1 ? '' : 's'} ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`
  const w = Math.round(d / 7)
  if (w < 9) return `${w} weeks ago`
  const mo = Math.round(d / 30)
  return mo < 24 ? `${mo} months ago` : `${Math.round(d / 365)} years ago`
}
const upFor = (ts: number) => ago(ts).replace(' ago', '')

const DAY = 86400000
const humanSize = (b: number) => (b < 1000 ? `${b}B` : b < 1e6 ? `${(b / 1000).toFixed(1).replace(/\.0$/, '')}kB` : b < 1e9 ? `${Math.round(b / 1e6)}MB` : `${(b / 1e9).toFixed(2)}GB`)

/** Docker's table format: every column padded to its widest cell plus three spaces. */
function table(headers: string[], rows: string[][]): string {
  const all = [headers, ...rows]
  const widths = headers.map((_, i) => Math.max(10, ...all.map((r) => (r[i] ?? '').length + 3)))
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join('').replace(/\s+$/, '')).join('\n') + '\n'
}
const quoteCmd = (argv: string[]) => { const s = argv.join(' '); return '"' + (s.length > 20 ? s.slice(0, 19) + '\u2026' : s) + '"' }

/* ---------- the image registry ---------- */

interface Known { family: Family; size: number; digest: string; layers: string[]; cmd: string[]; entrypoint: string[] | null; env: Record<string, string>; workdir: string; expose: string[]; created: number }

const TAGS: Record<string, RegExp> = {
  'hello-world': /^(latest|linux)$/,
  ubuntu: /^(latest|24\.04|22\.04|20\.04|noble|jammy|focal|rolling)$/,
  alpine: /^(latest|edge|3\.(1[6-9]|20|21)(\.\d+)?)$/,
  busybox: /^(latest|stable|1\.3[0-7](\.\d+)?)$/,
  python: /^(latest|3|3\.(9|1[0-3])(\.\d+)?(-slim|-alpine|-bookworm|-slim-bookworm|-alpine3\.20)?|slim|alpine)$/,
  nginx: /^(latest|stable|mainline|alpine|stable-alpine|1\.2[0-7](\.\d+)?(-alpine)?)$/,
  postgres: /^(latest|1[3-7](\.\d+)?(-alpine|-bookworm)?)$/,
  redis: /^(latest|alpine|[67](\.\d+)?(\.\d+)?(-alpine)?)$/,
}

function knownImage(repo: string, tag: string): Known | null {
  if (TAGS[repo] && !TAGS[repo].test(tag)) return null
  const now = Date.now()
  const env = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }
  switch (repo) {
    case 'hello-world': return { family: 'hello', size: 13256, digest: 'd211f485f2dd1dee407a80973c8f129f00d54604d2c90732e8e320e5038a1348', layers: ['c1ec31eb5944'], cmd: ['/hello'], entrypoint: null, env, workdir: '/', expose: [], created: now - 500 * DAY }
    case 'ubuntu': return { family: 'ubuntu', size: 78100000, digest: '8a37d68f4f73ebf3d4efe7a59a0d3b8d4a5b1b2c0b5a3b5a8f7c6e9d1a2b3c4d', layers: ['ff65ddf9395b'], cmd: ['/bin/bash'], entrypoint: null, env, workdir: '/', expose: [], created: now - 20 * DAY }
    case 'alpine': return { family: 'alpine', size: 7830000, digest: 'beefdbd8a1da6d2915566fde36db9db0b524eb737fc57cd1367effd16dc0d06d', layers: ['43c4264eed91'], cmd: ['/bin/sh'], entrypoint: null, env, workdir: '/', expose: [], created: now - 12 * DAY }
    case 'busybox': return { family: 'busybox', size: 4270000, digest: '9ae97d36d26566ff84e8893c64a6dc4fe8ca6d1144bf5b87b2b5a3b3a8e5d6c7', layers: ['ec562eabd705'], cmd: ['sh'], entrypoint: null, env, workdir: '/', expose: [], created: now - 40 * DAY }
    case 'python': {
      const slim = tag.includes('slim')
      return { family: 'python', size: slim ? 124000000 : 1020000000, digest: 'af4e85f1bac90dd3771e47292ea7c8a9830abfabbe25c3e7b0fd8f87fe2abbca', layers: slim ? ['302e3ee49805', '4cf6c1b8cd28', 'a1c4b5d6e7f8', 'b2d3e4f5a6c7'] : ['302e3ee49805', '4cf6c1b8cd28', 'a1c4b5d6e7f8', 'b2d3e4f5a6c7', 'c3e4f5a6b7d8', 'd4f5a6b7c8e9', 'e5a6b7c8d9f0'], cmd: ['python3'], entrypoint: null, env: { ...env, LANG: 'C.UTF-8', PYTHON_VERSION: pyVersion(tag) }, workdir: '/', expose: [], created: now - 9 * DAY }
    }
    case 'nginx': return { family: 'nginx', size: 192000000, digest: '0c86dddac19f2ce4fd716ac58c0fd0bf5f5b1a3a1d4e2a0c8f7b6a5d4c3b2a1f', layers: ['302e3ee49805', 'bfd5fd5d1d2f', '1a2b3c4d5e6f', '6f5e4d3c2b1a', 'abcdef123456', '123456abcdef', 'fedcba654321'], cmd: ['nginx', '-g', 'daemon off;'], entrypoint: ['/docker-entrypoint.sh'], env: { ...env, NGINX_VERSION: '1.27.2', PKG_RELEASE: '1~bookworm' }, workdir: '/', expose: ['80/tcp'], created: now - 15 * DAY }
    case 'postgres': return { family: 'postgres', size: 432000000, digest: '1e6a9a3b3f8d3e3c2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f', layers: ['302e3ee49805', '0a1b2c3d4e5f', '5f4e3d2c1b0a', '11223344aabb', 'bbaa44332211', 'cc55dd66ee77', '77ee66dd55cc', '8899aabbccdd', 'ddccbbaa9988', 'eeff00112233', '33221100ffee', '44556677aabb', 'bbaa77665544', '99887766aabb'], cmd: ['postgres'], entrypoint: ['docker-entrypoint.sh'], env: { ...env, PG_MAJOR: tag.match(/^\d+/)?.[0] ?? '16', PG_VERSION: '16.4-1.pgdg120+1', PGDATA: '/var/lib/postgresql/data', LANG: 'en_US.utf8' }, workdir: '/', expose: ['5432/tcp'], created: now - 11 * DAY }
    case 'redis': return { family: 'redis', size: 117000000, digest: 'a0d3b1f4c2e5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1', layers: ['302e3ee49805', 'a1a2a3a4a5a6', 'b1b2b3b4b5b6', 'c1c2c3c4c5c6', 'd1d2d3d4d5d6', 'e1e2e3e4e5e6', 'f1f2f3f4f5f6', '010203040506'], cmd: ['redis-server'], entrypoint: ['docker-entrypoint.sh'], env: { ...env, REDIS_VERSION: '7.4.1' }, workdir: '/data', expose: ['6379/tcp'], created: now - 8 * DAY }
    default: return null
  }
}

function pyVersion(tag: string): string {
  const m = tag.match(/^3\.(\d+)/)
  const minor = m ? Number(m[1]) : 12
  const patch: Record<number, string> = { 9: '3.9.20', 10: '3.10.15', 11: '3.11.10', 12: '3.12.7', 13: '3.13.0' }
  return patch[minor] ?? `3.${minor}.0`
}

/** Split "repo:tag" (tag defaults to latest). */
function splitRef(ref: string): { repo: string; tag: string } {
  const i = ref.lastIndexOf(':')
  if (i > 0 && !ref.slice(i + 1).includes('/')) return { repo: ref.slice(0, i), tag: ref.slice(i + 1) }
  return { repo: ref, tag: 'latest' }
}

const findImage = (st: DockerState, ref: string) => {
  const { repo, tag } = splitRef(ref)
  return st.images.find((i) => (i.repo === repo && i.tag === tag) || i.id.startsWith(ref)) ?? null
}

/** Pull an image from the pretend registry. Returns the transcript, or an error when the image is unknown. */
function pull(st: DockerState, ref: string, viaRun: boolean): { out: string; err: string; img: DockerImage | null } {
  const { repo, tag } = splitRef(ref)
  const existing = findImage(st, ref)
  const known = knownImage(repo, tag)
  if (existing && !viaRun) {
    return { out: `${tag}: Pulling from library/${repo}\nDigest: sha256:${known?.digest ?? existing.id}\nStatus: Image is up to date for ${repo}:${tag}\ndocker.io/library/${repo}:${tag}\n`, err: '', img: existing }
  }
  if (existing) return { out: '', err: '', img: existing }
  if (!known) {
    const head = viaRun ? `Unable to find image '${repo}:${tag}' locally\n` : ''
    const msg = repo.includes('/') || !knownImage(repo, 'latest')
      ? `${viaRun ? 'docker: ' : ''}Error response from daemon: pull access denied for ${repo}, repository does not exist or may require 'docker login': denied: requested access to the resource is denied`
      : `${viaRun ? 'docker: ' : ''}Error response from daemon: manifest for ${repo}:${tag} not found: manifest unknown: manifest unknown`
    return { out: head, err: msg + (viaRun ? "\n\nRun 'docker run --help' for more information" : '') + '\n', img: null }
  }
  const img: DockerImage = { repo, tag, id: hex(st.seq++ * 31 + 3, 64), size: known.size, created: known.created, family: known.family, files: {}, workdir: known.workdir, env: { ...known.env }, cmd: known.cmd, entrypoint: known.entrypoint, expose: known.expose, layers: [] }
  st.images.push(img)
  const lines = [viaRun ? `Unable to find image '${repo}:${tag}' locally` : '', `${tag}: Pulling from library/${repo}`, ...known.layers.map((l) => `${l}: Pull complete`), `Digest: sha256:${known.digest}`, `Status: Downloaded newer image for ${repo}:${tag}`, viaRun ? '' : `docker.io/library/${repo}:${tag}`].filter(Boolean)
  return { out: lines.join('\n') + '\n', err: '', img }
}

/* ---------- container filesystem ---------- */

const FAMILY_DIRS: Record<Family, string[]> = {
  hello: ['/'],
  ubuntu: ['/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/media', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var'],
  busybox: ['/bin', '/dev', '/etc', '/home', '/lib', '/proc', '/root', '/sys', '/tmp', '/usr', '/var'],
  alpine: ['/bin', '/dev', '/etc', '/home', '/lib', '/media', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var'],
  python: ['/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/media', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var'],
  nginx: ['/bin', '/boot', '/dev', '/docker-entrypoint.d', '/etc', '/home', '/lib', '/media', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var', '/etc/nginx', '/etc/nginx/conf.d', '/usr/share/nginx', '/usr/share/nginx/html'],
  postgres: ['/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/media', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var', '/var/lib/postgresql', '/var/lib/postgresql/data', '/docker-entrypoint-initdb.d'],
  redis: ['/bin', '/boot', '/data', '/dev', '/etc', '/home', '/lib', '/media', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var'],
}

const DEBIAN = 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nVERSION="12 (bookworm)"\nVERSION_CODENAME=bookworm\nID=debian\nHOME_URL="https://www.debian.org/"\n'
const NGINX_HTML = '<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n<style>\nhtml { color-scheme: light dark; }\nbody { width: 35em; margin: 0 auto;\nfont-family: Tahoma, Verdana, Arial, sans-serif; }\n</style>\n</head>\n<body>\n<h1>Welcome to nginx!</h1>\n<p>If you see this page, the nginx web server is successfully installed and\nworking. Further configuration is required.</p>\n\n<p>For online documentation and support please refer to\n<a href="http://nginx.org/">nginx.org</a>.<br/>\nCommercial support is available at\n<a href="http://nginx.com/">nginx.com</a>.</p>\n\n<p><em>Thank you for using nginx.</em></p>\n</body>\n</html>\n'
const FAMILY_FILES: Record<Family, Record<string, string>> = {
  hello: { '/hello': '(binary)\n' },
  ubuntu: { '/etc/os-release': 'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\nVERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL="https://www.ubuntu.com/"\n', '/etc/hostname': '', '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash\n' },
  busybox: { '/etc/os-release': 'NAME=Buildroot\nVERSION=2024.02.2\nID=buildroot\nPRETTY_NAME="Buildroot 2024.02.2"\n' },
  alpine: { '/etc/os-release': 'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.20.3\nPRETTY_NAME="Alpine Linux v3.20"\nHOME_URL="https://alpinelinux.org/"\n', '/etc/alpine-release': '3.20.3\n', '/etc/passwd': 'root:x:0:0:root:/root:/bin/sh\n' },
  python: { '/etc/os-release': DEBIAN, '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\n' },
  nginx: { '/etc/os-release': DEBIAN, '/usr/share/nginx/html/index.html': NGINX_HTML, '/usr/share/nginx/html/50x.html': '<!DOCTYPE html>\n<html>\n<head><title>Error</title></head>\n<body>\n<h1>An error occurred.</h1>\n</body>\n</html>\n', '/etc/nginx/nginx.conf': '\nuser  nginx;\nworker_processes  auto;\n\nerror_log  /var/log/nginx/error.log notice;\npid        /var/run/nginx.pid;\n\nevents {\n    worker_connections  1024;\n}\n\nhttp {\n    include       /etc/nginx/mime.types;\n    default_type  application/octet-stream;\n    include /etc/nginx/conf.d/*.conf;\n}\n', '/etc/nginx/conf.d/default.conf': 'server {\n    listen       80;\n    listen  [::]:80;\n    server_name  localhost;\n\n    location / {\n        root   /usr/share/nginx/html;\n        index  index.html index.htm;\n    }\n\n    error_page   500 502 503 504  /50x.html;\n    location = /50x.html {\n        root   /usr/share/nginx/html;\n    }\n}\n' },
  postgres: { '/etc/os-release': DEBIAN, '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\npostgres:x:999:999::/var/lib/postgresql:/bin/bash\n' },
  redis: { '/etc/os-release': DEBIAN },
}

interface Ctx { sh: Shell; st: DockerState; c: DockerContainer; img: DockerImage; cwd: string; env: Record<string, string>; tty: boolean }

type Stat = { type: 'file'; content: string } | { type: 'dir' } | null

function mountFor(ctx: Ctx, abs: string) {
  for (const v of ctx.c.volumes) if (abs === v.dst || abs.startsWith(v.dst.replace(/\/$/, '') + '/')) return { v, rel: abs.slice(v.dst.replace(/\/$/, '').length).replace(/^\//, '') }
  return null
}

function statC(ctx: Ctx, p: string): Stat {
  const abs = normalize(p, ctx.cwd, '/root')
  const m = mountFor(ctx, abs)
  if (m) {
    if (m.v.named) {
      const files = ctx.st.volumes[m.v.src] ?? {}
      if (m.rel === '') return { type: 'dir' }
      if (m.rel in files) return { type: 'file', content: files[m.rel] }
      return Object.keys(files).some((k) => k.startsWith(m.rel + '/')) ? { type: 'dir' } : null
    }
    const n = ctx.sh.vfs.get(m.rel ? m.v.src + '/' + m.rel : m.v.src)
    if (!n) return null
    return n.type === 'dir' ? { type: 'dir' } : { type: 'file', content: n.content }
  }
  const layers = [ctx.c.files, ctx.img.files, FAMILY_FILES[ctx.img.family]]
  for (const l of layers) if (abs in l) return { type: 'file', content: l[abs] }
  if (abs === '/' || abs === ctx.img.workdir || abs === ctx.c.workdir || FAMILY_DIRS[ctx.img.family].includes(abs)) return { type: 'dir' }
  for (const l of layers) for (const k of Object.keys(l)) if (k.startsWith(abs + '/')) return { type: 'dir' }
  if (ctx.c.volumes.some((v) => v.dst.startsWith(abs + '/'))) return { type: 'dir' }
  return null
}

function writeC(ctx: Ctx, p: string, content: string, append = false) {
  const abs = normalize(p, ctx.cwd, '/root')
  const m = mountFor(ctx, abs)
  if (m) {
    if (m.v.named) {
      const files = (ctx.st.volumes[m.v.src] ??= {})
      files[m.rel] = append ? (files[m.rel] ?? '') + content : content
      return
    }
    const host = m.v.src + '/' + m.rel
    ctx.sh.vfs.mkdir(dirname(host), { parents: true, owner: 'learner' })
    ctx.sh.vfs.writeFile(host, content, { append, owner: 'learner' })
    return
  }
  ctx.c.files[abs] = append ? (ctx.c.files[abs] ?? statC(ctx, abs)?.type === 'file' ? (statC(ctx, abs) as { content: string }).content : '') + content : content
}

function listC(ctx: Ctx, p: string): string[] | null {
  const abs = normalize(p, ctx.cwd, '/root')
  const s = statC(ctx, abs)
  if (!s) return null
  if (s.type === 'file') return [basename(abs)]
  const names = new Set<string>()
  const prefix = abs === '/' ? '/' : abs + '/'
  const addKey = (k: string) => { if (k.startsWith(prefix)) { const rest = k.slice(prefix.length).split('/')[0]; if (rest) names.add(rest) } }
  const m = mountFor(ctx, abs)
  if (m) {
    if (m.v.named) for (const k of Object.keys(ctx.st.volumes[m.v.src] ?? {})) { const rel = m.rel ? (k.startsWith(m.rel + '/') ? k.slice(m.rel.length + 1) : '') : k; if (rel) names.add(rel.split('/')[0]) }
    else { const n = ctx.sh.vfs.get(m.rel ? m.v.src + '/' + m.rel : m.v.src); if (n?.type === 'dir') for (const k of n.children.keys()) names.add(k) }
    return [...names].sort()
  }
  for (const l of [ctx.c.files, ctx.img.files, FAMILY_FILES[ctx.img.family]]) for (const k of Object.keys(l)) addKey(k)
  for (const d of FAMILY_DIRS[ctx.img.family]) addKey(d)
  if (ctx.img.workdir !== '/') addKey(ctx.img.workdir)
  for (const v of ctx.c.volumes) addKey(v.dst)
  return [...names].sort()
}

/* ---------- the container "process" interpreter ---------- */

interface Run { out: string; code: number; /** True when the command would keep running (a server). */ daemon?: boolean }

function shellSplit(s: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

const usageInv = 'usage: inventory.py [-h] [--file FILE] {add,remove,list} ...\n'

/** Runs the week 14 reference inventory.py: Item and Inventory classes saving to a JSON file, with add, remove, and list. */
function inventorySim(ctx: Ctx, argv: string[]): Run {
  let file = ctx.env.INVENTORY_FILE || 'inventory.json'
  let i = 0
  while (i < argv.length && argv[i].startsWith('-')) {
    if (argv[i] === '-h' || argv[i] === '--help') return { out: usageInv + '\nKeep a small inventory in a JSON file\n\npositional arguments:\n  {add,remove,list}\n    add              add an item\n    remove           remove an item, or part of its quantity\n    list             list everything\n\noptions:\n  -h, --help         show this help message and exit\n  --file FILE        where the data lives\n', code: 0 }
    if (argv[i] === '--file' || argv[i] === '-f') { file = argv[i + 1] ?? ''; i += 2; continue }
    if (argv[i].startsWith('--file=')) { file = argv[i].slice(7); i++; continue }
    if (argv[i] === '--log-level') { i += 2; continue }
    return { out: usageInv + `inventory.py: error: unrecognized arguments: ${argv[i]}\n`, code: 2 }
  }
  const cmd = argv[i]
  const rest = argv.slice(i + 1)
  if (!cmd) return { out: usageInv + 'inventory.py: error: the following arguments are required: command\n', code: 2 }
  if (!['add', 'remove', 'list'].includes(cmd)) return { out: usageInv + `inventory.py: error: argument command: invalid choice: '${cmd}' (choose from 'add', 'remove', 'list')\n`, code: 2 }
  const s = statC(ctx, file)
  let items: { name: string; qty: number }[] = []
  if (s?.type === 'file' && s.content.trim()) {
    try {
      const data = JSON.parse(s.content) as unknown
      const arr = Array.isArray(data) ? data : (data as { items?: unknown[] }).items ?? []
      items = (arr as Record<string, unknown>[]).map((d) => ({ name: String(d.name ?? ''), qty: Number(d.qty ?? d.quantity ?? 0) }))
    } catch {
      return { out: `Traceback (most recent call last):\n  File "/app/inventory.py", line 108, in <module>\n    raise SystemExit(main())\n  File "/app/inventory.py", line 86, in main\n    inv = Inventory.load(args.file)\njson.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)\n`, code: 1 }
    }
  }
  const save = () => writeC(ctx, file, JSON.stringify([...items].sort((a, b) => a.name.localeCompare(b.name)).map((it) => ({ name: it.name, qty: it.qty })), null, 2) + '\n')
  if (cmd === 'add') {
    if (!rest.length) return { out: 'usage: inventory.py add [-h] name [qty]\ninventory.py add: error: the following arguments are required: name\n', code: 2 }
    const qty = rest.length > 1 ? Number(rest[1]) : 1
    if (!Number.isInteger(qty)) return { out: `usage: inventory.py add [-h] name [qty]\ninventory.py add: error: argument qty: invalid int value: '${rest[1]}'\n`, code: 2 }
    if (qty <= 0) return { out: 'error: quantity must be positive\n', code: 1 }
    const found = items.find((it) => it.name === rest[0])
    if (found) found.qty += qty; else items.push({ name: rest[0], qty })
    save()
    return { out: `added ${rest[0]} x${found ? found.qty : qty}\n`, code: 0 }
  }
  if (cmd === 'remove') {
    if (!rest.length) return { out: 'usage: inventory.py remove [-h] name [qty]\ninventory.py remove: error: the following arguments are required: name\n', code: 2 }
    const found = items.find((it) => it.name === rest[0])
    if (!found) return { out: `error: no such item: ${rest[0]}\n`, code: 1 }
    const qty = rest.length > 1 ? Number(rest[1]) : null
    if (qty === null || qty >= found.qty) items = items.filter((it) => it !== found); else found.qty -= qty
    save()
    return { out: `removed ${rest[0]}\n`, code: 0 }
  }
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
  return { out: sorted.map((it) => `${it.name} x${it.qty}`).join('\n') + (sorted.length ? '\n' : '') + `${items.length} item(s)\n`, code: 0 }
}

const NGINX_LOG = '/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration\n/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/\n/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh\n10-listen-on-ipv6-by-default.sh: info: Getting the checksum of /etc/nginx/conf.d/default.conf\n10-listen-on-ipv6-by-default.sh: info: Enabled listen on IPv6 in /etc/nginx/conf.d/default.conf\n/docker-entrypoint.sh: Sourcing /docker-entrypoint.d/15-local-resolvers.envsh\n/docker-entrypoint.sh: Launching /docker-entrypoint.d/20-envsubst-on-templates.sh\n/docker-entrypoint.sh: Launching /docker-entrypoint.d/30-tune-worker-processes.sh\n/docker-entrypoint.sh: Configuration complete; ready for start up\n2026/09/18 09:41:07 [notice] 1#1: using the "epoll" event method\n2026/09/18 09:41:07 [notice] 1#1: nginx/1.27.2\n2026/09/18 09:41:07 [notice] 1#1: OS: Linux 6.8.0-45-generic\n2026/09/18 09:41:07 [notice] 1#1: start worker processes\n2026/09/18 09:41:07 [notice] 1#1: start worker process 29\n2026/09/18 09:41:07 [notice] 1#1: start worker process 30\n'
const PG_LOG = 'The files belonging to this database system will be owned by user "postgres".\nThis user must also own the server process.\n\nThe database cluster will be initialized with locale "en_US.utf8".\nThe default database encoding has accordingly been set to "UTF8".\nThe default text search configuration will be set to "english".\n\nData page checksums are disabled.\n\nfixing permissions on existing directory /var/lib/postgresql/data ... ok\ncreating subdirectories ... ok\nselecting dynamic shared memory implementation ... posix\nselecting default max_connections ... 100\nselecting default shared_buffers ... 128MB\nselecting default time zone ... Etc/UTC\ncreating configuration files ... ok\nrunning bootstrap script ... ok\nperforming post-bootstrap initialization ... ok\nsyncing data to disk ... ok\n\nSuccess. You can now start the database server using:\n\n    pg_ctl -D /var/lib/postgresql/data -l logfile start\n\nwaiting for server to start....2026-09-18 09:41:07.412 UTC [48] LOG:  starting PostgreSQL 16.4 (Debian 16.4-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit\n2026-09-18 09:41:07.414 UTC [48] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"\n2026-09-18 09:41:07.420 UTC [51] LOG:  database system was shut down at 2026-09-18 09:41:07 UTC\n2026-09-18 09:41:07.425 UTC [48] LOG:  database system is ready to accept connections\n done\nserver started\n\n/usr/local/bin/docker-entrypoint.sh: ignoring /docker-entrypoint-initdb.d/*\n\nwaiting for server to shut down....2026-09-18 09:41:07.512 UTC [48] LOG:  received fast shutdown request\n2026-09-18 09:41:07.520 UTC [48] LOG:  database system is shut down\n done\nserver stopped\n\nPostgreSQL init process complete; ready for start up.\n\n2026-09-18 09:41:07.640 UTC [1] LOG:  starting PostgreSQL 16.4 (Debian 16.4-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit\n2026-09-18 09:41:07.641 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432\n2026-09-18 09:41:07.641 UTC [1] LOG:  listening on IPv6 address "::", port 5432\n2026-09-18 09:41:07.645 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"\n2026-09-18 09:41:07.652 UTC [64] LOG:  database system was shut down at 2026-09-18 09:41:07 UTC\n2026-09-18 09:41:07.660 UTC [1] LOG:  database system is ready to accept connections\n'
const PG_NOPASS = 'Error: Database is uninitialized and superuser password is not specified.\n       You must specify POSTGRES_PASSWORD to a non-empty value for the\n       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".\n\n       You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all\n       connections without a password. This is *not* recommended.\n\n       See PostgreSQL documentation about "trust":\n       https://www.postgresql.org/docs/current/auth-trust.html\n'
const REDIS_LOG = '1:C 18 Sep 2026 09:41:07.100 * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo\n1:C 18 Sep 2026 09:41:07.100 * Redis version=7.4.1, bits=64, commit=00000000, modified=0, pid=1, just started\n1:M 18 Sep 2026 09:41:07.101 * Running mode=standalone, port=6379.\n1:M 18 Sep 2026 09:41:07.101 * Server initialized\n1:M 18 Sep 2026 09:41:07.101 * Ready to accept connections tcp\n'
const HELLO = 'Hello from Docker!\nThis message shows that your installation appears to be working correctly.\n\nTo generate this message, Docker took the following steps:\n 1. The Docker client contacted the Docker daemon.\n 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.\n    (amd64)\n 3. The Docker daemon created a new container from that image which runs the\n    executable that produces the output you are currently reading.\n 4. The Docker daemon streamed that output to the Docker client, which sent it\n    to your terminal.\n\nTo try something more ambitious, you can run an Ubuntu container with:\n $ docker run -it ubuntu bash\n\nShare images, automate workflows, and more with a free Docker ID:\n https://hub.docker.com/\n\nFor more examples and ideas, visit:\n https://docs.docker.com/get-started/\n\n'

/** Resolve a service or container name on the container's network to an IP. */
function resolveHost(ctx: Ctx, host: string): string | null {
  if (host === 'localhost' || host === ctx.c.name || host === ctx.c.id.slice(0, 12)) return '127.0.0.1'
  const peer = ctx.st.containers.find((o) => o.network === ctx.c.network && o.status === 'running' && (o.name === host || o.service === host || o.id.startsWith(host)))
  if (peer) return ctx.c.network === 'bridge' && peer.name === host ? null : peer.ip
  return null
}

function runPython(ctx: Ctx, argv: string[]): Run {
  const ver = ctx.img.family === 'python' ? (ctx.img.env.PYTHON_VERSION ?? '3.12.7') : ctx.img.family === 'ubuntu' ? '' : ctx.img.family === 'alpine' ? '' : '3.11.2'
  if (!ver) return notFound(ctx, argv[0])
  if (argv[1] === '--version' || argv[1] === '-V') return { out: `Python ${ver}\n`, code: 0 }
  if (argv[1] === '-c') {
    const code = argv[2] ?? ''
    const prints = [...code.matchAll(/print\((?:"([^"]*)"|'([^']*)')\)/g)].map((m) => m[1] ?? m[2])
    if (/sys\.version/.test(code)) return { out: `${ver} (main, Sep 18 2026, 09:41:07) [GCC 12.2.0]\n`, code: 0 }
    if (/platform\.machine|os\.uname/.test(code)) return { out: 'x86_64\n', code: 0 }
    if (prints.length) return { out: prints.join('\n') + '\n', code: 0 }
    return { out: '(python -c inside a container is only simulated for simple print calls)\n', code: 0 }
  }
  if (argv[1] === '-m') {
    if (argv[2] === 'http.server') { const port = argv[3] ?? '8000'; return { out: `Serving HTTP on 0.0.0.0 port ${port} (http://0.0.0.0:${port}/) ...\n`, code: 0, daemon: true } }
    if (argv[2] === 'pip') return runPip(ctx, argv.slice(2))
    if (argv[2] === 'inventory' || argv[2] === 'inventory.cli') return inventorySim(ctx, argv.slice(3))
    return { out: `${argv[0]}: No module named ${argv[2] ?? ''}\n`, code: 1 }
  }
  if (!argv[1]) return { out: ctx.tty ? `Python ${ver} (main, Sep 18 2026, 09:41:07) [GCC 12.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n>>> exit()\n(an interactive Python shell is not simulated inside containers; run a script or use -c)\n` : '', code: 0 }
  const script = argv[1]
  const s = statC(ctx, script)
  if (!s || s.type !== 'file') return { out: `${argv[0]}: can't open file '${normalize(script, ctx.cwd, '/root')}': [Errno 2] No such file or directory\n`, code: 2 }
  if (basename(script) === 'inventory.py' || /class Inventory/.test(s.content)) return inventorySim(ctx, argv.slice(2))
  const prints = [...s.content.matchAll(/^print\((?:"([^"]*)"|'([^']*)')\)\s*$/gm)].map((m) => m[1] ?? m[2])
  if (prints.length) return { out: prints.join('\n') + '\n', code: 0 }
  return { out: `(${basename(script)} ran inside the container. Only inventory.py and plain print calls are simulated here; other programs run for real on your VM.)\n`, code: 0 }
}

function runPip(ctx: Ctx, argv: string[]): Run {
  const sub = argv[1]
  const pv = 'pip 24.2 from /usr/local/lib/python3.12/site-packages/pip (python 3.12)\n'
  if (!sub || sub === '--version' || sub === '-V') return { out: pv, code: 0 }
  if (sub === 'install') {
    const pkgs: string[] = []
    for (let i = 2; i < argv.length; i++) {
      if (argv[i] === '-r' || argv[i] === '--requirement') {
        const f = statC(ctx, argv[++i] ?? '')
        if (!f || f.type !== 'file') return { out: `ERROR: Could not open requirements file: [Errno 2] No such file or directory: '${argv[i]}'\n`, code: 1 }
        pkgs.push(...f.content.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter((l) => l && !l.startsWith('-')).map((l) => l.split(/[=<>~![; ]/)[0]))
      } else if (!argv[i].startsWith('-')) pkgs.push(argv[i].split(/[=<>~![]/)[0])
    }
    if (!pkgs.length) return { out: 'ERROR: You must give at least one requirement to install (see "pip help install")\n', code: 1 }
    return { out: pkgs.map((p) => `Collecting ${p}\n  Downloading ${p}-1.0.0-py3-none-any.whl (50 kB)\n`).join('') + `Installing collected packages: ${pkgs.join(', ')}\nSuccessfully installed ${pkgs.map((p) => p + '-1.0.0').join(' ')}\n`, code: 0 }
  }
  if (sub === 'list') return { out: 'Package    Version\n---------- -------\npip        24.2\nsetuptools 75.1.0\nwheel      0.44.0\n', code: 0 }
  return { out: `ERROR: unknown command "${sub}"\n`, code: 1 }
}

function notFound(ctx: Ctx, name: string): Run {
  return { out: `${ctx.img.family === 'alpine' || ctx.img.family === 'busybox' ? '/bin/sh' : '/bin/bash'}: line 1: ${name}: command not found\n`, code: 127 }
}

const IMAGE_CMDS: Record<string, (ctx: Ctx, argv: string[]) => Run | null> = {
  nginx: (ctx, argv) => { if (argv[1] === '-v' || argv[1] === '-V') return { out: 'nginx version: nginx/1.27.2\n', code: 0 }; if (argv[1] === '-t') return { out: 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful\n', code: 0 }; return ctx.img.family === 'nginx' ? { out: '', code: 0, daemon: true } : null },
  psql: (ctx, argv) => {
    if (ctx.img.family !== 'postgres') return null
    if (argv.includes('--version')) return { out: 'psql (PostgreSQL) 16.4 (Debian 16.4-1.pgdg120+1)\n', code: 0 }
    const ci = argv.findIndex((a) => a === '-c' || a === '--command')
    const sql = ci >= 0 ? argv[ci + 1] ?? '' : ''
    const user = argv[argv.indexOf('-U') + 1] || 'root'
    if (!argv.includes('-U') && !ctx.env.POSTGRES_USER) return { out: `psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "root" does not exist\n`, code: 2 }
    if (!sql) return { out: `psql (16.4 (Debian 16.4-1.pgdg120+1))\nType "help" for help.\n\n${ctx.env.POSTGRES_DB ?? user}=# \\q\n(an interactive psql session is not simulated here; pass a statement with -c "SELECT ...")\n`, code: 0 }
    const q = sql.trim().replace(/;$/, '')
    if (/^select\s+version\(\)/i.test(q)) return { out: '                                                       version\n----------------------------------------------------------------------------------------------------------------------\n PostgreSQL 16.4 (Debian 16.4-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit\n(1 row)\n\n', code: 0 }
    if (/^select\s+now\(\)/i.test(q)) return { out: '              now\n-------------------------------\n 2026-09-18 09:42:11.123456+00\n(1 row)\n\n', code: 0 }
    if (/^select\s+current_user/i.test(q)) return { out: ` current_user\n--------------\n ${user}\n(1 row)\n\n`, code: 0 }
    const m = q.match(/^select\s+(\d+)\s*(?:as\s+(\w+))?$/i)
    if (m) { const col = m[2] ?? '?column?'; return { out: ` ${col}\n${'-'.repeat(col.length + 2)}\n ${m[1].padStart(col.length)}\n(1 row)\n\n`, code: 0 } }
    if (/^create\s+table/i.test(q)) return { out: 'CREATE TABLE\n', code: 0 }
    if (/^create\s+database/i.test(q)) return { out: 'CREATE DATABASE\n', code: 0 }
    if (/^insert/i.test(q)) return { out: 'INSERT 0 1\n', code: 0 }
    if (/^drop/i.test(q)) return { out: 'DROP TABLE\n', code: 0 }
    if (/^\\l/.test(q)) return { out: `                                                    List of databases\n   Name    |  Owner   | Encoding | Locale Provider |  Collate   |   Ctype    | Locale | ICU Rules |   Access privileges\n-----------+----------+----------+-----------------+------------+------------+--------+-----------+-----------------------\n ${(ctx.env.POSTGRES_DB ?? user).padEnd(9)} | ${user.padEnd(8)} | UTF8     | libc            | en_US.utf8 | en_US.utf8 |        |           |\n postgres  | ${user.padEnd(8)} | UTF8     | libc            | en_US.utf8 | en_US.utf8 |        |           |\n template0 | ${user.padEnd(8)} | UTF8     | libc            | en_US.utf8 | en_US.utf8 |        |           | =c/${user}\n template1 | ${user.padEnd(8)} | UTF8     | libc            | en_US.utf8 | en_US.utf8 |        |           | =c/${user}\n(4 rows)\n\n`, code: 0 }
    if (/^\\dt/.test(q)) return { out: 'Did not find any relations.\n', code: 0 }
    if (/^select/i.test(q)) return { out: '(0 rows)\n\n', code: 0 }
    return { out: `ERROR:  syntax error at or near "${q.split(/\s+/)[0]}"\nLINE 1: ${q}\n        ^\n`, code: 1 }
  },
  pg_isready: (ctx) => (ctx.img.family === 'postgres' ? { out: '/var/run/postgresql:5432 - accepting connections\n', code: 0 } : null),
  postgres: (ctx, argv) => (ctx.img.family === 'postgres' ? (argv[1] === '--version' ? { out: 'postgres (PostgreSQL) 16.4 (Debian 16.4-1.pgdg120+1)\n', code: 0 } : { out: '', code: 0, daemon: true }) : null),
  'redis-server': (ctx) => (ctx.img.family === 'redis' ? { out: '', code: 0, daemon: true } : null),
  'redis-cli': (ctx, argv) => (ctx.img.family === 'redis' ? { out: argv[1] === 'ping' ? 'PONG\n' : argv[1] === 'set' ? 'OK\n' : argv[1] === 'get' ? '(nil)\n' : '(redis-cli is only simulated for ping, set, and get)\n', code: 0 } : null),
}

function execC(ctx: Ctx, argv: string[]): Run {
  const [name, ...args] = argv
  if (!name) return { out: '', code: 0 }
  const fam = ctx.img.family
  // Entrypoints of the official images.
  if (name === '/docker-entrypoint.sh' && fam === 'nginx') return { out: NGINX_LOG, code: 0, daemon: true }
  if (name === 'docker-entrypoint.sh' && fam === 'postgres') {
    if (args[0] !== 'postgres') return execC(ctx, args)
    if (!ctx.env.POSTGRES_PASSWORD && ctx.env.POSTGRES_HOST_AUTH_METHOD !== 'trust') return { out: PG_NOPASS, code: 1 }
    return { out: PG_LOG + (ctx.env.POSTGRES_DB ? '' : ''), code: 0, daemon: true }
  }
  if (name === 'docker-entrypoint.sh' && fam === 'redis') return { out: REDIS_LOG, code: 0, daemon: true }
  if (name === '/hello' && fam === 'hello') return { out: HELLO, code: 0 }
  const shells = ['sh', 'bash', '/bin/sh', '/bin/bash', '/usr/bin/bash']
  if (shells.includes(name)) {
    if (name.endsWith('bash') && (fam === 'alpine' || fam === 'busybox')) return { out: `docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "bash": executable file not found in $PATH: unknown.\n`, code: 127 }
    if (args[0] === '-c') {
      let out = ''
      let code = 0
      let daemon = false
      for (const part of (args[1] ?? '').split(/\s*(?:&&|;)\s*/)) {
        if (!part.trim()) continue
        const redir = part.match(/^(.*?)\s*(>>|>)\s*(\S+)\s*$/)
        const r = execC(ctx, shellSplit(redir ? redir[1] : part))
        if (redir && r.code !== 127) writeC(ctx, redir[3], r.out, redir[2] === '>>'); else out += r.out
        code = r.code; daemon ||= Boolean(r.daemon)
        if (code !== 0) break
      }
      return { out, code, daemon }
    }
    if (args.length) return execC(ctx, args)
    return { out: ctx.tty ? `root@${ctx.c.id.slice(0, 12)}:${ctx.cwd}# exit\n(an interactive shell inside a container is not simulated here; run one command at a time, like docker exec ${ctx.c.name} ls /app)\n` : '', code: 0 }
  }
  const cmd = IMAGE_CMDS[name]
  if (cmd) { const r = cmd(ctx, argv); if (r) return r }
  switch (name) {
    case 'echo': return { out: args.filter((a) => a !== '-n').join(' ') + (args[0] === '-n' ? '' : '\n'), code: 0 }
    case 'printf': return { out: args[0]?.replace(/\\n/g, '\n').replace(/%s/g, () => args[1] ?? '') ?? '', code: 0 }
    case 'true': return { out: '', code: 0 }
    case 'false': return { out: '', code: 1 }
    case 'exit': return { out: '', code: Number(args[0] ?? 0) }
    case 'sleep': return { out: '', code: 0, daemon: args[0] === 'infinity' || Number(args[0]) > 30 }
    case 'tail': if (args[0] === '-f') return { out: '', code: 0, daemon: true }; return catLike(ctx, args, (t) => t.split('\n').slice(-11).join('\n'))
    case 'head': return catLike(ctx, args, (t) => t.split('\n').slice(0, 10).join('\n') + '\n')
    case 'pwd': return { out: ctx.cwd + '\n', code: 0 }
    case 'whoami': return { out: 'root\n', code: 0 }
    case 'id': return { out: 'uid=0(root) gid=0(root) groups=0(root)\n', code: 0 }
    case 'hostname': return { out: ctx.c.id.slice(0, 12) + '\n', code: 0 }
    case 'uname': return { out: (args.includes('-a') ? `Linux ${ctx.c.id.slice(0, 12)} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024 x86_64 ${fam === 'alpine' ? 'Linux' : 'GNU/Linux'}` : args.includes('-r') ? '6.8.0-45-generic' : args.includes('-m') ? 'x86_64' : 'Linux') + '\n', code: 0 }
    case 'date': return { out: new Date().toUTCString().replace('GMT', 'UTC') + '\n', code: 0 }
    case 'env': case 'printenv': {
      const all: Record<string, string> = { PATH: ctx.env.PATH ?? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', HOSTNAME: ctx.c.id.slice(0, 12), ...ctx.env, HOME: '/root' }
      if (args[0]) return all[args[0]] !== undefined ? { out: all[args[0]] + '\n', code: 0 } : { out: '', code: 1 }
      return { out: Object.entries(all).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', code: 0 }
    }
    case 'cat': return catLike(ctx, args, (t) => t)
    case 'ls': {
      const flags = args.filter((a) => a.startsWith('-')).join('')
      const targets = args.filter((a) => !a.startsWith('-'))
      const paths = targets.length ? targets : ['.']
      let out = ''
      let code = 0
      for (const p of paths) {
        const names = listC(ctx, p)
        if (!names) { out += `ls: cannot access '${p}': No such file or directory\n`; code = 2; continue }
        if (paths.length > 1) out += `${p}:\n`
        const shown = flags.includes('a') ? ['.', '..', ...names] : names
        out += flags.includes('l') ? shown.map((n) => { const s = statC(ctx, normalize(p, ctx.cwd, '/root') + '/' + n); const isDir = !s || s.type === 'dir'; return `${isDir ? 'drwxr-xr-x' : '-rw-r--r--'} 1 root root ${String(isDir ? 4096 : (s as { content: string }).content.length).padStart(6)} Sep 18 09:41 ${n}` }).join('\n') + (shown.length ? '\n' : '') : shown.join('  ') + (shown.length ? '\n' : '')
      }
      return { out, code }
    }
    case 'mkdir': for (const a of args.filter((x) => !x.startsWith('-'))) ctx.c.files[normalize(a, ctx.cwd, '/root') + '/.keep'] = ''; return { out: '', code: 0 }
    case 'touch': for (const a of args) if (!statC(ctx, a)) writeC(ctx, a, ''); return { out: '', code: 0 }
    case 'rm': { let code = 0; let out = ''; for (const a of args.filter((x) => !x.startsWith('-'))) { const abs = normalize(a, ctx.cwd, '/root'); if (!statC(ctx, abs)) { out += `rm: cannot remove '${a}': No such file or directory\n`; code = 1; continue } delete ctx.c.files[abs]; const m = mountFor(ctx, abs); if (m && !m.v.named) { try { ctx.sh.vfs.remove(m.v.src + '/' + m.rel, { recursive: true }) } catch { /* already gone */ } } else if (m) delete ctx.st.volumes[m.v.src]?.[m.rel] } return { out, code } }
    case 'cd': { const s = statC(ctx, args[0] ?? '/root'); if (!s || s.type !== 'dir') return { out: `sh: cd: ${args[0]}: No such file or directory\n`, code: 1 }; ctx.cwd = normalize(args[0] ?? '/root', ctx.cwd, '/root'); return { out: '', code: 0 } }
    case 'wc': return catLike(ctx, args.filter((a) => !a.startsWith('-')), (t) => { const l = t.split('\n').length - (t.endsWith('\n') ? 1 : 0); return (args.includes('-l') ? `${l}` : `${l} ${t.split(/\s+/).filter(Boolean).length} ${t.length}`) + '\n' })
    case 'grep': { const [pat, ...files] = args.filter((a) => !a.startsWith('-')); if (!pat) return { out: 'Usage: grep [OPTION]... PATTERNS [FILE]...\n', code: 2 }; let re: RegExp; try { re = new RegExp(pat, args.includes('-i') ? 'i' : '') } catch { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) } return catLike(ctx, files, (t) => { const hits = t.split('\n').filter((l) => re.test(l)); return hits.length ? hits.join('\n') + '\n' : '' }) }
    case 'getent': { if (args[0] !== 'hosts' || !args[1]) return { out: 'Usage: getent hosts NAME\n', code: 2 }; const ip = resolveHost(ctx, args[1]); return ip ? { out: `${ip.padEnd(15)} ${args[1]}\n`, code: 0 } : { out: '', code: 2 } }
    case 'nslookup': { const ip = resolveHost(ctx, args[0] ?? ''); return ip ? { out: `Server:\t\t127.0.0.11\nAddress:\t127.0.0.11#53\n\nNon-authoritative answer:\nName:\t${args[0]}\nAddress: ${ip}\n`, code: 0 } : { out: `Server:\t\t127.0.0.11\nAddress:\t127.0.0.11#53\n\n** server can't find ${args[0]}: NXDOMAIN\n`, code: 1 } }
    case 'ping': { const host = args.filter((a) => !a.startsWith('-') && !/^\d+$/.test(a)).pop() ?? ''; const ip = resolveHost(ctx, host); if (fam === 'python' || fam === 'nginx' || fam === 'postgres') return notFound(ctx, 'ping'); if (!ip) return { out: `ping: bad address '${host}'\n`, code: 1 }; return { out: `PING ${host} (${ip}): 56 data bytes\n64 bytes from ${ip}: seq=0 ttl=64 time=0.089 ms\n64 bytes from ${ip}: seq=1 ttl=64 time=0.071 ms\n\n--- ${host} ping statistics ---\n2 packets transmitted, 2 packets received, 0% packet loss\nround-trip min/avg/max = 0.071/0.080/0.089 ms\n`, code: 0 } }
    case 'curl': case 'wget': { const url = args.find((a) => !a.startsWith('-')) ?? ''; const host = url.replace(/^https?:\/\//, '').split(/[/:]/)[0]; const ip = resolveHost(ctx, host); if (fam === 'python' || fam === 'nginx' || fam === 'postgres') return notFound(ctx, name); if (!ip) return { out: `${name}: (6) Could not resolve host: ${host}\n`, code: 6 }; return { out: `(${name} inside a container reached ${host} at ${ip}; the response is not simulated)\n`, code: 0 } }
    case 'python': case 'python3': return runPython(ctx, argv)
    case 'pip': case 'pip3': return fam === 'python' ? runPip(ctx, argv) : notFound(ctx, name)
    case 'apt-get': case 'apt': return fam === 'ubuntu' || fam === 'python' || fam === 'nginx' || fam === 'postgres' ? { out: args[0] === 'update' ? 'Get:1 http://deb.debian.org/debian bookworm InRelease [151 kB]\nGet:2 http://deb.debian.org/debian bookworm-updates InRelease [55.4 kB]\nReading package lists... Done\n' : args[0] === 'install' ? `Reading package lists... Done\nBuilding dependency tree... Done\nSetting up ${args.filter((a) => !a.startsWith('-')).slice(1).join(' ')} ...\n` : 'apt 2.6.1 (amd64)\n', code: 0 } : notFound(ctx, name)
    case 'apk': return fam === 'alpine' ? { out: args[0] === 'add' ? `fetch https://dl-cdn.alpinelinux.org/alpine/v3.20/main/x86_64/APKINDEX.tar.gz\n(1/1) Installing ${args.filter((a) => !a.startsWith('-')).slice(1).join(' ')}\nOK: 8 MiB in 15 packages\n` : 'apk-tools 2.14.4, compiled for x86_64.\n', code: 0 } : notFound(ctx, name)
    case 'nc': case 'netstat': case 'ss': return { out: '(network tools inside containers are not simulated)\n', code: 0 }
    default: {
      const s = statC(ctx, name)
      if (s?.type === 'file' && s.content.startsWith('#!')) return { out: `(${name} is a script; scripts inside containers are not simulated here)\n`, code: 0 }
      return notFound(ctx, name)
    }
  }
}

function catLike(ctx: Ctx, files: string[], fn: (t: string) => string): Run {
  if (!files.length) return { out: '', code: 0 }
  let out = ''
  let code = 0
  for (const f of files) {
    const s = statC(ctx, f)
    if (!s) { out += `cat: ${f}: No such file or directory\n`; code = 1; continue }
    if (s.type === 'dir') { out += `cat: ${f}: Is a directory\n`; code = 1; continue }
    out += fn(s.content)
  }
  return { out, code }
}

/* ---------- containers ---------- */

function makeCtx(sh: Shell, st: DockerState, c: DockerContainer, tty = true): Ctx {
  const img = findImage(st, c.image) ?? st.images.find((i) => i.id === c.image) ?? fallbackImage(c.image)
  return { sh, st, c, img, cwd: c.workdir, env: { ...img.env, ...c.env }, tty }
}
const fallbackImage = (ref: string): DockerImage => ({ ...splitRef(ref), id: '0'.repeat(64), size: 0, created: Date.now(), family: 'busybox', files: {}, workdir: '/', env: {}, cmd: ['sh'], entrypoint: null, expose: [], layers: [] })

/** Run the container's command, record its logs, and settle its status. */
function startContainer(sh: Shell, st: DockerState, c: DockerContainer, tty: boolean): Run {
  const ctx = makeCtx(sh, st, c, tty)
  const r = execC(ctx, c.command)
  c.logs += r.out
  if (r.daemon) { c.status = 'running'; c.exitCode = 0 } else { c.status = 'exited'; c.exitCode = r.code; c.finished = Date.now() }
  return r
}

function nextIp(st: DockerState, network: string): string {
  const idx = Math.max(0, st.networks.indexOf(network))
  const used = st.containers.filter((c) => c.network === network).length
  return network === 'bridge' ? `172.17.0.${used + 2}` : `172.${18 + (idx % 200)}.0.${used + 2}`
}

function findContainer(st: DockerState, ref: string) {
  return st.containers.find((c) => c.name === ref || c.id === ref || (ref.length >= 3 && c.id.startsWith(ref))) ?? null
}

interface RunOpts { detach: boolean; rm: boolean; it: boolean; name: string | null; ports: { host: string; cont: string }[]; volumes: { src: string; dst: string; named: boolean }[]; env: Record<string, string>; network: string | null; workdir: string | null; entrypoint: string[] | null; image: string; args: string[]; envFile: string | null }

function parseRunArgs(sh: Shell, argv: string[]): RunOpts | string {
  const o: RunOpts = { detach: false, rm: false, it: false, name: null, ports: [], volumes: [], env: {}, network: null, workdir: null, entrypoint: null, image: '', args: [], envFile: null }
  let i = 0
  const value = (flag: string) => { const a = argv[i]; if (a.includes('=') && a.startsWith('--')) return a.slice(a.indexOf('=') + 1); i++; if (argv[i] === undefined) throw new Error(`flag needs an argument: '${flag}'`); return argv[i] }
  try {
    for (; i < argv.length; i++) {
      const a = argv[i]
      if (!a.startsWith('-') || a === '-') break
      const key = a.split('=')[0]
      if (key === '-d' || key === '--detach') o.detach = true
      else if (key === '--rm') o.rm = true
      else if (/^-[it]+$/.test(key) || key === '--interactive' || key === '--tty') o.it = true
      else if (key === '-p' || key === '--publish') {
        const v = value(key)
        const parts = v.split(':')
        if (parts.length < 2) return `docker: Error response from daemon: invalid publish spec '${v}': use HOSTPORT:CONTAINERPORT`
        o.ports.push({ host: parts[parts.length - 2], cont: parts[parts.length - 1].replace(/\/tcp$/, '') })
      } else if (key === '-v' || key === '--volume' || key === '--mount') {
        let v = value(key)
        if (key === '--mount') { const m: Record<string, string> = {}; for (const kv of v.split(',')) { const [k, val] = kv.split('='); m[k] = val ?? '' } v = `${m.source ?? m.src ?? ''}:${m.target ?? m.dst ?? m.destination ?? ''}`; }
        const [src, dst] = v.split(':')
        if (!dst) return `docker: Error response from daemon: invalid volume specification: '${v}': the format is HOST_PATH:CONTAINER_PATH or NAME:CONTAINER_PATH`
        if (!dst.startsWith('/')) return `docker: Error response from daemon: invalid volume specification: '${v}': invalid mount config for type "bind": invalid mount path: '${dst}' mount path must be absolute`
        const named = !src.startsWith('/') && !src.startsWith('.') && !src.startsWith('~')
        o.volumes.push({ src: named ? src : sh.path(src), dst: dst.replace(/\/$/, '') || '/', named })
      } else if (key === '--name') o.name = value(key)
      else if (key === '-e' || key === '--env') { const v = value(key); const eq = v.indexOf('='); if (eq < 0) o.env[v] = sh.env[v] ?? ''; else o.env[v.slice(0, eq)] = v.slice(eq + 1) }
      else if (key === '--env-file') o.envFile = value(key)
      else if (key === '--network' || key === '--net') o.network = value(key)
      else if (key === '-w' || key === '--workdir') o.workdir = value(key)
      else if (key === '--entrypoint') o.entrypoint = shellSplit(value(key))
      else if (['--restart', '--memory', '-m', '--cpus', '--hostname', '-h', '--user', '-u', '--label', '-l', '--platform', '--pull', '--health-cmd', '--log-driver'].includes(key)) value(key)
      else if (['--privileged', '--init', '--read-only', '--no-healthcheck', '-a', '--attach', '-q', '--quiet'].includes(key)) { /* accepted, no effect */ }
      else return `unknown flag: ${key}\n\nUsage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nRun 'docker run --help' for more information`
    }
  } catch (e) { return `docker: ${(e as Error).message}.\nSee 'docker run --help'.` }
  if (i >= argv.length) return `"docker run" requires at least 1 argument.\nSee 'docker run --help'.\n\nUsage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nCreate and run a new container from an image`
  o.image = argv[i]
  o.args = argv.slice(i + 1)
  if (o.envFile) {
    try { for (const l of sh.readFile(o.envFile).split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const eq = t.indexOf('='); if (eq > 0) o.env[t.slice(0, eq)] = t.slice(eq + 1) } } catch { return `docker: open ${sh.path(o.envFile)}: no such file or directory` }
  }
  return o
}

function createContainer(sh: Shell, st: DockerState, img: DockerImage, o: RunOpts, extra: Partial<DockerContainer> = {}): DockerContainer | string {
  const name = o.name ?? extra.name ?? randomName(st)
  const clash = st.containers.find((c) => c.name === name)
  if (clash) return `docker: Error response from daemon: Conflict. The container name "/${name}" is already in use by container "${clash.id}". You have to remove (or rename) that container to be able to reuse that name.`
  for (const p of o.ports) {
    const taken = st.containers.find((c) => c.status === 'running' && c.ports.some((q) => q.host === p.host))
    if (taken) return `docker: Error response from daemon: driver failed programming external connectivity on endpoint ${name}: Bind for 0.0.0.0:${p.host} failed: port is already allocated`
    if (!/^\d+$/.test(p.host) || !/^\d+$/.test(p.cont)) return `docker: Error response from daemon: invalid port specification: "${p.host}:${p.cont}"`
  }
  const network = o.network ?? extra.network ?? 'bridge'
  if (!st.networks.includes(network)) return `docker: Error response from daemon: network ${network} not found`
  for (const v of o.volumes) {
    if (v.named) st.volumes[v.src] ??= {}
    else if (!sh.vfs.get(v.src)) sh.vfs.mkdir(v.src, { parents: true, owner: 'learner' })
  }
  const entry = o.entrypoint ?? img.entrypoint ?? []
  const command = [...entry, ...(o.args.length ? o.args : img.cmd ?? [])]
  const c: DockerContainer = { id: newId(st), name, image: `${img.repo}:${img.tag}`, command, status: 'created', exitCode: 0, ports: o.ports, volumes: o.volumes, env: { ...o.env }, logs: '', created: Date.now(), finished: 0, rm: o.rm, files: {}, workdir: o.workdir ?? img.workdir, network, ip: nextIp(st, network), ...extra }
  st.containers.push(c)
  return c
}

/* ---------- Dockerfile and build ---------- */

interface DfInstr { op: string; arg: string; line: number }

function parseDockerfile(text: string): DfInstr[] | string {
  const out: DfInstr[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]
    const start = i + 1
    if (!l.trim() || l.trim().startsWith('#')) continue
    while (l.trimEnd().endsWith('\\') && i + 1 < lines.length) { l = l.trimEnd().slice(0, -1) + ' ' + lines[++i].trim() }
    const m = l.trim().match(/^(\S+)\s*(.*)$/)
    if (!m) continue
    const op = m[1].toUpperCase()
    if (!['FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'HEALTHCHECK', 'SHELL', 'STOPSIGNAL', 'ONBUILD', 'MAINTAINER'].includes(op)) return `dockerfile parse error on line ${start}: unknown instruction: ${m[1]}`
    if (!m[2].trim() && op !== 'ARG') return `dockerfile parse error on line ${start}: ${op} requires at least one argument`
    out.push({ op, arg: m[2].trim(), line: start })
  }
  return out
}

const execForm = (arg: string): string[] => { if (arg.startsWith('[')) { try { const v = JSON.parse(arg) as unknown; if (Array.isArray(v)) return v.map(String) } catch { /* fall through to shell form */ } } return ['/bin/sh', '-c', arg] }

function dockerignore(sh: Shell, context: string): RegExp[] {
  const n = sh.vfs.get(context + '/.dockerignore')
  if (!n || n.type !== 'file') return []
  return n.content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((p) => new RegExp('^' + p.replace(/\/$/, '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.') + '(/|$)'))
}

/** Copy from the build context into the image. Returns an error string when a source is missing. */
function copyInto(sh: Shell, img: DockerImage, context: string, ignore: RegExp[], srcs: string[], dest: string): string | null {
  const destAbs = normalize(dest, img.workdir, '/root')
  const asDir = dest.endsWith('/') || srcs.length > 1 || dest === '.' || destAbs === img.workdir || Object.keys(img.files).some((k) => k.startsWith(destAbs + '/'))
  for (const src of srcs) {
    const rel = src.replace(/^\.\//, '').replace(/\/$/, '')
    const wanted = rel === '.' || rel === '' ? context : normalize(rel, context, '/root')
    if (!wanted.startsWith(context)) return `"/${rel}": not found`
    const matches: string[] = []
    if (/[*?]/.test(basename(wanted))) {
      const parent = sh.vfs.get(dirname(wanted))
      const re = new RegExp('^' + basename(wanted).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
      if (parent?.type === 'dir') for (const name of parent.children.keys()) if (re.test(name)) matches.push(dirname(wanted) + '/' + name)
    } else if (sh.vfs.get(wanted)) matches.push(wanted)
    if (!matches.length) return `"/${rel}": not found`
    for (const abs of matches) {
      const n = sh.vfs.get(abs)!
      const relPath = abs.slice(context.length).replace(/^\//, '')
      if (ignore.some((re) => re.test(relPath))) continue
      if (n.type === 'file') {
        const target = asDir || matches.length > 1 ? (abs === context ? destAbs : destAbs + '/' + basename(abs)) : destAbs
        img.files[target.replace(/\/+/g, '/')] = n.content
        img.size += n.content.length
      } else {
        sh.vfs.walk(abs, (p, node) => {
          if (node.type !== 'file') return
          const inner = p.slice(abs.length).replace(/^\//, '')
          const fullRel = (relPath ? relPath + '/' : '') + inner
          if (ignore.some((re) => re.test(fullRel))) return
          const target = (rel === '.' || rel === '' || asDir && srcs.length > 1 ? destAbs + (rel === '.' || rel === '' ? '' : '/' + basename(abs)) : destAbs) + '/' + inner
          img.files[target.replace(/\/+/g, '/')] = node.content
          img.size += node.content.length
        })
      }
    }
  }
  return null
}

function build(sh: Shell, st: DockerState, argv: string[]): CmdResult {
  const tags: string[] = []
  let file: string | null = null
  let context: string | null = null
  let noCache = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-t' || a === '--tag') tags.push(argv[++i] ?? '')
    else if (a.startsWith('--tag=')) tags.push(a.slice(6))
    else if (a === '-f' || a === '--file') file = argv[++i] ?? null
    else if (a === '--no-cache') noCache = true
    else if (a === '--progress' || a === '--platform' || a === '--build-arg' || a === '--target') i++
    else if (a.startsWith('-')) { /* ignore other flags */ }
    else context = a
  }
  if (!context) return fail('"docker buildx build" requires exactly 1 argument.\nSee \'docker buildx build --help\'.\n\nUsage:  docker buildx build [OPTIONS] PATH | URL | -\n\nStart a build')
  const ctxAbs = sh.path(context)
  const ctxNode = sh.vfs.get(ctxAbs)
  if (!ctxNode || ctxNode.type !== 'dir') return fail(`ERROR: unable to prepare context: path "${context}" not found`)
  const dfPath = file ? sh.path(file) : ctxAbs + '/Dockerfile'
  const dfNode = sh.vfs.get(dfPath)
  const header = (n: number, total: number, status: string) => `[+] Building ${(0.3 + n * 0.4).toFixed(1)}s (${n}/${total}) ${status}${' '.repeat(Math.max(1, 46 - status.length))}docker:default\n`
  if (!dfNode || dfNode.type !== 'file') return { out: header(0, 0, 'FINISHED'), err: `ERROR: failed to solve: failed to read dockerfile: open ${file ?? 'Dockerfile'}: no such file or directory\n`, code: 1 }
  if (!dfNode.content.trim()) return { out: header(1, 1, 'FINISHED'), err: 'ERROR: failed to solve: the Dockerfile cannot be empty\n', code: 1 }
  const parsed = parseDockerfile(dfNode.content)
  if (typeof parsed === 'string') return { out: header(1, 1, 'FINISHED'), err: `ERROR: failed to solve: ${parsed}\n`, code: 1 }
  const fromIdx = parsed.findIndex((p) => p.op === 'FROM')
  const firstReal = parsed.findIndex((p) => p.op !== 'ARG')
  if (fromIdx < 0 || firstReal !== fromIdx) return { out: header(1, 1, 'FINISHED'), err: `ERROR: failed to solve: dockerfile parse error on line ${parsed[firstReal >= 0 ? firstReal : 0]?.line ?? 1}: no build stage in current context\n`, code: 1 }
  for (const t of tags) if (!/^[a-z0-9][a-z0-9._/-]*(:[A-Za-z0-9_.-]+)?$/.test(t)) return fail(`ERROR: invalid tag "${t}": repository name must be lowercase`)

  const layerOps = parsed.filter((p) => ['FROM', 'WORKDIR', 'COPY', 'ADD', 'RUN'].includes(p.op))
  const total = layerOps.length
  const baseRef = parsed[fromIdx].arg.split(/\s+/)[0]
  const { repo, tag } = splitRef(baseRef)
  const known = knownImage(repo, tag)
  const local = findImage(st, baseRef)
  const steps: string[] = ['[internal] load build definition from ' + basename(dfPath), '=> transferring dockerfile: ' + dfNode.content.length + 'B', `[internal] load metadata for docker.io/library/${repo}:${tag}`, '[internal] load .dockerignore', '=> transferring context: ' + (sh.vfs.get(ctxAbs + '/.dockerignore') ? '120B' : '2B')]
  const line = (s: string, secs = '0.0') => ` => ${s.startsWith('=>') ? '=> ' + s.slice(3) : s}`.padEnd(75) + `${secs}s\n`
  let out = header(total + 5, total + 5, 'FINISHED') + steps.map((s, i) => line(s, i === 2 ? '0.8' : '0.0')).join('')
  if (!known && !local) return { out, err: `ERROR: failed to solve: ${repo}:${tag}: failed to resolve source metadata for docker.io/library/${repo}:${tag}: docker.io/library/${repo}:${tag}: not found\n`, code: 1 }
  const baseImg = local ?? pull(st, baseRef, true).img!
  const img: DockerImage = { repo: '<none>', tag: '<none>', id: hex(st.seq++ * 13 + 5, 64), size: baseImg.size, created: Date.now(), family: baseImg.family, files: { ...baseImg.files }, workdir: baseImg.workdir, env: { ...baseImg.env }, cmd: baseImg.cmd, entrypoint: baseImg.entrypoint, expose: [...baseImg.expose], layers: [], base: `${repo}:${tag}` }
  const ignore = dockerignore(sh, ctxAbs)
  let n = 0
  let contextLoaded = false
  for (const ins of parsed) {
    const isLayer = ['FROM', 'WORKDIR', 'COPY', 'ADD', 'RUN'].includes(ins.op)
    if (isLayer) n++
    const label = `[${n}/${total}] ${ins.op} ${ins.op === 'FROM' ? `docker.io/library/${repo}:${tag}${known ? '@sha256:' + known.digest.slice(0, 12) : ''}` : ins.arg}`
    if ((ins.op === 'COPY' || ins.op === 'ADD') && !contextLoaded) { contextLoaded = true; out += line('[internal] load build context') + line(`=> transferring context: ${humanSize(Object.values(sh.vfs.snapshot(ctxAbs)).reduce((a, c) => a + (c?.length ?? 0), 0))}`) }
    switch (ins.op) {
      case 'FROM': img.layers.push(`FROM ${baseRef}`); break
      case 'WORKDIR': img.workdir = normalize(ins.arg, img.workdir, '/root'); img.layers.push(`WORKDIR ${ins.arg}`); break
      case 'COPY': case 'ADD': {
        const parts = shellSplit(ins.arg).filter((p) => !p.startsWith('--'))
        if (parts.length < 2) return { out: out + line(label), err: `ERROR: failed to solve: dockerfile parse error on line ${ins.line}: ${ins.op} requires at least two arguments, but only one was provided. Destination could not be determined\n`, code: 1 }
        const err = copyInto(sh, img, ctxAbs, ignore, parts.slice(0, -1), parts[parts.length - 1])
        if (err) {
          const errLine = ` => ERROR ${label}`.padEnd(75) + '0.0s\n'
          const src = dfNode.content.split('\n')
          const snippet = src.map((l, i) => `${i + 1 === ins.line ? `${String(i + 1).padStart(4)} | >>> ` : `${String(i + 1).padStart(4)} |     `}${l}`).filter((_, i) => Math.abs(i + 1 - ins.line) <= 1).join('\n')
          return { out: out + errLine + `------\n > ${label}:\n------\nDockerfile:${ins.line}\n--------------------\n${snippet}\n--------------------\n`, err: `ERROR: failed to solve: failed to compute cache key: failed to calculate checksum of ref ${hex(ins.line * 3, 12)}::${hex(ins.line * 5, 12)}: ${err}\n`, code: 1 }
        }
        img.layers.push(`${ins.op} ${ins.arg}`)
        break
      }
      case 'RUN': {
        const m = ins.arg.match(/pip3?\s+install\s+(?:--no-cache-dir\s+)?-r\s+(\S+)/)
        if (m && !(normalize(m[1], img.workdir, '/root') in img.files)) return { out: out + line(label), err: `ERROR: failed to solve: process "/bin/sh -c ${ins.arg}" did not complete successfully: exit code: 1\n  (ERROR: Could not open requirements file: [Errno 2] No such file or directory: '${m[1]}')\n`, code: 1 }
        img.layers.push(`RUN ${ins.arg}`)
        img.size += 2_400_000
        break
      }
      case 'ENV': { const eq = ins.arg.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/) ?? ins.arg.match(/^([A-Za-z_]\w*)\s+(.*)$/); if (eq) img.env[eq[1]] = eq[2].replace(/^"(.*)"$/, '$1'); for (const kv of ins.arg.matchAll(/(\w+)="([^"]*)"|(\w+)=(\S+)/g)) img.env[kv[1] ?? kv[3]] = kv[2] ?? kv[4]; break }
      case 'EXPOSE': img.expose.push(...ins.arg.split(/\s+/).map((p) => (p.includes('/') ? p : p + '/tcp'))); break
      case 'CMD': img.cmd = execForm(ins.arg); break
      case 'ENTRYPOINT': img.entrypoint = execForm(ins.arg); if (!ins.arg.startsWith('[')) img.cmd = null; break
      default: break
    }
    if (isLayer) out += line(label + (ins.op === 'FROM' && local && !noCache ? '' : ''), ins.op === 'RUN' ? '1.2' : '0.0').replace(/^ => \[/, n > 1 && ins.op !== 'RUN' && !noCache ? ' => [' : ' => [')
  }
  if (!tags.length) tags.push('<none>:<none>')
  const names = tags.map((t) => { const r = splitRef(t); return `${r.repo}:${r.tag}` })
  out += line('exporting to image') + line('=> exporting layers') + line(`=> writing image sha256:${img.id}`)
  for (const t of tags) if (t !== '<none>:<none>') out += line(`=> naming to docker.io/library/${splitRef(t).repo}:${splitRef(t).tag}`)
  // Register the image, untagging any older image that held the same name.
  const first = splitRef(tags[0])
  for (const old of st.images) if (names.includes(`${old.repo}:${old.tag}`)) { old.repo = '<none>'; old.tag = '<none>' }
  img.repo = first.repo; img.tag = first.tag
  st.images.push(img)
  for (const t of tags.slice(1)) { const r = splitRef(t); st.images.push({ ...img, repo: r.repo, tag: r.tag }) }
  return ok(out + (tags[0] === '<none>:<none>' ? '' : '') + '\nWhat\'s next:\n    View a summary of image vulnerabilities and recommendations \u2192 docker scout quickview\n')
}

/* ---------- compose ---------- */

type Yaml = string | Yaml[] | { [k: string]: Yaml } | null

/** A small YAML reader: nested maps, lists of scalars or maps, inline [a, b] lists, quoted strings. */
function parseYaml(text: string): Yaml {
  const lines = text.split('\n').map((l) => l.replace(/\t/g, '  ').replace(/\s+#.*$/, '').replace(/^#.*$/, '')).filter((l) => l.trim() !== '')
  let i = 0
  const indent = (l: string) => l.length - l.trimStart().length
  const scalar = (s: string): Yaml => {
    const t = s.trim()
    if (t === '' || t === '~' || t === 'null') return null
    if (/^".*"$/.test(t) || /^'.*'$/.test(t)) return t.slice(1, -1)
    if (t.startsWith('[') && t.endsWith(']')) return t.slice(1, -1).split(',').map((x) => scalar(x)).filter((x) => x !== null)
    if (t.startsWith('{') && t.endsWith('}')) { const o: { [k: string]: Yaml } = {}; for (const kv of t.slice(1, -1).split(',')) { const [k, ...v] = kv.split(':'); if (k.trim()) o[k.trim()] = scalar(v.join(':')) } return o }
    return t
  }
  const block = (level: number): Yaml => {
    if (i >= lines.length) return null
    if (lines[i].trim().startsWith('- ')|| lines[i].trim() === '-') {
      const arr: Yaml[] = []
      while (i < lines.length && indent(lines[i]) === level && (lines[i].trim().startsWith('- ') || lines[i].trim() === '-')) {
        const rest = lines[i].trim().slice(1).trim()
        if (rest === '') { i++; arr.push(block(level + 2)); continue }
        const kv = rest.match(/^([^\s:"']+|"[^"]*"|'[^']*')\s*:(?:\s+(.*))?$/)
        if (kv && !/^[\w.-]+:\d+/.test(rest) && !/^["']/.test(rest)) {
          // A list item that starts a map: "- key: value" then deeper keys.
          lines[i] = ' '.repeat(level + 2) + rest
          arr.push(block(level + 2))
          continue
        }
        arr.push(scalar(rest))
        i++
      }
      return arr
    }
    const obj: { [k: string]: Yaml } = {}
    while (i < lines.length && indent(lines[i]) === level) {
      const l = lines[i].trim()
      if (l.startsWith('- ')) break
      const m = l.match(/^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*)|$)/)
      if (!m) { i++; continue }
      const key = m[1].replace(/^["'](.*)["']$/, '$1')
      const val = m[2]
      i++
      if (val !== undefined && val.trim() !== '' && val.trim() !== '|' && val.trim() !== '>') obj[key] = scalar(val)
      else if (i < lines.length && indent(lines[i]) > level) obj[key] = block(indent(lines[i]))
      else if (i < lines.length && indent(lines[i]) === level && lines[i].trim().startsWith('- ')) obj[key] = block(level)
      else obj[key] = null
    }
    return obj
  }
  return block(i < lines.length ? indent(lines[0]) : 0)
}

interface Service { name: string; image?: string; build?: { context: string; dockerfile?: string }; ports: { host: string; cont: string }[]; volumes: { src: string; dst: string; named: boolean }[]; env: Record<string, string>; dependsOn: string[]; networks: string[]; containerName?: string; command?: string[]; workdir?: string; entrypoint?: string[] }
interface ComposeFile { path: string; dir: string; project: string; services: Service[]; volumes: string[]; networks: string[] }

const asObj = (y: Yaml): { [k: string]: Yaml } => (y && typeof y === 'object' && !Array.isArray(y) ? y : {})
const asList = (y: Yaml): Yaml[] => (Array.isArray(y) ? y : y === null || y === undefined ? [] : [y])
const asStr = (y: Yaml): string => (typeof y === 'string' ? y : y === null ? '' : JSON.stringify(y))

function loadCompose(sh: Shell, fileArg: string | null, projectArg: string | null): ComposeFile | string {
  const candidates = fileArg ? [sh.path(fileArg)] : ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'].map((f) => sh.path(f))
  const path = candidates.find((p) => sh.vfs.get(p)?.type === 'file')
  if (!path) return fileArg ? `open ${candidates[0]}: no such file or directory` : 'no configuration file provided: not found'
  const text = sh.vfs.readFile(path)
  const doc = asObj(parseYaml(text))
  const dir = dirname(path)
  const project = (projectArg ?? basename(dir)).toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const services: Service[] = []
  const svcMap = asObj(doc.services)
  if (!Object.keys(svcMap).length) return `validating ${path}: services must be a mapping`
  for (const [name, raw] of Object.entries(svcMap)) {
    const s = asObj(raw)
    if (!s.image && !s.build) return `service "${name}" has neither an image nor a build context specified: invalid compose project`
    const svc: Service = { name, ports: [], volumes: [], env: {}, dependsOn: [], networks: [] }
    if (s.image) svc.image = asStr(s.image)
    if (s.build) svc.build = typeof s.build === 'string' ? { context: s.build } : { context: asStr(asObj(s.build).context ?? '.'), dockerfile: asObj(s.build).dockerfile ? asStr(asObj(s.build).dockerfile) : undefined }
    for (const p of asList(s.ports)) {
      const str = typeof p === 'object' && p ? `${asStr(asObj(p).published)}:${asStr(asObj(p).target)}` : asStr(p)
      const parts = str.split(':')
      if (parts.length < 2) return `service "${name}": invalid port mapping "${str}": short syntax is HOST:CONTAINER`
      svc.ports.push({ host: parts[parts.length - 2], cont: parts[parts.length - 1].replace(/\/tcp$/, '') })
    }
    for (const v of asList(s.volumes)) {
      const str = typeof v === 'object' && v ? `${asStr(asObj(v).source)}:${asStr(asObj(v).target)}` : asStr(v)
      const [src, dst] = str.split(':')
      if (!dst) return `service "${name}": invalid volume "${str}": use SOURCE:TARGET`
      const named = !src.startsWith('/') && !src.startsWith('.') && !src.startsWith('~')
      svc.volumes.push({ src: named ? `${project}_${src}` : normalize(src, dir, '/home/learner'), dst: dst.replace(/\/$/, '') || '/', named })
    }
    const env = s.environment
    if (Array.isArray(env)) for (const e of env) { const t = asStr(e); const eq = t.indexOf('='); if (eq > 0) svc.env[t.slice(0, eq)] = t.slice(eq + 1) }
    else for (const [k, v] of Object.entries(asObj(env))) svc.env[k] = asStr(v)
    svc.dependsOn = Array.isArray(s.depends_on) ? s.depends_on.map(asStr) : Object.keys(asObj(s.depends_on))
    svc.networks = Array.isArray(s.networks) ? s.networks.map(asStr) : Object.keys(asObj(s.networks))
    if (s.container_name) svc.containerName = asStr(s.container_name)
    if (s.command) svc.command = Array.isArray(s.command) ? s.command.map(asStr) : shellSplit(asStr(s.command))
    if (s.entrypoint) svc.entrypoint = Array.isArray(s.entrypoint) ? s.entrypoint.map(asStr) : shellSplit(asStr(s.entrypoint))
    if (s.working_dir) svc.workdir = asStr(s.working_dir)
    services.push(svc)
  }
  for (const svc of services) for (const d of svc.dependsOn) if (!services.some((o) => o.name === d)) return `service "${svc.name}" depends on undefined service "${d}": invalid compose project`
  const networks = Object.keys(asObj(doc.networks))
  for (const svc of services) for (const nw of svc.networks) if (!networks.includes(nw)) return `service "${svc.name}" refers to undefined network ${nw}: invalid compose project`
  return { path, dir, project, services, volumes: Object.keys(asObj(doc.volumes)), networks }
}

function orderServices(services: Service[]): Service[] {
  const out: Service[] = []
  const visit = (s: Service, seen: Set<string>) => { if (out.includes(s)) return; seen.add(s.name); for (const d of s.dependsOn) { const dep = services.find((o) => o.name === d); if (dep && !seen.has(d)) visit(dep, seen) } out.push(s) }
  for (const s of services) visit(s, new Set())
  return out
}

function composeBlock(rows: { kind: string; name: string; action: string }[]): string {
  const w = Math.max(...rows.map((r) => (r.kind + ' ' + r.name).length))
  return `[+] Running ${rows.length}/${rows.length}\n` + rows.map((r, i) => ` \u2714 ${(r.kind + ' ' + r.name).padEnd(w)}  ${r.action.padEnd(28)}${(0.1 + i * 0.3).toFixed(1)}s`).join('\n') + '\n'
}

function compose(sh: Shell, st: DockerState, argv: string[]): CmdResult {
  let fileArg: string | null = null
  let projectArg: string | null = null
  let i = 0
  for (; i < argv.length; i++) {
    if (argv[i] === '-f' || argv[i] === '--file') fileArg = argv[++i] ?? null
    else if (argv[i] === '-p' || argv[i] === '--project-name') projectArg = argv[++i] ?? null
    else if (!argv[i].startsWith('-')) break
  }
  const sub = argv[i]
  const rest = argv.slice(i + 1)
  if (!sub || sub === '--help') return ok('\nUsage:  docker compose [OPTIONS] COMMAND\n\nDefine and run multi-container applications with Docker\n\nCommands:\n  build       Build or rebuild services\n  config      Parse, resolve and render compose file in canonical format\n  down        Stop and remove containers, networks\n  exec        Execute a command in a running container\n  logs        View output from containers\n  ls          List running compose projects\n  ps          List containers\n  pull        Pull service images\n  restart     Restart service containers\n  start       Start services\n  stop        Stop services\n  up          Create and start containers\n  version     Show the Docker Compose version information\n')
  if (sub === 'version') return ok('Docker Compose version v2.29.7\n')
  if (sub === 'ls') { const rows = Object.entries(st.projects).map(([name, p]) => { const running = st.containers.filter((c) => c.project === name && c.status === 'running').length; const all = st.containers.filter((c) => c.project === name).length; return [name, running === all ? `running(${all})` : running ? `running(${running}), exited(${all - running})` : `exited(${all})`, p.file] }); return ok(table(['NAME', 'STATUS', 'CONFIG FILES'], rows)) }
  const cf = loadCompose(sh, fileArg, projectArg)
  if (typeof cf === 'string') return fail(cf)
  const flags = new Set(rest.filter((a) => a.startsWith('-')))
  const names = rest.filter((a) => !a.startsWith('-'))
  const selected = names.length ? cf.services.filter((s) => names.includes(s.name)) : cf.services
  for (const n of names) if (sub !== 'exec' && sub !== 'logs' && sub !== 'run' && !cf.services.some((s) => s.name === n)) return fail(`no such service: ${n}`)
  const cname = (s: Service) => s.containerName ?? `${cf.project}-${s.name}-1`
  const netName = (s: Service) => (s.networks.length ? `${cf.project}_${s.networks[0]}` : `${cf.project}_default`)
  if (sub === 'config') return ok(sh.vfs.readFile(cf.path))
  if (sub === 'up' || sub === 'start' || sub === 'create') {
    const rows: { kind: string; name: string; action: string }[] = []
    let out = ''
    let pulled = ''
    let seq = 0
    for (const s of orderServices(selected)) {
      if (s.build && sub !== 'start') {
        const ctx = normalize(s.build.context, cf.dir, '/home/learner')
        const b = build(sh, st, ['-t', `${cf.project}-${s.name}`, ...(s.build.dockerfile ? ['-f', ctx + '/' + s.build.dockerfile] : []), ctx])
        if (b.code !== 0) return { out: out + b.out, err: b.err, code: b.code }
        out += b.out.replace(/\nWhat's next:[\s\S]*$/, '')
      } else if (s.image && !findImage(st, s.image)) {
        const p = pull(st, s.image, false)
        if (!p.img) return fail(`Error response from daemon: ${p.err.replace(/^docker: Error response from daemon: /, '')}`)
        pulled += ` \u2714 ${s.name} Pulled\n`
      }
    }
    if (pulled) out += `[+] Pulling ${pulled.split('\n').length - 1}/${pulled.split('\n').length - 1}\n` + pulled
    const nets = ['default', ...cf.networks].map((n) => `${cf.project}_${n}`)
    for (const n of nets) if (!st.networks.includes(n) && selected.some((s) => netName(s) === n)) { st.networks.push(n); rows.push({ kind: 'Network', name: n, action: 'Created' }) }
    for (const v of cf.volumes) { const full = `${cf.project}_${v}`; if (!(full in st.volumes)) { st.volumes[full] = {}; rows.push({ kind: 'Volume', name: `"${full}"`, action: 'Created' }) } }
    for (const s of orderServices(selected)) {
      const name = cname(s)
      let c = st.containers.find((x) => x.name === name)
      if (c && c.status === 'running') { rows.push({ kind: 'Container', name, action: 'Running' }); continue }
      if (!c) {
        if (sub === 'start') return fail(`service "${s.name}" has no container to start`)
        const imgRef = s.build ? `${cf.project}-${s.name}` : s.image!
        const img = findImage(st, imgRef)!
        const o: RunOpts = { detach: true, rm: false, it: false, name, ports: s.ports, volumes: s.volumes, env: s.env, network: netName(s), workdir: s.workdir ?? null, entrypoint: s.entrypoint ?? null, image: imgRef, args: s.command ?? [], envFile: null }
        const made = createContainer(sh, st, img, o, { project: cf.project, service: s.name })
        if (typeof made === 'string') return fail(made.replace(/^docker: /, ''))
        c = made
        rows.push({ kind: 'Container', name, action: sub === 'create' ? 'Created' : 'Started' })
      } else rows.push({ kind: 'Container', name, action: 'Started' })
      if (sub !== 'create') startContainer(sh, st, c, false)
      seq++
    }
    st.projects[cf.project] = { file: cf.path, services: cf.services.map((s) => s.name) }
    out += composeBlock(rows)
    if (sub === 'up' && !flags.has('-d') && !flags.has('--detach')) {
      const running = selected.map(cname).map((n) => st.containers.find((c) => c.name === n)!).filter(Boolean)
      out += `Attaching to ${running.map((c) => c.name.replace(cf.project + '-', '')).join(', ')}\n`
      out += prefixLogs(running, cf.project)
      out += `\n(docker compose up stays attached until Ctrl+C on a real machine, which then stops the containers. Here they keep running; use docker compose up -d to start them detached.)\n`
    }
    return ok(out)
  }
  if (sub === 'ps') {
    const cs = st.containers.filter((c) => c.project === cf.project && (flags.has('-a') || flags.has('--all') || c.status === 'running'))
    if (flags.has('-q')) return ok(cs.map((c) => c.id).join('\n') + (cs.length ? '\n' : ''))
    return ok(table(['NAME', 'IMAGE', 'COMMAND', 'SERVICE', 'CREATED', 'STATUS', 'PORTS'], cs.map((c) => [c.name, c.image, quoteCmd(c.command), c.service ?? '', ago(c.created), statusOf(c), portsOf(st, c)])))
  }
  if (sub === 'down' || sub === 'stop' || sub === 'rm' || sub === 'kill') {
    const rows: { kind: string; name: string; action: string }[] = []
    const cs = st.containers.filter((c) => c.project === cf.project && (!names.length || names.includes(c.service ?? ''))).reverse()
    for (const c of cs) {
      if (c.status === 'running') { c.status = 'exited'; c.exitCode = 0; c.finished = Date.now(); if (sub === 'stop' || sub === 'kill') rows.push({ kind: 'Container', name: c.name, action: sub === 'kill' ? 'Killed' : 'Stopped' }) }
      if (sub === 'down' || sub === 'rm') { st.containers = st.containers.filter((x) => x !== c); rows.push({ kind: 'Container', name: c.name, action: 'Removed' }) }
    }
    if (sub === 'down') {
      for (const n of [...cf.networks.map((x) => `${cf.project}_${x}`), `${cf.project}_default`]) if (st.networks.includes(n)) { st.networks = st.networks.filter((x) => x !== n); rows.push({ kind: 'Network', name: n, action: 'Removed' }) }
      if (flags.has('-v') || flags.has('--volumes')) for (const v of cf.volumes) { const full = `${cf.project}_${v}`; if (full in st.volumes) { delete st.volumes[full]; rows.push({ kind: 'Volume', name: full, action: 'Removed' }) } }
      delete st.projects[cf.project]
    }
    return ok(rows.length ? composeBlock(rows) : '')
  }
  if (sub === 'restart') {
    const rows: { kind: string; name: string; action: string }[] = []
    for (const c of st.containers.filter((x) => x.project === cf.project && (!names.length || names.includes(x.service ?? '')))) { startContainer(sh, st, c, false); rows.push({ kind: 'Container', name: c.name, action: 'Started' }) }
    return ok(composeBlock(rows))
  }
  if (sub === 'logs') {
    const cs = st.containers.filter((c) => c.project === cf.project && (!names.length || names.includes(c.service ?? '')))
    if (!cs.length && names.length) return fail(`no such service: ${names[0]}`)
    return ok(prefixLogs(cs, cf.project))
  }
  if (sub === 'exec' || sub === 'run') {
    const svcIdx = rest.findIndex((a) => !a.startsWith('-'))
    const svcName = svcIdx >= 0 ? rest[svcIdx] : undefined
    const cmdArgs = svcIdx >= 0 ? rest.slice(svcIdx + 1) : []
    const svc = cf.services.find((s) => s.name === svcName)
    if (!svc) return fail(svcName ? `no such service: ${svcName}` : 'service name is required')
    if (sub === 'run') { const imgRef = svc.build ? `${cf.project}-${svc.name}` : svc.image!; const img = findImage(st, imgRef); if (!img) return fail(`Error response from daemon: No such image: ${imgRef}`); const o: RunOpts = { detach: false, rm: true, it: true, name: null, ports: [], volumes: svc.volumes, env: svc.env, network: netName(svc), workdir: svc.workdir ?? null, entrypoint: svc.entrypoint ?? null, image: imgRef, args: cmdArgs, envFile: null }; if (!st.networks.includes(netName(svc))) st.networks.push(netName(svc)); const made = createContainer(sh, st, img, o, { name: `${cf.project}-${svc.name}-run-${hex(st.seq, 12)}`, project: cf.project, service: svc.name }); if (typeof made === 'string') return fail(made); const r = startContainer(sh, st, made, true); st.containers = st.containers.filter((x) => x !== made); return { out: r.out, err: '', code: r.code } }
    const c = st.containers.find((x) => x.name === cname(svc))
    if (!c) return fail(`service "${svcName}" is not running`)
    if (c.status !== 'running') return fail(`service "${svcName}" is not running container #1`)
    return execIn(sh, st, c, cmdArgs, !flags.has('-T'), null, {})
  }
  if (sub === 'build') { let out = ''; for (const s of selected) if (s.build) { const ctx = normalize(s.build.context, cf.dir, '/home/learner'); const b = build(sh, st, ['-t', `${cf.project}-${s.name}`, ...(s.build.dockerfile ? ['-f', ctx + '/' + s.build.dockerfile] : []), ctx]); if (b.code !== 0) return b; out += b.out } return ok(out) }
  if (sub === 'pull') { let out = ''; for (const s of selected) if (s.image) { const p = pull(st, s.image, false); if (!p.img) return fail(p.err); out += ` \u2714 ${s.name} Pulled\n` } return ok(`[+] Pulling ${selected.length}/${selected.length}\n` + out) }
  if (sub === 'images') return ok(table(['CONTAINER', 'REPOSITORY', 'TAG', 'IMAGE ID', 'SIZE'], st.containers.filter((c) => c.project === cf.project).map((c) => { const img = findImage(st, c.image); return [c.name, splitRef(c.image).repo, splitRef(c.image).tag, img?.id.slice(0, 12) ?? '', humanSize(img?.size ?? 0)] })))
  return fail(`unknown docker command: "compose ${sub}"`)
}

function prefixLogs(cs: DockerContainer[], project: string): string {
  const label = (c: DockerContainer) => c.name.startsWith(project + '-') ? c.name.slice(project.length + 1) : c.name
  const w = Math.max(0, ...cs.map((c) => label(c).length))
  return cs.map((c) => c.logs.replace(/\n$/, '').split('\n').filter((l) => c.logs.trim() !== '' || l).map((l) => `${label(c).padEnd(w)}  | ${l}`).join('\n')).filter(Boolean).join('\n') + (cs.some((c) => c.logs.trim()) ? '\n' : '')
}

const statusOf = (c: DockerContainer) => (c.status === 'running' ? `Up ${upFor(c.created)}` : c.status === 'created' ? 'Created' : `Exited (${c.exitCode}) ${ago(c.finished || c.created)}`)
function portsOf(st: DockerState, c: DockerContainer): string {
  const img = findImage(st, c.image)
  const published = c.ports.map((p) => `0.0.0.0:${p.host}->${p.cont}/tcp, [::]:${p.host}->${p.cont}/tcp`)
  const exposed = (img?.expose ?? []).filter((e) => !c.ports.some((p) => p.cont === e.replace('/tcp', '')))
  return c.status === 'running' ? [...published, ...exposed].join(', ') : ''
}

function execIn(sh: Shell, st: DockerState, c: DockerContainer, argv: string[], tty: boolean, workdir: string | null, env: Record<string, string>): CmdResult {
  if (!argv.length) return fail('"docker exec" requires at least 2 arguments.\nSee \'docker exec --help\'.\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]\n\nExecute a command in a running container')
  const ctx = makeCtx(sh, st, c, tty)
  if (workdir) ctx.cwd = workdir
  Object.assign(ctx.env, env)
  const r = execC(ctx, argv)
  if (r.code === 127 && !r.out.includes('command not found')) return { out: '', err: r.out, code: 127 }
  if (r.code === 127) return { out: '', err: `OCI runtime exec failed: exec failed: unable to start container process: exec: "${argv[0]}": executable file not found in $PATH: unknown\n`, code: 127 }
  return { out: r.out, err: '', code: r.code }
}

/* ---------- the docker command ---------- */

const VERSION = '27.3.1'
const HELP = '\nUsage:  docker [OPTIONS] COMMAND\n\nA self-sufficient runtime for containers\n\nCommon Commands:\n  run         Create and run a new container from an image\n  exec        Execute a command in a running container\n  ps          List containers\n  build       Build an image from a Dockerfile\n  pull        Download an image from a registry\n  push        Upload an image to a registry\n  images      List images\n  login       Authenticate to a registry\n  logout      Log out from a registry\n  search      Search Docker Hub for images\n  info        Display system-wide information\n\nManagement Commands:\n  compose*    Docker Compose\n  container   Manage containers\n  image       Manage images\n  network     Manage networks\n  volume      Manage volumes\n\nCommands:\n  inspect     Return low-level information on Docker objects\n  logs        Fetch the logs of a container\n  rm          Remove one or more containers\n  rmi         Remove one or more images\n  start       Start one or more stopped containers\n  stop        Stop one or more running containers\n  restart     Restart one or more containers\n  version     Show the Docker version information\n\nRun \'docker COMMAND --help\' for more information on a command.\n'

function canTalkToDaemon(sh: Shell, base: CommandTable): boolean {
  if (sh.user === 'root') return true
  try {
    const group = sh.vfs.readFile('/etc/group').split('\n').find((l) => l.startsWith('docker:'))
    if (group && group.split(':')[3]?.split(',').map((s) => s.trim()).includes(sh.user)) return true
  } catch { /* no group file */ }
  try { if (/\bdocker\b/.test(base.groups(sh, [], '').out)) return true } catch { /* base groups missing */ }
  return false
}

const DAEMON_DENIED = (api: string) => `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Get "http://%2Fvar%2Frun%2Fdocker.sock/v1.47/${api}": dial unix /var/run/docker.sock: connect: permission denied\n`

export function install(base: CommandTable) {
  const baseApt = base.apt
  const baseCurl = base.curl

  const markInstalled = (sh: Shell) => {
    const st = state(sh)
    st.installed = true
    if (!sh.state.packages.includes('docker.io')) sh.state.packages.push('docker.io')
    if (!sh.vfs.get('/usr/bin/docker')) sh.vfs.writeFile('/usr/bin/docker', '#!builtin\n', { owner: 'root', mode: 0o755 })
    sh.state.services.docker = 'active'
    try { const g = sh.vfs.readFile('/etc/group'); if (!/^docker:/m.test(g)) sh.vfs.writeFile('/etc/group', g + (g.endsWith('\n') || g === '' ? '' : '\n') + 'docker:x:999:\n') } catch { /* no group file */ }
  }

  const DOCKER_PKGS = ['docker.io', 'docker-ce', 'docker-ce-cli', 'containerd.io', 'docker-compose-plugin', 'docker-buildx-plugin', 'docker-compose-v2', 'docker-compose']
  base.apt = (sh, args, stdin) => {
    const sub = args.find((a) => !a.startsWith('-'))
    const pkgs = args.filter((a) => a !== sub && !a.startsWith('-'))
    const mine = pkgs.filter((p) => DOCKER_PKGS.includes(p))
    if (sub !== 'install' || !mine.length) return baseApt(sh, args, stdin)
    if (sh.user !== 'root') return fail('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?', 100)
    const quiet = args.includes('-qq')
    const already = state(sh).installed
    markInstalled(sh)
    let out = ''
    if (already) out += mine.map((p) => `${p} is already the newest version (${p === 'docker.io' ? '26.1.3-0ubuntu1~24.04.1' : '5:27.3.1-1~ubuntu.24.04~noble'}).\n`).join('')
    else if (!quiet) out += `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following additional packages will be installed:\n  bridge-utils containerd dns-root-data dnsmasq-base pigz runc ubuntu-fan\nThe following NEW packages will be installed:\n  bridge-utils containerd dns-root-data dnsmasq-base ${mine.join(' ')} pigz runc ubuntu-fan\n0 upgraded, ${7 + mine.length} newly installed, 0 to remove and 0 not upgraded.\nNeed to get 76.1 MB of archives.\nAfter this operation, 297 MB of additional disk space will be used.\nGet:1 http://archive.ubuntu.com/ubuntu noble/main amd64 pigz amd64 2.8-1 [65.6 kB]\nGet:2 http://archive.ubuntu.com/ubuntu noble/main amd64 runc amd64 1.1.12-0ubuntu3 [8,595 kB]\nGet:3 http://archive.ubuntu.com/ubuntu noble/main amd64 containerd amd64 1.7.12-0ubuntu4 [36.5 MB]\nGet:4 http://archive.ubuntu.com/ubuntu noble/main amd64 docker.io amd64 26.1.3-0ubuntu1~24.04.1 [30.9 MB]\nFetched 76.1 MB in 4s (19.0 MB/s)\nSelecting previously unselected package pigz.\nUnpacking pigz (2.8-1) ...\nUnpacking runc (1.1.12-0ubuntu3) ...\nUnpacking containerd (1.7.12-0ubuntu4) ...\nUnpacking docker.io (26.1.3-0ubuntu1~24.04.1) ...\nSetting up runc (1.1.12-0ubuntu3) ...\nSetting up containerd (1.7.12-0ubuntu4) ...\nCreated symlink /etc/systemd/system/multi-user.target.wants/containerd.service \u2192 /usr/lib/systemd/system/containerd.service.\nSetting up docker.io (26.1.3-0ubuntu1~24.04.1) ...\ninfo: Selecting GID from range 100 to 999 ...\ninfo: Adding group \`docker' (GID 999) ...\nCreated symlink /etc/systemd/system/multi-user.target.wants/docker.service \u2192 /usr/lib/systemd/system/docker.service.\nCreated symlink /etc/systemd/system/sockets.target.wants/docker.socket \u2192 /usr/lib/systemd/system/docker.socket.\nProcessing triggers for man-db (2.12.0-4build2) ...\n`
    const others = pkgs.filter((p) => !DOCKER_PKGS.includes(p))
    if (others.length) { const r = baseApt(sh, [sub, ...others], stdin); out += r.out; if (r.code !== 0) return { out, err: r.err, code: r.code } }
    return ok(out)
  }

  // curl -fsSL https://get.docker.com | sh: hand back a script that installs docker.io through apt.
  base.curl = (sh, args, stdin) => {
    const url = args.find((a) => !a.startsWith('-') && !/^\d+$/.test(a) && args[args.indexOf(a) - 1] !== '-o' && args[args.indexOf(a) - 1] !== '-H' && args[args.indexOf(a) - 1] !== '-d' && args[args.indexOf(a) - 1] !== '-X') ?? ''
    const key = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (key === 'get.docker.com' || key === 'get.docker.com/rootless') {
      const script = '#!/bin/sh\n# This script is meant for quick & easy install via:\n#   $ curl -fsSL https://get.docker.com -o get-docker.sh\n#   $ sh get-docker.sh\n# (simulated copy: it installs Ubuntu\'s docker.io package)\necho "# Executing docker install script, commit: 6d9743e"\necho "+ sh -c apt-get -qq update >/dev/null"\necho "+ sh -c DEBIAN_FRONTEND=noninteractive apt-get -y -qq install ca-certificates curl >/dev/null"\necho "+ sh -c install -m 0755 -d /etc/apt/keyrings"\necho "+ sh -c curl -fsSL \\"https://download.docker.com/linux/ubuntu/gpg\\" -o /etc/apt/keyrings/docker.asc"\necho "+ sh -c echo \\"deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable\\" > /etc/apt/sources.list.d/docker.list"\necho "+ sh -c apt-get -qq update >/dev/null"\necho "+ sh -c DEBIAN_FRONTEND=noninteractive apt-get -y -qq install docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-ce-rootless-extras docker-buildx-plugin >/dev/null"\nsudo apt-get -y -qq install docker-ce docker-ce-cli containerd.io docker-compose-plugin\necho "+ sh -c docker version"\nsudo docker version\necho\necho "================================================================================"\necho\necho "To run Docker as a non-privileged user, consider setting up the"\necho "Docker daemon in rootless mode for your user:"\necho\necho "    dockerd-rootless-setuptool.sh install"\necho\necho "Visit https://docs.docker.com/go/rootless/ to learn about rootless mode."\necho\necho "To run the Docker daemon as a fully privileged service, but granting non-root"\necho "users access, refer to https://docs.docker.com/go/daemon-access/"\necho\necho "WARNING: Access to the remote API on a privileged Docker daemon is equivalent"\necho "         to root access on the host. Refer to the \'Docker daemon attack surface\'"\necho "         documentation for details: https://docs.docker.com/go/attack-surface/"\necho\necho "================================================================================"\n'
      const oi = args.indexOf('-o')
      if (oi >= 0 && args[oi + 1]) { sh.writeFile(args[oi + 1], script); return ok() }
      return ok(script)
    }
    // A published port of a running container answers on localhost.
    const m = key.match(/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::(\d+))?(\/.*)?$/)
    if (m) {
      const st = state(sh)
      const port = m[1] ?? '80'
      const c = st.containers.find((x) => x.status === 'running' && x.ports.some((p) => p.host === port))
      if (c) {
        const img = findImage(st, c.image)
        const path = m[2] ?? '/'
        const fam = img?.family
        let headers = 'HTTP/1.1 200 OK\n'
        let body = ''
        if (fam === 'nginx') {
          const ctx = makeCtx(sh, st, c)
          const s = statC(ctx, '/usr/share/nginx/html' + (path === '/' ? '/index.html' : path))
          if (s?.type === 'file') { body = s.content; headers += 'Server: nginx/1.27.2\nContent-Type: text/html\nContent-Length: ' + body.length + '\n' }
          else { headers = 'HTTP/1.1 404 Not Found\nServer: nginx/1.27.2\nContent-Type: text/html\n'; body = '<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>nginx/1.27.2</center>\n</body>\n</html>\n' }
          c.logs += `172.17.0.1 - - [18/Sep/2026:09:42:11 +0000] "GET ${path} HTTP/1.1" ${headers.startsWith('HTTP/1.1 200') ? '200' : '404'} ${body.length} "-" "curl/8.5.0" "-"\n`
        } else if (c.command.join(' ').includes('http.server')) {
          const ctx = makeCtx(sh, st, c)
          const names = listC(ctx, ctx.cwd) ?? []
          body = `<!DOCTYPE HTML>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Directory listing for ${path}</title>\n</head>\n<body>\n<h1>Directory listing for ${path}</h1>\n<hr>\n<ul>\n${names.map((n) => `<li><a href="${n}">${n}</a></li>`).join('\n')}\n</ul>\n<hr>\n</body>\n</html>\n`
          headers = 'HTTP/1.0 200 OK\nServer: SimpleHTTP/0.6 Python/3.12.7\nContent-type: text/html; charset=utf-8\n'
          c.logs += `172.17.0.1 - - [18/Sep/2026 09:42:11] "GET ${path} HTTP/1.1" 200 -\n`
        } else if (fam === 'postgres' || fam === 'redis') return fail(`curl: (52) Empty reply from server`, 52)
        else return fail(`curl: (56) Recv failure: Connection reset by peer`, 56)
        const flags = args.filter((a) => a.startsWith('-')).join('')
        const out = flags.includes('I') ? headers + '\n' : flags.includes('i') ? headers + '\n' + body : body
        if (oiOf(args) !== null) { sh.writeFile(oiOf(args)!, body); return ok() }
        return ok(out)
      }
    }
    return baseCurl(sh, args, stdin)
  }
  const oiOf = (args: string[]) => { const i = args.indexOf('-o'); return i >= 0 ? args[i + 1] ?? null : null }

  const dockerCmd = (sh: Shell, args: string[]): CmdResult => {
    const st = state(sh)
    if (!st.installed) return fail('docker: command not found', 127)
    const [sub, ...rest] = args
    if (!sub || sub === '--help' || sub === 'help') return ok(HELP)
    if (sub === '--version' || sub === '-v') return ok(`Docker version ${VERSION}, build ce12230\n`)
    const client = `Client:\n Version:           ${VERSION}\n API version:       1.47\n Go version:        go1.22.7\n Git commit:        ce12230\n Built:             Fri Sep 20 11:41:00 2024\n OS/Arch:           linux/amd64\n Context:           default\n`
    if (!canTalkToDaemon(sh, base)) {
      const api = sub === 'ps' ? 'containers/json' : sub === 'images' ? 'images/json' : sub === 'version' ? 'version' : 'containers/create'
      return { out: sub === 'version' ? client : '', err: (sub === 'version' ? '' : sub === 'run' || sub === 'build' ? `docker: ` : '') + DAEMON_DENIED(api) + (sub === 'run' ? "\nRun 'docker run --help' for more information\n" : ''), code: 1 }
    }
    if (sub === 'version') return ok(client + `\nServer: Docker Engine - Community\n Engine:\n  Version:          ${VERSION}\n  API version:      1.47 (minimum version 1.24)\n  Go version:       go1.22.7\n  Git commit:       41ca978\n  Built:            Fri Sep 20 11:41:00 2024\n  OS/Arch:          linux/amd64\n  Experimental:     false\n containerd:\n  Version:          1.7.22\n  GitCommit:        7f7fdf5fed64eb6a7caf99b3e12efcf9d60e311c\n runc:\n  Version:          1.1.14\n  GitCommit:        v1.1.14-0-g2c9f560\n docker-init:\n  Version:          0.19.0\n  GitCommit:        de40ad0\n`)
    if (sub === 'info') return ok(`Client: Docker Engine - Community\n Version:    ${VERSION}\n Context:    default\n Debug Mode: false\n Plugins:\n  buildx: Docker Buildx (Docker Inc.)\n    Version:  v0.17.1\n  compose: Docker Compose (Docker Inc.)\n    Version:  v2.29.7\n\nServer:\n Containers: ${st.containers.length}\n  Running: ${st.containers.filter((c) => c.status === 'running').length}\n  Paused: 0\n  Stopped: ${st.containers.filter((c) => c.status !== 'running').length}\n Images: ${st.images.length}\n Server Version: ${VERSION}\n Storage Driver: overlay2\n Cgroup Driver: systemd\n Kernel Version: 6.8.0-45-generic\n Operating System: Ubuntu 24.04.1 LTS\n OSType: linux\n Architecture: x86_64\n CPUs: 2\n Total Memory: 3.82GiB\n Name: stackbox\n Docker Root Dir: /var/lib/docker\n`)

    // Management-command aliases: docker container ls, docker image rm, and so on.
    let cmd = sub
    let argv = rest
    if (sub === 'container' || sub === 'image') {
      const map: Record<string, string> = { ls: sub === 'container' ? 'ps' : 'images', list: sub === 'container' ? 'ps' : 'images', rm: sub === 'container' ? 'rm' : 'rmi', remove: sub === 'container' ? 'rm' : 'rmi', run: 'run', build: 'build', pull: 'pull', push: 'push', inspect: 'inspect', logs: 'logs', stop: 'stop', start: 'start', restart: 'restart', exec: 'exec', prune: sub + '-prune', tag: 'tag', kill: 'stop' }
      cmd = map[rest[0]] ?? `${sub} ${rest[0]}`
      argv = rest.slice(1)
    }

    switch (cmd) {
      case 'run': case 'create': {
        const o = parseRunArgs(sh, argv)
        if (typeof o === 'string') return fail(o, 125)
        let pulled = ''
        let img = findImage(st, o.image)
        if (!img) { const p = pull(st, o.image, true); pulled += p.out; if (!p.img) return { out: '', err: pulled + p.err, code: 125 }; img = p.img; pulled += '\n' }
        const made = createContainer(sh, st, img, o)
        if (typeof made === 'string') return { out: '', err: pulled + made + "\n\nRun 'docker run --help' for more information\n", code: 125 }
        if (cmd === 'create') return { out: made.id + '\n', err: pulled, code: 0, ...(pulled ? { seq: pulled + made.id + '\n' } : {}) }
        if (o.detach) { startContainer(sh, st, made, false); return { out: made.id + '\n', err: pulled, code: 0, ...(pulled ? { seq: pulled + made.id + '\n' } : {}) } }
        const r = startContainer(sh, st, made, o.it)
        let err = ''
        let body = r.out
        if (r.code === 127 && r.out.startsWith('docker:')) { err = r.out; body = '' }
        else if (r.code === 127) { err = `docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "${made.command[0]}": executable file not found in $PATH: unknown.\n\nRun 'docker run --help' for more information\n`; body = '' }
        if (r.daemon) body += `\n(${made.name} keeps running in the foreground on a real machine until Ctrl+C. Here it stays up in the background, as if you had passed -d.)\n`
        if (made.rm && !r.daemon) st.containers = st.containers.filter((c) => c !== made)
        return { out: body, err: pulled + err, code: err ? 125 : r.code, ...(pulled || err ? { seq: pulled + body + err } : {}) }
      }
      case 'ps': {
        const all = argv.includes('-a') || argv.includes('--all')
        const cs = st.containers.filter((c) => all || c.status === 'running')
        if (argv.includes('-q') || argv.includes('--quiet')) return ok(cs.map((c) => c.id.slice(0, 12)).join('\n') + (cs.length ? '\n' : ''))
        const fi = argv.findIndex((a) => a === '--filter' || a === '-f')
        const filtered = fi >= 0 ? cs.filter((c) => { const [k, v] = (argv[fi + 1] ?? '').split('='); return k === 'name' ? c.name.includes(v) : k === 'status' ? c.status === v : true }) : cs
        return ok(table(['CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES'], filtered.map((c) => [c.id.slice(0, 12), c.image.replace(/:latest$/, ''), quoteCmd(c.command), ago(c.created), statusOf(c), portsOf(st, c), c.name])))
      }
      case 'images': {
        const shown = st.images.filter((i) => argv.includes('-a') || i.repo !== '<none>')
        const named = argv.filter((a) => !a.startsWith('-'))
        const list = named.length ? shown.filter((i) => i.repo === splitRef(named[0]).repo) : shown
        if (argv.includes('-q')) return ok(list.map((i) => i.id.slice(0, 12)).join('\n') + (list.length ? '\n' : ''))
        return ok(table(['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE'], [...list].sort((a, b) => b.created - a.created).map((i) => [i.repo, i.tag, i.id.slice(0, 12), ago(i.created), humanSize(i.size)])))
      }
      case 'pull': {
        const ref = argv.find((a) => !a.startsWith('-'))
        if (!ref) return fail('"docker pull" requires exactly 1 argument.\nSee \'docker pull --help\'.\n\nUsage:  docker pull [OPTIONS] NAME[:TAG|@DIGEST]\n\nDownload an image from a registry')
        const p = pull(st, ref, false)
        return p.img ? ok(p.out) : { out: p.out, err: p.err, code: 1 }
      }
      case 'push': return fail(`Using default tag: latest\nThe push refers to repository [docker.io/library/${argv[0] ?? ''}]\ndenied: requested access to the resource is denied\n(pushing to a registry needs a Docker Hub account; not simulated here)`)
      case 'login': return ok('Log in with your Docker ID or email address to push and pull images from Docker Hub.\n(logging in is not simulated; nothing here needs a registry account)\n')
      case 'search': return ok(table(['NAME', 'DESCRIPTION', 'STARS', 'OFFICIAL'], [['nginx', 'Official build of Nginx.', '20345', '[OK]'], ['python', 'Python is an interpreted, interactive, object-oriented programming language.', '9876', '[OK]'], ['postgres', 'The PostgreSQL object-relational database system provides reliability and data integrity.', '13456', '[OK]'], ['ubuntu', 'Ubuntu is a Debian-based Linux operating system based on free software.', '17234', '[OK]'], ['alpine', 'A minimal Docker image based on Alpine Linux with a complete package index and only 5 MB in size!', '11002', '[OK]']].filter((r) => !argv[0] || r[0].includes(argv[0]))))
      case 'build': case 'buildx': return build(sh, st, argv[0] === 'build' ? argv.slice(1) : argv)
      case 'tag': {
        const [src, dst] = argv
        const img = src && findImage(st, src)
        if (!img) return fail(`Error response from daemon: No such image: ${src ?? ''}`)
        const r = splitRef(dst ?? '')
        if (!dst) return fail('"docker tag" requires exactly 2 arguments.')
        st.images.push({ ...img, repo: r.repo, tag: r.tag })
        return ok()
      }
      case 'exec': {
        let tty = false
        let workdir: string | null = null
        const env: Record<string, string> = {}
        let i = 0
        for (; i < argv.length; i++) {
          const a = argv[i]
          if (!a.startsWith('-')) break
          if (/^-[it]+$/.test(a) || a === '--interactive' || a === '--tty') tty = true
          else if (a === '-w' || a === '--workdir') workdir = argv[++i] ?? null
          else if (a === '-e' || a === '--env') { const v = argv[++i] ?? ''; const eq = v.indexOf('='); if (eq > 0) env[v.slice(0, eq)] = v.slice(eq + 1) }
          else if (a === '-d' || a === '--detach' || a === '-u' || a === '--user') { if (a === '-u' || a === '--user') i++ }
          else return fail(`unknown flag: ${a}\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]`)
        }
        const c = argv[i] ? findContainer(st, argv[i]) : null
        if (!argv[i] || !argv[i + 1]) return fail('"docker exec" requires at least 2 arguments.\nSee \'docker exec --help\'.\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]\n\nExecute a command in a running container')
        if (!c) return fail(`Error response from daemon: No such container: ${argv[i]}`)
        if (c.status !== 'running') return fail(`Error response from daemon: container ${c.id} is not running`)
        return execIn(sh, st, c, argv.slice(i + 1), tty, workdir, env)
      }
      case 'logs': {
        const name = argv.find((a) => !a.startsWith('-') && argv[argv.indexOf(a) - 1] !== '--tail' && argv[argv.indexOf(a) - 1] !== '-n')
        if (!name) return fail('"docker logs" requires exactly 1 argument.\nSee \'docker logs --help\'.\n\nUsage:  docker logs [OPTIONS] CONTAINER\n\nFetch the logs of a container')
        const c = findContainer(st, name)
        if (!c) return fail(`Error response from daemon: No such container: ${name}`)
        const ti = argv.findIndex((a) => a === '--tail' || a === '-n')
        let text = c.logs
        if (ti >= 0) text = text.replace(/\n$/, '').split('\n').slice(-Number(argv[ti + 1] ?? 10)).join('\n') + (text ? '\n' : '')
        if (argv.includes('-t') || argv.includes('--timestamps')) text = text.replace(/\n$/, '').split('\n').map((l) => `2026-09-18T09:41:07.123456789Z ${l}`).join('\n') + (text ? '\n' : '')
        return ok(text + (argv.includes('-f') && c.status === 'running' ? '(docker logs -f follows new output until Ctrl+C on a real machine)\n' : ''))
      }
      case 'stop': case 'kill': case 'start': case 'restart': case 'rm': case 'pause': case 'unpause': {
        const force = argv.includes('-f') || argv.includes('--force')
        const names = argv.filter((a) => !a.startsWith('-'))
        if (!names.length) return fail(`"docker ${cmd}" requires at least 1 argument.\nSee 'docker ${cmd} --help'.\n\nUsage:  docker ${cmd} [OPTIONS] CONTAINER [CONTAINER...]`)
        let out = ''
        let err = ''
        for (const n of names) {
          const c = findContainer(st, n)
          if (!c) { err += `Error response from daemon: No such container: ${n}\n`; continue }
          if (cmd === 'stop' || cmd === 'kill') { if (c.status === 'running') { c.status = 'exited'; c.exitCode = cmd === 'kill' ? 137 : 0; c.finished = Date.now() } out += n + '\n'; continue }
          if (cmd === 'start') { if (c.status !== 'running') startContainer(sh, st, c, false); out += n + '\n'; continue }
          if (cmd === 'restart') { startContainer(sh, st, c, false); out += n + '\n'; continue }
          if (cmd === 'pause' || cmd === 'unpause') { out += n + '\n'; continue }
          if (c.status === 'running' && !force) { err += `Error response from daemon: cannot remove container "/${c.name}": container is running: stop the container before removing or force remove\n`; continue }
          st.containers = st.containers.filter((x) => x !== c)
          out += n + '\n'
        }
        return { out, err, code: err ? 1 : 0 }
      }
      case 'rmi': {
        const force = argv.includes('-f') || argv.includes('--force')
        const names = argv.filter((a) => !a.startsWith('-'))
        if (!names.length) return fail('"docker rmi" requires at least 1 argument.\nSee \'docker rmi --help\'.\n\nUsage:  docker rmi [OPTIONS] IMAGE [IMAGE...]')
        let out = ''
        let err = ''
        for (const n of names) {
          const img = findImage(st, n)
          if (!img) { err += `Error response from daemon: No such image: ${n}${n.includes(':') ? '' : ':latest'}\n`; continue }
          const user = st.containers.find((c) => c.image === `${img.repo}:${img.tag}`)
          if (user && !force) { err += `Error response from daemon: conflict: unable to remove repository reference "${n}" (must force) - container ${user.id.slice(0, 12)} is using its referenced image ${img.id.slice(0, 12)}\n`; continue }
          if (user && force && user.status === 'running') { err += `Error response from daemon: conflict: unable to delete ${img.id.slice(0, 12)} (cannot be forced) - image is being used by running container ${user.id.slice(0, 12)}\n`; continue }
          st.images = st.images.filter((x) => x !== img)
          out += `Untagged: ${img.repo}:${img.tag}\n` + (st.images.some((x) => x.id === img.id) ? '' : `Deleted: sha256:${img.id}\n`)
        }
        return { out, err, code: err ? 1 : 0 }
      }
      case 'inspect': {
        const fmtIdx = argv.findIndex((a) => a === '-f' || a === '--format')
        const fmt = fmtIdx >= 0 ? argv[fmtIdx + 1] : null
        const name = argv.find((a, k) => !a.startsWith('-') && (fmtIdx < 0 || k !== fmtIdx + 1))
        if (!name) return fail('"docker inspect" requires at least 1 argument.')
        const c = findContainer(st, name)
        const img = c ? null : findImage(st, name)
        if (!c && !img) return { out: '[]\n', err: `Error response from daemon: No such object: ${name}\n`, code: 1 }
        const obj: Record<string, unknown> = c ? {
          Id: c.id, Created: new Date(c.created).toISOString(), Path: c.command[0] ?? '', Args: c.command.slice(1), State: { Status: c.status, Running: c.status === 'running', Paused: false, Restarting: false, ExitCode: c.exitCode, StartedAt: new Date(c.created).toISOString(), FinishedAt: c.finished ? new Date(c.finished).toISOString() : '0001-01-01T00:00:00Z' }, Image: 'sha256:' + (findImage(st, c.image)?.id ?? ''), Name: '/' + c.name, RestartCount: 0, Platform: 'linux', HostConfig: { Binds: c.volumes.map((v) => `${v.src}:${v.dst}`), NetworkMode: c.network, PortBindings: Object.fromEntries(c.ports.map((p) => [`${p.cont}/tcp`, [{ HostIp: '', HostPort: p.host }]])), AutoRemove: c.rm }, Mounts: c.volumes.map((v) => ({ Type: v.named ? 'volume' : 'bind', Source: v.named ? `/var/lib/docker/volumes/${v.src}/_data` : v.src, Destination: v.dst, Mode: '', RW: true, ...(v.named ? { Name: v.src, Driver: 'local' } : {}) })), Config: { Hostname: c.id.slice(0, 12), User: '', ExposedPorts: Object.fromEntries((findImage(st, c.image)?.expose ?? []).map((e) => [e, {}])), Env: Object.entries({ ...(findImage(st, c.image)?.env ?? {}), ...c.env }).map(([k, v]) => `${k}=${v}`), Cmd: c.command, Image: c.image, WorkingDir: c.workdir, Labels: c.project ? { 'com.docker.compose.project': c.project, 'com.docker.compose.service': c.service } : {} }, NetworkSettings: { Ports: Object.fromEntries(c.ports.map((p) => [`${p.cont}/tcp`, [{ HostIp: '0.0.0.0', HostPort: p.host }, { HostIp: '::', HostPort: p.host }]])), IPAddress: c.status === 'running' ? c.ip : '', Networks: { [c.network]: { IPAddress: c.status === 'running' ? c.ip : '', Gateway: c.ip.replace(/\.\d+$/, '.1'), Aliases: c.service ? [c.service, c.id.slice(0, 12)] : null } } },
        } : { Id: 'sha256:' + img!.id, RepoTags: [`${img!.repo}:${img!.tag}`], Created: new Date(img!.created).toISOString(), Size: img!.size, Architecture: 'amd64', Os: 'linux', Config: { Env: Object.entries(img!.env).map(([k, v]) => `${k}=${v}`), Cmd: img!.cmd, Entrypoint: img!.entrypoint, WorkingDir: img!.workdir, ExposedPorts: Object.fromEntries(img!.expose.map((e) => [e, {}])) }, RootFS: { Type: 'layers', Layers: img!.layers } }
        if (fmt) {
          const path = fmt.replace(/^\{\{\s*\.?/, '').replace(/\s*\}\}$/, '').replace(/^json\s+\.?/, '')
          let cur: unknown = obj
          for (const seg of path.split('.').filter(Boolean)) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[seg] : undefined
          return ok((typeof cur === 'object' ? JSON.stringify(cur) : String(cur ?? '<no value>')) + '\n')
        }
        return ok(JSON.stringify([obj], null, 4) + '\n')
      }
      case 'port': { const c = argv[0] ? findContainer(st, argv[0]) : null; if (!c) return fail(`Error response from daemon: No such container: ${argv[0] ?? ''}`); return ok(c.ports.map((p) => `${p.cont}/tcp -> 0.0.0.0:${p.host}\n${p.cont}/tcp -> [::]:${p.host}`).join('\n') + (c.ports.length ? '\n' : '')) }
      case 'volume': {
        const [vsub, ...vrest] = argv
        const vnames = vrest.filter((a) => !a.startsWith('-'))
        if (vsub === 'ls' || vsub === 'list') return ok(argv.includes('-q') ? Object.keys(st.volumes).join('\n') + (Object.keys(st.volumes).length ? '\n' : '') : table(['DRIVER', 'VOLUME NAME'], Object.keys(st.volumes).sort().map((v) => ['local', v])))
        if (vsub === 'create') { const n = vnames[0] ?? hex(st.seq++ * 3, 64); st.volumes[n] ??= {}; return ok(n + '\n') }
        if (vsub === 'rm' || vsub === 'remove') { let out = ''; let err = ''; for (const n of vnames) { if (!(n in st.volumes)) { err += `Error response from daemon: get ${n}: no such volume\n`; continue } const user = st.containers.find((c) => c.volumes.some((v) => v.named && v.src === n)); if (user) { err += `Error response from daemon: remove ${n}: volume is in use - [${user.id}]\n`; continue } delete st.volumes[n]; out += n + '\n' } return { out, err, code: err ? 1 : 0 } }
        if (vsub === 'inspect') { const n = vnames[0]; if (!n || !(n in st.volumes)) return { out: '[]\n', err: `Error response from daemon: get ${n}: no such volume\n`, code: 1 }; return ok(JSON.stringify([{ CreatedAt: new Date().toISOString(), Driver: 'local', Labels: null, Mountpoint: `/var/lib/docker/volumes/${n}/_data`, Name: n, Options: null, Scope: 'local' }], null, 4) + '\n') }
        if (vsub === 'prune') { const unused = Object.keys(st.volumes).filter((n) => !st.containers.some((c) => c.volumes.some((v) => v.named && v.src === n))); for (const n of unused) delete st.volumes[n]; return ok(`Deleted Volumes:\n${unused.join('\n')}\n\nTotal reclaimed space: ${unused.length ? '12.3kB' : '0B'}\n`) }
        return fail('\nUsage:  docker volume COMMAND\n\nManage volumes\n\nCommands:\n  create      Create a volume\n  inspect     Display detailed information on one or more volumes\n  ls          List volumes\n  prune       Remove unused local volumes\n  rm          Remove one or more volumes')
      }
      case 'network': {
        const [nsub, ...nrest] = argv
        const nnames = nrest.filter((a) => !a.startsWith('-'))
        if (nsub === 'ls' || nsub === 'list') return ok(table(['NETWORK ID', 'NAME', 'DRIVER', 'SCOPE'], st.networks.map((n, k) => [hex(k * 11 + 101, 12), n, n === 'host' ? 'host' : n === 'none' ? 'null' : 'bridge', 'local'])))
        if (nsub === 'create') { const n = nnames[0]; if (!n) return fail('"docker network create" requires exactly 1 argument.'); if (st.networks.includes(n)) return fail(`Error response from daemon: network with name ${n} already exists`); st.networks.push(n); return ok(hex(st.seq++ * 5, 64) + '\n') }
        if (nsub === 'rm' || nsub === 'remove') { let out = ''; let err = ''; for (const n of nnames) { if (!st.networks.includes(n)) { err += `Error response from daemon: network ${n} not found\n`; continue } if (['bridge', 'host', 'none'].includes(n)) { err += `Error response from daemon: ${n} is a pre-defined network and cannot be removed\n`; continue } const user = st.containers.find((c) => c.network === n); if (user) { err += `Error response from daemon: error while removing network: network ${n} has active endpoints\n`; continue } st.networks = st.networks.filter((x) => x !== n); out += n + '\n' } return { out, err, code: err ? 1 : 0 } }
        if (nsub === 'inspect') { const n = nnames[0]; if (!n || !st.networks.includes(n)) return { out: '[]\n', err: `Error response from daemon: network ${n} not found\n`, code: 1 }; const members = st.containers.filter((c) => c.network === n && c.status === 'running'); return ok(JSON.stringify([{ Name: n, Id: hex(st.networks.indexOf(n) * 11 + 101, 64), Driver: n === 'host' ? 'host' : n === 'none' ? 'null' : 'bridge', Scope: 'local', IPAM: { Driver: 'default', Config: [{ Subnet: (members[0]?.ip ?? nextIp(st, n)).replace(/\.\d+$/, '.0/16'), Gateway: (members[0]?.ip ?? nextIp(st, n)).replace(/\.\d+$/, '.1') }] }, Containers: Object.fromEntries(members.map((c) => [c.id, { Name: c.name, IPv4Address: c.ip + '/16' }])) }], null, 4) + '\n') }
        if (nsub === 'connect') { const [n, cn] = nnames; const c = cn ? findContainer(st, cn) : null; if (!c || !st.networks.includes(n)) return fail(`Error response from daemon: ${!c ? `No such container: ${cn}` : `network ${n} not found`}`); c.network = n; c.ip = nextIp(st, n); return ok() }
        if (nsub === 'prune') return ok('Deleted Networks:\n' + st.networks.filter((n) => !['bridge', 'host', 'none'].includes(n) && !st.containers.some((c) => c.network === n)).join('\n') + '\n')
        return fail('\nUsage:  docker network COMMAND\n\nManage networks\n\nCommands:\n  connect     Connect a container to a network\n  create      Create a network\n  inspect     Display detailed information on one or more networks\n  ls          List networks\n  prune       Remove all unused networks\n  rm          Remove one or more networks')
      }
      case 'compose': return compose(sh, st, argv)
      case 'system': {
        if (argv[0] === 'prune') { const gone = st.containers.filter((c) => c.status !== 'running'); st.containers = st.containers.filter((c) => c.status === 'running'); const nets = st.networks.filter((n) => !['bridge', 'host', 'none'].includes(n) && !st.containers.some((c) => c.network === n)); st.networks = st.networks.filter((n) => !nets.includes(n)); return ok(`WARNING! This will remove:\n  - all stopped containers\n  - all networks not used by at least one container\n  - all dangling images\n  - unused build cache\n\nAre you sure you want to continue? [y/N] y\nDeleted Containers:\n${gone.map((c) => c.id).join('\n')}\n${nets.length ? `\nDeleted Networks:\n${nets.join('\n')}\n` : ''}\nTotal reclaimed space: ${gone.length ? '1.2MB' : '0B'}\n`) }
        if (argv[0] === 'df') return ok(table(['TYPE', 'TOTAL', 'ACTIVE', 'SIZE', 'RECLAIMABLE'], [['Images', String(st.images.length), String(new Set(st.containers.map((c) => c.image)).size), humanSize(st.images.reduce((a, i) => a + i.size, 0)), '0B (0%)'], ['Containers', String(st.containers.length), String(st.containers.filter((c) => c.status === 'running').length), '0B', '0B'], ['Local Volumes', String(Object.keys(st.volumes).length), String(new Set(st.containers.flatMap((c) => c.volumes.filter((v) => v.named).map((v) => v.src))).size), '0B', '0B'], ['Build Cache', '0', '0', '0B', '0B']]))
        return fail('\nUsage:  docker system COMMAND\n\nManage Docker\n\nCommands:\n  df          Show docker disk usage\n  prune       Remove unused data')
      }
      case 'container-prune': { const gone = st.containers.filter((c) => c.status !== 'running'); st.containers = st.containers.filter((c) => c.status === 'running'); return ok(`WARNING! This will remove all stopped containers.\nAre you sure you want to continue? [y/N] y\n${gone.length ? 'Deleted Containers:\n' + gone.map((c) => c.id).join('\n') + '\n\n' : ''}Total reclaimed space: ${gone.length ? '1.2MB' : '0B'}\n`) }
      case 'image-prune': { const gone = st.images.filter((i) => i.repo === '<none>'); st.images = st.images.filter((i) => i.repo !== '<none>'); return ok(`WARNING! This will remove all dangling images.\nAre you sure you want to continue? [y/N] y\n${gone.length ? 'Deleted Images:\n' + gone.map((i) => 'deleted: sha256:' + i.id).join('\n') + '\n\n' : ''}Total reclaimed space: ${gone.length ? humanSize(gone.reduce((a, i) => a + i.size, 0)) : '0B'}\n`) }
      case 'history': { const img = argv[0] ? findImage(st, argv[0]) : null; if (!img) return fail(`Error response from daemon: No such image: ${argv[0] ?? ''}:latest`); return ok(table(['IMAGE', 'CREATED', 'CREATED BY', 'SIZE', 'COMMENT'], [...img.layers].reverse().map((l, k) => [k === 0 ? img.id.slice(0, 12) : '<missing>', ago(img.created), l.length > 45 ? l.slice(0, 42) + '\u2026' : l, k === img.layers.length - 1 ? humanSize(img.size) : '0B', '']))) }
      case 'stats': return ok(table(['CONTAINER ID', 'NAME', 'CPU %', 'MEM USAGE / LIMIT', 'MEM %', 'NET I/O', 'BLOCK I/O', 'PIDS'], st.containers.filter((c) => c.status === 'running').map((c) => [c.id.slice(0, 12), c.name, '0.05%', '3.2MiB / 3.82GiB', '0.08%', '1.2kB / 0B', '0B / 0B', '2'])) + '(docker stats refreshes live on a real machine; press Ctrl+C there to stop it)\n')
      case 'top': { const c = argv[0] ? findContainer(st, argv[0]) : null; if (!c) return fail(`Error response from daemon: No such container: ${argv[0] ?? ''}`); if (c.status !== 'running') return fail(`Error response from daemon: container ${c.id} is not running`); return ok(`UID    PID     PPID    C    STIME   TTY   TIME       CMD\nroot   ${4000 + st.containers.indexOf(c)}    ${3990 + st.containers.indexOf(c)}    0    09:41    ?     00:00:00   ${c.command.join(' ')}\n`) }
      case 'cp': return fail('docker cp: copying files between the host and a container is not simulated here. Use a volume (-v) to share files instead.')
      case 'attach': return fail('docker attach: attaching to a running container is not simulated here. Use docker logs NAME to read its output, or docker exec NAME CMD to run a command inside it.')
      case 'commit': return fail('docker commit: not simulated here. Write a Dockerfile and docker build instead, which is the reproducible way.')
      default: return fail(`docker: unknown command: docker ${sub}\n\nRun 'docker --help' for more information`)
    }
  }
  base.docker = (sh, args) => { const r = dockerCmd(sh, args); return r.seq === undefined && r.out && r.err ? { ...r, seq: r.out + r.err } : r }
  base['docker-compose'] = (sh, args) => base.docker(sh, ['compose', ...args], '')
}
