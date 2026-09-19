/** Stand-in for pytest: collects test_ functions from the learner's program and prints pytest-style output. Pure Python, standard library only. */
export const PYTEST_SHIM = `
"""Stackcraft stand-in for pytest.

Collects test_* functions (and methods of Test* classes) from the program that
called pytest.main(), runs them in definition order, and prints pytest-style
verbose output. Supports fixtures (return and yield), tmp_path, monkeypatch,
capsys, parametrize, raises, approx, skip, and fail. Pure standard library.
"""
import ast
import collections
import inspect
import io
import linecache
import os
import pathlib
import re
import sys
import time

__version__ = "8.3.0"
_WIDTH = 79
_OPS = {ast.Eq: "==", ast.NotEq: "!=", ast.Lt: "<", ast.LtE: "<=", ast.Gt: ">", ast.GtE: ">=",
        ast.In: "in", ast.NotIn: "not in", ast.Is: "is", ast.IsNot: "is not"}


class _Skipped(Exception):
    pass


class _Failed(Exception):
    pass


def skip(reason=""):
    raise _Skipped(reason)


def fail(reason="", pytrace=True):
    raise _Failed(reason)


class _Marker:
    def __init__(self, name):
        self.name = name

    def __call__(self, *args, **kw):
        if self.name != "parametrize" and len(args) == 1 and callable(args[0]) and not kw:
            return self._apply(args[0], (), {})
        return lambda fn: self._apply(fn, args, kw)

    def _apply(self, fn, args, kw):
        fn._sc_marks = getattr(fn, "_sc_marks", []) + [(self.name, args, kw)]
        return fn


class _Mark:
    def __getattr__(self, name):
        return _Marker(name)


mark = _Mark()


class param:
    def __init__(self, *values, id=None, marks=()):
        self.values, self.id = values, id


def fixture(fn=None, *, scope="function", autouse=False, params=None, name=None):
    def deco(f):
        f._sc_fixture = {"autouse": autouse, "name": name or f.__name__}
        return f
    return deco(fn) if callable(fn) else deco


class _Raises:
    def __init__(self, exc, match):
        self.expected, self.match, self.value, self.type = exc, match, None, None

    def __enter__(self):
        return self

    def __exit__(self, t, v, tb):
        if t is None:
            raise _Failed(f"DID NOT RAISE {self.expected}")
        if not issubclass(t, self.expected):
            return False
        self.value, self.type = v, t
        if self.match is not None and not re.search(self.match, str(v)):
            raise AssertionError(f"Regex pattern did not match.\\n Regex: {self.match!r}\\n Input: {str(v)!r}")
        return True


def raises(exc, *args, match=None, **kw):
    ctx = _Raises(exc, match)
    if not args:
        return ctx
    with ctx:
        args[0](*args[1:], **kw)
    return ctx


class approx:
    def __init__(self, expected, rel=None, abs=None):
        self.expected, self.rel, self.abs = expected, rel, abs

    def _close(self, a, e):
        if isinstance(e, dict):
            return isinstance(a, dict) and a.keys() == e.keys() and all(self._close(a[k], e[k]) for k in e)
        if isinstance(e, (list, tuple)):
            return len(a) == len(e) and all(self._close(x, y) for x, y in zip(a, e))
        rel = 1e-6 if self.rel is None else self.rel
        tol = max(rel * abs_(e), 1e-12 if self.abs is None else self.abs)
        return abs_(a - e) <= tol

    def __eq__(self, actual):
        try:
            return self._close(actual, self.expected)
        except TypeError:
            return False

    def __repr__(self):
        return f"{self.expected!r} +- {self.abs if self.abs is not None else (self.rel or 1e-6)}"


abs_ = abs


class MonkeyPatch:
    def __init__(self):
        self._undo = []

    def setattr(self, target, name, value=None, raising=True):
        if isinstance(target, str) and value is None:
            mod, _, attr = target.rpartition(".")
            target, name, value = sys.modules[mod] if mod in sys.modules else __import__(mod), attr, name
        had = hasattr(target, name)
        if raising and not had:
            raise AttributeError(f"{target!r} has no attribute {name!r}")
        old = getattr(target, name, None)
        self._undo.append(lambda: setattr(target, name, old) if had else delattr(target, name))
        setattr(target, name, value)

    def delattr(self, target, name, raising=True):
        if hasattr(target, name):
            old = getattr(target, name)
            self._undo.append(lambda: setattr(target, name, old))
            delattr(target, name)
        elif raising:
            raise AttributeError(name)

    def setitem(self, mapping, name, value):
        had, old = name in mapping, mapping.get(name)
        self._undo.append(lambda: mapping.__setitem__(name, old) if had else mapping.pop(name, None))
        mapping[name] = value

    def delitem(self, mapping, name, raising=True):
        if name in mapping:
            old = mapping[name]
            self._undo.append(lambda: mapping.__setitem__(name, old))
            del mapping[name]
        elif raising:
            raise KeyError(name)

    def setenv(self, name, value, prepend=None):
        value = str(value)
        if prepend and name in os.environ:
            value = value + prepend + os.environ[name]
        self.setitem(os.environ, name, value)

    def delenv(self, name, raising=True):
        self.delitem(os.environ, name, raising)

    def chdir(self, path):
        old = os.getcwd()
        self._undo.append(lambda: os.chdir(old))
        os.chdir(str(path))

    def undo(self):
        while self._undo:
            self._undo.pop()()


CaptureResult = collections.namedtuple("CaptureResult", "out err")


class _Capsys:
    def __init__(self, out, err):
        self._out, self._err = out, err

    def readouterr(self):
        out, err = self._out.getvalue(), self._err.getvalue()
        self._out.seek(0), self._out.truncate(), self._err.seek(0), self._err.truncate()
        return CaptureResult(out, err)


def _idval(v, name, i):
    if isinstance(v, param) and v.id:
        return v.id
    v = v.values[0] if isinstance(v, param) and len(v.values) == 1 else v
    if isinstance(v, (int, float, str, bool, type(None))):
        return str(v)
    return f"{name}{i}"


def _expand(fn):
    """Yield (id suffix, kwargs) for every parametrize mark on fn, stacked as a cross product."""
    combos = [("", {})]
    for kind, args, kw in getattr(fn, "_sc_marks", []):
        if kind != "parametrize":
            continue
        names = [n.strip() for n in args[0].split(",")] if isinstance(args[0], str) else list(args[0])
        ids = kw.get("ids") or (args[2] if len(args) > 2 else None)
        new = []
        for i, row in enumerate(args[1]):
            values = row.values if isinstance(row, param) else (row if len(names) > 1 else (row,))
            ident = ids[i] if ids else (_idval(row, names[0], i) if len(names) == 1 else "-".join(_idval(v, n, i) for v, n in zip(values, names)))
            for old_id, old_kw in combos:
                new.append((f"{old_id}-{ident}" if old_id else ident, {**old_kw, **dict(zip(names, values))}))
        combos = new
    return combos


_FILE = ["main.py"]


def _collect(ns, keyword):
    fixtures = {v._sc_fixture["name"]: v for v in ns.values() if callable(v) and getattr(v, "_sc_fixture", None)}
    items = []
    for name, obj in list(ns.items()):
        if inspect.isfunction(obj) and name.startswith("test"):
            items.append((obj.__name__, None, obj))
        elif inspect.isclass(obj) and name.startswith("Test") and obj.__module__ == ns.get("__name__"):
            for mname, m in vars(obj).items():
                if inspect.isfunction(m) and mname.startswith("test"):
                    items.append((f"{obj.__name__}::{mname}", obj, m))
    cases = []
    for label, cls, fn in items:
        for suffix, kwargs in _expand(fn):
            nodeid = f"{os.path.basename(_FILE[0])}::{label}" + (f"[{suffix}]" if suffix else "")
            if keyword and keyword not in nodeid:
                continue
            cases.append((nodeid, cls, fn, kwargs))
    return fixtures, cases


class _Runner:
    def __init__(self, fixtures, buffers):
        self.fixtures, self.buffers, self.tmp_count = fixtures, buffers, {}

    def resolve(self, name, cache, finalizers, nodeid):
        if name in cache:
            return cache[name]
        if name == "tmp_path":
            base = re.sub(r"\\W+", "_", nodeid.split("::")[-1])[:30]
            n = self.tmp_count.get(base, 0)
            self.tmp_count[base] = n + 1
            value = pathlib.Path(os.getcwd()) / "tmp" / f"{base}{n}"
            value.mkdir(parents=True, exist_ok=True)
        elif name == "monkeypatch":
            value = MonkeyPatch()
            finalizers.append(value.undo)
        elif name == "capsys":
            value = _Capsys(*self.buffers)
        elif name in self.fixtures:
            fn = self.fixtures[name]
            kw = {p: self.resolve(p, cache, finalizers, nodeid) for p in inspect.signature(fn).parameters}
            result = fn(**kw)
            if inspect.isgenerator(result):
                value = next(result)
                finalizers.append(lambda: next(result, None))
            else:
                value = result
        else:
            raise LookupError(f"fixture '{name}' not found\\n available fixtures: {', '.join(sorted(list(self.fixtures) + ['capsys', 'monkeypatch', 'tmp_path']))}")
        cache[name] = value
        return value

    def run(self, nodeid, cls, fn, params):
        cache, finalizers, exc = {}, [], None
        try:
            for kind, args, kw in getattr(fn, "_sc_marks", []):
                if kind == "skip" or (kind == "skipif" and args and args[0]):
                    raise _Skipped(kw.get("reason", args[0] if kind == "skip" and args else ""))
            for f in self.fixtures.values():
                if f._sc_fixture["autouse"]:
                    self.resolve(f._sc_fixture["name"], cache, finalizers, nodeid)
            names = [p for p in inspect.signature(fn).parameters if p != "self"]
            kw = {p: params[p] if p in params else self.resolve(p, cache, finalizers, nodeid) for p in names}
            if cls is not None:
                self_obj = cls()
                if hasattr(self_obj, "setup_method"):
                    self_obj.setup_method(fn)
                    finalizers.append(lambda: None)
                if hasattr(self_obj, "teardown_method"):
                    finalizers.append(lambda: self_obj.teardown_method(fn))
                fn(self_obj, **kw)
            else:
                fn(**kw)
        except BaseException as e:
            exc = e
        for fin in reversed(finalizers):
            try:
                fin()
            except BaseException as e:
                exc = exc or e
        return exc


def _explain(exc, frame, line):
    """Build the E lines for a failure: pytest-style assert introspection when the failing line is a simple assert."""
    text = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
    if isinstance(exc, _Failed):
        return [f"Failed: {exc}"]
    if not isinstance(exc, AssertionError):
        return text.splitlines()
    lines = [f"AssertionError: {exc}"] if str(exc) else []
    try:
        node = ast.parse(line.strip()).body[0]
        if not isinstance(node, ast.Assert):
            return lines or ["AssertionError"]
        ev = lambda n: eval(compile(ast.Expression(n), "<assert>", "eval"), frame.f_globals, frame.f_locals)
        src = lambda n: ast.get_source_segment(line.strip(), n)
        t = node.test
        if isinstance(t, ast.Compare) and len(t.ops) == 1:
            left, right = ev(t.left), ev(t.comparators[0])
            lines.append(f"assert {left!r} {_OPS[type(t.ops[0])]} {right!r}")
            for val, n in ((left, t.left), (right, t.comparators[0])):
                if not isinstance(n, ast.Constant):
                    lines.append(f" +  where {val!r} = {src(n)}")
        else:
            val = ev(t)
            lines.append(f"assert {val!r}")
            if not isinstance(t, ast.Constant):
                lines.append(f" +  where {val!r} = {src(t)}")
        return lines
    except Exception:
        return lines or [line.strip() or "AssertionError"]


def _report_failure(nodeid, exc, out):
    print(("_" * ((_WIDTH - len(nodeid.split("::", 1)[1]) - 2) // 2) + " " + nodeid.split("::", 1)[1] + " ").ljust(_WIDTH, "_"))
    print()
    tb, frame, lineno = exc.__traceback__, None, None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _FILE[0]:
            frame, lineno = tb.tb_frame, tb.tb_lineno
        tb = tb.tb_next
    if frame is not None:
        for n in range(frame.f_code.co_firstlineno, lineno + 1):
            src = linecache.getline(_FILE[0], n).rstrip("\\n")
            print(("> " if n == lineno else "  ") + "  " + src)
    explained = _explain(exc, frame, linecache.getline(_FILE[0], lineno) if frame else "")
    for e in explained:
        print("E       " + e)
    if frame is not None:
        print()
        print(f"{os.path.basename(_FILE[0])}:{lineno}: {'Failed' if isinstance(exc, _Failed) else type(exc).__name__}")
    if out.strip():
        print(" Captured stdout call ".center(_WIDTH, "-"))
        print(out.rstrip("\\n"))
    return next((e for e in explained if e.startswith("assert ")), explained[0])


def main(args=None, plugins=None):
    args = list(args or [])
    keyword = args[args.index("-k") + 1] if "-k" in args and args.index("-k") + 1 < len(args) else ""
    stop_first = "-x" in args
    caller = sys._getframe(1)
    ns = caller.f_globals if "__name__" in caller.f_globals else vars(sys.modules["__main__"])
    _FILE[0] = caller.f_code.co_filename
    fixtures, cases = _collect(ns, keyword)
    if os.path.exists("conftest.py"):
        with open("conftest.py") as f:
            cns = {"__name__": "conftest"}
            exec(compile(f.read(), "conftest.py", "exec"), cns)
        fixtures = {**_collect(cns, "")[0], **fixtures}
    print(" test session starts ".center(_WIDTH, "="))
    print(f"platform emscripten -- Python {sys.version.split()[0]}, pytest-{__version__} (stackcraft stand-in)")
    print(f"rootdir: {os.getcwd()}")
    print(f"collected {len(cases)} item{'' if len(cases) == 1 else 's'}")
    print()
    started = time.perf_counter()
    real_out, real_err = sys.stdout, sys.stderr
    counts, failures = collections.Counter(), []
    runner = _Runner(fixtures, (io.StringIO(), io.StringIO()))
    for i, (nodeid, cls, fn, params) in enumerate(cases, 1):
        buf_out, buf_err = runner.buffers
        buf_out.seek(0), buf_out.truncate(), buf_err.seek(0), buf_err.truncate()
        sys.stdout, sys.stderr = buf_out, buf_err
        try:
            exc = runner.run(nodeid, cls, fn, params)
        finally:
            sys.stdout, sys.stderr = real_out, real_err
        if exc is None:
            word = "PASSED"
        elif isinstance(exc, _Skipped):
            word = f"SKIPPED ({exc})" if str(exc) else "SKIPPED"
        elif isinstance(exc, LookupError) and "fixture" in str(exc):
            word = "ERROR"
            failures.append((nodeid, exc, buf_out.getvalue()))
        else:
            word = "FAILED"
            failures.append((nodeid, exc, buf_out.getvalue()))
        counts[word.split()[0].lower()] += 1
        print(f"{nodeid} {word}".ljust(_WIDTH - 7) + f"[{100 * i // len(cases):3d}%]")
        if stop_first and word in ("FAILED", "ERROR"):
            break
    if failures:
        errors = [f for f in failures if isinstance(f[1], LookupError)]
        if errors:
            print(" ERRORS ".center(_WIDTH, "="))
            for nodeid, exc, out in errors:
                print(f" ERROR at setup of {nodeid.split('::', 1)[1]} ".center(_WIDTH, "_"))
                print("E       " + str(exc).replace("\\n", "\\nE       "))
        reasons = {}
        if len(errors) < len(failures):
            print(" FAILURES ".center(_WIDTH, "="))
            for nodeid, exc, out in failures:
                if not isinstance(exc, LookupError):
                    reasons[nodeid] = _report_failure(nodeid, exc, out)
        print(" short test summary info ".center(_WIDTH, "="))
        for nodeid, exc, out in failures:
            reason = reasons.get(nodeid) or str(exc).strip().splitlines()[0]
            print(f"{'ERROR' if isinstance(exc, LookupError) else 'FAILED'} {nodeid} - {reason}"[:_WIDTH])
    elapsed = time.perf_counter() - started
    parts = [f"{counts[k]} {k}" for k in ("failed", "passed", "skipped", "error") if counts[k]]
    summary = ", ".join(parts) if parts else "no tests ran"
    print(f" {summary} in {elapsed:.2f}s ".center(_WIDTH, "="))
    return 0 if cases and not failures else (1 if cases else 5)
`
