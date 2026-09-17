import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w11d1',
  tier: 1,
  track: 'linux',
  week: 11,
  day: 1,
  title: 'Environment variables and .bashrc',
  concept: `Variables let the shell remember values. NAME=value sets one (no spaces around the =), and $NAME reads it. echo $HOME prints your home directory because HOME is already set.

A plain variable exists only in the current shell. export NAME=value makes it an environment variable, which means programs you start from this shell can see it too. env lists the exported ones. Tools read settings this way: EDITOR picks your editor, PATH decides where commands are found.

Variables vanish when the shell closes. To make one permanent, add the export line to ~/.bashrc, a script bash runs every time a new shell starts. To apply changes without opening a new terminal, run source ~/.bashrc.`,
  example: {
    language: 'bash',
    caption: 'Temporary, exported, permanent',
    code: `COLOR=blue
echo $COLOR
blue
export EDITOR=nano
env | grep EDITOR
EDITOR=nano
echo 'export FAVORITE_COLOR=green' >> ~/.bashrc
source ~/.bashrc
echo $FAVORITE_COLOR
green`,
  },
  task: {
    kind: 'shell',
    instructions: '1. Print HOME and PATH with echo.\n2. Set a plain variable MOOD=curious and print it.\n3. Export EDITOR=nano and prove it is exported with env and grep.\n4. In the editor above, add a line to ~/.bashrc that exports FAVORITE_COLOR=green.\n5. Reload with source ~/.bashrc and print FAVORITE_COLOR.',
    seed: HOME_SEED,
    file: '/home/learner/.bashrc',
    starter: '# ~/.bashrc: run for every new interactive shell\n\nexport EDITOR=nano\nalias ll="ls -l"\n',
    hints: ['echo $HOME and echo $PATH read variables with a dollar sign.', 'MOOD=curious has no spaces. Then echo $MOOD.', 'env | grep EDITOR shows only exported variables.', 'Add the line export FAVORITE_COLOR=green in the editor, then run source ~/.bashrc.'],
    solution: { file: '# ~/.bashrc\nexport EDITOR=nano\nexport FAVORITE_COLOR=green\n', commands: ['echo $HOME', 'echo $PATH', 'MOOD=curious', 'echo $MOOD', 'export EDITOR=nano', 'env | grep EDITOR', 'source ~/.bashrc', 'echo $FAVORITE_COLOR'] },
    check: (r) => {
      const rc = fileContent(r, '/home/learner/.bashrc') ?? ''
      return steps([
        [ranWith(r, /echo\s+"?\$HOME/, /\/home\/learner/) && ranWith(r, /echo\s+"?\$PATH/, /\/usr\/bin/), 'Print both HOME and PATH with echo $HOME and echo $PATH.'],
        [ranWith(r, /echo\s+"?\$MOOD/, /^curious\n$/), 'Set MOOD=curious and print it with echo $MOOD.'],
        [ranWith(r, /env\s*\|\s*grep\s+EDITOR|printenv\s+EDITOR/, /nano/), 'Export EDITOR=nano and check with env | grep EDITOR.'],
        [/^\s*export\s+FAVORITE_COLOR=["']?green["']?\s*$/m.test(rc), 'In the editor, add the line: export FAVORITE_COLOR=green to ~/.bashrc.'],
        [ran(r, /^\s*(source|\.)\s+~\/\.bashrc|^\s*(source|\.)\s+\/home\/learner\/\.bashrc|^\s*(source|\.)\s+\.bashrc/), 'Reload the file with source ~/.bashrc.'],
        [ranWith(r, /echo\s+"?\$FAVORITE_COLOR/, /^green\n$/) && r.env?.FAVORITE_COLOR === 'green', 'Print it: echo $FAVORITE_COLOR should say green.'],
      ], 'Variables set, exported, and made permanent.')
    },
  },
  quiz: [
    { question: 'What does export change about a variable?', options: ['It makes it read-only', 'Programs started from this shell can see it', 'It saves it to disk'], answer: 1, explanation: 'Exported variables are passed into the environment of child processes.' },
    { question: 'Why edit ~/.bashrc?', options: ['To change your password', 'So settings apply to every new shell', 'To install packages'], answer: 1, explanation: 'bash runs .bashrc on startup, so anything there becomes permanent.' },
    { question: 'You edited .bashrc but nothing changed. Why?', options: ['You must run source ~/.bashrc or open a new terminal', 'The file needs chmod +x', 'You need sudo'], answer: 0, explanation: 'The running shell already read the old file. source re-reads it in place.' },
  ],
}

export default lesson
