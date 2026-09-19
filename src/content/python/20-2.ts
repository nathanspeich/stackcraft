import type { Lesson } from '../types'
import { codeHas, fileContent, noError, outLines, steps } from '../checks'

const STARTER = `import logging

log = logging.getLogger("shop")
log.handlers.clear()  # the sandbox keeps loggers between runs; start clean
# 1. log.setLevel(logging.DEBUG)

# 2. console handler: WARNING and above, short format

# 3. file handler: everything, with timestamps, into shop.log

# 4. attach both handlers

# 5. log four messages, one per level from DEBUG to ERROR
`

const SOLUTION = `import logging

log = logging.getLogger("shop")
log.handlers.clear()  # the sandbox keeps loggers between runs; start clean
log.setLevel(logging.DEBUG)

console = logging.StreamHandler()
console.setLevel(logging.WARNING)
console.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

logfile = logging.FileHandler("shop.log")
logfile.setLevel(logging.DEBUG)
logfile.setFormatter(logging.Formatter(
    "%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
))

log.addHandler(console)
log.addHandler(logfile)

log.debug("loading catalog")
log.info("%d products loaded", 3)
log.warning("price missing for %s", "Cable")
log.error("checkout failed for order %d", 42)
`

const lesson: Lesson = {
  id: 'w20d2',
  tier: 2,
  track: 'python',
  week: 20,
  day: 2,
  title: 'Formatters and handlers',
  concept: `basicConfig is fine for scripts. Real tools want two destinations at once: a short line on the console for the person watching, and a full record in a file for later. That is what handlers are for.

A logger accepts a message and hands it to each of its handlers. A StreamHandler writes to the terminal, a FileHandler appends to a file. Each handler has its own level and its own Formatter, so the console can show only WARNING and above in a terse form while the file keeps DEBUG and above with timestamps.

The format string names fields from the log record: %(asctime)s, %(levelname)s, %(name)s, %(message)s. datefmt controls the timestamp. Set the logger's own level to DEBUG, or messages are dropped before any handler sees them.`,
  example: {
    language: 'python',
    caption: 'Two handlers, two formats, one logger',
    code: `import logging

log = logging.getLogger("app")
log.setLevel(logging.DEBUG)

console = logging.StreamHandler()
console.setLevel(logging.INFO)
console.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

logfile = logging.FileHandler("app.log")
logfile.setFormatter(logging.Formatter(
    "%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S"))

log.addHandler(console)
log.addHandler(logfile)
log.info("ready")   # console: INFO: ready   file: 09:41:07 INFO ready`,
  },
  task: {
    kind: 'python',
    instructions: 'Give the shop logger a console handler and a file handler.\n1. Set the logger level to DEBUG with log.setLevel(logging.DEBUG).\n2. Create console = logging.StreamHandler(), set its level to WARNING and its formatter to "%(levelname)s: %(message)s".\n3. Create logfile = logging.FileHandler("shop.log") at level DEBUG with the formatter "%(asctime)s %(levelname)s %(name)s %(message)s" and datefmt="%Y-%m-%d %H:%M:%S".\n4. Attach both with log.addHandler.\n5. Log four messages: debug "loading catalog", info "3 products loaded" (pass 3 as a %d argument), warning "price missing for Cable" (Cable as %s), error "checkout failed for order 42" (42 as %d). The console should show only the last two; shop.log should hold all four with timestamps.',
    starter: STARTER,
    hints: [
      'console = logging.StreamHandler(); console.setLevel(logging.WARNING); console.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))',
      'logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")',
      'log.addHandler(console) and log.addHandler(logfile). Without setLevel(DEBUG) on the logger itself, the debug and info lines never reach the file.',
      'log.info("%d products loaded", 3)',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const file = (fileContent(r, 'shop.log') ?? '').replace(/\s+$/, '').split('\n')
      const stamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} /
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /log\.setLevel\(logging\.DEBUG\)/), 'Step 1: log.setLevel(logging.DEBUG).'],
        [codeHas(r, /logging\.StreamHandler\(\)/) && codeHas(r, /setLevel\(logging\.WARNING\)/), 'Step 2: a StreamHandler with its level set to WARNING.'],
        [codeHas(r, /logging\.FileHandler\(\s*["']shop\.log["']\s*\)/) && codeHas(r, /datefmt\s*=\s*["']%Y-%m-%d %H:%M:%S["']/), 'Step 3: logging.FileHandler("shop.log") with a Formatter that has datefmt="%Y-%m-%d %H:%M:%S".'],
        [(r.input.match(/log\.addHandler\(/g) ?? []).length >= 2, 'Step 4: call log.addHandler for both handlers.'],
        [ls.length === 2 && ls[0] === 'WARNING: price missing for Cable' && ls[1] === 'ERROR: checkout failed for order 42', `Step 5: the console should show exactly two lines,  WARNING: price missing for Cable  and  ERROR: checkout failed for order 42  (yours: ${JSON.stringify(ls.join(' | '))}).`],
        [file.length === 4 && file.every((l) => stamp.test(l)), 'Step 5: shop.log should contain four lines, each starting with a timestamp like 2026-09-18 10:12:03.'],
        [/DEBUG shop loading catalog$/.test(file[0] ?? '') && /INFO shop 3 products loaded$/.test(file[1] ?? ''), 'Step 5: the first two file lines should end with  DEBUG shop loading catalog  and  INFO shop 3 products loaded.'],
        [codeHas(r, /log\.info\(\s*"[^"]*%d[^"]*",\s*3\)/) && codeHas(r, /log\.error\(\s*"[^"]*%d[^"]*",\s*42\)/), 'Step 5: pass 3 and 42 as %d arguments rather than writing them into the string.'],
      ], 'Terse on screen, complete on disk. That split is how every server program logs.')
    },
  },
  quiz: [
    { question: 'The logger level is WARNING and the file handler level is DEBUG. What reaches the file?', options: ['Everything from DEBUG up', 'Only WARNING and above, because the logger drops the rest first', 'Nothing'], answer: 1, explanation: 'The logger filters first; a handler can only tighten further, never loosen.' },
    { question: 'What does %(asctime)s insert?', options: ['The elapsed seconds', 'The time the record was created, formatted by datefmt', 'The name of the logger'], answer: 1, explanation: 'asctime is the human-readable timestamp; datefmt chooses its shape.' },
    { question: 'Why give the console and the file different formatters?', options: ['Handlers require unique formatters', 'The person watching wants short lines, while the file needs timestamps and names for later investigation', 'Files cannot store the level name'], answer: 1, explanation: 'Each destination serves a different reader, so each gets its own format.' },
  ],
}

export default lesson
