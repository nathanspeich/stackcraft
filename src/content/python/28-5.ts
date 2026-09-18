import type { Lesson } from '../types'

const URLS = `cat > ~/apis/urls.txt <<'EOF'
https://example.com
https://www.python.org
https://docs.python.org/3/
https://pypi.org
https://github.com
https://api.github.com
https://www.wikipedia.org
https://httpbin.org/get
https://httpbin.org/status/404
https://httpbin.org/status/500
https://httpbin.org/delay/2
https://nope.invalid
EOF`

const CHECKER = `cat > ~/apis/checker.py <<'EOF'
"""Check many URLs at once: status and time per URL, then a total."""
import argparse
import asyncio
import sys
import time

import httpx


async def check(client, sem, url):
    """Return (url, status or error name, seconds). The semaphore caps concurrency."""
    async with sem:
        started = time.perf_counter()
        try:
            r = await client.get(url)
            return url, r.status_code, time.perf_counter() - started
        except httpx.HTTPError as e:
            return url, type(e).__name__, time.perf_counter() - started


async def main():
    parser = argparse.ArgumentParser(description="Async URL checker")
    parser.add_argument("file", help="text file with one URL per line")
    parser.add_argument("--limit", type=int, default=10, help="max requests in flight")
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args()

    try:
        with open(args.file) as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    except FileNotFoundError:
        sys.exit(f"error: no such file: {args.file}")
    if not urls:
        sys.exit(f"error: {args.file} has no URLs")

    sem = asyncio.Semaphore(args.limit)
    start = time.perf_counter()
    headers = {"User-Agent": "stackcraft-url-checker"}
    async with httpx.AsyncClient(timeout=args.timeout, headers=headers,
                                 follow_redirects=True) as client:
        rows = await asyncio.gather(*(check(client, sem, u) for u in urls))

    ok = 0
    for url, status, seconds in rows:
        if isinstance(status, int) and 200 <= status < 300:
            ok += 1
        print(f"{str(status):>16} {seconds:>6.2f}s  {url}")
    total = time.perf_counter() - start
    print(f"checked {len(rows)} urls in {total:.2f}s "
          f"({ok} ok, {len(rows) - ok} failed, limit {args.limit})")


if __name__ == "__main__":
    asyncio.run(main())
EOF`

