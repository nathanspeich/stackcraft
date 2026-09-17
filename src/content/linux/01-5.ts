import type { Lesson } from '../types'
import { HOME_SEED, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w01d5',
  tier: 1,
  track: 'linux',
  week: 1,
  day: 5,
  title: 'Absolute vs relative paths and PATH',
  concept: `A path is an address for a file. There are two kinds.

An absolute path starts with / and spells out the whole route from the root of the disk: /home/learner/documents/letter.txt. It works from anywhere.

A relative path starts from where you are now: documents/letter.txt works only if you are in /home/learner. Two shortcuts help: . means the current directory and .. means the parent, so ../projects climbs up and then goes into projects.

PATH is different. It is a variable holding a list of directories, separated by colons. When you type ls, the shell searches those directories in order for a program called ls. echo $PATH shows the list. That is why which can tell you where a command lives.`,
  example: {
    language: 'bash',
    caption: 'Same file, two addresses',
    code: `cat /home/learner/documents/letter.txt   # absolute, works anywhere
cd documents
cat letter.txt                            # relative to the current directory
cd ../projects                            # up one, then into projects
echo $PATH
/usr/local/bin:/usr/bin:/bin`,
  },
  task: {
    kind: 'shell',
    instructions: '1. From home, print documents/letter.txt using its absolute path.\n2. Move into documents and print the same file with a relative path.\n3. From documents, move to projects/website in one cd command that uses .. and list it.\n4. Print your PATH variable with echo.',
    seed: HOME_SEED,
    hints: ['The absolute path is /home/learner/documents/letter.txt.', 'After cd documents, the relative path is just letter.txt.', 'cd ../projects/website goes up one level and then down two.', 'Variables are read with a dollar sign: echo $PATH.'],
    solution: { commands: ['cat /home/learner/documents/letter.txt', 'cd documents', 'cat letter.txt', 'cd ../projects/website', 'ls', 'echo $PATH'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*cat\s+\/home\/learner\/documents\/letter\.txt/, /Dear future me/), 'Print the letter using its absolute path, starting with /home/learner.'],
        [ranWith(r, /^\s*cat\s+(\.\/)?letter\.txt\s*$/, /Dear future me/), 'cd into documents and print letter.txt with a relative path.'],
        [ran(r, /^\s*cd\s+\.\.\/projects\/website/), 'From documents, run cd ../projects/website in one command.'],
        [ranWith(r, /^\s*ls\b/, /index\.html/), 'List the website directory with ls.'],
        [ranWith(r, /echo\s+"?\$PATH"?/, /\/usr\/bin/), 'Print the PATH variable with echo $PATH.'],
      ], 'Absolute, relative, and PATH: you can address anything now.'),
  },
  quiz: [
    { question: 'Which of these is an absolute path?', options: ['projects/notes', '../notes', '/home/learner/notes'], answer: 2, explanation: 'Absolute paths always begin with / and are valid from any directory.' },
    { question: 'What does .. mean in a path?', options: ['The home directory', 'The parent directory', 'A hidden file'], answer: 1, explanation: 'One dot is here, two dots is one level up.' },
    { question: 'What is PATH?', options: ['The current directory', 'A list of directories the shell searches for commands', 'The path to your home folder'], answer: 1, explanation: 'When you type a command name, the shell looks through PATH directories in order until it finds it.' },
  ],
}

export default lesson
