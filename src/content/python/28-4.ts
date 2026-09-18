import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `import asyncio
import time

NAMES = ["a", "b", "c", "d", "e"]


async def fetch(name, seconds):
    """Pretend to fetch something that takes a while."""
    time.sleep(seconds)
    return f"{name} ok"


async def main():
    start = time.perf_counter()

    first = fetch("warmup", 0.1)
    print(first)

    coros = [fetch(name, 0.1) for name in NAMES]
    results = coros
    for result in results:
        print(result)

    print(f"total: {time.perf_counter() - start:.1f}s")


asyncio.run(main())
`

const SOLUTION = `import asyncio
import time

NAMES = ["a", "b", "c", "d", "e"]


async def fetch(name, seconds):
    """Pretend to fetch something that takes a while."""
    await asyncio.sleep(seconds)
    return f"{name} ok"


async def main():
    start = time.perf_counter()

    first = await fetch("warmup", 0.1)
    print(first)

    coros = [fetch(name, 0.1) for name in NAMES]
    results = await asyncio.gather(*coros)
    for result in results:
        print(result)

    print(f"total: {time.perf_counter() - start:.1f}s")


asyncio.run(main())
`

const lesson: Lesson = {
  id: 'w28d4',
  tier: 2,
  track: 'python',
  week: 28,
  day: 4,
  title: 'When async is the wrong tool',
  concept: `Async shines when a program waits on many slow things at once: web requests, sockets, subprocesses. It does nothing for CPU work. A loop crunching numbers inside a coroutine blocks the event loop exactly like time.sleep does, because only one line of Python runs at a time. For heavy computation use multiprocessing, or stay synchronous.

Sometimes you must call a blocking library (an old database driver) from async code. await asyncio.to_thread(func, *args) runs it in a worker thread and awaits the result, so the loop keeps going. The in-app runner has no threads, so that stays on the real machine.

Three classic mistakes: forgetting await, so nothing runs; time.sleep inside a coroutine, which freezes everything; and building coroutines without gathering them, so they never execute. Timing exposes all three.`,
  example: {
    language: 'python',
    caption: 'Blocking work moved to a thread so the loop keeps running',
    code: `import asyncio, hashlib

def slow_hash(data):                # ordinary blocking function
    return hashlib.sha256(data).hexdigest()

async def main():
    digest, _ = await asyncio.gather(
        asyncio.to_thread(slow_hash, b"x" * 50_000_000),
        heartbeat(),                # keeps ticking while the hash runs
    )
    print(digest[:12])

# On the real machine only: the in-app sandbox has no threads.`,
  },
  task: {
    kind: 'python',
    instructions: 'The starter runs without an error but its output is wrong and its timing is a lie. Find and fix three mistakes. Correct output is  warmup ok , then  a ok  to  e ok , then  total: 0.2s .\n1. fetch uses time.sleep, which blocks the loop. Use await asyncio.sleep(seconds).\n2. The warmup call is missing await, so first is a coroutine object. Await it.\n3. The five coroutines are never run. Gather them with await asyncio.gather(*coros).\n4. Run it: the total should be about 0.2s (0.1 for the warmup plus 0.1 for the five together). If it says 0.6s, the five are running one after another.',
    starter: STARTER,
    hints: [
      'Replace time.sleep(seconds) with await asyncio.sleep(seconds) inside fetch.',
      'first = await fetch("warmup", 0.1)',
      'results = await asyncio.gather(*coros)',
      'A total of 0.6s means the fetches are awaited one by one in a loop instead of gathered.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const total = parseFloat(/total: ([\d.]+)s/.exec(r.output)?.[1] ?? 'NaN')
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [!codeHas(r, /time\.sleep\(/) && codeHas(r, /await asyncio\.sleep\(/), 'Step 1: fetch must use await asyncio.sleep(seconds), not time.sleep.'],
        [ls[0] === 'warmup ok' && codeHas(r, /await fetch\(\s*["']warmup["']/), `Step 2: await the warmup call so the first line is  warmup ok  (yours: ${JSON.stringify(ls[0] ?? '')}).`],
        [ls.slice(1, 6).join('|') === 'a ok|b ok|c ok|d ok|e ok' && codeHas(r, /asyncio\.gather\(/), 'Step 3: gather the coroutines so lines 2 to 6 are  a ok  through  e ok .'],
        [total >= 0.15 && total < 0.4, `Step 4: total should be about 0.2s (yours: ${Number.isNaN(total) ? 'missing' : total}). Near 0.6s means the fetches run one after another.`],
      ], 'Three silent bugs found by reading the output and the clock. Keep doing that.')
    },
  },
  quiz: [
    { question: 'A coroutine runs a tight loop summing a billion numbers. What happens to the other coroutines?', options: ['They run in parallel on other cores', 'They wait; the loop is blocked until the sum finishes', 'They are cancelled'], answer: 1, explanation: 'CPU work never yields to the event loop. Async only overlaps waiting.' },
    { question: 'What is asyncio.to_thread for?', options: ['Making a coroutine faster', 'Running a blocking function in a worker thread so the loop can keep going', 'Creating new event loops'], answer: 1, explanation: 'It wraps a blocking call so async code can await it without freezing.' },
    { question: 'You print a value and see <coroutine object fetch at 0x...>. What went wrong?', options: ['The server returned an object', 'You forgot to await the call', 'fetch needs to be a class'], answer: 1, explanation: 'Calling an async function gives a coroutine object; only await (or a task) runs it.' },
  ],
}

export default lesson
