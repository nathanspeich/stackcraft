import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ranWith, steps } from '../checks'

const LOGS = {
  '/home/learner/logs/app.log': 'INFO started\nINFO request /\nWARN slow query\nINFO request /about\nINFO request /\nERROR timeout\nINFO request /\nINFO stopped\n',
  '/home/learner/logs/db.log': 'connected\ncheckpoint\ncheckpoint\nvacuum\ndisconnected\n',
  '/home/learner/logs/notes.txt': 'rotate logs weekly\ncheck disk on Fridays\n',
}

const lesson: Lesson = {
  id: 'w13d3',
  tier: 2,
  track: 'linux',
  week: 13,
  day: 3,
  title: 'Conditionals, loops, case, arrays, substitution, arithmetic',
  concept: `Tier 1 gave you if, for, and functions. Today adds the pieces that make real scripts tidy.

case matches one value against patterns and beats a ladder of ifs: case "$f" in *.log) ... ;; *) ... ;; esac. Each branch ends with two semicolons.

Arrays hold a list: files=(logs/*) collects matching names. "\${files[@]}" expands to every element, safely quoted, and \${#files[@]} is the count.

Command substitution $(...) turns a command's output into a value: n=$(wc -l < "$f"). Arithmetic lives inside $(( )): total=$((total + n)). For a numeric test, (( total > 10 )) reads better than [ "$total" -gt 10 ].

Quote every expansion unless you truly want word splitting.`,
  example: {
    language: 'bash',
    caption: 'case, an array, substitution, and arithmetic together',
    code: `#!/bin/bash
set -euo pipefail

files=(reports/*)
count=0
for f in "\${files[@]}"; do
  case "$f" in
    *.csv) rows=$(wc -l < "$f"); count=$((count + rows)) ;;
    *)     echo "ignoring $f" ;;
  esac
done
echo "\${#files[@]} files, $count csv rows"
if (( count == 0 )); then echo "nothing to do"; fi`,
  },
  task: {
    kind: 'shell',
    instructions: 'The folder logs/ holds app.log, db.log, and notes.txt. Write summary.sh so that:\n1. It collects the folder contents into an array:  files=(logs/*)  and starts total=0.\n2. It loops over "${files[@]}" with a case: for *.log files it counts lines with $(wc -l < "$f"), adds them to total, and prints  app.log: 8 lines  (use basename); for anything else it prints  skipping notes.txt .\n3. After the loop it prints  total: 13 lines in 3 files  using $total and ${#files[@]}.\n4. Finally, with (( total > 10 )), it prints  busy day , otherwise  quiet day .\nRun it with bash summary.sh.',
    seed: { ...HOME_SEED, ...LOGS },
    file: '/home/learner/summary.sh',
    starter: '#!/bin/bash\nset -euo pipefail\n\n# 1. the array and the running total\n\n# 2. loop with a case on the file name\n\n# 3. the total line\n\n# 4. busy or quiet\n',
    hints: ['files=(logs/*) then total=0. Loop: for f in "${files[@]}"; do ... done', 'Inside the loop: case "$f" in *.log) n=$(wc -l < "$f"); total=$((total + n)); echo "$(basename "$f"): $n lines" ;; *) echo "skipping $(basename "$f")" ;; esac', 'echo "total: $total lines in ${#files[@]} files" then if (( total > 10 )); then echo "busy day"; else echo "quiet day"; fi'],
    solution: {
      file: '#!/bin/bash\nset -euo pipefail\n\nfiles=(logs/*)\ntotal=0\n\nfor f in "${files[@]}"; do\n  case "$f" in\n    *.log)\n      n=$(wc -l < "$f")\n      total=$((total + n))\n      echo "$(basename "$f"): $n lines"\n      ;;\n    *)\n      echo "skipping $(basename "$f")"\n      ;;\n  esac\ndone\n\necho "total: $total lines in ${#files[@]} files"\n\nif (( total > 10 )); then\n  echo "busy day"\nelse\n  echo "quiet day"\nfi\n',
      commands: ['bash summary.sh'],
    },
    check: (r) => {
      const src = fileContent(r, '/home/learner/summary.sh') ?? ''
      return steps([
        [/files=\(logs\/\*\)/.test(src) && /total=0/.test(src), 'Step 1: files=(logs/*) and total=0.'],
        [/for\s+\w+\s+in\s+"\$\{files\[@\]\}"/.test(src) && /case\s+"?\$\w+"?\s+in/.test(src) && /\*\.log\)/.test(src) && /esac/.test(src), 'Step 2: loop over "${files[@]}" with a case that has a *.log) branch and a *) branch, ending in esac.'],
        [/\$\(wc -l < "?\$\w+"?\)/.test(src) && /total=\$\(\(\s*total\s*\+\s*\w+\s*\)\)/.test(src), 'Step 2: count with $(wc -l < "$f") and add with total=$((total + n)).'],
        [/\$\{#files\[@\]\}/.test(src), 'Step 3: use ${#files[@]} for the file count.'],
        [/\(\(\s*total\s*>\s*10\s*\)\)/.test(src), 'Step 4: test with (( total > 10 )).'],
        [ranWith(r, /summary\.sh/, /^app\.log: 8 lines\ndb\.log: 5 lines\nskipping notes\.txt\ntotal: 13 lines in 3 files\nbusy day\n$/), 'Run bash summary.sh. Expected exactly: app.log: 8 lines, db.log: 5 lines, skipping notes.txt, total: 13 lines in 3 files, busy day.'],
      ], 'case, arrays, substitution, and arithmetic, all in one script.')
    },
  },
  quiz: [
    { question: 'How does each branch of a case statement end?', options: ['With fi', 'With ;;', 'With done'], answer: 1, explanation: 'Two semicolons close a branch. esac closes the whole case.' },
    { question: 'What does "${files[@]}" expand to?', options: ['The first element only', 'Every element, each kept as one word even with spaces', 'The number of elements'], answer: 1, explanation: 'The quotes plus [@] keep names with spaces intact. ${#files[@]} gives the count.' },
    { question: 'Which line adds n to total?', options: ['total = total + n', 'total=$((total + n))', 'total+=n'], answer: 1, explanation: 'Arithmetic happens inside $(( )). Spaces around = would try to run a command called total.' },
  ],
}

export default lesson
