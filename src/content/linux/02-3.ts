import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const APP_LOG = `2026-09-15 08:01:12 INFO  server started on port 8080
2026-09-15 08:01:13 INFO  connected to database
2026-09-15 08:14:55 WARN  slow query took 2.3s
2026-09-15 09:02:41 ERROR request timeout after 30s
2026-09-15 09:02:42 INFO  retrying request
2026-09-15 09:30:10 ERROR failed to write cache: disk full
2026-09-15 10:00:00 INFO  nightly cleanup finished
`
const SERVER_LOG = `[2026-09-15T08:00:00Z] listening on :3000
[2026-09-15T08:05:31Z] GET /api/users 200 12ms
[2026-09-15T08:07:02Z] GET /api/orders 504 Timeout while waiting for upstream
[2026-09-15T08:09:44Z] POST /api/login 200 41ms
`

const lesson: Lesson = {
  id: 'w02d3',
  tier: 1,
  track: 'linux',
  week: 2,
  day: 3,
  title: 'Finding things: find and grep',
  concept: `Two commands answer the two most common questions. Where is that file? What file contains this text?

find searches by name and type, walking down a directory tree. find ~/projects -name "*.log" lists every .log file under projects. Quote the pattern so the shell does not expand it first. Add -type d for directories only or -type f for files only.

grep searches inside files for text. grep ERROR app.log prints the matching lines. Useful flags: -i ignores case, -n shows line numbers, -r searches a whole directory recursively, -v shows lines that do not match, and -c counts matches instead of printing them.

The two combine well: find locates candidates, grep inspects them.`,
  example: {
    language: 'bash',
    caption: 'Locate, then inspect',
    code: `find ~/projects -name "*.log"
/home/learner/projects/app/app.log
/home/learner/projects/api/server.log
grep -n ERROR ~/projects/app/app.log
4:2026-09-15 09:02:41 ERROR request timeout after 30s
6:2026-09-15 09:30:10 ERROR failed to write cache: disk full`,
  },
  task: {
    kind: 'shell',
    instructions: 'Two services under ~/projects have been misbehaving.\n1. Use find to list every .log file under ~/projects.\n2. Use grep with line numbers to show the ERROR lines in projects/app/app.log.\n3. Search all of ~/projects recursively and case-insensitively for the word timeout.\n4. Count how many lines in app.log contain INFO.',
    seed: {
      ...HOME_SEED,
      '/home/learner/projects/app/app.log': APP_LOG,
      '/home/learner/projects/app/config.yml': 'port: 8080\ntimeout: 30\n',
      '/home/learner/projects/app/src/main.py': 'print("app")\n',
      '/home/learner/projects/api/server.log': SERVER_LOG,
      '/home/learner/projects/api/README.md': '# API\n',
    },
    hints: ['find ~/projects -name "*.log"', 'grep -n ERROR projects/app/app.log', 'grep -ri timeout ~/projects searches every file below projects.', 'grep -c INFO projects/app/app.log prints just a number.'],
    solution: { commands: ['find ~/projects -name "*.log"', 'grep -n ERROR projects/app/app.log', 'grep -ri timeout ~/projects', 'grep -c INFO projects/app/app.log'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*find\b.*-name/, /app\.log[\s\S]*server\.log|server\.log[\s\S]*app\.log/), 'List every .log file with find ~/projects -name "*.log". Remember the quotes.'],
        [ranWith(r, /^\s*grep\b.*-\w*n\w*.*ERROR.*app\.log/, /^4:.*ERROR[\s\S]*^6:.*ERROR/m), 'Show the ERROR lines in app.log with line numbers: grep -n ERROR ...'],
        [ranWith(r, /^\s*grep\b.*-\w*[ri]\w*[ri]\w*.*timeout/i, /app\.log.*timeout[\s\S]*Timeout|Timeout[\s\S]*app\.log.*timeout/i), 'Search all of ~/projects recursively and case-insensitively for timeout (grep -ri).'],
        [ranWith(r, /^\s*grep\b.*-\w*c.*INFO.*app\.log/, /^4\n$/), 'Count the INFO lines in app.log with grep -c INFO ...'],
      ], 'Located every log and pulled out exactly the lines that mattered.'),
  },
  quiz: [
    { question: 'Why quote the pattern in find -name "*.txt"?', options: ['find needs quotes to run', 'So the shell does not expand * before find sees it', 'To make the search case insensitive'], answer: 1, explanation: 'Unquoted, the shell replaces *.txt with matching names in the current directory, which is not what you meant.' },
    { question: 'Which grep flag shows line numbers?', options: ['-l', '-n', '-c'], answer: 1, explanation: '-n prefixes each match with its line number. -c counts, -l lists file names.' },
    { question: 'How do you search every file under a directory?', options: ['grep -r pattern dir', 'grep -a pattern dir', 'grep pattern dir/*'], answer: 0, explanation: '-r recurses into subdirectories. dir/* only covers the top level and would skip nested folders.' },
  ],
}

export default lesson
