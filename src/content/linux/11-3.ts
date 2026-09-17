import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w11d3',
  tier: 1,
  track: 'linux',
  week: 11,
  day: 3,
  title: 'Loops, functions, exit codes',
  concept: `Three ideas turn a list of commands into a real program.

Loops repeat. for f in reports/*.txt; do echo "$f"; done runs the body once per file, with $f set each time.

Conditions decide. if [ -f "$f" ]; then ... fi runs the body when the test passes. Common tests: -f file exists, -d directory exists, "$a" = "$b" strings equal, $n -gt 3 number greater than.

Functions name a block: count_lines() { wc -l < "$1"; } and then count_lines file.txt calls it with $1 set inside.

Every command ends with an exit code: 0 means success, anything else means failure. echo $? shows the last one. Scripts set their own with exit 0 or exit 1, and other tools and scripts rely on that to know whether things worked.`,
  example: {
    language: 'bash',
    caption: 'A loop, a function, and an exit code',
    code: `#!/bin/bash
count_lines() {
  wc -l < "$1"
}
for f in reports/*.txt; do
  echo "$f has $(count_lines "$f") lines"
done
if [ ! -d reports ]; then
  echo "no reports directory" >&2
  exit 2
fi
exit 0`,
  },
  task: {
    kind: 'shell',
    instructions: 'The folder reports/ has three text files. Write check.sh so that it:\n1. Defines a function count_lines that prints the line count of the file named in $1.\n2. Loops over reports/*.txt and prints one line per file in the form  jan.txt: 3 lines  (use basename to strip the folder).\n3. Ends with exit 0.\nRun it with bash check.sh, then print the exit code with echo $?.',
    seed: { ...HOME_SEED, '/home/learner/reports/jan.txt': 'rent\nfood\nbus\n', '/home/learner/reports/feb.txt': 'rent\nfood\nbus\ngift\n', '/home/learner/reports/mar.txt': 'rent\nfood\n' },
    file: '/home/learner/check.sh',
    starter: '#!/bin/bash\n# check.sh: report the number of lines in each file under reports/\n\ncount_lines() {\n  # print the number of lines in the file $1\n}\n\nfor f in reports/*.txt; do\n  # print "<name>: <n> lines"\ndone\n\n',
    hints: ['Inside the function: wc -l < "$1" prints just the number.', 'Inside the loop: n=$(count_lines "$f") then echo "$(basename "$f"): $n lines".', 'Finish with exit 0, then run bash check.sh and echo $?.'],
    solution: { file: '#!/bin/bash\ncount_lines() {\n  wc -l < "$1"\n}\nfor f in reports/*.txt; do\n  n=$(count_lines "$f")\n  echo "$(basename "$f"): $n lines"\ndone\nexit 0\n', commands: ['bash check.sh', 'echo $?'] },
    check: (r) => {
      const src = fileContent(r, '/home/learner/check.sh') ?? ''
      const h = r.history ?? []
      const runIdx = h.findIndex((c, i) => /check\.sh/.test(c) && /feb\.txt: 4 lines/.test(r.outputs?.[i] ?? ''))
      const echoAfter = runIdx >= 0 && h.slice(runIdx + 1).some((c, k) => /echo\s+"?\$\?/.test(c) && /^0\n$/.test(r.outputs?.[runIdx + 1 + k] ?? ''))
      return steps([
        [/count_lines\s*\(\)\s*\{[\s\S]*wc\s+-l/.test(src), 'Define count_lines() with wc -l inside it.'],
        [/for\s+\w+\s+in\s+reports\/\*\.txt/.test(src), 'Loop with for f in reports/*.txt; do ... done.'],
        [/count_lines/.test(src.split('}').slice(1).join('}')), 'Call count_lines inside the loop to get each count.'],
        [/exit\s+0/.test(src), 'End the script with exit 0.'],
        [ranWith(r, /check\.sh/, /feb\.txt: 4 lines\njan\.txt: 3 lines\nmar\.txt: 2 lines/), 'Run bash check.sh. Expected output, one per line: feb.txt: 4 lines, jan.txt: 3 lines, mar.txt: 2 lines.'],
        [echoAfter, 'Right after running it, print the exit code with echo $? (it should be 0).'],
      ], 'Loop, function, and a clean exit code. That is a real script.')
    },
  },
  quiz: [
    { question: 'What exit code means success?', options: ['1', '0', '200'], answer: 1, explanation: 'Zero is success. Any non-zero value signals some kind of failure.' },
    { question: 'What does [ -f notes.txt ] test?', options: ['That notes.txt is a regular file that exists', 'That notes.txt is full', 'That notes.txt is a folder'], answer: 0, explanation: '-f is the file test. -d tests for a directory.' },
    { question: 'Inside a function, what is $1?', options: ['The script\'s first argument', 'The function\'s first argument', 'The current directory'], answer: 1, explanation: 'Functions get their own positional parameters while they run.' },
  ],
}

export default lesson
