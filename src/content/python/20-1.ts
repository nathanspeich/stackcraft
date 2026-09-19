import type { Lesson } from '../types'
import { codeHas, noError, outHas, outLines, steps } from '../checks'

const STARTER = `import logging


def sync(files):
    if not files:
        print("nothing to sync")
        return 0
    print("starting sync")
    copied = 0
    for name in files:
        if name.endswith(".tmp"):
            print("skipping temp file", name)
            continue
        print("copied", name)
        copied += 1
    print("done, copied", copied, "files")
    return copied


sync(["a.txt", "b.tmp", "c.txt"])
sync([])
`

const SOLUTION = `import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", force=True)
log = logging.getLogger("sync")


def sync(files):
    if not files:
        log.error("nothing to sync")
        return 0
    log.info("starting sync")
    copied = 0
    for name in files:
        if name.endswith(".tmp"):
            log.warning("skipping temp file %s", name)
            continue
        log.debug("copied %s", name)
        copied += 1
    log.info("done, copied %d files", copied)
    return copied


sync(["a.txt", "b.tmp", "c.txt"])
sync([])
`

const lesson: Lesson = {
  id: 'w20d1',
  tier: 2,
  track: 'python',
  week: 20,
  day: 1,
  title: 'print vs logging and the five levels',
  concept: `print is for program output, the thing the user asked for. Everything else, progress notes, warnings, errors, belongs to logging. The difference is control: a print is always on and always goes to the screen, while a log call carries a level and a name, and one configuration line decides which levels show and where they go.

The five levels, from chattiest to loudest: DEBUG (details for you while developing), INFO (normal milestones), WARNING (something odd but the program continues), ERROR (an operation failed), CRITICAL (the program cannot go on). Setting the level to INFO shows INFO and above, hiding DEBUG.

logging.basicConfig(level=..., format=...) sets up the root logger once. logging.getLogger("sync") gives a named logger. Pass values as arguments, log.info("copied %d files", n), rather than formatting them yourself.`,
  example: {
    language: 'python',
    caption: 'One config line, then messages with levels',
    code: `import logging

logging.basicConfig(level=logging.INFO,
                    format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")

log.debug("connecting to db")     # hidden at INFO
log.info("loaded %d rows", 42)    # INFO app: loaded 42 rows
log.warning("disk at %d%%", 91)   # WARNING app: disk at 91%
log.error("save failed")          # ERROR app: save failed`,
  },
  task: {
    kind: 'python',
    instructions: 'Convert the prints in sync() to logging.\n1. Right after the import, call logging.basicConfig with level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", and force=True (this sandbox keeps loggers alive between runs; force=True resets the handlers).\n2. Create log = logging.getLogger("sync").\n3. Replace every print: "nothing to sync" becomes log.error, "starting sync" and the "done" line become log.info, the temp-file skip becomes log.warning, and each "copied" becomes log.debug. Pass values as arguments with %s and %d, not f-strings.\n4. Run. Expected four lines: INFO starting, WARNING skipping b.tmp, INFO done with 2, ERROR nothing to sync. The DEBUG lines stay hidden.\n5. No print calls may remain.',
    starter: STARTER,
    hints: [
      'logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", force=True)',
      'log.warning("skipping temp file %s", name) and log.info("done, copied %d files", copied)',
      'DEBUG messages are hidden because the level is INFO. Change the level to DEBUG for a moment to see them, then put it back.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /logging\.basicConfig\([^)]*level\s*=\s*logging\.INFO/) && codeHas(r, /force\s*=\s*True/), 'Step 1: logging.basicConfig(level=logging.INFO, format=..., force=True).'],
        [codeHas(r, /%\(levelname\)s %\(name\)s: %\(message\)s/), 'Step 1: use the format "%(levelname)s %(name)s: %(message)s".'],
        [codeHas(r, /logging\.getLogger\(\s*["']sync["']\s*\)/), 'Step 2: log = logging.getLogger("sync").'],
        [!codeHas(r, /^\s*print\(/m), 'Step 5: a print call is still there. Every message should go through log.'],
        [codeHas(r, /log\.debug\(/) && codeHas(r, /log\.warning\(/) && codeHas(r, /log\.error\(/) && codeHas(r, /log\.info\(/), 'Step 3: use log.debug for copied, log.warning for the skip, log.error for nothing to sync, and log.info for the rest.'],
        [codeHas(r, /log\.\w+\(\s*"[^"]*%[sd][^"]*",/), 'Step 3: pass values as arguments, for example log.warning("skipping temp file %s", name).'],
        [ls[0] === 'INFO sync: starting sync', `Step 4: the first line should be  INFO sync: starting sync  (yours: ${JSON.stringify(ls[0] ?? '')}).`],
        [ls[1] === 'WARNING sync: skipping temp file b.tmp', 'Step 4: the second line should be  WARNING sync: skipping temp file b.tmp'],
        [ls[2] === 'INFO sync: done, copied 2 files', 'Step 4: the third line should be  INFO sync: done, copied 2 files'],
        [ls[3] === 'ERROR sync: nothing to sync', 'Step 4: the last line should be  ERROR sync: nothing to sync'],
        [!outHas(r, /DEBUG/), 'Step 4: DEBUG lines should be hidden at level INFO.'],
      ], 'Same program, but now one line decides how much it says and where.')
    },
  },
  quiz: [
    { question: 'With the level set to WARNING, which calls produce output?', options: ['warning, error, and critical', 'Only warning', 'debug, info, and warning'], answer: 0, explanation: 'A level shows itself and everything more severe.' },
    { question: 'Why log.info("copied %d files", n) instead of log.info(f"copied {n} files")?', options: ['f-strings are not allowed in logging', 'The message is only formatted if that level is enabled, and log tools can group identical messages', 'It is shorter'], answer: 1, explanation: 'Lazy formatting skips work for hidden levels and keeps the message template stable.' },
    { question: 'When is print the right choice?', options: ['Never in real programs', 'For the actual output of the program, the thing the user asked for', 'For error messages'], answer: 1, explanation: 'Results go to print (stdout); commentary about the run goes to logging.' },
  ],
}

export default lesson
