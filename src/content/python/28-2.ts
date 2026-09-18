import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const HEAD = `import asyncio
import time

PRICES = {"apple": 1.2, "bread": 2.5, "cheese": 6.0, "dates": 4.4}
DELAYS = {"apple": 0.1, "bread": 0.3, "cheese": 0.2, "dates": 0.15}


async def fetch_price(item):
    """Pretend to ask a slow shop for a price."""
    await asyncio.sleep(DELAYS.get(item, 0.1))
    if item not in PRICES:
        raise KeyError(item)
    return PRICES[item]
`

const STARTER = HEAD + `

async def main():
    start = time.perf_counter()
    # 1. gather the four prices and print item: price

    print(f"total: {time.perf_counter() - start:.1f}s")

    # 2. gather again with a bad item and return_exceptions=True

    # 3. a task with a deadline


asyncio.run(main())
`

const SOLUTION = HEAD + `

async def main():
    start = time.perf_counter()
    # 1. gather the four prices and print item: price
    items = list(PRICES)
    prices = await asyncio.gather(*(fetch_price(item) for item in items))
    for item, price in zip(items, prices):
        print(f"{item}: {price}")
    print(f"total: {time.perf_counter() - start:.1f}s")

    # 2. gather again with a bad item and return_exceptions=True
    items = ["apple", "ghost"]
    results = await asyncio.gather(*(fetch_price(item) for item in items), return_exceptions=True)
    for item, result in zip(items, results):
        if isinstance(result, Exception):
            print(f"{item}: failed ({type(result).__name__})")
        else:
            print(f"{item}: {result}")

    # 3. a task with a deadline
    task = asyncio.create_task(fetch_price("bread"))
    try:
        price = await asyncio.wait_for(task, timeout=0.1)
        print(f"bread: {price}")
    except TimeoutError:
        print("bread: timed out")


asyncio.run(main())
`

const lesson: Lesson = {
  id: 'w28d2',
  tier: 2,
  track: 'python',
  week: 28,
  day: 2,
  title: 'asyncio.gather and tasks',
  concept: `asyncio.gather(a(), b(), c()) runs several coroutines at once and gives back their results as a list in the same order you passed them. The total time is the slowest one, not the sum. If one raises, gather raises too, unless you pass return_exceptions=True, in which case the exception sits in the results list where its value would have been, and you can check it with isinstance.

A task is a coroutine the loop has already scheduled. asyncio.create_task(coro) starts it right away; you can do other things and await the task later. Tasks can be cancelled with task.cancel().

asyncio.wait_for(awaitable, timeout=2) gives any wait a deadline: it raises TimeoutError if the time runs out. A network client without deadlines is a client that hangs.`,
  example: {
    language: 'python',
    caption: 'Results in order, one failure kept, and a deadline',
    code: `results = await asyncio.gather(
    fetch("a"), fetch("b"), fetch("bad"),
    return_exceptions=True)
for name, res in zip(["a", "b", "bad"], results):
    if isinstance(res, Exception):
        print(name, "failed:", res)

task = asyncio.create_task(fetch("slow"))   # runs from now on
try:
    print(await asyncio.wait_for(task, timeout=0.5))
except TimeoutError:
    print("gave up on slow")`,
  },
  task: {
    kind: 'python',
    instructions: 'fetch_price(item) answers after a short delay and raises KeyError for unknown items.\n1. Gather the prices of the four items in PRICES (list(PRICES) keeps their order), then print one line per item like  apple: 1.2 . The total line that follows should be near 0.3s, the slowest delay.\n2. Gather ["apple", "ghost"] with return_exceptions=True. For each result print  apple: 1.2 , or  ghost: failed (KeyError)  when isinstance(result, Exception), using type(result).__name__.\n3. Start fetch_price("bread") with asyncio.create_task, then await it through asyncio.wait_for with timeout=0.1. Print  bread: timed out  in the except TimeoutError branch (bread takes 0.3s).',
    starter: STARTER,
    hints: [
      'prices = await asyncio.gather(*(fetch_price(item) for item in items)) then zip(items, prices)',
      'results = await asyncio.gather(..., return_exceptions=True); if isinstance(result, Exception): print(f"{item}: failed ({type(result).__name__})")',
      'task = asyncio.create_task(fetch_price("bread")) then price = await asyncio.wait_for(task, timeout=0.1)',
      'except TimeoutError: print("bread: timed out")',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const total = parseFloat(/total: ([\d.]+)s/.exec(r.output)?.[1] ?? 'NaN')
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /asyncio\.gather\(/), 'Step 1: use await asyncio.gather(...) over the four fetch_price calls.'],
        [ls.slice(0, 4).join('|') === 'apple: 1.2|bread: 2.5|cheese: 6.0|dates: 4.4', `Step 1: print  apple: 1.2 ,  bread: 2.5 ,  cheese: 6.0 ,  dates: 4.4  in that order (yours: ${JSON.stringify(ls.slice(0, 4))}).`],
        [total >= 0.25 && total < 0.6, `Step 1: the total should be near 0.3s, the slowest delay, not the sum (yours: ${Number.isNaN(total) ? 'missing' : total}).`],
        [codeHas(r, /return_exceptions\s*=\s*True/) && codeHas(r, /isinstance\(/), 'Step 2: gather with return_exceptions=True and check each result with isinstance(result, Exception).'],
        [ls[5] === 'apple: 1.2' && ls[6] === 'ghost: failed (KeyError)', `Step 2: after the total line print  apple: 1.2  then  ghost: failed (KeyError)  (yours: ${JSON.stringify(ls.slice(5, 7))}).`],
        [codeHas(r, /asyncio\.create_task\(/) && codeHas(r, /asyncio\.wait_for\(/), 'Step 3: create the task with asyncio.create_task and await it with asyncio.wait_for(task, timeout=0.1).'],
        [ls[7] === 'bread: timed out', 'Step 3: the last line should be  bread: timed out  from the except TimeoutError branch.'],
      ], 'Results in order, failures kept, and a deadline. Those three cover most real async code.')
    },
  },
  quiz: [
    { question: 'In what order does asyncio.gather return results?', options: ['Fastest first', 'The order you passed the coroutines, whatever finished first', 'Random'], answer: 1, explanation: 'gather lines results up with its arguments, so zip(items, results) is safe.' },
    { question: 'What does return_exceptions=True change?', options: ['Exceptions are ignored', 'A failed coroutine puts its exception in the results list instead of raising from gather', 'gather retries the failure'], answer: 1, explanation: 'The other coroutines keep their results and you decide what to do with the failures.' },
    { question: 'When does a task made with asyncio.create_task start running?', options: ['When you await it', 'As soon as the loop gets a chance, right after create_task', 'Only inside gather'], answer: 1, explanation: 'create_task schedules it immediately; await later just collects the result.' },
  ],
}

export default lesson
