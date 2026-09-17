import type { Lesson } from '../types'
import { HOME_SEED, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w01d4',
  tier: 1,
  track: 'linux',
  week: 1,
  day: 4,
  title: 'Getting help: man, --help, which',
  concept: `Nobody memorizes every flag. Experienced Linux users look things up constantly, they just know where.

man opens the manual page for a command: man ls. It uses the same viewer as less, so / searches and q quits. Read the NAME and SYNOPSIS at the top, then skim the options.

Most commands also accept --help and print a shorter summary right in the terminal. It is quicker for a reminder.

which tells you where a command lives on disk, for example /usr/bin/python3. If which prints nothing, the command is not installed or not on your PATH.

When you are stuck: man first, --help second, then search the web with the exact error text.`,
  example: {
    language: 'bash',
    caption: 'Three ways to ask for help',
    code: `man mkdir        # full manual, q to quit
mkdir --help     # short summary
which mkdir
/usr/bin/mkdir`,
  },
  task: {
    kind: 'shell',
    instructions: 'Practice asking for help:\n1. Open the manual page for ls with man.\n2. Print the short help for grep with --help.\n3. Use which to find where python3 is installed.\n4. Use which on a command that does not exist, like fakecmd, and notice it prints nothing.',
    seed: HOME_SEED,
    hints: ['man ls opens the manual. In this terminal it prints the page.', 'grep --help prints the summary.', 'which python3 prints the path. which fakecmd prints nothing and exits with status 1.'],
    solution: { commands: ['man ls', 'grep --help', 'which python3', 'which fakecmd'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*man\s+ls\s*$/, /list directory contents/), 'Open the manual for ls with man ls.'],
        [ranWith(r, /^\s*grep\s+--help/, /grep/), 'Print the short help for grep with grep --help.'],
        [ranWith(r, /^\s*which\s+python3/, /\/usr\/bin\/python3/), 'Find python3 with which python3.'],
        [ran(r, /^\s*which\s+(?!python3|ls|grep|man)\S+/), 'Now try which on a command that does not exist, such as which fakecmd.'],
      ], 'You know how to find answers without leaving the terminal.'),
  },
  quiz: [
    { question: 'Which command opens the full manual for cp?', options: ['cp --manual', 'help cp', 'man cp'], answer: 2, explanation: 'man plus the command name opens its manual page.' },
    { question: 'Inside a man page, how do you search for a word?', options: ['Type / then the word', 'Press Ctrl+F', 'Type find word'], answer: 0, explanation: 'man uses the less viewer, where / starts a search and n jumps to the next match.' },
    { question: 'which curl prints nothing. What does that mean?', options: ['curl has no options', 'curl is not installed or not on your PATH', 'curl is a built-in'], answer: 1, explanation: 'which searches the PATH directories. No output means no executable was found there.' },
  ],
}

export default lesson
