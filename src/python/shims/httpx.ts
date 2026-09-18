/** Stand-in for httpx: canned async responses with deterministic delays, no network. */
export const HTTPX_SHIM = `
"""Stackcraft stand-in for the httpx library.

Serves canned responses without any network. Every request awaits a small,
deterministic delay derived from the URL (0.05 to 0.3 seconds), so fetching
many URLs concurrently is measurably faster than fetching them one by one.
"""
import asyncio as _asyncio
import datetime as _dt
import json as _json
import time as _time

__version__ = "0.27.0"


class HTTPError(Exception):
    pass


class RequestError(HTTPError):
    pass


class ConnectError(RequestError):
    pass


class TimeoutException(RequestError):
    pass


class ConnectTimeout(TimeoutException):
    pass


class ReadTimeout(TimeoutException):
    pass


class HTTPStatusError(HTTPError):
    def __init__(self, message, request=None, response=None):
        super().__init__(message)
        self.request = request
        self.response = response


class codes:
    OK = 200
    CREATED = 201
    NO_CONTENT = 204
    MOVED_PERMANENTLY = 301
    FOUND = 302
    NOT_MODIFIED = 304
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    TOO_MANY_REQUESTS = 429
    INTERNAL_SERVER_ERROR = 500
    BAD_GATEWAY = 502
    SERVICE_UNAVAILABLE = 503

    @staticmethod
    def get_reason_phrase(code):
        return _REASONS.get(int(code), "")

    @staticmethod
    def is_success(code):
        return 200 <= int(code) < 300

    @staticmethod
    def is_error(code):
        return 400 <= int(code) < 600


_REASONS = {
    200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found",
    304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 429: "Too Many Requests", 500: "Internal Server Error",
    502: "Bad Gateway", 503: "Service Unavailable",
}

_HTML = "<!doctype html>\\n<html>\\n<head><title>Example Domain</title></head>\\n<body><h1>Example Domain</h1></body>\\n</html>\\n"

# url -> (status, body, content type, extra delay in seconds)
_ROUTES = {
    "https://example.com": (200, _HTML, "text/html", 0),
    "https://example.com/": (200, _HTML, "text/html", 0),
    "https://www.example.com": (200, _HTML, "text/html", 0),
    "https://httpbin.org/get": (200, {"args": {}, "headers": {"Accept": "*/*"}, "url": "https://httpbin.org/get"}, "application/json", 0),
    "https://httpbin.org/json": (200, {"slideshow": {"title": "Sample Slide Show", "slides": 2}}, "application/json", 0),
    "https://httpbin.org/status/200": (200, "", "text/plain", 0),
    "https://httpbin.org/status/201": (201, "", "text/plain", 0),
    "https://httpbin.org/status/301": (301, "", "text/plain", 0),
    "https://httpbin.org/status/403": (403, "", "text/plain", 0),
    "https://httpbin.org/status/404": (404, "", "text/plain", 0),
    "https://httpbin.org/status/429": (429, "", "text/plain", 0),
    "https://httpbin.org/status/500": (500, "", "text/plain", 0),
    "https://httpbin.org/status/503": (503, "", "text/plain", 0),
    "https://httpbin.org/delay/1": (200, {"url": "https://httpbin.org/delay/1"}, "application/json", 1.0),
    "https://httpbin.org/delay/2": (200, {"url": "https://httpbin.org/delay/2"}, "application/json", 2.0),
    "https://httpbin.org/delay/3": (200, {"url": "https://httpbin.org/delay/3"}, "application/json", 3.0),
    "https://api.github.com": (200, {"current_user_url": "https://api.github.com/user"}, "application/json", 0),
    "https://api.github.com/users/octocat": (200, {"login": "octocat", "name": "The Octocat", "public_repos": 8, "followers": 12000}, "application/json", 0),
    "https://api.github.com/users/octocat/repos": (200, [{"name": "hello-world", "stargazers_count": 2500, "language": None}, {"name": "octocat.github.io", "stargazers_count": 300, "language": "HTML"}, {"name": "spoon-knife", "stargazers_count": 12000, "language": "HTML"}], "application/json", 0),
    "https://api.github.com/repos/python/cpython": (200, {"full_name": "python/cpython", "stargazers_count": 64000, "language": "Python"}, "application/json", 0),
    "https://api.stackcraft.dev/status": (200, {"status": "ok", "version": "1.0"}, "application/json", 0),
    "https://python.org": (200, "<!doctype html>\\n<html><head><title>Welcome to Python.org</title></head><body></body></html>\\n", "text/html", 0),
    "https://www.python.org": (200, "<!doctype html>\\n<html><head><title>Welcome to Python.org</title></head><body></body></html>\\n", "text/html", 0),
    "https://docs.python.org/3/": (200, "<!doctype html>\\n<html><head><title>3.12 documentation</title></head><body></body></html>\\n", "text/html", 0),
    "https://pypi.org": (200, "<!doctype html>\\n<html><head><title>PyPI</title></head><body></body></html>\\n", "text/html", 0),
    "https://github.com": (200, "<!doctype html>\\n<html><head><title>GitHub</title></head><body></body></html>\\n", "text/html", 0),
    "https://wikipedia.org": (301, "", "text/html", 0),
    "https://www.wikipedia.org": (200, "<!doctype html>\\n<html><head><title>Wikipedia</title></head><body></body></html>\\n", "text/html", 0),
}

_UNREACHABLE = ("https://nope.invalid", "http://nope.invalid", "https://does-not-exist.example", "http://localhost:9", "https://localhost:9")


def _base(url):
    url = str(url)
    if "?" in url:
        url = url.split("?", 1)[0]
    if "#" in url:
        url = url.split("#", 1)[0]
    return url


def _delay_for(url):
    """A deterministic pause between 0.05 and 0.3 seconds, derived from the URL text."""
    h = 0
    for ch in _base(url).rstrip("/"):
        h = (h * 31 + ord(ch)) % 1000003
    return 0.05 + (h % 26) / 100.0


def _lookup(url):
    """Return (status, body, content type, extra delay) or raise ConnectError."""
    base = _base(url)
    key = base if base in _ROUTES else base.rstrip("/")
    if key in _ROUTES:
        return _ROUTES[key]
    for bad in _UNREACHABLE:
        if base.startswith(bad):
            raise ConnectError(f"[Errno -2] Name or service not known: {base}")
    if base.startswith("https://api.github.com/users/"):
        return (404, {"message": "Not Found"}, "application/json", 0)
    if base.startswith("https://httpbin.org/status/"):
        try:
            return (int(base.rsplit("/", 1)[1]), "", "text/plain", 0)
        except ValueError:
            pass
    if base.startswith("https://httpbin.org/delay/"):
        try:
            return (200, {"url": base}, "application/json", float(base.rsplit("/", 1)[1]))
        except ValueError:
            pass
    if not (base.startswith("http://") or base.startswith("https://")):
        raise ConnectError(f"Request URL is missing an 'http://' or 'https://' protocol: {base}")
    raise ConnectError(f"Could not reach {base} (this sandbox has no network; only the demo URLs answer)")


def _merge_url(url, params):
    if not params:
        return str(url)
    qs = "&".join(f"{k}={v}" for k, v in dict(params).items())
    return str(url) + ("&" if "?" in str(url) else "?") + qs


class URL:
    def __init__(self, text):
        self._text = str(text)
        rest = self._text.split("://", 1)
        self.scheme = rest[0] if len(rest) == 2 else ""
        after = rest[1] if len(rest) == 2 else rest[0]
        self.host = after.split("/", 1)[0].split("?", 1)[0]
        path = after[len(self.host):]
        self.path = path.split("?", 1)[0] or "/"
        self.query = path.split("?", 1)[1].encode() if "?" in path else b""
    def __str__(self):
        return self._text
    def __repr__(self):
        return f"URL({self._text!r})"
    def __eq__(self, other):
        return str(self) == str(other)
    def __hash__(self):
        return hash(self._text)


class Headers(dict):
    """A case-insensitive dictionary of headers."""
    def __init__(self, data=None):
        super().__init__()
        for k, v in dict(data or {}).items():
            self[k] = v
    def __setitem__(self, key, value):
        super().__setitem__(str(key).lower(), str(value))
    def __getitem__(self, key):
        return super().__getitem__(str(key).lower())
    def __contains__(self, key):
        return super().__contains__(str(key).lower())
    def get(self, key, default=None):
        return super().get(str(key).lower(), default)


class Request:
    def __init__(self, method, url, headers=None):
        self.method = method
        self.url = URL(url)
        self.headers = Headers(headers)
    def __repr__(self):
        return f"<Request('{self.method}', '{self.url}')>"


class Response:
    def __init__(self, status_code, url, body, content_type, elapsed, request=None):
        self.status_code = int(status_code)
        self.url = URL(url)
        self._body = body
        self.text = body if isinstance(body, str) else _json.dumps(body)
        self.content = self.text.encode()
        self.headers = Headers({"content-type": content_type, "content-length": str(len(self.content)), "server": "stackcraft-shim"})
        self.elapsed = _dt.timedelta(seconds=elapsed)
        self.request = request
        self.reason_phrase = _REASONS.get(self.status_code, "")
        self.encoding = "utf-8"
        self.http_version = "HTTP/1.1"
    @property
    def is_success(self):
        return 200 <= self.status_code < 300
    @property
    def is_redirect(self):
        return 300 <= self.status_code < 400
    @property
    def is_client_error(self):
        return 400 <= self.status_code < 500
    @property
    def is_server_error(self):
        return 500 <= self.status_code < 600
    @property
    def is_error(self):
        return 400 <= self.status_code < 600
    def json(self, **kw):
        if isinstance(self._body, str):
            return _json.loads(self._body, **kw)
        return self._body
    def raise_for_status(self):
        if self.is_error:
            kind = "Client" if self.is_client_error else "Server"
            raise HTTPStatusError(f"{kind} error '{self.status_code} {self.reason_phrase}' for url '{self.url}'", request=self.request, response=self)
        return self
    def __repr__(self):
        return f"<Response [{self.status_code} {self.reason_phrase}]>"


def _timeout_seconds(timeout):
    if timeout is None or timeout is ...:
        return None
    if isinstance(timeout, Timeout):
        return timeout.read
    return float(timeout)


class Timeout:
    def __init__(self, timeout=None, connect=None, read=None, write=None, pool=None):
        self.connect = connect if connect is not None else timeout
        self.read = read if read is not None else timeout
        self.write = write if write is not None else timeout
        self.pool = pool if pool is not None else timeout
    def __repr__(self):
        return f"Timeout(timeout={self.read})"


def _plan(method, url, params, headers, timeout, default_headers):
    """Work out what a request will do: (url, status, body, content type, wait, limit, request, error)."""
    full = _merge_url(url, params)
    status, body, ctype, extra, error = 0, "", "text/plain", 0, None
    try:
        status, body, ctype, extra = _lookup(full)
    except ConnectError as e:
        error = e
    wait = _delay_for(full) + extra
    limit = _timeout_seconds(timeout)
    merged = Headers(default_headers)
    for k, v in dict(headers or {}).items():
        merged[k] = v
    req = Request(method, full, merged)
    return full, status, body, ctype, wait, limit, req, error


def _sync_request(method, url, params=None, headers=None, timeout=5.0, default_headers=None, **kw):
    full, status, body, ctype, wait, limit, req, error = _plan(method, url, params, headers, timeout, default_headers)
    if limit is not None and wait > limit:
        _time.sleep(min(limit, 2.0))
        raise ReadTimeout(f"timed out after {limit} seconds: {full}")
    _time.sleep(min(wait, 2.0))
    if error is not None:
        raise error
    return Response(status, full, body, ctype, wait, req)


async def _async_request(method, url, params=None, headers=None, timeout=5.0, default_headers=None, **kw):
    full, status, body, ctype, wait, limit, req, error = _plan(method, url, params, headers, timeout, default_headers)
    started = _time.perf_counter()
    if limit is not None and wait > limit:
        await _asyncio.sleep(limit)
        raise ReadTimeout(f"timed out after {limit} seconds: {full}")
    await _asyncio.sleep(wait)
    if error is not None:
        raise error
    return Response(status, full, body, ctype, _time.perf_counter() - started, req)


def get(url, params=None, headers=None, timeout=5.0, **kw):
    return _sync_request("GET", url, params, headers, timeout, **kw)


def post(url, params=None, headers=None, timeout=5.0, **kw):
    return _sync_request("POST", url, params, headers, timeout, **kw)


def head(url, params=None, headers=None, timeout=5.0, **kw):
    return _sync_request("HEAD", url, params, headers, timeout, **kw)


class Client:
    """Synchronous client. Use with a with-block or call close() yourself."""
    def __init__(self, timeout=5.0, headers=None, base_url="", **kw):
        self.timeout = timeout
        self.headers = Headers(headers)
        self.base_url = base_url
        self.is_closed = False
    def _full(self, url):
        return self.base_url + str(url) if self.base_url and not str(url).startswith("http") else url
    def get(self, url, params=None, headers=None, timeout=...):
        t = self.timeout if timeout is ... else timeout
        return _sync_request("GET", self._full(url), params, headers, t, self.headers)
    def post(self, url, params=None, headers=None, timeout=..., **kw):
        t = self.timeout if timeout is ... else timeout
        return _sync_request("POST", self._full(url), params, headers, t, self.headers)
    def head(self, url, params=None, headers=None, timeout=...):
        t = self.timeout if timeout is ... else timeout
        return _sync_request("HEAD", self._full(url), params, headers, t, self.headers)
    def close(self):
        self.is_closed = True
    def __enter__(self):
        return self
    def __exit__(self, *exc):
        self.close()
        return False


class AsyncClient:
    """Asynchronous client. Use with an async with-block: async with httpx.AsyncClient() as client."""
    def __init__(self, timeout=5.0, headers=None, base_url="", **kw):
        self.timeout = timeout
        self.headers = Headers(headers)
        self.base_url = base_url
        self.is_closed = False
    def _full(self, url):
        return self.base_url + str(url) if self.base_url and not str(url).startswith("http") else url
    async def get(self, url, params=None, headers=None, timeout=...):
        t = self.timeout if timeout is ... else timeout
        return await _async_request("GET", self._full(url), params, headers, t, self.headers)
    async def post(self, url, params=None, headers=None, timeout=..., **kw):
        t = self.timeout if timeout is ... else timeout
        return await _async_request("POST", self._full(url), params, headers, t, self.headers)
    async def head(self, url, params=None, headers=None, timeout=...):
        t = self.timeout if timeout is ... else timeout
        return await _async_request("HEAD", self._full(url), params, headers, t, self.headers)
    async def aclose(self):
        self.is_closed = True
    async def __aenter__(self):
        return self
    async def __aexit__(self, *exc):
        await self.aclose()
        return False
`
