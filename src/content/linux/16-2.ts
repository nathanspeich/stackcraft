import type { Lesson } from '../types'
import { HOME_SEED, mode, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w16d2',
  tier: 2,
  track: 'linux',
  week: 16,
  day: 2,
  title: 'Octal permissions and umask',
  concept: `Each permission set is three bits: read is 4, write is 2, execute is 1. Add them up and you get one digit per group of people: owner, group, others. rwxr-xr-x is 755, rw-r--r-- is 644, rw------- is 600. chmod 640 file sets all nine bits in one go.

Where do the defaults for a brand new file come from? Programs ask for 666 (files) or 777 (folders), and the umask takes bits away. With the usual umask of 022, group and others lose write: files become 644, folders 755.

umask prints the current mask, umask 077 sets a stricter one for this shell, so new files are yours alone (600, folders 700). umask -S shows the same thing as letters.`,
  example: {
    language: 'bash',
    caption: 'The same file mode, three ways of reading it',
    code: `umask          # 0022
touch report.txt
ls -l report.txt   # -rw-r--r--  owner 6, group 4, others 4
stat -c %a report.txt   # 644

umask 077
touch secret.txt
ls -l secret.txt   # -rw-------  600`,
  },
  task: {
    kind: 'shell',
    instructions: '1. Print the current umask, then create notes.txt with touch and look at it with ls -l (expect 644).\n2. Set the umask to 077.\n3. Create a folder called private and a file private/secret.txt. Check them with ls -ld private and ls -l private.\n4. Set the umask to 002 and create shared.txt (group members should be able to write it).\n5. Print the umask in symbolic form with umask -S.',
    seed: HOME_SEED,
    hints: ['umask on its own prints the mask. umask 077 changes it for the rest of this session.', 'mkdir private, then touch private/secret.txt. With umask 077 the folder becomes 700 and the file 600.', 'umask 002 keeps group write: a new file gets 666 minus 002, which is 664.', 'umask -S prints something like u=rwx,g=rwx,o=rx.'],
    solution: { commands: ['umask', 'touch notes.txt', 'ls -l notes.txt', 'umask 077', 'mkdir private', 'touch private/secret.txt', 'ls -ld private', 'ls -l private', 'umask 002', 'touch shared.txt', 'umask -S'] },
    check: (r) => {
      const h = '/home/learner'
      const exists = (p: string) => Boolean(r.fs && p in r.fs)
      return steps([
        [ranWith(r, /^\s*umask\s*$/, /^0022\n$/), 'Step 1: run umask on its own first. It should print 0022.'],
        [exists(h + '/notes.txt') && (mode(r, h + '/notes.txt') & 0o777) === 0o644, 'Step 1: create notes.txt with touch while the umask is still 0022, so it ends up 644.'],
        [ranWith(r, /ls\s+-l.*notes\.txt/, /^-rw-r--r--/), 'Step 1: look at it with ls -l notes.txt.'],
        [exists(h + '/private') && (mode(r, h + '/private') & 0o777) === 0o700, 'Steps 2 and 3: set umask 077, then mkdir private. The folder should be 700 (drwx------).'],
        [exists(h + '/private/secret.txt') && (mode(r, h + '/private/secret.txt') & 0o777) === 0o600, 'Step 3: with umask 077 in place, touch private/secret.txt. It should be 600.'],
        [ranWith(r, /ls\s+-ld\s+private/, /^drwx------/), 'Step 3: run ls -ld private to see the folder itself.'],
        [exists(h + '/shared.txt') && (mode(r, h + '/shared.txt') & 0o777) === 0o664, 'Step 4: set umask 002, then create shared.txt. It should be 664 (rw-rw-r--).'],
        [ranWith(r, /umask\s+-S/, /^u=rwx,g=rwx,o=rx\n$/), 'Step 5: run umask -S while the mask is 002. Expected: u=rwx,g=rwx,o=rx.'],
      ], 'You can now read a mode as a number and predict what a new file will get before you create it.')
    },
  },
  quiz: [
    { question: 'What mode is rw-r-----?', options: ['640', '604', '460'], answer: 0, explanation: 'Owner rw is 4+2=6, group r is 4, others nothing is 0.' },
    { question: 'With umask 022, what mode does a new folder get?', options: ['644', '755', '777'], answer: 1, explanation: 'Folders start from 777 and the mask removes write for group and others: 755.' },
    { question: 'What does umask 077 change?', options: ['Existing files become private', 'New files and folders in this shell get no group or other permissions', 'The permissions of your home folder'], answer: 1, explanation: 'umask only affects files created afterwards, in the shell where you set it.' },
  ],
}

export default lesson
