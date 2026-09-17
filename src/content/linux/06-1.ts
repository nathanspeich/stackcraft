import type { Lesson } from '../types'
import { HOME_SEED, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w06d1',
  tier: 1,
  track: 'linux',
  week: 6,
  day: 1,
  title: 'Processes: ps, top, kill, jobs',
  concept: `A running program is a process. Each one has a number called a PID, an owner, and a share of CPU and memory.

ps aux lists every process with its user, PID, CPU and memory percentages, and command. Pipe it into grep to find one by name: ps aux | grep python.

top shows the same information live, sorted by CPU. Press q to leave. It is the first thing to open when a machine feels slow.

kill PID asks a process to stop politely. kill -9 PID forces it, for when the polite version is ignored. You can only kill your own processes unless you use sudo.

Adding & after a command runs it in the background, and jobs lists those background jobs.`,
  example: {
    language: 'bash',
    caption: 'Find the hog, stop it',
    code: `ps aux | grep runaway
learner  2841 97.3  1.2 ... python3 runaway.py
kill 2841
ps aux | grep runaway
learner  2903  0.0  0.0 ... grep runaway`,
  },
  task: {
    kind: 'shell',
    instructions: 'A script called runaway.py is eating the CPU.\n1. Look at the machine with top.\n2. Find the PID of the runaway process with ps aux and grep.\n3. Stop it with kill.\n4. Confirm it is gone with ps aux and grep again.',
    seed: HOME_SEED,
    machine: { processes: [{ pid: 2841, user: 'learner', cmd: 'python3 runaway.py', cpu: 97.3, mem: 1.2 }, { pid: 2650, user: 'learner', cmd: 'python3 -m http.server 8000', cpu: 0.1, mem: 0.6 }] },
    hints: ['top prints a snapshot here. The process with the highest %CPU is the one you want.', 'ps aux | grep runaway shows the line with the PID in the second column.', 'kill 2841 (use the PID you found).'],
    solution: { commands: ['top', 'ps aux | grep runaway', 'kill 2841', 'ps aux | grep runaway'] },
    check: (r) => {
      const gone = !(r.state?.processes ?? []).some((p) => p.cmd.includes('runaway'))
      return steps([
        [ran(r, /^\s*(top|htop)\b/), 'Open top to see what is using the CPU.'],
        [ranWith(r, /^\s*ps\b.*\|\s*grep\b.*runaway/, /2841/), 'Find the PID with ps aux | grep runaway.'],
        [ran(r, /^\s*kill\b.*2841/) && gone, 'Stop the process with kill and its PID.'],
        [ranWith(r, /^\s*ps\b.*\|\s*grep\b.*runaway/, /^(?!.*python3 runaway)[\s\S]*$/) && (r.history ?? []).lastIndexOf('kill 2841') >= 0 && (r.history ?? []).findLastIndex((h) => /ps\b.*runaway/.test(h)) > (r.history ?? []).findIndex((h) => /^\s*kill\b/.test(h)), 'Run ps aux | grep runaway once more to confirm it is gone.'],
      ], 'Found the runaway process and stopped it cleanly.')
    },
  },
  quiz: [
    { question: 'What is a PID?', options: ['A process identifier number', 'A permission level', 'A program installer'], answer: 0, explanation: 'Every running process gets a unique number that kill and other tools use to refer to it.' },
    { question: 'What is the difference between kill PID and kill -9 PID?', options: ['-9 is slower', 'kill asks nicely, -9 forces the process to end', 'There is none'], answer: 1, explanation: 'Plain kill sends SIGTERM so the program can clean up. -9 sends SIGKILL which cannot be ignored.' },
    { question: 'How do you leave top?', options: ['Ctrl+D', 'Type exit', 'Press q'], answer: 2, explanation: 'q quits top, less, and man pages alike.' },
  ],
}

export default lesson
