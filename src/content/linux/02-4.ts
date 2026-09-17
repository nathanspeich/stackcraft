import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w02d4',
  tier: 1,
  track: 'linux',
  week: 2,
  day: 4,
  title: 'Pipes and redirection',
  concept: `Commands print to the screen by default. Redirection sends that output somewhere else, and pipes connect commands together. This is the idea that makes the shell powerful.

command > file writes the output into a file, replacing whatever was there. command >> file appends to the end instead. Both create the file if needed.

command1 | command2 is a pipe. The output of the first command becomes the input of the second. cat access.log | grep 404 | wc -l reads a log, keeps the 404 lines, and counts them, without any temporary files.

Most text tools accept input from a pipe when you give them no file name. That is what makes them chain so well.`,
  example: {
    language: 'bash',
    caption: 'Redirect, append, pipe',
    code: `ls > files.txt          # save the listing
echo "made by me" >> files.txt   # add a line
cat files.txt | wc -l   # count the lines
sort scores.txt | head -n 3      # smallest three`,
  },
  task: {
    kind: 'shell',
    instructions: '1. Save a listing of ~/projects into a file called listing.txt using >.\n2. Append the line end of list to it using >> and echo.\n3. Count the lines of listing.txt by piping cat into wc -l.\n4. numbers.txt holds one number per line. Pipe sort -n into head -n 3 to show the three smallest.',
    seed: { ...HOME_SEED, '/home/learner/numbers.txt': '42\n7\n19\n3\n88\n15\n' },
    hints: ['ls ~/projects > listing.txt', 'echo "end of list" >> listing.txt', 'cat listing.txt | wc -l', 'sort -n numbers.txt | head -n 3'],
    solution: { commands: ['ls ~/projects > listing.txt', 'echo "end of list" >> listing.txt', 'cat listing.txt | wc -l', 'sort -n numbers.txt | head -n 3'] },
    check: (r) => {
      const listing = fileContent(r, '/home/learner/listing.txt') ?? ''
      return steps([
        [ran(r, /^\s*ls\b.*>\s*listing\.txt/) && /notes/.test(listing), 'Save the listing of ~/projects with ls ~/projects > listing.txt.'],
        [ran(r, /^\s*echo\b.*>>\s*listing\.txt/) && /end of list\n$/.test(listing), 'Append the line with echo "end of list" >> listing.txt.'],
        [ranWith(r, /cat\s+listing\.txt\s*\|\s*wc\s+-l/, /^3\n$/), 'Count the lines with cat listing.txt | wc -l.'],
        [ranWith(r, /sort\b.*numbers\.txt\s*\|\s*head/, /^3\n7\n15\n$/), 'Show the three smallest numbers with sort -n numbers.txt | head -n 3.'],
      ], 'Redirection and pipes: the shell just became a toolkit.')
    },
  },
  quiz: [
    { question: 'What is the difference between > and >>?', options: ['> appends, >> overwrites', '> overwrites, >> appends', 'They are the same'], answer: 1, explanation: 'A single > replaces the file. A double >> adds to the end.' },
    { question: 'What does the pipe | do?', options: ['Sends output of one command into the next as input', 'Runs two commands at the same time', 'Saves output to a file'], answer: 0, explanation: 'Pipes connect stdout of the left command to stdin of the right one.' },
    { question: 'How many temporary files does cat log | grep ERROR | wc -l create?', options: ['One', 'Two', 'None'], answer: 2, explanation: 'Data flows through memory from command to command. Nothing touches the disk.' },
  ],
}

export default lesson
