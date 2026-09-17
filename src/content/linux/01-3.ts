import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const STORY = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}: ${['The ship left port at dawn.', 'Nobody spoke for an hour.', 'Then the wind changed.', 'The captain checked the map twice.', 'A gull landed on the rail.'][i % 5]}`).join('\n') + '\n'

const lesson: Lesson = {
  id: 'w01d3',
  tier: 1,
  track: 'linux',
  week: 1,
  day: 3,
  title: 'Reading files: cat, less, head, tail, wc',
  concept: `You will read far more files than you write, so it pays to know the fast ways to look inside one.

cat prints a whole file to the screen. It is perfect for short files and awkward for long ones, because everything scrolls past.

less shows a file one screen at a time. Space moves forward, b moves back, / searches, and q quits.

head prints the first 10 lines, tail the last 10. Both accept -n to choose a different count: head -n 3 or tail -n 20. tail -f keeps watching a file as it grows, which is how people follow logs.

wc counts. wc -l gives lines, wc -w words, wc -c bytes.`,
  example: {
    language: 'bash',
    caption: 'Peeking at a long file',
    code: `wc -l story.txt
30 story.txt
head -n 2 story.txt
Line 1: The ship left port at dawn.
Line 2: Nobody spoke for an hour.
tail -n 1 story.txt
Line 30: A gull landed on the rail.`,
  },
  task: {
    kind: 'shell',
    instructions: 'There is a file called story.txt in your home directory.\n1. Count its lines with wc.\n2. Show only its first 5 lines.\n3. Show only its last 3 lines.\n4. Print the whole of projects/notes/ideas.txt with cat.',
    seed: { ...HOME_SEED, '/home/learner/story.txt': STORY },
    hints: ['wc -l story.txt counts lines.', 'head -n 5 story.txt shows five lines. tail -n 3 shows the last three.', 'cat projects/notes/ideas.txt prints the short file.'],
    solution: { commands: ['wc -l story.txt', 'head -n 5 story.txt', 'tail -n 3 story.txt', 'cat projects/notes/ideas.txt'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*wc\b.*story\.txt/, /\b30\b/), 'Count the lines in story.txt with wc -l.'],
        [ranWith(r, /^\s*head\b.*story\.txt/, /^Line 1:[\s\S]*Line 5:[^\n]*\n$/), 'Show exactly the first 5 lines with head -n 5.'],
        [ranWith(r, /^\s*tail\b.*story\.txt/, /^Line 28:[\s\S]*Line 30:[^\n]*\n$/), 'Show exactly the last 3 lines with tail -n 3.'],
        [ranWith(r, /^\s*cat\b.*ideas\.txt/, /Automate backups/), 'Print projects/notes/ideas.txt with cat.'],
      ], 'You can size up any file in seconds now.'),
  },
  quiz: [
    { question: 'Which command shows only the last lines of a file?', options: ['tail', 'head', 'less'], answer: 0, explanation: 'tail shows the end. head shows the beginning.' },
    { question: 'How do you count the lines in notes.txt?', options: ['count notes.txt', 'wc -l notes.txt', 'ls -l notes.txt'], answer: 1, explanation: 'wc -l counts newline characters, which is the line count.' },
    { question: 'You opened a big file with less. How do you get out?', options: ['Press q', 'Press Ctrl+D', 'Type exit'], answer: 0, explanation: 'q quits less (and man pages, which use the same viewer).' },
  ],
}

export default lesson
