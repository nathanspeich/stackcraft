import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w02d5',
  tier: 1,
  track: 'linux',
  week: 2,
  day: 5,
  title: 'Text tools: sort, uniq, cut, tr, sed basics',
  concept: `Linux ships a set of small text tools that each do one thing. Chained with pipes, they replace a lot of spreadsheet work.

sort orders lines. -n sorts as numbers, -r reverses. uniq removes adjacent duplicates and -c counts them, which is why sort | uniq -c is the classic way to tally things.

cut slices columns. cut -d, -f2 splits on commas and keeps the second field.

tr translates characters: tr a-z A-Z upper-cases, tr -d " " deletes spaces. It reads only from a pipe or <.

sed edits streams. sed 's/old/new/' replaces the first old on each line; add g at the end for every occurrence. It prints the result and leaves the file alone unless you pass -i.`,
  example: {
    language: 'bash',
    caption: 'A tally, a column, a transform, a replace',
    code: `sort visitors.txt | uniq -c
      3 ana
      1 kim
      2 raj
cut -d, -f2 people.csv
city
Lisbon
echo "hello" | tr a-z A-Z
HELLO
sed 's/cat/dog/g' message.txt`,
  },
  task: {
    kind: 'shell',
    instructions: 'Files in your home directory: visitors.txt (one name per line, with repeats), people.csv (name,city,age), and message.txt.\n1. Count how many times each visitor appears with sort and uniq -c.\n2. Print only the city column of people.csv with cut.\n3. Upper-case message.txt with tr (use cat and a pipe, or <).\n4. Use sed to replace every cat with dog in message.txt.',
    seed: {
      ...HOME_SEED,
      '/home/learner/visitors.txt': 'ana\nraj\nana\nkim\nraj\nana\n',
      '/home/learner/people.csv': 'name,city,age\nana,Lisbon,34\nraj,Pune,28\nkim,Seoul,41\n',
      '/home/learner/message.txt': 'the cat sat on the mat\nanother cat came along\n',
    },
    hints: ['sort visitors.txt | uniq -c. uniq only spots repeats that are next to each other, so sort first.', 'cut -d, -f2 people.csv', 'cat message.txt | tr a-z A-Z', "sed 's/cat/dog/g' message.txt. The g means every match on the line."],
    solution: { commands: ['sort visitors.txt | uniq -c', 'cut -d, -f2 people.csv', 'cat message.txt | tr a-z A-Z', "sed 's/cat/dog/g' message.txt"] },
    check: (r) =>
      steps([
        [ranWith(r, /sort\b.*visitors\.txt\s*\|\s*uniq\s+-c|uniq\s+-c/, /3 ana[\s\S]*1 kim[\s\S]*2 raj/), 'Tally the visitors with sort visitors.txt | uniq -c.'],
        [ranWith(r, /^\s*cut\b.*people\.csv/, /^city\nLisbon\nPune\nSeoul\n$/), 'Print the city column with cut -d, -f2 people.csv.'],
        [ranWith(r, /tr\b/, /THE CAT SAT ON THE MAT/), 'Upper-case message.txt with tr a-z A-Z (feed it with cat and a pipe).'],
        [ranWith(r, /^\s*sed\b.*s\/cat\/dog\/g/, /the dog sat on the mat\nanother dog came along/), "Replace every cat with dog using sed 's/cat/dog/g' message.txt."],
      ], 'Five tiny tools, one pipeline mindset.'),
  },
  quiz: [
    { question: 'Why sort before uniq?', options: ['uniq requires sorted input to run', 'uniq only removes duplicates that are adjacent', 'sort makes uniq faster'], answer: 1, explanation: 'uniq compares each line to the one before it. Sorting groups identical lines together.' },
    { question: 'What does cut -d: -f1 /etc/passwd print?', options: ['Every user name', 'Every home directory', 'The first line'], answer: 0, explanation: '-d: splits on colons, -f1 keeps the first field, which is the user name.' },
    { question: "What does sed 's/a/b/' do to the line 'banana'?", options: ['bbnbnb', 'bbnana', 'Nothing'], answer: 1, explanation: 'Without g, sed replaces only the first match on each line.' },
  ],
}

export default lesson
