import type { Lesson } from '../types'
import { fileContent, hasExecBit, isDir, ran, steps } from '../checks'

const COLLECT = "#!/bin/bash\nout=\"$1\"\necho \"host=$(hostname)\" > \"$out\"\necho \"date=$(date +%F)\" >> \"$out\"\necho \"disk_use=$(df -h | grep ' /$' | tr -s ' ' | cut -d' ' -f5)\" >> \"$out\"\necho \"mem_used=$(free -h | grep Mem | tr -s ' ' | cut -d' ' -f3)\" >> \"$out\"\necho \"load=$(uptime | sed 's/.*load averages*: //')\" >> \"$out\"\necho \"procs=$(ps aux | wc -l)\" >> \"$out\"\necho \"wrote $out\"\n"
const LOAD = 'import sqlite3\nimport sys\n# day 2: read report files into health.db (see week 12 day 2)\n'
const REPORT = 'import sqlite3\nimport sys\n# day 4: print the report (see week 12 day 4)\n'

const lesson: Lesson = {
  id: 'w12d5',
  tier: 1,
  track: 'capstone',
  week: 12,
  day: 5,
  title: 'What to learn next',
  concept: `Tier 1 is done. You can move around a Linux system, write a script, parse and store data in Python, and ask a database real questions. Today you package the project and look ahead.

Packaging is a habit: a folder with the scripts, an executable bit where it belongs, and a README that says how to run it. Future you will thank present you.

Tier 2 takes each skill to a real machine. Week 13 sets up an Ubuntu virtual machine on your Mac with Multipass and starts real bash scripting. After that: Python classes and tests, SQL CTEs and window functions, systemd services, Docker, and packaging. Every week ends with a project the app checks from output you paste.

Fifteen minutes a day got you here. Keep the streak.`,
  example: {
    language: 'text',
    caption: 'A README that lets someone else run your tool',
    code: `# Server health report

## How to run
bash collect.sh report.txt
python3 load.py report.txt
python3 report.py report.txt

## Next
- Real bash scripting in a VM (week 13)
- Python classes and pytest
- SQL CTEs and window functions`,
  },
  task: {
    kind: 'shell',
    instructions: 'Package the capstone. The editor holds ~/health/README.md; the terminal starts in ~/health.\n1. In the editor, write the README with a top heading line starting with # , a ## How to run section that names all three scripts, and a ## Next section with at least three lines starting with "- " about what you want to learn next.\n2. Create the folder ~/projects/health-report with mkdir -p.\n3. Copy collect.sh, load.py, report.py, and README.md from ~/health into it with cp.\n4. Make the copied collect.sh executable with chmod +x.\n5. Run ls -l ~/projects/health-report to check the files and the x bit.',
    seed: { '/home/learner/health/collect.sh': COLLECT, '/home/learner/health/load.py': LOAD, '/home/learner/health/report.py': REPORT, '/home/learner/health/report.txt': 'host=stackbox\ndate=2026-09-17\ndisk_use=33%\n', '/home/learner/projects/': '' },
    cwd: '/home/learner/health',
    file: '/home/learner/health/README.md',
    starter: '# Server health report\n\n## How to run\n\n## Next\n',
    hints: [
      'Under ## Next, lines like: - Real bash scripting in a VM',
      'mkdir -p ~/projects/health-report',
      'cp collect.sh load.py report.py README.md ~/projects/health-report/',
      'chmod +x ~/projects/health-report/collect.sh',
    ],
    solution: {
      file: '# Server health report\n\n## How to run\nbash collect.sh report.txt\npython3 load.py report.txt\npython3 report.py report.txt\n\n## Next\n- Real bash scripting in a VM\n- Python classes and pytest\n- SQL CTEs and window functions\n',
      commands: ['mkdir -p ~/projects/health-report', 'cp collect.sh load.py report.py README.md ~/projects/health-report/', 'chmod +x ~/projects/health-report/collect.sh', 'ls -l ~/projects/health-report'],
    },
    check: (r) => {
      const dir = '/home/learner/projects/health-report'
      const readme = fileContent(r, '/home/learner/health/README.md') ?? ''
      const bullets = readme.split('\n').filter((l) => /^- \S/.test(l)).length
      const copied = ['collect.sh', 'load.py', 'report.py', 'README.md'].filter((f) => (fileContent(r, `${dir}/${f}`) ?? '').length > 0)
      return steps([
        [/^# \S/m.test(readme) && /^## How to run/m.test(readme), 'Step 1: README.md needs a # heading and a ## How to run section.'],
        [/collect\.sh/.test(readme) && /load\.py/.test(readme) && /report\.py/.test(readme), 'Step 1: name all three scripts under How to run.'],
        [/^## Next/m.test(readme) && bullets >= 3, `Step 1: a ## Next section with at least three "- " lines (${bullets} so far).`],
        [isDir(r, dir), 'Step 2: mkdir -p ~/projects/health-report'],
        [copied.length === 4, `Step 3: copy collect.sh, load.py, report.py, and README.md into the new folder (${copied.length} of 4 there so far). If you copied the README before finishing it, copy it again.`],
        [fileContent(r, `${dir}/README.md`) === readme, 'The copied README.md is older than the one in the editor. Copy it again.'],
        [hasExecBit(r, `${dir}/collect.sh`), 'Step 4: chmod +x ~/projects/health-report/collect.sh'],
        [ran(r, /^\s*ls\s+-l[a-z]*\s+(~|\/home\/learner|\.\.)\/projects\/health-report\/?\s*$/), 'Step 5: ls -l ~/projects/health-report'],
      ], 'Packaged and documented. Tier 1 complete. See you in the VM.')
    },
    realSteps: [
      'On your Mac, run git --version in Terminal (accept the developer tools install if it asks). Then in ~/projects/health-report (or ~/health) run git init, git add ., and git commit -m "Tier 1 capstone" so the project is under version control.',
      'Run brew --version. If Homebrew is missing, install it from brew.sh. Week 13 uses it to install Multipass, which creates the Ubuntu VM for Tier 2.',
    ],
  },
  quiz: [
    { question: 'Why does a project need a README?', options: ['Git requires one', 'So someone, including future you, can run it without reading the code', 'It makes scripts faster'], answer: 1, explanation: 'Three lines of how to run it save an hour of guessing later.' },
    { question: 'What does Tier 2 add that Tier 1 did not have?', options: ['A real Ubuntu machine, as a VM on your Mac', 'A different programming language', 'Nothing, it repeats Tier 1'], answer: 0, explanation: 'Lessons still run in the app, but every week ends with a project on the VM, checked from output you paste.' },
    { question: 'Why chmod +x the copied collect.sh?', options: ['So it can be run as ./collect.sh without typing bash first', 'cp removes the file otherwise', 'Python needs it'], answer: 0, explanation: 'The execute bit lets the shell run the file directly, using the shebang line to pick bash.' },
  ],
}

export default lesson
