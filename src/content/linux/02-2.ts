import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w02d2',
  tier: 1,
  track: 'linux',
  week: 2,
  day: 2,
  title: 'Users and sudo',
  concept: `Linux is built for many users sharing one machine, even when that machine is just yours. Each user has a name, a numeric id, a home directory, and a set of groups. whoami prints your name, and id prints the numbers and groups.

The list of users lives in /etc/passwd, which anyone can read. Password hashes live in /etc/shadow, which only root can read.

root is the administrator account. It can read, change, or delete anything, so you do not work as root all day. Instead you put sudo in front of a single command to run just that command as root. On a real system sudo asks for your password the first time.

Members of the sudo group may use sudo. id shows whether you are one of them.`,
  example: {
    language: 'bash',
    caption: 'Who am I, and who can I become?',
    code: `whoami
learner
id
uid=1000(learner) gid=1000(learner) groups=1000(learner),27(sudo)
cat /etc/shadow
cat: /etc/shadow: Permission denied
sudo cat /etc/shadow | head -n 1
root:$6$rounds=5000$...:19600:0:99999:7:::`,
  },
  task: {
    kind: 'shell',
    instructions: '1. Print your user name and your id.\n2. Find your own line in /etc/passwd using grep.\n3. Try to read /etc/shadow as yourself, and watch it fail.\n4. Read it again with sudo.\n5. Run whoami with sudo to see who you become.',
    seed: HOME_SEED,
    hints: ['whoami and id take no arguments.', 'grep learner /etc/passwd prints only your line.', 'Put sudo in front: sudo cat /etc/shadow, sudo whoami.'],
    solution: { commands: ['whoami', 'id', 'grep learner /etc/passwd', 'cat /etc/shadow', 'sudo cat /etc/shadow', 'sudo whoami'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*whoami\s*$/, /^learner\n$/), 'Run whoami.'],
        [ranWith(r, /^\s*id\b/, /uid=1000/), 'Run id to see your numeric ids and groups.'],
        [ranWith(r, /grep\b.*learner.*\/etc\/passwd|cat \/etc\/passwd.*\|\s*grep\b.*learner/, /^learner:x:1000/m), 'Find your line in /etc/passwd with grep learner /etc/passwd.'],
        [ranWith(r, /^\s*cat\s+\/etc\/shadow/, /Permission denied/), 'Try cat /etc/shadow without sudo first.'],
        [ranWith(r, /^\s*sudo\s+cat\s+\/etc\/shadow/, /^root:/m), 'Now read it with sudo cat /etc/shadow.'],
        [ranWith(r, /^\s*sudo\s+whoami/, /^root\n$/), 'Run sudo whoami.'],
      ], 'You know who you are, who root is, and how to borrow root for one command.'),
  },
  quiz: [
    { question: 'What does sudo do?', options: ['Switches you to root permanently', 'Runs one command as root', 'Creates a new user'], answer: 1, explanation: 'sudo runs a single command with root privileges and then you are yourself again.' },
    { question: 'Why can you read /etc/passwd but not /etc/shadow?', options: ['shadow is hidden', 'shadow holds password hashes, so its permissions restrict it to root', 'passwd is a text file and shadow is binary'], answer: 1, explanation: 'Both are text. shadow is mode 640 and owned by root, so normal users are refused.' },
    { question: 'Which command shows the groups you belong to?', options: ['id', 'pwd', 'ls -l'], answer: 0, explanation: 'id prints uid, gid, and every group you are in, including sudo if you have it.' },
  ],
}

export default lesson
