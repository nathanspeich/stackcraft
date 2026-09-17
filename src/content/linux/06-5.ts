import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'w06d5',
  tier: 1,
  track: 'linux',
  week: 6,
  day: 5,
  title: 'SSH and scp',
  concept: `SSH is how you work on a machine that is somewhere else. ssh user@host opens a shell on that host, encrypted end to end. Everything you have learned works there exactly the same, because it is the same bash.

The first time you connect, ssh shows the host's fingerprint and asks you to trust it. After that it warns you if the fingerprint changes.

Passwords work, but keys are better. ssh-keygen creates a key pair in ~/.ssh: a private key that never leaves your machine and a public key you copy to the server with ssh-copy-id. Then logins are both passwordless and safer.

scp copies files over SSH. scp report.txt user@host:/tmp/ uploads. scp user@host:/var/log/syslog . downloads. The colon marks the remote side.`,
  example: {
    language: 'bash',
    caption: 'Log in, copy a file, log out',
    code: `ssh-keygen -t ed25519          # once, press Enter for the defaults
ssh-copy-id learner@192.168.64.5
ssh learner@192.168.64.5
learner@stackbox:~$ uname -a
learner@stackbox:~$ exit
scp notes.txt learner@192.168.64.5:~/`,
  },
  task: {
    kind: 'selfcheck',
    instructions: 'This terminal cannot open real network connections, so this one is for your real machine. You need any second Linux box you can reach: a friend\'s machine, a cheap VPS, or a virtual machine. If you have none yet, that is fine: check the steps you could complete, and revisit this lesson in week 13 when you set up the Stackcraft VM.',
    steps: [
      'I ran ssh-keygen -t ed25519 and have id_ed25519 and id_ed25519.pub in ~/.ssh',
      'I connected to a remote machine with ssh user@host and ran uname -a there',
      'I copied a file to the remote machine with scp and saw it there with ls',
      'I typed exit to come back to my own shell',
    ],
  },
  quiz: [
    { question: 'What does ssh-copy-id do?', options: ['Copies your private key to the server', 'Copies your public key to the server so key logins work', 'Copies the server fingerprint to your machine'], answer: 1, explanation: 'Only the public key travels. The private key stays in your ~/.ssh.' },
    { question: 'In scp file.txt bob@server:/tmp/, which side is remote?', options: ['The part with the colon', 'The part without the colon', 'Both'], answer: 0, explanation: 'user@host: marks the remote location. The plain path is local.' },
    { question: 'ssh warns that a host fingerprint has changed. What should you do?', options: ['Ignore it and continue', 'Stop and find out why before connecting', 'Reboot your machine'], answer: 1, explanation: 'A changed fingerprint can mean the server was reinstalled, or that something is intercepting the connection. Check first.' },
  ],
}

export default lesson
