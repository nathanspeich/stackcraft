import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `import time

DOWNLOADS = [("photo.jpg", 0.2), ("song.mp3", 0.2), ("notes.txt", 0.2)]


def download(name, seconds):
    """Pretend to download a file: the wait stands in for the network."""
    time.sleep(seconds)
    print(f"done {name}")


start = time.perf_counter()
for name, seconds in DOWNLOADS:
    download(name, seconds)
print(f"sequential: {time.perf_counter() - start:.1f}s")
`

const SOLUTION = `import asyncio
import time

DOWNLOADS = [("photo.jpg", 0.2), ("song.mp3", 0.2), ("notes.txt", 0.2)]


async def download(name, seconds):
    """Pretend to download a file: the wait stands in for the network."""
    await asyncio.sleep(seconds)
    print(f"done {name}")


async def main():
    start = time.perf_counter()
    for name, seconds in DOWNLOADS:
        await download(name, seconds)
    print(f"sequential: {time.perf_counter() - start:.1f}s")

    start = time.perf_counter()
    await asyncio.gather(*(download(name, s) for name, s in DOWNLOADS))
    print(f"concurrent: {time.perf_counter() - start:.1f}s")


asyncio.run(main())
`

const lesson: Lesson = {
  id: 'w28d1',
  tier: 2,
  track: 'python',
  week: 28,
  day: 1,
  title: 'The event loop, async and await',
  concept: `Most of the time a network program is not computing, it is waiting: for a server to answer, for a file to arrive. In ordinary (synchronous) code, waiting means the whole program stops. Three downloads of one second each take three seconds.

Async code lets one program keep several waits going at once. An async def function is a coroutine. Inside it, await something means: I am waiting here, run something else meanwhile. That something else is chosen by the event loop, a scheduler that hops between coroutines whenever one is waiting.

Only one line of Python runs at any moment, so async speeds up waiting, not computing. asyncio.sleep(1) is a wait the loop can hop away from; time.sleep(1) freezes everything. asyncio.run(main()) starts the loop.`,
  example: {
    language: 'python',
    caption: 'A coroutine, awaited by another coroutine, started by asyncio.run',
    code: `import asyncio

async def fetch(name):
    print("start", name)
    await asyncio.sleep(1)      # hand control back while waiting
    print("done", name)
    return name.upper()

async def main():
    result = await fetch("a")   # wait for it and get the return value
    print(result)

asyncio.run(main())             # start the event loop`,
  },
  task: {
    kind: 'python',
    instructions: 'Turn the sequential downloader into an async one and measure both ways.\n1. Import asyncio. Make download an async def and replace time.sleep with await asyncio.sleep(seconds).\n2. Write async def main(). Inside, time a loop that awaits download for each entry of DOWNLOADS one after another, then print  sequential: 0.6s  (one decimal).\n3. Then time the same three downloads run together with await asyncio.gather(...) and print  concurrent: 0.2s .\n4. Start it all with asyncio.run(main()) at the bottom.',
    starter: STARTER,
    hints: [
      'async def download(name, seconds): await asyncio.sleep(seconds); print(f"done {name}")',
      'Inside main: for name, seconds in DOWNLOADS: await download(name, seconds)',
      'await asyncio.gather(*(download(name, s) for name, s in DOWNLOADS)) runs the three coroutines together.',
      'A coroutine only runs when awaited. Calling download(...) without await does nothing (Python warns "coroutine was never awaited").',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const seq = parseFloat(/sequential: ([\d.]+)s/.exec(r.output)?.[1] ?? 'NaN')
      const con = parseFloat(/concurrent: ([\d.]+)s/.exec(r.output)?.[1] ?? 'NaN')
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /async def download\(/) && codeHas(r, /await asyncio\.sleep\(/) && !codeHas(r, /time\.sleep\(/), 'Step 1: download must be async def and use await asyncio.sleep(seconds), not time.sleep.'],
        [codeHas(r, /async def main\(\)/) && codeHas(r, /await download\(/), 'Step 2: write async def main() that awaits download for each entry in a loop.'],
        [ls.slice(0, 3).join('|') === 'done photo.jpg|done song.mp3|done notes.txt' && seq >= 0.5 && seq < 1.2, `Step 2: the three done lines then  sequential: 0.6s  (a value near 0.6; yours: ${JSON.stringify(ls[3] ?? '')}).`],
        [codeHas(r, /asyncio\.gather\(/) && con >= 0.15 && con < 0.45, `Step 3: await asyncio.gather(...) over the three downloads and print  concurrent: 0.2s  (a value near 0.2; yours: ${Number.isNaN(con) ? 'missing' : con}).`],
        [codeHas(r, /^asyncio\.run\(main\(\)\)/m), 'Step 4: start the loop with asyncio.run(main()) at the bottom of the file.'],
      ], 'Three waits that used to add up now overlap. That is the whole point of async.')
    },
  },
  quiz: [
    { question: 'What does await asyncio.sleep(1) do that time.sleep(1) does not?', options: ['Sleeps more precisely', 'Lets the event loop run other coroutines during the wait', 'Sleeps in a separate process'], answer: 1, explanation: 'time.sleep blocks the only thread; asyncio.sleep hands control back to the loop.' },
    { question: 'What happens if you call an async function without await?', options: ['It runs in the background', 'It returns a coroutine object that never runs', 'Python raises SyntaxError'], answer: 1, explanation: 'You get a coroutine object and a "never awaited" warning; nothing inside it executes.' },
    { question: 'Does async make a CPU-heavy loop faster?', options: ['No, only one line of Python runs at a time; async only overlaps waiting', 'Yes, it uses every core', 'Only on Linux'], answer: 0, explanation: 'Async is about not idling while waiting on I/O, not about parallel computation.' },
  ],
}

export default lesson
