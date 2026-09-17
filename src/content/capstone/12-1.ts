import type { Lesson } from '../types'
import { fileContent, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w12d1',
  tier: 1,
  track: 'capstone',
  week: 12,
  day: 1,
  title: 'Bash script gathers system info',
  concept: `This week you build one small tool end to end: a server health report. Bash collects facts about the machine, Python loads them into SQLite, and SQL turns the rows into a report. Each day adds one layer.

Today is the collector. It runs the commands you already know (hostname, date, df, free, uptime, ps) and writes the answers as key=value lines into a file. That format is deliberately plain: one fact per line, easy for Python to read tomorrow.

The trick is extracting just the number you want from a command's output. Pipe it through grep to keep one line, tr -s to squeeze repeated spaces, and cut to take one field. Then wrap the whole pipeline in $( ) to capture it into your echo.`,
  example: {
    language: 'bash',
    caption: 'Capturing one field from df',
    code: `# The root filesystem line ends with a lone /
df -h | grep ' /$'
#   /dev/vda1   20G  6.1G   13G  33% /

# Squeeze spaces, take field 5, capture it
use=$(df -h | grep ' /$' | tr -s ' ' | cut -d' ' -f5)
echo "disk_use=$use"     # disk_use=33%`,
  },
  task: {
    kind: 'shell',
    instructions: 'Write collect.sh in the editor so that, given an output file name as $1, it writes these six key=value lines to that file (use > for the first line and >> for the rest):\n1. host= from hostname.\n2. date= from date +%F (gives 2026-09-17 style dates).\n3. disk_use= the Use% field of the root filesystem from df -h (grep the line ending in " /", squeeze spaces, cut field 5).\n4. mem_used= the used column from free -h (grep Mem, squeeze, cut field 3).\n5. load= the load averages from uptime (sed \'s/.*load averages*: //\' strips everything before them).\n6. procs= the number of lines from ps aux | wc -l.\nThen run bash collect.sh report.txt and cat report.txt.',
    seed: { '/home/learner/health/': '', '/home/learner/health/README.txt': 'Capstone: server health report.\nDay 1: collect.sh writes report.txt\nDay 2: load.py stores it in health.db\nDay 3: SQL queries make the report\n' },
    cwd: '/home/learner/health',
    file: '/home/learner/health/collect.sh',
    starter: '#!/bin/bash\n# collect.sh: write a few health facts as key=value lines into the file named in $1\nout="$1"\n\necho "host=$(hostname)" > "$out"\n# add date, disk_use, mem_used, load, procs with >>\n\necho "wrote $out"\n',
    hints: [
      'echo "date=$(date +%F)" >> "$out"',
      "echo \"disk_use=$(df -h | grep ' /$' | tr -s ' ' | cut -d' ' -f5)\" >> \"$out\"",
      "echo \"mem_used=$(free -h | grep Mem | tr -s ' ' | cut -d' ' -f3)\" >> \"$out\"",
      "echo \"load=$(uptime | sed 's/.*load averages*: //')\" >> \"$out\" and echo \"procs=$(ps aux | wc -l)\" >> \"$out\"",
    ],
    solution: {
      file: "#!/bin/bash\n# collect.sh: write a few health facts as key=value lines into the file named in $1\nout=\"$1\"\n\necho \"host=$(hostname)\" > \"$out\"\necho \"date=$(date +%F)\" >> \"$out\"\necho \"disk_use=$(df -h | grep ' /$' | tr -s ' ' | cut -d' ' -f5)\" >> \"$out\"\necho \"mem_used=$(free -h | grep Mem | tr -s ' ' | cut -d' ' -f3)\" >> \"$out\"\necho \"load=$(uptime | sed 's/.*load averages*: //')\" >> \"$out\"\necho \"procs=$(ps aux | wc -l)\" >> \"$out\"\n\necho \"wrote $out\"\n",
      commands: ['bash collect.sh report.txt', 'cat report.txt'],
    },
    check: (r) => {
      const src = fileContent(r, '/home/learner/health/collect.sh') ?? ''
      const report = fileContent(r, '/home/learner/health/report.txt') ?? ''
      const line = (k: string) => report.split('\n').find((l) => l.startsWith(k + '='))?.slice(k.length + 1)
      return steps([
        [/^#!\/bin\/(ba)?sh/.test(src) && /\$\(\s*hostname\s*\)/.test(src) && /date \+%F/.test(src), 'collect.sh needs the shebang, host=$(hostname), and date=$(date +%F).'],
        [/df -h[^\n]*grep[^\n]*cut -d' ' -f5/.test(src), "disk_use: pipe df -h through grep ' /$', tr -s ' ', and cut -d' ' -f5."],
        [/free -h[^\n]*grep Mem[^\n]*cut -d' ' -f3/.test(src), "mem_used: pipe free -h through grep Mem, tr -s ' ', and cut -d' ' -f3."],
        [/uptime[^\n]*sed/.test(src) && /ps aux[^\n]*wc -l/.test(src), "load: uptime | sed 's/.*load averages*: //'. procs: ps aux | wc -l."],
        [ranWith(r, /^\s*(bash\s+|\.\/)collect\.sh\s+report\.txt/, /wrote report\.txt/), 'Run it: bash collect.sh report.txt'],
        [line('host') === 'stackbox' && /^\d{4}-\d\d-\d\d$/.test(line('date') ?? ''), 'report.txt should start with host=stackbox and date=2026-09-17 (today). Check that the first echo uses > and the rest use >>.'],
        [line('disk_use') === '33%', `disk_use should be 33%, not "${line('disk_use') ?? ''}". Compare with the worked example.`],
        [line('mem_used') === '812Mi', `mem_used should be 812Mi, not "${line('mem_used') ?? ''}".`],
        [line('load') === '0.08, 0.05, 0.01' && /^\d+$/.test(line('procs') ?? ''), 'load should read 0.08, 0.05, 0.01 and procs should be a plain number.'],
        [ranWith(r, /^\s*cat\s+report\.txt/, /host=stackbox\n/), 'Finish with cat report.txt to read the result.'],
      ], 'Six facts captured. Tomorrow Python reads this file.')
    },
    realSteps: [
      'On your Mac, open Terminal, make a folder with mkdir -p ~/health, and save this collect.sh into it (TextEdit in plain text mode, or nano).',
      'macOS has no free command, so that line will print an error and an empty value. That is expected. Run bash collect.sh report.txt and then cat report.txt to see your real host name, disk use, and load averages.',
    ],
  },
  quiz: [
    { question: 'Why write the first line with > and the rest with >>?', options: ['> is faster', '> starts the file fresh, >> appends the rest', 'They are the same'], answer: 1, explanation: 'The first > truncates any old report. Every later >> adds a line to it.' },
    { question: "What does tr -s ' ' do in the pipeline?", options: ['Deletes all spaces', 'Squeezes runs of spaces into one so cut can count fields', 'Sorts by spaces'], answer: 1, explanation: 'df pads columns with several spaces. cut splits on a single delimiter, so squeeze first.' },
    { question: 'Why key=value lines instead of the raw command output?', options: ['They are shorter', 'They are easy for another program to parse, one fact per line', 'Bash requires it'], answer: 1, explanation: 'Tomorrow Python splits each line on = and gets a dictionary. Raw output would need a parser per command.' },
  ],
}

export default lesson