const lesson: Lesson = {
  id: 'w28d5',
  tier: 2,
  track: 'python',
  week: 28,
  day: 5,
  title: 'Project: an async URL checker',
  concept: `A URL checker is the classic first async tool: a list of addresses, one request each, and a report of which answered and how fast. Sequentially, forty URLs at half a second each is twenty seconds. Concurrently it is about half a second.

But "all at once" needs a ceiling. A thousand simultaneous requests would exhaust sockets and annoy servers. asyncio.Semaphore(10) is a counter with ten slots: async with sem: waits for a free slot, runs the body, and gives the slot back. Wrap each request in it and at most ten are in flight, however long the list is.

The rest is this week's toolkit: one AsyncClient, gather, a timeout, httpx.HTTPError for failures, and time.perf_counter for the numbers. Read the URLs from a file so the tool is reusable.`,
  example: {
    language: 'python',
    caption: 'A semaphore keeps at most 10 requests in flight',
    code: `sem = asyncio.Semaphore(10)

async def check(client, url):
    async with sem:                     # wait for one of the 10 slots
        started = time.perf_counter()
        try:
            r = await client.get(url)
            return url, r.status_code, time.perf_counter() - started
        except httpx.HTTPError as e:
            return url, type(e).__name__, time.perf_counter() - started

async with httpx.AsyncClient(timeout=5) as client:
    rows = await asyncio.gather(*(check(client, u) for u in urls))`,
  },
  task: {
    kind: 'real',
    intro: `The last project of Tier 2: an async URL checker that reads addresses from a file, checks them with at most 10 requests in flight, and prints the status and elapsed time of each, plus a total line. Finishing this lesson completes Tier 2.

This is done inside the VM (multipass shell stackcraft), in the ~/apis folder from week 23 with its virtual environment. Install httpx into that venv. A complete reference checker.py is in the second step; type it in, read it, and make it yours: change the columns, sort the rows by time, or add a --json flag.

The URL list mixes fast sites, a page that answers 404, one that answers 500, one that takes two seconds, and a host that does not exist, so you can see every kind of outcome in one run. The app never talks to the VM; it only reads what you paste.`,
    steps: [
      {
        instruction: 'Inside the VM, activate the week 23 virtual environment and install httpx. Paste the output of pip show httpx.',
        command: `multipass shell stackcraft
cd ~/apis
source .venv/bin/activate
pip install httpx
pip show httpx`,
        pasteLabel: 'Paste the output of pip show httpx',
        check: [
          { type: 'includes', text: 'Name: httpx' },
          { type: 'regex', pattern: 'Version:\\s*\\d+\\.\\d+', label: 'a Version: line' },
        ],
        hint: 'If ~/apis or .venv is missing, redo the first step of week 23 day 5: mkdir -p ~/apis, python3 -m venv .venv, source .venv/bin/activate. The prompt shows (.venv) when the venv is active.',
        example: `Name: httpx
Version: 0.27.2
Summary: The next generation HTTP client.
Home-page: https://github.com/encode/httpx
Author: Tom Christie
Author-email: tom@tomchristie.com
License: BSD-3-Clause
Location: /home/ubuntu/apis/.venv/lib/python3.12/site-packages
Requires: anyio, certifi, httpcore, idna, sniffio
Required-by:`,
      },
      {
        instruction: 'Create urls.txt and checker.py in ~/apis (both are in the command block), then run the checker with the default limit of 10. Paste the whole output: one row per URL with its status and time, then the total line.',
        command: `${URLS}

${CHECKER}

python3 checker.py urls.txt`,
        pasteLabel: 'Paste the output of python3 checker.py urls.txt',
        check: [
          { type: 'lines', atLeast: 5 },
          { type: 'regex', pattern: '\\b[1-5]\\d\\d\\b', count: 3, label: 'a status code on at least 3 lines' },
          { type: 'regex', pattern: '\\d+\\.\\d+\\s*s\\b', count: 3, label: 'a time in seconds on at least 3 lines' },
          { type: 'regex', pattern: 'checked \\d+ urls in \\d+\\.\\d+s', label: 'a total line like  checked 12 urls in 2.31s' },
          { type: 'not', pattern: 'Traceback', label: 'no traceback' },
        ],
        hint: 'ModuleNotFoundError: httpx means the venv is not active. If every row says ConnectError, the VM has no network: check with ping -c 1 example.com. A traceback inside check means an exception that is not an httpx.HTTPError escaped; read its last line.',
        example: `             200   0.31s  https://example.com
             200   0.48s  https://www.python.org
             200   0.52s  https://docs.python.org/3/
             200   0.44s  https://pypi.org
             200   0.39s  https://github.com
             200   0.35s  https://api.github.com
             200   0.41s  https://www.wikipedia.org
             200   0.63s  https://httpbin.org/get
             404   0.58s  https://httpbin.org/status/404
             500   0.61s  https://httpbin.org/status/500
             200   2.66s  https://httpbin.org/delay/2
    ConnectError   0.02s  https://nope.invalid
checked 12 urls in 2.67s (9 ok, 3 failed, limit 10)`,
      },
      {
        instruction: 'Prove the semaphore matters. Run the checker again with --limit 1, so requests go one at a time, and paste the output. The total should be several times larger than with limit 10, even though every row is about the same.',
        command: 'python3 checker.py urls.txt --limit 1',
        pasteLabel: 'Paste the output of python3 checker.py urls.txt --limit 1',
        check: [
          { type: 'lines', atLeast: 5 },
          { type: 'regex', pattern: '\\b[1-5]\\d\\d\\b', count: 3, label: 'a status code on at least 3 lines' },
          { type: 'regex', pattern: 'checked \\d+ urls in \\d+\\.\\d+s.*limit 1\\b', label: 'a total line ending with  limit 1' },
        ],
        hint: 'If the total is almost the same as before, the semaphore is not wrapping the request: the async with sem: block must contain the await client.get line. Make sure --limit reaches asyncio.Semaphore(args.limit).',
        example: `             200   0.29s  https://example.com
             200   0.45s  https://www.python.org
             200   0.50s  https://docs.python.org/3/
             200   0.42s  https://pypi.org
             200   0.37s  https://github.com
             200   0.33s  https://api.github.com
             200   0.40s  https://www.wikipedia.org
             200   0.60s  https://httpbin.org/get
             404   0.57s  https://httpbin.org/status/404
             500   0.59s  https://httpbin.org/status/500
             200   2.61s  https://httpbin.org/delay/2
    ConnectError   0.01s  https://nope.invalid
checked 12 urls in 7.14s (9 ok, 3 failed, limit 1)`,
      },
    ],
  },
  quiz: [
    { question: 'What does asyncio.Semaphore(10) guarantee?', options: ['Exactly 10 requests are sent', 'At most 10 coroutines are inside their async with sem block at once', 'Each request takes 10 seconds at most'], answer: 1, explanation: 'It is a counter of free slots; the eleventh waits until one of the ten finishes.' },
    { question: 'With limit 1 the total roughly equals what?', options: ['The slowest request', 'The sum of all the request times', 'Zero'], answer: 1, explanation: 'One slot means one request at a time, so the waits add up exactly like synchronous code.' },
    { question: 'Why catch httpx.HTTPError inside check instead of around gather?', options: ['gather cannot be inside try', 'So one failing URL becomes a row in the report instead of cancelling the whole run', 'It is faster'], answer: 1, explanation: 'Handling the error per URL keeps the other results and gives a complete report.' },
  ],
}

export default lesson
