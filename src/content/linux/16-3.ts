import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

/** Two teammates already exist on the box, and learner is in the team group too. */
const TEAM_SEED: Record<string, string> = {
  ...HOME_SEED,
  '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nsshd:x:105:65534::/run/sshd:/usr/sbin/nologin\nlearner:x:1000:1000:Learner:/home/learner:/bin/bash\nalice:x:1001:1001:Alice Moreau:/home/alice:/bin/bash\nbob:x:1002:1002:Bob Tanaka:/home/bob:/bin/bash\n',
  '/etc/group': 'root:x:0:\nsudo:x:27:learner\nlearner:x:1000:\nalice:x:1001:\nbob:x:1002:\nteam:x:1003:learner,alice,bob\n',
  '/etc/shadow': 'root:$6$rounds=5000$saltsalt$hashhashhashhash:19600:0:99999:7:::\nlearner:$6$rounds=5000$saltsalt$hashhashhashhash:19600:0:99999:7:::\nalice:$6$rounds=5000$saltsalt$hashhashhashhash:20700:0:99999:7:::\nbob:$6$rounds=5000$saltsalt$hashhashhashhash:20700:0:99999:7:::\n',
  '/home/alice/': '',
  '/home/bob/': '',
}

const lesson: Lesson = {
  id: 'w16d3',
  tier: 2,
  track: 'linux',
  week: 16,
  day: 3,
  title: 'setuid, setgid, sticky bit',
  concept: `Three extra bits sit in front of the nine you know, each solving a real sharing problem.

setuid (4000) on a program runs it as the file's owner. passwd is owned by root and setuid, so normal users can update /etc/shadow through it. ls shows an s in the owner's x slot: rwsr-xr-x.

setgid (2000) on a folder makes every new file inside inherit the folder's group instead of the creator's. That is how a shared team folder works: chgrp team, then chmod 2775. ls shows drwxrwsr-x.

The sticky bit (1000) on a folder means only a file's owner can delete or rename it, even when everyone can write there. /tmp is 1777, shown as drwxrwxrwt. A capital S or T means the bit is set but x is missing.`,
  example: {
    language: 'bash',
    caption: 'A shared folder where new files belong to the team',
    code: `sudo mkdir /srv/team
sudo chgrp team /srv/team
sudo chmod 2775 /srv/team
ls -ld /srv/team       # drwxrwsr-x root team
sudo -u alice touch /srv/team/plan.txt
ls -l /srv/team/plan.txt   # -rw-r--r-- alice team`,
  },
  task: {
    kind: 'shell',
    instructions: 'Users alice and bob exist and, like you, are in the team group.\n1. Create /srv/team, give it the team group, and set mode 2775 (setgid plus rwxrwxr-x). Each command needs sudo.\n2. Confirm with ls -ld /srv/team that the group is team and the mode shows an s.\n3. As alice, create a file: sudo -u alice touch /srv/team/plan.txt. Check with ls -l that its group is team, not alice.\n4. Add the sticky bit to /srv/team with chmod +t.\n5. As bob, try to delete alice\'s file with sudo -u bob rm /srv/team/plan.txt and watch it fail.\n6. Look at a setuid program: ls -l /usr/bin/passwd.',
    seed: TEAM_SEED,
    hints: ['Three commands for step 1: sudo mkdir /srv/team, sudo chgrp team /srv/team, sudo chmod 2775 /srv/team.', 'sudo -u alice runs one command as alice. Files she creates in the setgid folder get the team group automatically.', 'sudo chmod +t /srv/team adds the sticky bit. ls -ld should then end with rwsr-t.', 'The rm as bob is supposed to fail with Operation not permitted: that is the sticky bit doing its job.'],
    solution: { commands: ['sudo mkdir /srv/team', 'sudo chgrp team /srv/team', 'sudo chmod 2775 /srv/team', 'ls -ld /srv/team', 'sudo -u alice touch /srv/team/plan.txt', 'ls -l /srv/team', 'sudo chmod +t /srv/team', 'sudo -u bob rm /srv/team/plan.txt', 'ls -l /usr/bin/passwd'] },
    check: (r) => {
      const perms = (r.state?.sims?.users as { perms?: Record<string, { mode: number; owner: string; group: string }> } | undefined)?.perms ?? {}
      const dir = perms['/srv/team']
      const plan = perms['/srv/team/plan.txt']
      return steps([
        [Boolean(dir), 'Step 1: create the folder with sudo mkdir /srv/team.'],
        [dir?.group === 'team', 'Step 1: give the folder to the team group: sudo chgrp team /srv/team.'],
        [Boolean(dir && dir.mode & 0o2000 && (dir.mode & 0o777) === 0o775), 'Step 1: set the mode with sudo chmod 2775 /srv/team (the leading 2 is the setgid bit).'],
        [ranWith(r, /ls\s+-ld\s+\/srv\/team/, /^drwxrws/m), 'Step 2: run ls -ld /srv/team and check for the s in the group slot.'],
        [plan?.owner === 'alice', 'Step 3: create the file as alice: sudo -u alice touch /srv/team/plan.txt.'],
        [plan?.group === 'team', 'Step 3: plan.txt should have the group team. If it says alice, the setgid bit was not on the folder when the file was created: fix the folder, delete the file, and create it again.'],
        [ranWith(r, /ls\s+-l.*\/srv\/team/, /alice\s+team.*plan\.txt/), 'Step 3: run ls -l /srv/team to see alice as owner and team as group.'],
        [Boolean(dir && dir.mode & 0o1000), 'Step 4: add the sticky bit with sudo chmod +t /srv/team.'],
        [ranWith(r, /sudo\s+-u\s+bob\s+rm\s+\/srv\/team\/plan\.txt/, /Operation not permitted/), 'Step 5: run sudo -u bob rm /srv/team/plan.txt. The sticky bit should make it fail.'],
        [Boolean(plan), 'Step 5: plan.txt is gone. Recreate it as alice (sudo -u alice touch /srv/team/plan.txt) and make sure the sticky bit is set before bob tries again.'],
        [ranWith(r, /ls\s+-l\s+\/usr\/bin\/passwd/, /^-rws/m), 'Step 6: run ls -l /usr/bin/passwd and look for the s in the owner slot.'],
      ], 'Shared folder with group inheritance and delete protection, done. You will build the same thing on the real VM on day 5.')
    },
  },
  quiz: [
    { question: 'A folder shows drwxrwsr-x. What does the s do?', options: ['Everyone can run files inside it', 'New files inside inherit the folder\'s group', 'Only root can delete files inside it'], answer: 1, explanation: 'setgid on a folder makes new files take the folder\'s group, which is what a shared team folder needs.' },
    { question: 'Why is /tmp mode 1777?', options: ['So anyone can write there but only delete their own files', 'So it is cleared at boot', 'So programs run as root inside it'], answer: 0, explanation: 'The 1 is the sticky bit: world-writable, but you can only remove what you own.' },
    { question: 'What does a capital S in ls output mean?', options: ['The bit is set with extra strength', 'The special bit is set but the execute bit underneath is missing', 'The file is a socket'], answer: 1, explanation: 'Lowercase s means s plus x. Uppercase S means the special bit without x, which is usually a mistake.' },
  ],
}

export default lesson
