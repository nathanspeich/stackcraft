import type { Lesson } from '../types'
import { HOME_SEED, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w01d1',
  tier: 1,
  track: 'linux',
  week: 1,
  day: 1,
  title: 'Terminal orientation and navigation',
  concept: `The terminal is a text conversation with your computer. You type a command, press Enter, and the shell (a program called bash) runs it and prints the result.

The line ending in $ is the prompt. It shows your user name, the machine name, and where you are. The ~ symbol means your home directory, the folder that belongs to you.

Three commands cover most navigation. pwd prints your current directory. ls lists what is in it. cd moves you somewhere else: cd projects goes into a folder, cd .. goes up one level, and cd on its own takes you home.

You are never lost in a terminal as long as you can run pwd.`,
  example: {
    language: 'bash',
    caption: 'A short walk around home',
    code: `learner@stackbox:~$ pwd
/home/learner
learner@stackbox:~$ ls
documents  downloads  photos  projects
learner@stackbox:~$ cd projects
learner@stackbox:~/projects$ ls
notes  website
learner@stackbox:~/projects$ cd ..
learner@stackbox:~$`,
  },
  task: {
    kind: 'shell',
    instructions: 'Start in your home directory. Move into the projects folder, then into notes. Run pwd there to prove where you are. Finally, go back home with cd and run ls.',
    seed: HOME_SEED,
    hints: ['You can move in two steps (cd projects, then cd notes) or one step (cd projects/notes).', 'cd with nothing after it always returns you home.', 'Tab completes folder names: type cd pro and press Tab.'],
    solution: { commands: ['cd projects/notes', 'pwd', 'cd', 'ls'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*pwd\s*$/, /^\/home\/learner\/projects\/notes\n$/), 'Run pwd while you are inside ~/projects/notes.'],
        [ran(r, /^\s*cd\s*$/) || ran(r, /^\s*cd\s+~\s*$/), 'Now go back home with plain cd.'],
        [ranWith(r, /^\s*ls\b/, /documents/) && r.cwd === '/home/learner', 'Run ls from your home directory.'],
      ], 'You navigated down, proved your location, and came back home.'),
  },
  quiz: [
    { question: 'What does pwd print?', options: ['The password file', 'The directory you are currently in', 'A list of files'], answer: 1, explanation: 'pwd stands for print working directory.' },
    { question: 'Which command moves you up one level?', options: ['cd ..', 'cd .', 'cd up'], answer: 0, explanation: 'Two dots mean the parent directory. One dot means the current one.' },
    { question: 'What does ~ mean in the prompt?', options: ['The root of the disk', 'A temporary folder', 'Your home directory'], answer: 2, explanation: 'The tilde is shorthand for /home/yourname.' },
  ],
}

export default lesson
