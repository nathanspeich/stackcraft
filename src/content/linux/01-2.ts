import type { Lesson } from '../types'
import { HOME_SEED, fileExists, isDir, ran, steps } from '../checks'

const lesson: Lesson = {
  id: 'w01d2',
  tier: 1,
  track: 'linux',
  week: 1,
  day: 2,
  title: 'Files and directories',
  concept: `Everything on Linux is a file or a directory, and a handful of commands manage them.

mkdir makes a directory. mkdir -p makes a whole path at once, creating any missing parents. touch creates an empty file, or updates the timestamp of an existing one.

cp copies: cp source destination. Add -r to copy a directory with everything inside it. mv moves, and because renaming is just moving to a new name, mv is also how you rename things.

rm removes files. rm -r removes a directory and its contents. There is no trash can and no undo, so read an rm command twice before you press Enter.`,
  example: {
    language: 'bash',
    caption: 'Create, copy, rename, remove',
    code: `mkdir -p garden/seeds/2026
touch garden/plan.txt
cp garden/plan.txt garden/plan-copy.txt
mv garden/plan-copy.txt garden/plan-final.txt
rm garden/plan-final.txt
ls garden
plan.txt  seeds`,
  },
  task: {
    kind: 'shell',
    instructions: 'Build a small workspace in your home directory:\n1. Create a directory called workshop with a nested path drafts/2026 inside it, in one command.\n2. Create an empty file workshop/plan.txt.\n3. Copy it to workshop/plan-backup.txt.\n4. Rename the copy to workshop/plan-v2.txt with mv.\n5. Remove the drafts directory tree.',
    seed: HOME_SEED,
    hints: ['mkdir -p workshop/drafts/2026 creates all three levels at once.', 'mv old-name new-name renames a file.', 'Removing a directory that has things inside needs rm -r.'],
    solution: { commands: ['mkdir -p workshop/drafts/2026', 'touch workshop/plan.txt', 'cp workshop/plan.txt workshop/plan-backup.txt', 'mv workshop/plan-backup.txt workshop/plan-v2.txt', 'rm -r workshop/drafts'] },
    check: (r) =>
      steps([
        [isDir(r, '/home/learner/workshop'), 'Create the workshop directory first.'],
        [ran(r, /mkdir\s+-p\s+\S*workshop\/drafts\/2026/) || isDir(r, '/home/learner/workshop/drafts/2026') || ran(r, /rm\s+-r/), 'Create workshop/drafts/2026 with mkdir -p.'],
        [fileExists(r, '/home/learner/workshop/plan.txt'), 'Create workshop/plan.txt with touch.'],
        [ran(r, /^\s*cp\s+\S*plan\.txt\s+\S*plan-backup\.txt/), 'Copy plan.txt to plan-backup.txt with cp.'],
        [fileExists(r, '/home/learner/workshop/plan-v2.txt') && !fileExists(r, '/home/learner/workshop/plan-backup.txt') && ran(r, /^\s*mv\s/), 'Rename plan-backup.txt to plan-v2.txt with mv.'],
        [!fileExists(r, '/home/learner/workshop/drafts'), 'Remove the drafts directory with rm -r workshop/drafts.'],
      ], 'Directory made, file created, copied, renamed, and cleaned up.'),
  },
  quiz: [
    { question: 'What does the -p flag do for mkdir?', options: ['Prints the new directory', 'Creates missing parent directories too', 'Protects the directory from deletion'], answer: 1, explanation: 'mkdir -p a/b/c creates a, then b, then c as needed.' },
    { question: 'How do you rename report.txt to final.txt?', options: ['rename report.txt final.txt', 'cp report.txt final.txt', 'mv report.txt final.txt'], answer: 2, explanation: 'Moving a file to a new name is a rename. cp would leave the original in place.' },
    { question: 'Why should you be careful with rm?', options: ['It asks for a password', 'Deleted files do not go to a trash can', 'It only works on empty files'], answer: 1, explanation: 'rm deletes immediately and permanently. There is no undo.' },
  ],
}

export default lesson
