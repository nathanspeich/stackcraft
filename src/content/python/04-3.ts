import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w04d3',
  tier: 1,
  track: 'python',
  week: 4,
  day: 3,
  title: 'Dictionaries',
  concept: `A dictionary maps keys to values, like a real dictionary maps words to meanings. ages = {"ana": 34, "raj": 28}. Look up with ages["ana"], add or change with ages["kim"] = 41, delete with del ages["raj"].

Looking up a missing key raises KeyError. ages.get("zoe") returns None instead, and ages.get("zoe", 0) returns a default of your choice. "ana" in ages checks for a key.

Loop over items with for name, age in ages.items(). ages.keys() and ages.values() give just one side. len(ages) counts entries.

Counting things is the classic dictionary job: for each word, counts[word] = counts.get(word, 0) + 1.`,
  example: {
    language: 'python',
    caption: 'Lookup, update, count',
    code: `stock = {"apple": 5, "pear": 0}
stock["fig"] = 12
print(stock["apple"], stock.get("kiwi", "none"))
for item, qty in stock.items():
    print(f"{item}: {qty}")
counts = {}
for word in "a b a c a".split():
    counts[word] = counts.get(word, 0) + 1
print(counts)`,
  },
  task: {
    kind: 'python',
    instructions: 'Start with text = "the cat and the dog and the bird".\n1. Count each word into a dictionary using .get with a default.\n2. Print the dictionary.\n3. Print how many times the appears, using the dictionary.\n4. Print the count for zebra using .get so it prints 0 instead of crashing.\n5. Loop over the items and print each word and count as  word: count , in the order they first appeared.',
    starter: 'text = "the cat and the dog and the bird"\ncounts = {}\n',
    hints: ['for word in text.split(): counts[word] = counts.get(word, 0) + 1', 'print(counts["the"])', 'print(counts.get("zebra", 0))', 'for word, n in counts.items(): print(f"{word}: {n}")'],
    solution: { file: 'text = "the cat and the dog and the bird"\ncounts = {}\nfor word in text.split():\n    counts[word] = counts.get(word, 0) + 1\nprint(counts)\nprint(counts["the"])\nprint(counts.get("zebra", 0))\nfor word, n in counts.items():\n    print(f"{word}: {n}")\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [ls[0] === "{'the': 3, 'cat': 1, 'and': 2, 'dog': 1, 'bird': 1}" && codeHas(r, '.get('), 'Line 1: the counts dictionary, built with .get(word, 0) + 1.'],
        [ls[1] === '3', 'Line 2: 3, the count for the.'],
        [ls[2] === '0' && codeHas(r, /\.get\(\s*["']zebra["']\s*,\s*0\s*\)/), 'Line 3: 0 for zebra, using counts.get("zebra", 0).'],
        [ls.slice(3, 8).join('|') === 'the: 3|cat: 1|and: 2|dog: 1|bird: 1' && codeHas(r, '.items()'), 'Lines 4 to 8: each word: count from a loop over .items().'],
      ], 'Keys, values, defaults, and the counting pattern.')
    },
  },
  quiz: [
    { question: 'What happens with d["missing"] if the key is absent?', options: ['Returns None', 'Raises KeyError', 'Returns 0'], answer: 1, explanation: 'Square-bracket lookup is strict. Use .get for a safe default.' },
    { question: 'How do you loop over keys and values together?', options: ['for k, v in d.items()', 'for k, v in d', 'for k in d.values()'], answer: 0, explanation: '.items() yields (key, value) pairs you can unpack.' },
    { question: 'What does d.get("x", 5) return when "x" is missing?', options: ['KeyError', 'None', '5'], answer: 2, explanation: 'The second argument to get is the default when the key is absent.' },
  ],
}

export default lesson
