// In-memory virtual filesystem for the simulated Linux shell.

export interface FileNode { type: 'file'; content: string; mode: number; owner: string; group: string; mtime: number }
export interface DirNode { type: 'dir'; children: Map<string, FsNode>; mode: number; owner: string; group: string; mtime: number }
export type FsNode = FileNode | DirNode

export class FsError extends Error {}

const now = () => Date.now()

export function normalize(path: string, cwd: string, home: string): string {
  let p = path
  if (p === '~' || p.startsWith('~/')) p = home + p.slice(1)
  if (!p.startsWith('/')) p = cwd.replace(/\/$/, '') + '/' + p
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return '/' + out.join('/')
}

export const basename = (p: string) => p.replace(/\/+$/, '').split('/').pop() || '/'
export const dirname = (p: string) => {
  const s = p.replace(/\/+$/, '')
  const i = s.lastIndexOf('/')
  return i <= 0 ? '/' : s.slice(0, i)
}

export class VFS {
  root: DirNode = { type: 'dir', children: new Map(), mode: 0o755, owner: 'root', group: 'root', mtime: now() }

  get(path: string): FsNode | undefined {
    if (path === '/') return this.root
    let node: FsNode = this.root
    for (const seg of path.split('/').filter(Boolean)) {
      if (node.type !== 'dir') return undefined
      const next = node.children.get(seg)
      if (!next) return undefined
      node = next
    }
    return node
  }

  exists(path: string) { return Boolean(this.get(path)) }
  isDir(path: string) { return this.get(path)?.type === 'dir' }

  dir(path: string): DirNode {
    const n = this.get(path)
    if (!n) throw new FsError(`No such file or directory`)
    if (n.type !== 'dir') throw new FsError(`Not a directory`)
    return n
  }

  mkdir(path: string, opts: { parents?: boolean; owner?: string } = {}) {
    const owner = opts.owner ?? 'learner'
    if (opts.parents) {
      let cur = ''
      for (const seg of path.split('/').filter(Boolean)) {
        cur += '/' + seg
        const n = this.get(cur)
        if (!n) this.dir(dirname(cur)).children.set(seg, { type: 'dir', children: new Map(), mode: 0o755, owner, group: owner, mtime: now() })
        else if (n.type !== 'dir') throw new FsError(`cannot create directory '${cur}': Not a directory`)
      }
      return
    }
    if (this.get(path)) throw new FsError(`cannot create directory '${path}': File exists`)
    const parent = this.get(dirname(path))
    if (!parent || parent.type !== 'dir') throw new FsError(`cannot create directory '${path}': No such file or directory`)
    parent.children.set(basename(path), { type: 'dir', children: new Map(), mode: 0o755, owner, group: owner, mtime: now() })
  }

  writeFile(path: string, content: string, opts: { append?: boolean; owner?: string; mode?: number } = {}) {
    const existing = this.get(path)
    if (existing?.type === 'dir') throw new FsError(`${path}: Is a directory`)
    if (existing) {
      existing.content = opts.append ? existing.content + content : content
      existing.mtime = now()
      return
    }
    const parent = this.get(dirname(path))
    if (!parent || parent.type !== 'dir') throw new FsError(`${path}: No such file or directory`)
    const owner = opts.owner ?? 'learner'
    parent.children.set(basename(path), { type: 'file', content, mode: opts.mode ?? 0o644, owner, group: owner, mtime: now() })
  }

  readFile(path: string): string {
    const n = this.get(path)
    if (!n) throw new FsError(`${path}: No such file or directory`)
    if (n.type === 'dir') throw new FsError(`${path}: Is a directory`)
    return n.content
  }

  touch(path: string) {
    const n = this.get(path)
    if (n) { n.mtime = now(); return }
    this.writeFile(path, '')
  }

  remove(path: string, opts: { recursive?: boolean } = {}) {
    const n = this.get(path)
    if (!n) throw new FsError(`cannot remove '${path}': No such file or directory`)
    if (n.type === 'dir' && !opts.recursive) throw new FsError(`cannot remove '${path}': Is a directory`)
    if (path === '/') throw new FsError(`it is dangerous to operate recursively on '/'`)
    this.dir(dirname(path)).children.delete(basename(path))
  }

  copy(src: string, dst: string, opts: { recursive?: boolean } = {}) {
    const n = this.get(src)
    if (!n) throw new FsError(`cannot stat '${src}': No such file or directory`)
    if (n.type === 'dir' && !opts.recursive) throw new FsError(`-r not specified; omitting directory '${src}'`)
    const target = this.isDir(dst) ? dst + '/' + basename(src) : dst
    const parent = this.get(dirname(target))
    if (!parent || parent.type !== 'dir') throw new FsError(`cannot create '${target}': No such file or directory`)
    parent.children.set(basename(target), clone(n))
  }

  move(src: string, dst: string) {
    const n = this.get(src)
    if (!n) throw new FsError(`cannot stat '${src}': No such file or directory`)
    const target = this.isDir(dst) ? dst + '/' + basename(src) : dst
    const parent = this.get(dirname(target))
    if (!parent || parent.type !== 'dir') throw new FsError(`cannot move '${src}' to '${target}': No such file or directory`)
    this.dir(dirname(src)).children.delete(basename(src))
    parent.children.set(basename(target), n)
  }

  list(path: string): [string, FsNode][] {
    return [...this.dir(path).children.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }

  /** Walk every path under root, depth first. */
  walk(path: string, visit: (p: string, n: FsNode) => void) {
    const n = this.get(path)
    if (!n) return
    visit(path, n)
    if (n.type === 'dir') for (const [name] of this.list(path)) this.walk(path === '/' ? '/' + name : path + '/' + name, visit)
  }

  snapshot(from = '/'): Record<string, string | null> {
    const out: Record<string, string | null> = {}
    this.walk(from, (p, n) => { out[p] = n.type === 'file' ? n.content : null })
    return out
  }
}

function clone(n: FsNode): FsNode {
  if (n.type === 'file') return { ...n, mtime: now() }
  const children = new Map<string, FsNode>()
  for (const [k, v] of n.children) children.set(k, clone(v))
  return { ...n, children, mtime: now() }
}

/** Seed a filesystem from a flat map. Keys ending in "/" are directories. */
export function seedFs(vfs: VFS, seed: Record<string, string>, owner = 'learner') {
  for (const [path, content] of Object.entries(seed)) {
    if (path.endsWith('/')) vfs.mkdir(path.slice(0, -1), { parents: true, owner })
    else {
      vfs.mkdir(dirname(path), { parents: true, owner })
      vfs.writeFile(path, content, { owner })
    }
  }
}
