import type { Lesson } from '../types'
import { HOME_SEED, hasExecBit, mode, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w02d1',
  tier: 1,
  track: 'linux',
  week: 2,
  day: 1,
  title: 'Permissions and chmod',
  badge: 'first-script',
  concept: `Every file has an owner and a set of permissions. ls -l shows them at the start of each line, like -rwxr-xr--.

Ignore the first character (d for directory, - for file). The rest is three groups of three: owner, group, and everyone else. In each group, r means read, w means write, x means execute, and - means no.

So -rwxr-xr-- means: the owner can read, write, and run it; the group can read and run it; others can only read it.

chmod changes permissions. chmod +x script.sh makes a file runnable. chmod 600 secret.txt uses numbers: 4 is read, 2 is write, 1 is execute, and you add them up per group. 600 means the owner can read and write, nobody else can do anything.`,
  example: {
    language: 'bash',
    caption: 'Making a script runnable',
    code: `ls -l hello.sh
-rw-r--r-- 1 learner learner 32 Sep 17 09:00 hello.sh
./hello.sh
bash: ./hello.sh: Permission denied
chmod +x hello.sh
./hello.sh
Hello from a script!`,
  },
  task: {
    kind: 'shell',
    instructions: 'In your home directory there is scripts/hello.sh and a file called secret.txt.\n1. Look at the permissions of scripts/hello.sh with ls -l.\n2. Try to run it with ./scripts/hello.sh and read the error.\n3. Make it executable with chmod, then run it.\n4. Lock secret.txt so only you can read and write it: mode 600. Confirm with ls -l.',
    seed: { ...HOME_SEED, '/home/learner/scripts/hello.sh': '#!/bin/bash\necho "Hello from a script!"\n', '/home/learner/secret.txt': 'my diary\n' },
    hints: ['ls -l scripts/hello.sh shows -rw-r--r--, no x anywhere.', 'chmod +x scripts/hello.sh adds execute permission.', 'chmod 600 secret.txt gives the owner read and write, and removes everything for group and others.'],
    solution: { commands: ['ls -l scripts/hello.sh', './scripts/hello.sh', 'chmod +x scripts/hello.sh', './scripts/hello.sh', 'chmod 600 secret.txt', 'ls -l secret.txt'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*ls\s+-l.*hello\.sh/, /-rw/), 'Check the permissions with ls -l scripts/hello.sh.'],
        [ranWith(r, /^\s*\.\/scripts\/hello\.sh|^\s*scripts\/hello\.sh/, /Permission denied/), 'Try running ./scripts/hello.sh before changing anything. It should be refused.'],
        [hasExecBit(r, '/home/learner/scripts/hello.sh'), 'Make the script executable with chmod +x.'],
        [ranWith(r, /hello\.sh/, /Hello from a script!/), 'Now run ./scripts/hello.sh again.'],
        [mode(r, '/home/learner/secret.txt') === 0o600, 'Set secret.txt to mode 600 with chmod 600 secret.txt.'],
        [ranWith(r, /^\s*ls\s+-l.*secret\.txt/, /-rw-------/), 'Confirm with ls -l secret.txt. You should see -rw-------.'],
      ], 'You ran your first script and locked a file down.'),
  },
  quiz: [
    { question: 'In -rwxr-x---, what can "others" do?', options: ['Read only', 'Nothing', 'Read and execute'], answer: 1, explanation: 'The last three characters are ---, so everyone outside the owner and group has no access.' },
    { question: 'What does chmod 644 file.txt allow?', options: ['Owner read and write, everyone else read', 'Everyone read and write', 'Owner only'], answer: 0, explanation: '6 is read (4) plus write (2). 4 is read only. So owner rw, group r, others r.' },
    { question: 'Why does ./script.sh say Permission denied?', options: ['The file is missing', 'The file has no execute permission', 'You need to be in the root directory'], answer: 1, explanation: 'Running a file requires the x bit. chmod +x adds it.' },
  ],
}

export default lesson
