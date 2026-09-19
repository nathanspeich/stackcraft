import type { Lesson } from '../types'
import { codeHas, fileExists, noError, outHas, steps } from '../checks'

const STARTER = `import logging
from logging.handlers import RotatingFileHandler

log = logging.getLogger("worker")
log.handlers.clear()  # the sandbox keeps loggers between runs; start clean
log.setLevel(logging.DEBUG)

# 1. rotating file handler: worker.log, maxBytes=600, backupCount=3

# 2. console handler at INFO with "%(levelname)s: %(message)s"


def process(job):
    if job % 7 == 0:
        raise ValueError(f"job {job} has a bad payload")
    return job * 2


done = 0
for job in range(1, 13):
    print("job", job, "started")
    result = process(job)
    print("job", job, "done:", result)
    done += 1
print("finished", done, "jobs")
`

const SOLUTION = `import logging
from logging.handlers import RotatingFileHandler

log = logging.getLogger("worker")
log.handlers.clear()  # the sandbox keeps loggers between runs; start clean
log.setLevel(logging.DEBUG)

rotating = RotatingFileHandler("worker.log", maxBytes=600, backupCount=3)
rotating.setFormatter(logging.Formatter(
    "%(asctime)s %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
console = logging.StreamHandler()
console.setLevel(logging.INFO)
console.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
log.addHandler(rotating)
log.addHandler(console)


def process(job):
    if job % 7 == 0:
        raise ValueError(f"job {job} has a bad payload")
    return job * 2


done = 0
for job in range(1, 13):
    log.debug("job %d started", job)
    try:
        result = process(job)
    except ValueError:
        log.exception("job %d failed", job)
        continue
    log.debug("job %d done: %d", job, result)
    done += 1
log.info("finished %d jobs", done)
`

