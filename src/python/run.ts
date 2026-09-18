// Shared Python runner logic. Used by the browser worker and the Node test harness.
import type { RunResult } from '../content/types'
import { EXTRA_SHIMS } from './shims'

export const PYODIDE_VERSION = '314.0.7'
export const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`

export interface PyRunRequest {
  code: string
  stdin?: string
  argv?: string[]
  /** Files placed in the working directory before the run. */
  files?: Record<string, string>
}

export interface PyRunResult {
  stdout: string
  stderr: string
  /** Short error summary (last traceback line) when the program raised. */
  error?: string
  /** Text files in the working directory after the run. */
  files: Record<string, string>
}

/** Minimal type for the parts of the Pyodide API we use. */
export interface PyodideLike {
  runPython(code: string): unknown
  runPythonAsync(code: string): Promise<unknown>
  globals: { get(name: string): unknown; set(name: string, value: unknown): void }
  FS: {
    mkdirTree?(path: string): void
    mkdir(path: string): void
    writeFile(path: string, data: string, opts?: { encoding: string }): void
    readFile(path: string, opts: { encoding: string }): string
    readdir(path: string): string[]
    stat(path: string): { mode: number }
    isDir(mode: number): boolean
    unlink(path: string): void
    rmdir(path: string): void
    analyzePath(path: string): { exists: boolean }
  }
  toPy(obj: unknown): unknown
}

export const WORK_DIR = '/home/pyodide/work'
const SHIM_DIR = '/home/pyodide/shims'

/** A tiny stand-in for the requests library: canned responses, no network. */
const REQUESTS_SHIM = `
"""Stackcraft stand-in for the requests library. Serves canned responses without any network."""
import json as _json

class ConnectionError(Exception):
    pass

class HTTPError(Exception):
    pass

class exceptions:
    ConnectionError = ConnectionError
    HTTPError = HTTPError
    Timeout = ConnectionError
    RequestException = Exception

_WEATHER = {
    "lisbon": {"city": "Lisbon", "temp_c": 24, "condition": "sunny", "humidity": 55},
    "seoul": {"city": "Seoul", "temp_c": 18, "condition": "cloudy", "humidity": 70},
    "pune": {"city": "Pune", "temp_c": 29, "condition": "rain", "humidity": 88},
    "oslo": {"city": "Oslo", "temp_c": 9, "condition": "windy", "humidity": 61},
}

_ROUTES = {
    "https://api.github.com/users/octocat": (200, {"login": "octocat", "name": "The Octocat", "public_repos": 8, "followers": 12000}),
    "https://api.github.com/repos/python/cpython": (200, {"full_name": "python/cpython", "stargazers_count": 64000, "language": "Python", "open_issues": 9000}),
    "https://httpbin.org/get": (200, {"args": {}, "url": "https://httpbin.org/get"}),
    "https://api.stackcraft.dev/status": (200, {"status": "ok", "version": "1.0"}),
}

class Response:
    def __init__(self, url, status_code, data, text=None):
        self.url = url
        self.status_code = status_code
        self._data = data
        self.text = text if text is not None else _json.dumps(data)
        self.headers = {"Content-Type": "application/json"}
        self.ok = 200 <= status_code < 300
    def json(self):
        return self._data
    def raise_for_status(self):
        if not self.ok:
            raise HTTPError(f"{self.status_code} Client Error for url: {self.url}")
    def __repr__(self):
        return f"<Response [{self.status_code}]>"

def _split(url):
    if "?" in url:
        base, qs = url.split("?", 1)
        params = dict(p.split("=", 1) for p in qs.split("&") if "=" in p)
        return base, params
    return url, {}

def get(url, params=None, timeout=None, headers=None):
    base, qs = _split(url)
    q = dict(qs)
    if params:
        q.update({k: str(v) for k, v in params.items()})
    if base == "https://api.stackcraft.dev/weather":
        city = q.get("city", "").lower()
        if city in _WEATHER:
            return Response(url, 200, _WEATHER[city])
        return Response(url, 404, {"error": f"unknown city: {q.get('city', '')}"})
    if base in _ROUTES:
        code, data = _ROUTES[base]
        return Response(url, code, data)
    if base.startswith("https://api.github.com/users/"):
        return Response(url, 404, {"message": "Not Found"})
    raise ConnectionError(f"Could not reach {base} (this sandbox has no network; only the demo endpoints answer)")

def post(url, json=None, data=None, timeout=None, headers=None):
    if url.startswith("https://httpbin.org/post") or url.startswith("https://api.stackcraft.dev/"):
        return Response(url, 201, {"received": json if json is not None else data})
    raise ConnectionError(f"Could not reach {url} (this sandbox has no network)")
`

/** A stand-in for subprocess that simulates a few common commands. */
const SUBPROCESS_SHIM = `
"""Stackcraft stand-in for subprocess: simulates a handful of commands, no real processes."""
import os as _os
import datetime as _dt

PIPE = -1
STDOUT = -2
DEVNULL = -3

