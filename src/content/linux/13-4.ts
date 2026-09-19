import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w13d4',
  tier: 2,
  track: 'linux',
  week: 13,
  day: 4,
  title: 'Input, here-docs, traps, temp files, debugging',
  concept: `Four habits separate scripts that work once from scripts you can trust.

Reading input: read -r -p "Name: " name asks a question; -r keeps backslashes as typed. Piped input works too: echo demo | ./setup.sh.

Here-docs write several lines at once: cat > file <<EOF ... EOF. Variables expand inside unless you quote the marker as <<'EOF'.

Temp files: tmp=$(mktemp -d) gives a fresh private directory. A trap runs a command when the script exits, even on error: trap 'rm -rf "$tmp"' EXIT, so nothing is left behind.

Debugging: bash -x script.sh prints each command before running it, and shellcheck script.sh points out quoting mistakes and unsafe habits before they bite.`,
  example: {
    language: 'bash',
    caption: 'A temp directory cleaned up by a trap, and a here-doc',
    code: `#!/bin/bash
set -euo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/hello.txt" <<EOF
user: $USER
home: $HOME
EOF

wc -l < "$tmp/hello.txt"    # 2
# the trap removes $tmp here, even if a command above failed`,
  },
  task: {
    kind: 'shell',
    instructions: 'Write setup.sh so that:\n1. It creates a temp directory with tmp=$(mktemp -d) and sets a trap that removes it on EXIT.\n2. It reads a project name with read -r -p "Project name: " name.\n3. It writes $tmp/config.ini with a here-doc containing three lines:  [project] ,  name = $name , and  owner = $USER .\n4. It prints  wrote 3 lines for NAME  (count with wc -l) and copies the file to ./config.ini.\nThen run  echo demo | bash setup.sh , check the result with cat config.ini, confirm nothing was left in /tmp with ls /tmp, and run shellcheck setup.sh (it should print nothing) and bash -x setup.sh with the same piped input to watch it trace.',
    seed: HOME_SEED,
    file: '/home/learner/setup.sh',
    starter: '#!/bin/bash\nset -euo pipefail\n\n# 1. temp directory and trap\n\n# 2. read the project name\n\n# 3. here-doc into "$tmp/config.ini"\n\n# 4. report and copy\n',
    hints: ['tmp=$(mktemp -d) then trap \'rm -rf "$tmp"\' EXIT (single quotes on purpose: the trap expands $tmp when it runs).', 'read -r -p "Project name: " name', 'cat > "$tmp/config.ini" <<EOF\n[project]\nname = $name\nowner = $USER\nEOF', 'lines=$(wc -l < "$tmp/config.ini"); echo "wrote $lines lines for $name"; cp "$tmp/config.ini" ./config.ini'],
    solution: {
      file: '#!/bin/bash\nset -euo pipefail\n\ntmp=$(mktemp -d)\ntrap \'rm -rf "$tmp"\' EXIT\n\nread -r -p "Project name: " name\n\ncat > "$tmp/config.ini" <<EOF\n[project]\nname = $name\nowner = $USER\nEOF\n\nlines=$(wc -l < "$tmp/config.ini")\necho "wrote $lines lines for $name"\ncp "$tmp/config.ini" ./config.ini\n',
      commands: ['echo demo | bash setup.sh', 'cat config.ini', 'ls /tmp', 'shellcheck setup.sh', 'echo demo | bash -x setup.sh'],
    },
    check: (r) => {
      const src = fileContent(r, '/home/learner/setup.sh') ?? ''
      const cfg = fileContent(r, '/home/learner/config.ini') ?? ''
      const leftovers = Object.keys(r.fs ?? {}).filter((p) => /^\/tmp\/tmp\./.test(p))
      return steps([
        [/tmp=\$\(mktemp -d\)/.test(src) && /trap\s+'rm -rf "\$tmp"'\s+EXIT/.test(src), 'Step 1: tmp=$(mktemp -d) and trap \'rm -rf "$tmp"\' EXIT.'],
        [/read\s+-r\s+-p\s+"Project name: "\s+name/.test(src), 'Step 2: read -r -p "Project name: " name'],
        [/cat\s*>\s*"\$tmp\/config\.ini"\s*<<\s*EOF[\s\S]*\[project\][\s\S]*name = \$name[\s\S]*owner = \$USER[\s\S]*\nEOF/.test(src), 'Step 3: a here-doc (cat > "$tmp/config.ini" <<EOF ... EOF) with the three lines.'],
        [/wc -l/.test(src) && /cp\s+"\$tmp\/config\.ini"\s+(\.\/)?config\.ini/.test(src), 'Step 4: count with wc -l, print the report, and cp the file to ./config.ini.'],
        [ranWith(r, /echo demo \| bash setup\.sh/, /wrote 3 lines for demo/), 'Run: echo demo | bash setup.sh  and expect  wrote 3 lines for demo'],
        [/name = demo/.test(cfg) && /owner = learner/.test(cfg), 'config.ini should contain name = demo and owner = learner. Check it with cat config.ini.'],
        [leftovers.length === 0 && ran(r, /ls \/tmp/), 'Run ls /tmp: the trap should have removed the temp directory, so no tmp.* entries remain.'],
        [ranWith(r, /^shellcheck setup\.sh/, /^$/), 'Run shellcheck setup.sh and fix anything it reports until it prints nothing.'],
        [ranWith(r, /bash -x setup\.sh/, /\+ mktemp -d/), 'Run  echo demo | bash -x setup.sh  to see the trace (lines starting with +).'],
      ], 'Input, a here-doc, a self-cleaning temp directory, and two debugging tools. Ready for tomorrow.')
    },
  },
  quiz: [
    { question: 'Why write the trap command in single quotes?', options: ['Double quotes are not allowed in traps', 'So $tmp is expanded when the trap runs, not when it is set', 'It makes the trap run faster'], answer: 1, explanation: 'With single quotes the text is stored as-is and evaluated at exit time, which is what you want.' },
    { question: 'What is the difference between <<EOF and <<\'EOF\'?', options: ['None', 'Quoting the marker stops variable expansion inside the here-doc', 'The quoted form needs sudo'], answer: 1, explanation: 'Use the quoted form when the text should stay literal, such as a script template containing $ signs.' },
    { question: 'What does bash -x do?', options: ['Runs the script as root', 'Prints each command before running it', 'Checks the syntax without running'], answer: 1, explanation: 'The trace shows the expanded commands, which is the fastest way to see where a script goes wrong. bash -n checks syntax only.' },
  ],
}

export default lesson
