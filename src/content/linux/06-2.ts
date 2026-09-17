import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w06d2',
  tier: 1,
  track: 'linux',
  week: 6,
  day: 2,
  title: 'System info: df, du, free, uname',
  concept: `Four commands tell you how a machine is doing. Learn them and you can size up any server in under a minute.

df -h reports disk space per filesystem: size, used, available, and the percent full. The -h means human readable, so you see 20G instead of a huge number of blocks.

du -sh path tells you how much space one directory takes. The -s summarizes instead of listing every subfolder. When a disk fills up, du -sh * inside a folder shows which child is the culprit.

free -h shows memory: total, used, free, and how much is available for new programs.

uname -a prints the kernel version and architecture, which you need when installing software or reporting a bug.`,
  example: {
    language: 'bash',
    caption: 'A one minute health check',
    code: `df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1        20G  6.1G   13G  33% /
du -sh ~/projects
12K     /home/learner/projects
free -h
               total        used        free
Mem:           3.8Gi       812Mi       2.2Gi
uname -a
Linux stackbox 6.8.0-45-generic ... x86_64 GNU/Linux`,
  },
  task: {
    kind: 'shell',
    instructions: 'Run a quick health check:\n1. Show disk usage in human readable form.\n2. Show how much space ~/projects takes, summarized.\n3. Show memory in human readable form.\n4. Print the full kernel and machine info with uname.',
    seed: HOME_SEED,
    hints: ['df -h', 'du -sh ~/projects', 'free -h', 'uname -a'],
    solution: { commands: ['df -h', 'du -sh ~/projects', 'free -h', 'uname -a'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*df\s+-\w*h/, /Filesystem.*Size/), 'Show disk space with df -h.'],
        [ranWith(r, /^\s*du\s+-\w*s\w*.*projects|^\s*du\s+-\w*h\w*s.*projects/, /\tprojects|\/projects/), 'Summarize the size of ~/projects with du -sh ~/projects.'],
        [ranWith(r, /^\s*free\s+-\w*h/, /Mem:\s+3\.8Gi/), 'Show memory with free -h.'],
        [ranWith(r, /^\s*uname\s+-\w*a/, /Linux stackbox.*x86_64/), 'Print everything with uname -a.'],
      ], 'Disk, memory, kernel: you can read the vital signs.'),
  },
  quiz: [
    { question: 'What does the -h flag mean for df and du?', options: ['Help', 'Hidden files', 'Human readable sizes'], answer: 2, explanation: 'It prints K, M, G units instead of raw block counts.' },
    { question: 'A disk is 98% full. Which command finds the biggest folder?', options: ['df -h', 'du -sh * in the suspect directory', 'free -h'], answer: 1, explanation: 'df says the disk is full. du -sh per folder tells you where the space went.' },
    { question: 'What does uname -r print?', options: ['The kernel release version', 'The root user name', 'Free RAM'], answer: 0, explanation: '-r is release. -a prints everything including the machine architecture.' },
  ],
}

export default lesson
