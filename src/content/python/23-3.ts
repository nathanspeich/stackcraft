import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const FAKE = `import time


class Timeout(Exception):
    """Raised when the server does not answer in time."""


class FakeResponse:
    def __init__(self, status_code, data, headers=None):
        self.status_code = status_code
        self._data = data
        self.headers = headers or {}

    def json(self):
        return self._data


# Three pages of items, then an empty page that means "no more".
PAGES = {
    1: [f"item-{n}" for n in range(1, 11)],
    2: [f"item-{n}" for n in range(11, 21)],
    3: [f"item-{n}" for n in range(21, 26)],
}

# What the server does on each call, in order. A real server is just less predictable.
SCRIPT = ["timeout", 200, 503, 429, 200, 200, 200]
calls = 0


def fake_fetch(page):
    """Pretend to GET /items?page=N. Fails now and then, like a real server."""
    global calls
    calls += 1
    outcome = SCRIPT[calls - 1] if calls <= len(SCRIPT) else 200
    if outcome == "timeout":
        raise Timeout("no answer after 5 seconds")
    if outcome == 429:
        return FakeResponse(429, {"error": "slow down"}, {"Retry-After": "1"})
    if outcome != 200:
        return FakeResponse(outcome, {"error": "server hiccup"})
    return FakeResponse(200, PAGES.get(page, []))
`

const STARTER = FAKE + `

# 1. fetch_with_retry(page, attempts=3): retry on Timeout, 5xx, and 429


# 2. Walk the pages until one comes back empty
items = []

# 3. Report
`

const SOLUTION = FAKE + `

# 1. fetch_with_retry(page, attempts=3): retry on Timeout, 5xx, and 429
def fetch_with_retry(page, attempts=3):
    for attempt in range(1, attempts + 1):
        try:
            r = fake_fetch(page)
        except Timeout:
            print(f"page {page}: timeout, retry {attempt}")
            time.sleep(0.1 * attempt)
            continue
        if r.status_code == 200:
            return r
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After", "1"))
            print(f"page {page}: rate limited, waiting {wait}s")
            time.sleep(wait)
            continue
        if r.status_code >= 500:
            print(f"page {page}: server error {r.status_code}, retry {attempt}")
            time.sleep(0.1 * attempt)
            continue
        raise RuntimeError(f"page {page}: unexpected status {r.status_code}")
    raise RuntimeError(f"page {page}: gave up after {attempts} attempts")


# 2. Walk the pages until one comes back empty
items = []
page = 1
while True:
    batch = fetch_with_retry(page).json()
    if not batch:
        break
    items.extend(batch)
    page += 1

# 3. Report
print(f"fetched {len(items)} items in {calls} calls")
`

const lesson: Lesson = {
  id: 'w23d3',
  tier: 2,
  track: 'python',
  week: 23,
  day: 3,
  title: 'Pagination, rate limits, timeouts, retries',
  concept: `APIs rarely hand over everything at once. They page: ?page=2 or ?per_page=100, or a next cursor in the response. Your loop asks for page after page until one comes back empty or the next link is missing.

Servers also protect themselves. Ask too fast and you get 429 Too Many Requests, often with a Retry-After header saying how many seconds to wait. Respect it.

Then there is plain failure: a timeout, a 503 while the server restarts. These are temporary, so retry a few times with a growing pause (backoff). But never retry a 4xx like 404 or 401. Asking again will not make a missing page appear.

Today the server is a fake function with scripted failures, so you can watch your retry loop handle every case.`,
  example: {
    language: 'python',
    caption: 'The shape of a retry loop with backoff',
    code: `import time

def get_with_retry(url, attempts=3):
    for attempt in range(1, attempts + 1):
        try:
            r = requests.get(url, timeout=5)
        except requests.exceptions.Timeout:
            time.sleep(0.5 * attempt)     # backoff, then try again
            continue
        if r.status_code == 429:
            time.sleep(int(r.headers.get("Retry-After", "1")))
            continue
        if r.status_code < 500:
            return r                      # success or a 4xx we must not retry
        time.sleep(0.5 * attempt)         # 5xx: try again
    raise RuntimeError("gave up after 3 attempts")`,
  },
  task: {
    kind: 'python',
    instructions: 'fake_fetch(page) plays a flaky server: read SCRIPT to see what it will do. Write the client that survives it.\n1. Write fetch_with_retry(page, attempts=3). Loop attempts times: call fake_fetch(page). On Timeout print  page 1: timeout, retry 1  and try again after time.sleep(0.1 * attempt). On 429 read the Retry-After header, print  page 2: rate limited, waiting 1s , sleep that long, and try again. On a status of 500 or more print  page 2: server error 503, retry 1  and try again. On 200 return the response. After the loop raise RuntimeError.\n2. Walk the pages starting at 1: call fetch_with_retry(page).json(), stop when the list is empty, otherwise extend items and move to the next page.\n3. Print  fetched 25 items in 7 calls  using len(items) and the calls counter.',
    starter: STARTER,
    hints: [
      'for attempt in range(1, attempts + 1): try: r = fake_fetch(page) except Timeout: print(...); time.sleep(0.1 * attempt); continue',
      'wait = int(r.headers.get("Retry-After", "1")); time.sleep(wait)',
      'page = 1 then while True: batch = fetch_with_retry(page).json(); if not batch: break; items.extend(batch); page += 1',
      'The calls variable is already counted for you by fake_fetch.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /def fetch_with_retry\(\s*page\s*,\s*attempts\s*=\s*3\s*\)/), 'Step 1: define fetch_with_retry(page, attempts=3).'],
        [codeHas(r, /except Timeout/) && codeHas(r, /time\.sleep\(/), 'Step 1: catch Timeout and pause with time.sleep before retrying.'],
        [codeHas(r, /Retry-After/), 'Step 1: on a 429 read the Retry-After header from r.headers.'],
        [ls[0] === 'page 1: timeout, retry 1', `Step 1: the first line should be  page 1: timeout, retry 1  (yours: ${JSON.stringify(ls[0] ?? '')}).`],
        [ls[1] === 'page 2: server error 503, retry 1', 'Step 1: the second line should be  page 2: server error 503, retry 1 .'],
        [ls[2] === 'page 2: rate limited, waiting 1s', 'Step 1: the third line should be  page 2: rate limited, waiting 1s .'],
        [codeHas(r, /\.extend\(|\+=\s*batch/) && codeHas(r, /page\s*\+=\s*1/), 'Step 2: extend items with each page and do page += 1 until a page is empty.'],
        [ls[3] === 'fetched 25 items in 7 calls', `Step 3: the last line should be  fetched 25 items in 7 calls  (yours: ${JSON.stringify(ls[3] ?? '')}).`],
      ], 'Timeouts, hiccups, and a rate limit, and your client got every item anyway.')
    },
  },
  quiz: [
    { question: 'Which status should you NOT retry?', options: ['503', '404', 'A timeout'], answer: 1, explanation: '404 means the thing is not there; retrying will not change that. 5xx and timeouts are usually temporary.' },
    { question: 'What does the Retry-After header on a 429 tell you?', options: ['How many requests you have left', 'How long to wait before asking again', 'Which page to fetch next'], answer: 1, explanation: 'It is the server saying "wait this many seconds", and polite clients do.' },
    { question: 'Why grow the pause between retries (backoff)?', options: ['So a struggling server gets room to recover instead of a flood of retries', 'Python requires it', 'It makes the first attempt faster'], answer: 0, explanation: 'Hammering a server that is already failing makes it worse for everyone.' },
  ],
}

export default lesson