class CalledProcessError(Exception):
    def __init__(self, returncode, cmd, output=None, stderr=None):
        super().__init__(f"Command '{cmd}' returned non-zero exit status {returncode}.")
        self.returncode = returncode
        self.cmd = cmd
        self.output = output
        self.stdout = output
        self.stderr = stderr

class CompletedProcess:
    def __init__(self, args, returncode, stdout=None, stderr=None):
        self.args = args
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
    def __repr__(self):
        return f"CompletedProcess(args={self.args!r}, returncode={self.returncode})"
    def check_returncode(self):
        if self.returncode:
            raise CalledProcessError(self.returncode, self.args, self.stdout, self.stderr)

def _simulate(argv):
    if not argv:
        return 0, "", ""
    cmd, args = argv[0], argv[1:]
    if cmd == "echo":
        return 0, " ".join(args) + "\\n", ""
    if cmd == "ls":
        names = sorted(n for n in _os.listdir(".") if not n.startswith("."))
        if "-l" in args:
            return 0, "".join(f"-rw-r--r-- 1 learner learner {_os.path.getsize(n) if _os.path.isfile(n) else 4096:>6} Sep 17 09:00 {n}\\n" for n in names), ""
        return 0, "\\n".join(names) + ("\\n" if names else ""), ""
    if cmd == "pwd":
        return 0, _os.getcwd() + "\\n", ""
    if cmd == "whoami":
        return 0, "learner\\n", ""
    if cmd == "hostname":
        return 0, "stackbox\\n", ""
    if cmd == "uname":
        return 0, ("Linux stackbox 6.8.0-45-generic x86_64 GNU/Linux\\n" if "-a" in args else "Linux\\n"), ""
    if cmd == "date":
        return 0, _dt.datetime.now().strftime("%a %b %d %H:%M:%S %Y") + "\\n", ""
    if cmd == "df":
        return 0, "Filesystem      Size  Used Avail Use% Mounted on\\n/dev/vda1        20G  6.1G   13G  33% /\\n", ""
    if cmd == "uptime":
        return 0, " 09:41:07 up 3 days,  2:15,  1 user,  load average: 0.08, 0.05, 0.01\\n", ""
    if cmd == "cat":
        out = ""
        for f in args:
            try:
                with open(f) as fh:
                    out += fh.read()
            except FileNotFoundError:
                return 1, out, f"cat: {f}: No such file or directory\\n"
        return 0, out, ""
    if cmd == "false":
        return 1, "", ""
    if cmd == "true":
        return 0, "", ""
    raise FileNotFoundError(2, f"No such file or directory: '{cmd}' (this sandbox simulates only: echo ls pwd whoami hostname uname date df uptime cat)")

def run(args, capture_output=False, text=False, check=False, shell=False, stdout=None, stderr=None, input=None, cwd=None, timeout=None, encoding=None, env=None):
    argv = args.split() if isinstance(args, str) else list(args)
    code, out, err = _simulate(argv)
    if check and code:
        raise CalledProcessError(code, argv, out, err)
    captured = capture_output or stdout == PIPE
    if not captured:
        print(out, end="")
        if err:
            print(err, end="")
        return CompletedProcess(argv, code, None, None)
    if not (text or encoding):
        out, err = out.encode(), err.encode()
    return CompletedProcess(argv, code, out, err)

def check_output(args, text=False, shell=False, **kw):
    r = run(args, capture_output=True, text=text, check=True, shell=shell)
    return r.stdout

def call(args, **kw):
    return run(args, **kw).returncode

def check_call(args, **kw):
    run(args, check=True, **kw)
    return 0
`

const SETUP = `
import sys, io, os, builtins, traceback, types, re, asyncio
from pyodide.code import eval_code_async

_SHIM_MODULES = ("subprocess", "requests", ${Object.keys(EXTRA_SHIMS).map((f) => JSON.stringify(f.replace(/\.py$/, ''))).join(', ')})

def _stackcraft_prepare(code):
    # asyncio.run() cannot block inside the browser, but the program can be run with
    # top-level await instead: "asyncio.run(main())" becomes "await main()".
    return re.sub(r"^(\\s*)((?:[A-Za-z_]\\w*\\s*=\\s*)?)asyncio\\.run\\((.+)\\)\\s*(#.*)?$", r"\\1\\2await \\3", code, flags=re.M)

