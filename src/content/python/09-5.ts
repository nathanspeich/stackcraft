import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const LOG = `192.168.1.10 - - [17/Sep/2026:08:01:02] "GET /index.html HTTP/1.1" 200 1043
192.168.1.11 - - [17/Sep/2026:08:01:05] "GET /about.html HTTP/1.1" 200 2210
192.168.1.10 - - [17/Sep/2026:08:01:09] "GET /favicon.ico HTTP/1.1" 404 209
203.0.113.9 - - [17/Sep/2026:08:02:00] "GET /admin HTTP/1.1" 403 153
192.168.1.12 - - [17/Sep/2026:08:02:31] "GET /index.html HTTP/1.1" 200 1043
192.168.1.11 - - [17/Sep/2026:08:03:12] "POST /login HTTP/1.1" 302 0
192.168.1.11 - - [17/Sep/2026:08:03:13] "GET /dashboard HTTP/1.1" 200 5120
203.0.113.9 - - [17/Sep/2026:08:04:44] "GET /wp-login.php HTTP/1.1" 404 209
192.168.1.13 - - [17/Sep/2026:08:05:01] "GET /index.html HTTP/1.1" 200 1043
192.168.1.10 - - [17/Sep/2026:08:05:40] "GET /api/items HTTP/1.1" 500 87
192.168.1.12 - - [17/Sep/2026:08:06:02] "GET /about.html HTTP/1.1" 200 2210
192.168.1.13 - - [17/Sep/2026:08:06:30] "GET /api/items HTTP/1.1" 200 3300
`

const lesson: Lesson = {
  id: 'w09d5',
  tier: 1,
  track: 'python',
  week: 9,
  day: 5,
  title: 'Mini project: a log parser CLI',
  concept: `Time to combine the week. A web server writes one line per request in a fixed shape: client address, timestamp in brackets, the request in quotes, the status code, and the size. A log parser turns thousands of those lines into a few numbers a person can read.

The plan is the usual one for a small tool. Parse arguments with argparse. Read the file line by line. Pull the fields out with split, being careful with the quoted request. Count with a Counter. Print a short report.

Build it in steps and run after each: first the number of lines, then the status counts, then the top paths. Small steps with a run in between is how working programmers avoid long debugging sessions.`,
  example: {
    language: 'python',
    caption: 'Pulling fields from one line',
    code: `line = '192.168.1.10 - - [17/Sep/2026:08:01:02] "GET /index.html HTTP/1.1" 200 1043'
before, request, after = line.split('"')
method, path, _ = request.split()
status, size = after.split()
print(path, status, size)
# /index.html 200 1043`,
  },
  task: {
    kind: 'python',
    instructions: 'Write a log parser. access.log is in the working directory and the arguments box holds  access.log --top 3 .\n1. Use argparse: a positional  logfile  and an option  --top  (int, default 3).\n2. Print  requests: <n>  with the number of lines.\n3. Print a  status:  header and then one line per status code as  <code>: <count> , sorted by code.\n4. Print a  top paths:  header and the --top most requested paths as  <path>: <count> , most frequent first (Counter.most_common).\n5. Print  errors: <n>  counting statuses 400 and above.',
    starter: 'import argparse\nfrom collections import Counter\n\nparser = argparse.ArgumentParser(description="Summarize a web server log")\n',
    seed: { 'access.log': LOG },
    argv: ['access.log', '--top', '3'],
    hints: ['parser.add_argument("logfile") and parser.add_argument("--top", type=int, default=3)', 'before, request, after = line.split(\'"\') then path = request.split()[1] and status = after.split()[0]', 'statuses = Counter() and paths = Counter(); statuses[status] += 1', 'for code, n in sorted(statuses.items()): print(f"{code}: {n}") and paths.most_common(args.top)', 'errors = sum(n for code, n in statuses.items() if int(code) >= 400)'],
    solution: { file: 'import argparse\nfrom collections import Counter\n\nparser = argparse.ArgumentParser(description="Summarize a web server log")\nparser.add_argument("logfile")\nparser.add_argument("--top", type=int, default=3)\nargs = parser.parse_args()\n\nstatuses = Counter()\npaths = Counter()\ncount = 0\nwith open(args.logfile) as f:\n    for line in f:\n        line = line.strip()\n        if not line:\n            continue\n        count += 1\n        before, request, after = line.split(\'"\')\n        path = request.split()[1]\n        status = after.split()[0]\n        statuses[status] += 1\n        paths[path] += 1\n\nprint(f"requests: {count}")\nprint("status:")\nfor code, n in sorted(statuses.items()):\n    print(f"{code}: {n}")\nprint("top paths:")\nfor path, n in paths.most_common(args.top):\n    print(f"{path}: {n}")\nerrors = sum(n for code, n in statuses.items() if int(code) >= 400)\nprint(f"errors: {errors}")\n' },
    check: (r) => {
      const ls = outLines(r)
      const argv = (r.env?.ARGV ?? '').split(/\s+/).filter(Boolean)
      const top = argv.includes('--top') ? parseInt(argv[argv.indexOf('--top') + 1], 10) : 3
      const expectedTop = ['/index.html: 3', '/about.html: 2', '/api/items: 2'].slice(0, top)
      const i = ls.indexOf('top paths:')
      return steps([
        [argv[0] === 'access.log', 'Keep access.log as the first argument in the arguments box.'],
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /add_argument\(\s*["']logfile["']/) && codeHas(r, /add_argument\(\s*["']--top["'][^)]*type\s*=\s*int/), 'Add the logfile positional and the --top option with type=int.'],
        [ls[0] === 'requests: 12', 'First line: requests: 12'],
        [ls.slice(1, 7).join('|') === 'status:|200: 7|302: 1|403: 1|404: 2|500: 1', 'Then status: followed by 200: 7, 302: 1, 403: 1, 404: 2, 500: 1 sorted by code.'],
        [i > 0 && ls.slice(i + 1, i + 1 + expectedTop.length).join('|') === expectedTop.join('|') && codeHas(r, 'most_common'), `Then top paths: followed by ${expectedTop.join(', ')} using most_common(args.top).`],
        [ls[ls.length - 1] === 'errors: 4', 'Last line: errors: 4 (statuses 400 and above).'],
      ], 'A real command-line tool that turns a log into a report. Week 9 complete.')
    },
  },
  quiz: [
    { question: 'Why split the log line on the double quote first?', options: ['Quotes are invalid in logs', 'The request part can contain spaces, so isolating it first keeps the fields straight', 'split only works on quotes'], answer: 1, explanation: 'Splitting on quotes gives three pieces: before, the request, and after. Each is then safe to split on spaces.' },
    { question: 'What does Counter.most_common(3) return?', options: ['The three largest keys', 'A list of the three (item, count) pairs with the highest counts', 'The total count'], answer: 1, explanation: 'It returns pairs sorted by count, highest first.' },
    { question: 'What is the benefit of building a tool in small runnable steps?', options: ['It uses less memory', 'Each step is easy to check, so bugs are found where they were introduced', 'Python requires it'], answer: 1, explanation: 'Short feedback loops keep debugging cheap.' },
  ],
}

export default lesson
