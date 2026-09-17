import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w04d5',
  tier: 1,
  track: 'python',
  week: 4,
  day: 5,
  title: 'Tuples, sets, list comprehensions',
  concept: `Three more tools round out the basics.

A tuple is an immutable list: point = (3, 4). You cannot append to it or change an item, which makes it right for fixed records. Unpacking pulls the parts out: x, y = point. Functions often return tuples to give back several values at once.

A set is an unordered collection with no duplicates: set([1, 2, 2, 3]) is {1, 2, 3}. Sets are fast for membership tests and support union with |, intersection with &, and difference with -.

A list comprehension builds a list in one line: [n * n for n in range(5)]. Add a condition to filter: [n for n in nums if n % 2 == 0]. It reads almost like English and replaces a three-line loop.`,
  example: {
    language: 'python',
    caption: 'Tuple, set, comprehension',
    code: `point = (3, 4)
x, y = point
print(x + y)
tags = set(["a", "b", "a", "c"])
print(len(tags), "b" in tags)
squares = [n * n for n in range(1, 6)]
evens = [n for n in range(10) if n % 2 == 0]
print(squares, evens)`,
  },
  task: {
    kind: 'python',
    instructions: '1. Make a tuple city = ("Lisbon", 545923) and unpack it into name and pop. Print  Lisbon: 545923 .\n2. Given visits = ["ana", "raj", "ana", "kim", "raj", "ana"], build a set of unique names and print how many there are.\n3. Print the sorted list of those unique names.\n4. Use a comprehension to make the cubes of 1 to 5 and print the list.\n5. Use a comprehension with a condition to keep only numbers divisible by 3 from range(1, 20) and print it.',
    starter: 'city = ("Lisbon", 545923)\nvisits = ["ana", "raj", "ana", "kim", "raj", "ana"]\n',
    hints: ['name, pop = city then print(f"{name}: {pop}")', 'unique = set(visits) then print(len(unique))', 'print(sorted(unique))', '[n ** 3 for n in range(1, 6)] and [n for n in range(1, 20) if n % 3 == 0]'],
    solution: { file: 'city = ("Lisbon", 545923)\nvisits = ["ana", "raj", "ana", "kim", "raj", "ana"]\nname, pop = city\nprint(f"{name}: {pop}")\nunique = set(visits)\nprint(len(unique))\nprint(sorted(unique))\nprint([n ** 3 for n in range(1, 6)])\nprint([n for n in range(1, 20) if n % 3 == 0])\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [ls[0] === 'Lisbon: 545923' && codeHas(r, /\w+\s*,\s*\w+\s*=\s*city/), 'Line 1: unpack the tuple with name, pop = city and print Lisbon: 545923'],
        [ls[1] === '3' && codeHas(r, 'set('), 'Line 2: 3 unique names, using set(visits).'],
        [ls[2] === "['ana', 'kim', 'raj']", "Line 3: the sorted unique names: ['ana', 'kim', 'raj']"],
        [ls[3] === '[1, 8, 27, 64, 125]' && codeHas(r, /\[\s*\w+\s*\*\*\s*3\s+for\b|\[\s*\w+\s*\*\s*\w+\s*\*\s*\w+\s+for\b/), 'Line 4: cubes from a comprehension: [1, 8, 27, 64, 125]'],
        [ls[4] === '[3, 6, 9, 12, 15, 18]' && codeHas(r, /for\b[^\]]*\bif\b/), 'Line 5: multiples of 3 from a comprehension with an if: [3, 6, 9, 12, 15, 18]'],
      ], 'Tuples, sets, and comprehensions. Week 4 done.')
    },
  },
  quiz: [
    { question: 'What happens when you run t = (1, 2); t[0] = 5?', options: ['t becomes (5, 2)', 'TypeError, tuples cannot be changed', 't becomes [5, 2]'], answer: 1, explanation: 'Tuples are immutable. Make a new tuple instead.' },
    { question: 'What is len({1, 1, 2, 3, 3})?', options: ['5', '3', '2'], answer: 1, explanation: 'Sets drop duplicates, leaving 1, 2, 3.' },
    { question: 'What does [x * 2 for x in [1, 2, 3]] produce?', options: ['[2, 4, 6]', '[1, 2, 3, 1, 2, 3]', '6'], answer: 0, explanation: 'The expression x * 2 is evaluated for each item and collected into a new list.' },
  ],
}

export default lesson
