import type { Lesson } from '../types'
import { HOME_SEED, isDir, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w16d1',
  tier: 2,
  track: 'linux',
  week: 16,
  day: 1,
  title: '/etc/passwd, /etc/group, useradd, usermod, id',
  concept: `Every account on a Linux box is one line in /etc/passwd: name, an x where the password used to be, user id, primary group id, full name, home folder, login shell. Password hashes live in /etc/shadow, which only root can read.

Groups are lines in /etc/group: name, x, group id, then the members who joined later. Your primary group comes from passwd, the rest from group.

sudo useradd -m -s /bin/bash -c "Full name" NAME creates an account with a home folder and bash as the shell. Without -s, Ubuntu gives new users plain sh.

sudo usermod -aG GROUP NAME adds a user to a group. Always keep the -a: usermod -G alone replaces the whole list. id NAME and getent group GROUP show the result.`,
  example: {
    language: 'bash',
    caption: 'Create a group and a user, then check both',
    code: `sudo groupadd team
sudo useradd -m -s /bin/bash -c "Deploy bot" deploy
sudo usermod -aG team deploy
id deploy
# uid=1001(deploy) gid=1002(deploy) groups=1002(deploy),1001(team)
getent group team
# team:x:1001:deploy`,
  },
  task: {
    kind: 'shell',
    instructions: '1. Find your own line in /etc/passwd with grep learner /etc/passwd and read the seven fields.\n2. Create a group called team.\n3. Create a user called deploy with a home folder, /bin/bash as its shell, and the comment "Deploy bot".\n4. Add deploy to the team group without removing it from any other group.\n5. Check the result with id deploy and getent group team.',
    seed: HOME_SEED,
    hints: ['useradd, groupadd, and usermod change system files, so each needs sudo in front.', 'useradd flags: -m makes the home folder, -s /bin/bash sets the shell, -c "Deploy bot" sets the comment. The user name goes last.', 'The safe way to add a group is usermod -aG team deploy. The -a means append.', 'getent group team prints the group line, with the members after the last colon.'],
    solution: { commands: ['grep learner /etc/passwd', 'sudo groupadd team', 'sudo useradd -m -s /bin/bash -c "Deploy bot" deploy', 'sudo usermod -aG team deploy', 'id deploy', 'getent group team'] },
    check: (r) => {
      const passwd = r.fs?.['/etc/passwd'] ?? ''
      const group = r.fs?.['/etc/group'] ?? ''
      const deployLine = passwd.split('\n').find((l) => l.startsWith('deploy:')) ?? ''
      const teamLine = group.split('\n').find((l) => l.startsWith('team:')) ?? ''
      const teamMembers = (teamLine.split(':')[3] ?? '').split(',')
      return steps([
        [ranWith(r, /grep\s+learner\s+\/etc\/passwd/, /^learner:x:1000:1000/m), 'Step 1: run grep learner /etc/passwd to see your own account line.'],
        [teamLine !== '', 'Step 2: create the group with sudo groupadd team.'],
        [deployLine !== '', 'Step 3: create the user with sudo useradd ... deploy (it needs sudo).'],
        [deployLine.split(':')[6] === '/bin/bash', 'Step 3: deploy must use /bin/bash as its shell. Remove the user with sudo userdel -r deploy and create it again with -s /bin/bash.'],
        [deployLine.split(':')[4] === 'Deploy bot', 'Step 3: the comment field should read Deploy bot. Fix it with sudo usermod -c "Deploy bot" deploy.'],
        [isDir(r, '/home/deploy'), 'Step 3: deploy has no home folder. The -m flag creates it (sudo userdel -r deploy, then useradd again with -m).'],
        [teamMembers.includes('deploy'), 'Step 4: add deploy to team with sudo usermod -aG team deploy.'],
        [ranWith(r, /^\s*id\s+deploy/, /\(team\)/), 'Step 5: run id deploy. Its output should list team.'],
        [ran(r, /getent\s+group\s+team/), 'Step 5: run getent group team to see the members.'],
      ], 'A group, a user with a proper shell, and a membership added the safe way. That is the daily bread of user management.')
    },
  },
  quiz: [
    { question: 'Which file stores password hashes?', options: ['/etc/passwd', '/etc/shadow', '/etc/group'], answer: 1, explanation: 'Despite the name, /etc/passwd holds an x. The hashes are in /etc/shadow, readable only by root.' },
    { question: 'What does usermod -G team deploy do without -a?', options: ['Adds team to the list of groups', 'Replaces every supplementary group with team', 'Creates the team group'], answer: 1, explanation: 'Without -a the list is replaced, which can silently kick a user out of sudo or docker. Use -aG.' },
    { question: 'Which useradd flag creates the home folder?', options: ['-m', '-d', '-h'], answer: 0, explanation: '-m makes /home/NAME. -d picks a different path but does not create it on its own.' },
  ],
}

export default lesson