async def _stackcraft_run(code, stdin_text, argv):
    old_out, old_err, old_in, old_input, old_argv = sys.stdout, sys.stderr, sys.stdin, builtins.input, sys.argv
    out, err = io.StringIO(), io.StringIO()
    lines = stdin_text.split("\\n") if stdin_text else []
    def fake_input(prompt=""):
        out.write(str(prompt))
        if not lines:
            raise EOFError("EOF when reading a line (add more lines to the Input box)")
        value = lines.pop(0)
        out.write(value + "\\n")
        return value
    sys.stdout, sys.stderr, sys.stdin, builtins.input, sys.argv = out, err, io.StringIO(stdin_text), fake_input, ["main.py"] + list(argv)
    for m in list(sys.modules):
        if m in _SHIM_MODULES or m.startswith("_stackcraft_user_"):
            sys.modules.pop(m, None)
    # Modules the learner wrote into the working directory must be re-imported fresh each run.
    for m in list(sys.modules):
        f = getattr(sys.modules[m], "__file__", None) or ""
        if f.startswith("${WORK_DIR}"):
            sys.modules.pop(m, None)
    os.chdir("${WORK_DIR}")
    error = None
    try:
        await eval_code_async(_stackcraft_prepare(code), {"__name__": "__main__", "__file__": "main.py"}, filename="main.py", return_mode="none")
    except SystemExit as e:
        if e.code not in (None, 0):
            err.write(f"(exited with status {e.code})\\n")
    except BaseException as e:
        tb = traceback.format_exception(type(e), e, e.__traceback__)
        # Drop the runner's own frames so the trace starts at the learner's code.
        tb = [l for l in tb if "_stackcraft_run" not in l and "<string>" not in l and "pyodide/code.py" not in l and "_pyodide/_base.py" not in l and "eval_code_async" not in l]
        err.write("".join(tb))
        error = tb[-1].strip() if tb else str(e)
    finally:
        sys.stdout, sys.stderr, sys.stdin, builtins.input, sys.argv = old_out, old_err, old_in, old_input, old_argv
    return out.getvalue(), err.getvalue(), error
`

let prepared = new WeakSet<object>()

export async function preparePyodide(py: PyodideLike) {
  if (prepared.has(py)) return
  mkdirp(py, SHIM_DIR)
  mkdirp(py, WORK_DIR)
  py.FS.writeFile(`${SHIM_DIR}/requests.py`, REQUESTS_SHIM)
  py.FS.writeFile(`${SHIM_DIR}/subprocess.py`, SUBPROCESS_SHIM)
  for (const [name, src] of Object.entries(EXTRA_SHIMS)) py.FS.writeFile(`${SHIM_DIR}/${name}`, src)
  py.runPython(`import sys\nif "${SHIM_DIR}" not in sys.path: sys.path.insert(0, "${SHIM_DIR}")\nif "${WORK_DIR}" not in sys.path: sys.path.insert(0, "${WORK_DIR}")`)
  py.runPython(SETUP)
  prepared.add(py)
}

function mkdirp(py: PyodideLike, path: string) {
  if (py.FS.mkdirTree) { py.FS.mkdirTree(path); return }
  let cur = ''
  for (const seg of path.split('/').filter(Boolean)) {
    cur += '/' + seg
    if (!py.FS.analyzePath(cur).exists) py.FS.mkdir(cur)
  }
}

function clearDir(py: PyodideLike, dir: string) {
  for (const name of py.FS.readdir(dir)) {
    if (name === '.' || name === '..') continue
    const p = `${dir}/${name}`
    if (py.FS.isDir(py.FS.stat(p).mode)) { clearDir(py, p); py.FS.rmdir(p) }
    else py.FS.unlink(p)
  }
}

function snapshot(py: PyodideLike, dir: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of py.FS.readdir(dir)) {
    if (name === '.' || name === '..' || name === '__pycache__') continue
    const p = `${dir}/${name}`
    const rel = prefix + name
    if (py.FS.isDir(py.FS.stat(p).mode)) Object.assign(out, snapshot(py, p, rel + '/'))
    else {
      try { const t = py.FS.readFile(p, { encoding: 'utf8' }); if (t.length < 65536) out[rel] = t } catch { /* binary */ }
    }
  }
  return out
}

export async function runPython(py: PyodideLike, req: PyRunRequest): Promise<PyRunResult> {
  await preparePyodide(py)
  clearDir(py, WORK_DIR)
  for (const [name, content] of Object.entries(req.files ?? {})) {
    const full = `${WORK_DIR}/${name}`
    const dir = full.slice(0, full.lastIndexOf('/'))
    mkdirp(py, dir)
    py.FS.writeFile(full, content)
  }
  const fn = py.globals.get('_stackcraft_run') as (code: string, stdin: string, argv: unknown) => Promise<{ toJs(): [string, string, string | null]; destroy?(): void }>
  const res = await fn(req.code, req.stdin ?? '', py.toPy(req.argv ?? []))
  const [stdout, stderr, error] = res.toJs()
  res.destroy?.()
  return { stdout, stderr, error: error ?? undefined, files: snapshot(py, WORK_DIR) }
}

/** Assemble the checker input from every run so far. */
export function toRunResult(runs: { code: string; stdin: string; argv: string[]; result: PyRunResult }[]): RunResult {
  const last = runs[runs.length - 1]
  return {
    input: last?.code ?? '',
    output: last ? last.result.stdout + last.result.stderr : '',
    error: last?.result.error,
    history: runs.map((r) => r.code),
    outputs: runs.map((r) => r.result.stdout + r.result.stderr),
    fs: last?.result.files ?? {},
    env: { STDIN: last?.stdin ?? '', ARGV: (last?.argv ?? []).join(' ') },
  }
}
