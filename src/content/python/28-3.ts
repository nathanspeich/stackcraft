import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const HEAD = `import asyncio
import time

import httpx

URLS = [
    "https://example.com",
    "https://httpbin.org/get",
    "https://httpbin.org/status/404",
    "https://httpbin.org/status/500",
    "https://api.github.com/users/octocat",
    "https://nope.invalid",
]
`

const STARTER = HEAD + `

async def check(client, url):
    # 1. return (url, status or "ERR", seconds taken)
    pass


async def main():
    start = time.perf_counter()
    # 2. one client, gather a check for every URL, print a row each

    # 3. the summary lines


asyncio.run(main())
`

const SOLUTION = HEAD + `

async def check(client, url):
    # 1. return (url, status or "ERR", seconds taken)
    started = time.perf_counter()
    try:
        r = await client.get(url)
        return url, r.status_code, r.elapsed.total_seconds()
    except httpx.HTTPError:
        return url, "ERR", time.perf_counter() - started


async def main():
    start = time.perf_counter()
    # 2. one client, gather a check for every URL, print a row each
    async with httpx.AsyncClient(timeout=5) as client:
        rows = await asyncio.gather(*(check(client, url) for url in URLS))
    for url, status, seconds in rows:
        print(f"{status:>4} {seconds:>6.2f}s  {url}")

    # 3. the summary lines
    ok = sum(1 for _, status, _ in rows if status != "ERR" and 200 <= status < 300)
    print(f"ok: {ok}, errors: {len(rows) - ok}")
    print(f"checked {len(rows)} urls in {time.perf_counter() - start:.1f}s")


asyncio.run(main())
`

const lesson: Lesson = {
  id: 'w28d3',
  tier: 2,
  track: 'python',
  week: 28,
  day: 3,
  title: 'An async HTTP client with httpx',
  concept: `requests is synchronous: every call blocks until the answer arrives, so it cannot take part in an event loop. httpx has the same feel (httpx.get, r.status_code, r.json()) plus an async version.

async with httpx.AsyncClient(timeout=5) as client opens one client that reuses connections, and r = await client.get(url) is a wait the loop can overlap. Put ten of those in asyncio.gather and ten requests are in flight at once.

Errors come as exceptions: httpx.ConnectError when the host cannot be reached, httpx.TimeoutException when the deadline passes, and httpx.HTTPStatusError from r.raise_for_status(). All of them inherit from httpx.HTTPError, so one except catches them. r.elapsed is a timedelta of how long that request took.

In the app a stand-in httpx answers demo URLs with a small pause each, so the speedup is measurable.`,
  example: {
    language: 'python',
    caption: 'Many requests in flight with one AsyncClient',
    code: `import asyncio, httpx

async def fetch(client, url):
    try:
        r = await client.get(url)
        return r.status_code
    except httpx.HTTPError as e:
        return f"ERR {type(e).__name__}"

async def main():
    async with httpx.AsyncClient(timeout=5) as client:
        codes = await asyncio.gather(*(fetch(client, u) for u in urls))
    print(codes)     # [200, 404, 'ERR ConnectError']

asyncio.run(main())`,
  },
  task: {
    kind: 'python',
    instructions: 'Check every URL in URLS concurrently.\n1. Finish check(client, url): await client.get(url) and return (url, r.status_code, r.elapsed.total_seconds()). Catch httpx.HTTPError and return (url, "ERR", seconds since check started) instead.\n2. In main open one httpx.AsyncClient(timeout=5) with async with, gather a check for every URL, then print one row per result as f"{status:>4} {seconds:>6.2f}s  {url}" (two spaces before the url).\n3. Print  ok: 3, errors: 3  counting statuses from 200 to 299 as ok, then  checked 6 urls in 0.3s  (one decimal). Gathered, the total should be close to the slowest single request, not the sum.',
    starter: STARTER,
    hints: [
      'started = time.perf_counter() then try: r = await client.get(url); return url, r.status_code, r.elapsed.total_seconds()',
      'except httpx.HTTPError: return url, "ERR", time.perf_counter() - started',
      'async with httpx.AsyncClient(timeout=5) as client: rows = await asyncio.gather(*(check(client, url) for url in URLS))',
      'ok = sum(1 for _, status, _ in rows if status != "ERR" and 200 <= status < 300)',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const total = parseFloat(/checked 6 urls in ([\d.]+)s/.exec(r.output)?.[1] ?? 'NaN')
      const row = (status: string, url: string) => ls.some((l) => new RegExp(`^\\s*${status}\\s+\\d+\\.\\d\\ds\\s\\s${url.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`).test(l))
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /await client\.get\(/) && codeHas(r, /except httpx\.HTTPError/) && codeHas(r, /\.elapsed/), 'Step 1: await client.get(url), use r.elapsed, and catch httpx.HTTPError.'],
        [codeHas(r, /async with httpx\.AsyncClient\(\s*timeout\s*=\s*5\s*\)/) && codeHas(r, /asyncio\.gather\(/), 'Step 2: open httpx.AsyncClient(timeout=5) with async with and gather the checks.'],
        [row('200', 'https://example.com') && row('404', 'https://httpbin.org/status/404') && row('500', 'https://httpbin.org/status/500'), `Step 2: each row looks like  200   0.17s  https://example.com  (status right-aligned in 4, seconds with 2 decimals, two spaces, url). Yours: ${JSON.stringify(ls[0] ?? '')}`],
        [row('ERR', 'https://nope.invalid'), 'Step 2: the unreachable host should print an  ERR  row instead of crashing the run.'],
        [ls.includes('ok: 3, errors: 3'), 'Step 3: print  ok: 3, errors: 3  (only 2xx counts as ok).'],
        [total > 0.15 && total < 0.5, `Step 3: the last line should be  checked 6 urls in 0.3s  with a total near the slowest request, not the sum (yours: ${Number.isNaN(total) ? 'missing' : total}).`],
      ], 'Six requests, one round trip of waiting. This is the pattern behind every fast crawler and health checker.')
    },
  },
  quiz: [
    { question: 'Why can requests not be used inside an async program?', options: ['It cannot parse JSON', 'Its calls block the thread, so the event loop cannot run anything else while waiting', 'It has no timeout option'], answer: 1, explanation: 'A blocking call freezes the loop; you need an awaitable client like httpx.AsyncClient.' },
    { question: 'What does one except httpx.HTTPError catch?', options: ['Only 4xx and 5xx responses', 'Connection failures, timeouts, and raise_for_status errors, since they all inherit from it', 'Nothing, it is abstract'], answer: 1, explanation: 'HTTPError is the base class of httpx exceptions; catch narrower ones when you need to treat them differently.' },
    { question: 'Why open one AsyncClient for all the requests instead of one per URL?', options: ['Only one is allowed per program', 'It reuses connections and shares settings like timeout and headers', 'It makes the responses smaller'], answer: 1, explanation: 'A client is a connection pool; making a new one for each request wastes the pooling.' },
  ],
}

export default lesson