const lesson: Lesson = {
  id: 'w20d4',
  tier: 2,
  track: 'python',
  week: 20,
  day: 4,
  title: 'Rotating files and logging exceptions',
  concept: `A log file that grows forever eventually fills the disk. RotatingFileHandler from logging.handlers caps it: when the file reaches maxBytes it is renamed to worker.log.1, the old .1 becomes .2, and so on up to backupCount, then the oldest is deleted. Servers use this or its cousin TimedRotatingFileHandler for daily files.

When something fails inside an except block, log.exception("job %d failed", job) records the message at ERROR level and appends the full traceback. The same effect comes from log.error(..., exc_info=True). A traceback in the log is what turns "it broke last night" into a fix.

What is worth logging? Milestones and counts at INFO, anything you would want at 3 a.m. at ERROR with the traceback, and the noisy details at DEBUG where they cost nothing until you need them.`,
  example: {
    language: 'python',
    caption: 'Rotation plus a traceback in the log',
    code: `from logging.handlers import RotatingFileHandler
import logging

log = logging.getLogger("app")
log.setLevel(logging.DEBUG)
log.addHandler(RotatingFileHandler("app.log", maxBytes=1_000_000, backupCount=5))

try:
    risky()
except OSError:
    log.exception("risky failed")   # message plus full traceback
# app.log, app.log.1, ... app.log.5 at most`,
  },
  task: {
    kind: 'python',
    instructions: 'Give the worker a rotating log and survive the bad job.\n1. Create RotatingFileHandler("worker.log", maxBytes=600, backupCount=3) with a Formatter "%(asctime)s %(levelname)s %(message)s" and datefmt="%Y-%m-%d %H:%M:%S". Add it to log.\n2. Create a StreamHandler at level INFO with the format "%(levelname)s: %(message)s" and add it too.\n3. Replace the prints inside the loop with log.debug calls: "job %d started" and "job %d done: %d".\n4. Wrap process(job) in try/except ValueError. In the except block call log.exception("job %d failed", job) and continue, so the loop keeps going.\n5. Replace the final print with log.info("finished %d jobs", done). Run: the console shows the ERROR with its traceback and  INFO: finished 11 jobs; the file rotated into worker.log.1 and more.',
    starter: STARTER,
    hints: [
      'rotating = RotatingFileHandler("worker.log", maxBytes=600, backupCount=3); rotating.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")); log.addHandler(rotating)',
      'try:\n    result = process(job)\nexcept ValueError:\n    log.exception("job %d failed", job)\n    continue',
      'log.exception must be called inside an except block; that is where it finds the traceback.',
      'With 600 bytes per file, about 23 debug lines plus one traceback need three files. Look at r.fs after the run: worker.log, worker.log.1, worker.log.2.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const logs = Object.entries(r.fs ?? {}).filter(([p]) => /^worker\.log(\.\d+)?$/.test(p)).map(([, c]) => c ?? '')
      const all = logs.join('\n')
      return steps([
        [noError(r), 'Your program raised an error. Step 4: catch the ValueError from job 7 so the loop continues.'],
        [codeHas(r, /RotatingFileHandler\(\s*["']worker\.log["'],\s*maxBytes\s*=\s*600,\s*backupCount\s*=\s*3\s*\)/), 'Step 1: RotatingFileHandler("worker.log", maxBytes=600, backupCount=3).'],
        [codeHas(r, /datefmt\s*=\s*["']%Y-%m-%d %H:%M:%S["']/), 'Step 1: give the file formatter datefmt="%Y-%m-%d %H:%M:%S".'],
        [codeHas(r, /logging\.StreamHandler\(\)/) && codeHas(r, /setLevel\(logging\.INFO\)/), 'Step 2: a StreamHandler with its level set to INFO.'],
        [!codeHas(r, /^\s*print\(/m) && codeHas(r, /log\.debug\(\s*"job %d started"/), 'Step 3: replace the prints with log.debug("job %d started", job) and log.debug("job %d done: %d", job, result).'],
        [codeHas(r, /except ValueError:/) && codeHas(r, /log\.exception\(\s*"job %d failed",\s*job\)/), 'Step 4: except ValueError: then log.exception("job %d failed", job) and continue.'],
        [outHas(r, /ERROR: job 7 failed/) && outHas(r, /Traceback \(most recent call last\)/) && outHas(r, /ValueError: job 7 has a bad payload/), 'Step 4: the console should show  ERROR: job 7 failed  followed by the traceback ending in ValueError: job 7 has a bad payload.'],
        [outHas(r, /INFO: finished 11 jobs/), 'Step 5: end with log.info("finished %d jobs", done), which should say 11.'],
        [!outHas(r, /DEBUG/), 'Step 2: DEBUG lines should not reach the console; only the file gets them.'],
        [fileExists(r, 'worker.log.1'), 'Step 1: worker.log.1 is missing. With maxBytes=600 the file should rotate at least once. Are the debug lines going to the file?'],
        [/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} DEBUG job 1 started/.test(all) && all.includes('Traceback (most recent call last)'), 'Step 4: the log files should contain the timestamped DEBUG lines and the traceback from job 7.'],
      ], 'Bounded files, a traceback where it belongs, and the loop finished its work.')
    },
  },
  quiz: [
    { question: 'What happens when worker.log reaches maxBytes with backupCount=3?', options: ['Logging stops', 'It is renamed worker.log.1, older backups shift up, and anything past .3 is deleted', 'It is emptied and overwritten'], answer: 1, explanation: 'Rotation keeps a fixed number of files, so disk use stays bounded.' },
    { question: 'Where must log.exception be called?', options: ['Anywhere', 'Inside an except block, so it can capture the current traceback', 'Only in the main module'], answer: 1, explanation: 'It reads the exception being handled; outside except there is none.' },
    { question: 'Which is the best fit for DEBUG level?', options: ['A failed payment with its traceback', 'Every job started and finished, useful only when investigating', 'The daily total'], answer: 1, explanation: 'DEBUG is for noisy detail that costs nothing while hidden and everything when you need it.' },
  ],
}

export default lesson
