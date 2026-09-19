import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w13d2',
  tier: 2,
  track: 'linux',
  week: 13,
  day: 2,
  title: 'Arguments, getopts, usage, exit codes, functions',
  concept: `A script becomes a tool when it takes arguments and complains clearly when it gets them wrong.

Positional arguments arrive as $1, $2, and so on; $# is how many there are. Flags like -u or -n NAME are parsed by getopts: it loops over the flags, sets a variable to each letter, and puts a flag's value in $OPTARG. A colon after a letter means that flag takes a value. After the loop, shift $((OPTIND - 1)) drops the flags so only plain arguments remain.

A usage function prints how to call the script to stderr (>&2) and exits with 1. Exit 0 means success; anything else means failure, and other tools rely on that.

Functions keep the script readable: one job per function, called by name.`,
  example: {
    language: 'bash',
    caption: 'getopts with one flag that takes a value',
    code: `#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: $0 [-v] -f FILE" >&2
  exit 1
}

verbose=0
file=""
while getopts "vf:" opt; do
  case $opt in
    v) verbose=1 ;;
    f) file=$OPTARG ;;
    *) usage ;;
  esac
done
shift $((OPTIND - 1))
[ -n "$file" ] || usage
echo "file=$file verbose=$verbose rest=$*"`,
  },
  task: {
    kind: 'shell',
    instructions: 'Write greet.sh in the editor so that:\n1. It starts with the shebang and set -euo pipefail, and defines a usage function that prints  Usage: greet.sh [-u] -n NAME  to stderr and exits 1.\n2. It parses flags with getopts "un:" where -u means uppercase and -n takes the name. Unknown flags call usage.\n3. If no name was given, it calls usage.\n4. It prints  Hello, NAME!  and with -u the same text in capitals (use ${greeting^^}).\nThen run: bash greet.sh -n Ada, then bash greet.sh -u -n Ada, then bash greet.sh followed by echo $? on the next line.',
    seed: HOME_SEED,
    file: '/home/learner/greet.sh',
    starter: '#!/bin/bash\nset -euo pipefail\n\nusage() {\n  # print the usage line to stderr and exit 1\n}\n\nupper=0\nname=""\nwhile getopts "un:" opt; do\n  case $opt in\n    # u) ...\n    # n) ...\n    # *) ...\n  esac\ndone\nshift $((OPTIND - 1))\n\n# call usage when name is empty, then build and print the greeting\n',
    hints: ['usage() { echo "Usage: greet.sh [-u] -n NAME" >&2; exit 1; }', 'u) upper=1 ;;  n) name=$OPTARG ;;  *) usage ;;', '[ -n "$name" ] || usage   then   greeting="Hello, $name!"   and   if [ "$upper" -eq 1 ]; then greeting=${greeting^^}; fi', 'Finish with echo "$greeting", then run the three commands from the instructions.'],
    solution: {
      file: '#!/bin/bash\nset -euo pipefail\n\nusage() {\n  echo "Usage: greet.sh [-u] -n NAME" >&2\n  exit 1\n}\n\nupper=0\nname=""\nwhile getopts "un:" opt; do\n  case $opt in\n    u) upper=1 ;;\n    n) name=$OPTARG ;;\n    *) usage ;;\n  esac\ndone\nshift $((OPTIND - 1))\n\n[ -n "$name" ] || usage\ngreeting="Hello, $name!"\nif [ "$upper" -eq 1 ]; then\n  greeting=${greeting^^}\nfi\necho "$greeting"\n',
      commands: ['bash greet.sh -n Ada', 'bash greet.sh -u -n Ada', 'bash greet.sh', 'echo $?'],
    },
    check: (r) => {
      const src = fileContent(r, '/home/learner/greet.sh') ?? ''
      const h = r.history ?? []
      const o = r.outputs ?? []
      const noArgs = h.findIndex((c, i) => /^bash\s+(\.\/)?greet\.sh\s*$|^\.\/greet\.sh\s*$/.test(c.trim()) && /Usage: greet\.sh/.test(o[i] ?? ''))
      const codeAfter = noArgs >= 0 && /echo\s+"?\$\?/.test(h[noArgs + 1] ?? '') && /^1\n$/.test(o[noArgs + 1] ?? '')
      return steps([
        [/^#!\/bin\/bash/.test(src) && /set -euo pipefail/.test(src), 'Step 1: keep the shebang and set -euo pipefail at the top.'],
        [/usage\s*\(\)\s*\{[\s\S]*Usage: greet\.sh \[-u\] -n NAME[\s\S]*>&2[\s\S]*exit 1[\s\S]*\}/.test(src), 'Step 1: usage() should echo  Usage: greet.sh [-u] -n NAME  to stderr (>&2) and exit 1.'],
        [/getopts\s+"un:"/.test(src) && /u\)\s*upper=1/.test(src) && /n\)\s*name=\$OPTARG/.test(src) && /\*\)\s*usage/.test(src), 'Step 2: inside the case, u) sets upper=1, n) sets name=$OPTARG, and *) calls usage.'],
        [/\[\s*-[nz]\s+"\$name"\s*\]\s*(\|\||&&)\s*usage|if\s+\[\s*-z\s+"\$name"\s*\]/.test(src), 'Step 3: call usage when $name is empty, for example [ -n "$name" ] || usage.'],
        [ranWith(r, /greet\.sh -n Ada/, /^Hello, Ada!\n$/), 'Step 4: bash greet.sh -n Ada should print exactly  Hello, Ada!'],
        [ranWith(r, /greet\.sh -u -n Ada/, /^HELLO, ADA!\n$/), 'Step 4: bash greet.sh -u -n Ada should print  HELLO, ADA!  (use ${greeting^^}).'],
        [codeAfter, 'Run bash greet.sh with no arguments (it prints the usage line), then echo $? on the next line to show the exit code 1.'],
      ], 'Flags, a usage message, and honest exit codes. That is a tool.')
    },
  },
  quiz: [
    { question: 'In getopts "un:", what does the colon after n mean?', options: ['-n is required', '-n takes a value, available as $OPTARG', '-n is the default'], answer: 1, explanation: 'A colon after a letter marks a flag that expects a value.' },
    { question: 'Why print usage messages to stderr with >&2?', options: ['So they show in red', 'So they do not pollute stdout, which may be piped into another tool', 'Because echo cannot write to stdout'], answer: 1, explanation: 'Errors and help go to stderr; real output goes to stdout. Pipelines only carry stdout.' },
    { question: 'What does shift $((OPTIND - 1)) do after the getopts loop?', options: ['Removes the parsed flags so $1 is the first plain argument', 'Resets getopts', 'Exits the script'], answer: 0, explanation: 'OPTIND points just past the last flag. Shifting by that many leaves only the positional arguments.' },
  ],
}

export default lesson
