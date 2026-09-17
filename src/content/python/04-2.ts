import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w04d2',
  tier: 1,
  track: 'python',
  week: 4,
  day: 2,
  title: 'Loops',
  concept: `Loops repeat a block of code. Python has two.

for runs the block once per item: for fruit in fruits: print(fruit). To loop over numbers use range: range(5) gives 0 to 4, range(1, 6) gives 1 to 5. When you need the position too, enumerate(fruits) gives pairs of index and item.

while repeats as long as a condition holds: while n > 0: n = n - 1. Something in the block must eventually make the condition false, or the loop never ends.

break leaves the loop immediately. continue skips to the next round.

A common pattern is an accumulator: start with total = 0, then add to it inside the loop. Another is a counter you increment with count += 1.`,
  example: {
    language: 'python',
    caption: 'for, range, enumerate, while',
    code: `for n in range(1, 4):
    print(n, n * n)
for i, name in enumerate(["ana", "raj"]):
    print(i, name)
count = 3
while count > 0:
    print("T minus", count)
    count -= 1
print("liftoff")`,
  },
  task: {
    kind: 'python',
    instructions: 'Write four small loops:\n1. A for loop over range that prints the squares of 1 to 5, one per line, as  1 squared is 1  and so on.\n2. Print the sum of all numbers from 1 to 100 (use an accumulator, not a formula).\n3. A while loop that counts down from 3 to 1 printing each number, then prints go.\n4. Loop with enumerate over ["ana", "raj", "kim"] printing  1. ana  (numbering starting at 1).',
    starter: '# Four loops\n',
    hints: ['for n in range(1, 6): print(f"{n} squared is {n * n}")', 'total = 0 then for n in range(1, 101): total += n', 'n = 3 then while n > 0: print(n); n -= 1', 'for i, name in enumerate(names, start=1): print(f"{i}. {name}")'],
    solution: { file: 'for n in range(1, 6):\n    print(f"{n} squared is {n * n}")\ntotal = 0\nfor n in range(1, 101):\n    total += n\nprint(total)\nn = 3\nwhile n > 0:\n    print(n)\n    n -= 1\nprint("go")\nfor i, name in enumerate(["ana", "raj", "kim"], start=1):\n    print(f"{i}. {name}")\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [ls.slice(0, 5).join('|') === '1 squared is 1|2 squared is 4|3 squared is 9|4 squared is 16|5 squared is 25' && codeHas(r, 'range('), 'Lines 1 to 5: n squared is n*n for 1 to 5, using range.'],
        [ls[5] === '5050' && codeHas(r, /\+=|total\s*=\s*total\s*\+/), 'Line 6: 5050, added up with an accumulator in a loop.'],
        [ls.slice(6, 10).join('|') === '3|2|1|go' && codeHas(r, /^\s*while\b/m), 'Lines 7 to 10: 3, 2, 1, go from a while loop.'],
        [ls.slice(10, 13).join('|') === '1. ana|2. raj|3. kim' && codeHas(r, 'enumerate('), 'Lines 11 to 13: 1. ana, 2. raj, 3. kim using enumerate.'],
      ], 'for, while, range, enumerate, and an accumulator. Loops mastered.')
    },
  },
  quiz: [
    { question: 'What numbers does range(3) produce?', options: ['1, 2, 3', '0, 1, 2', '0, 1, 2, 3'], answer: 1, explanation: 'range starts at 0 and stops before the end value.' },
    { question: 'When does a while loop stop?', options: ['After 10 rounds', 'When its condition becomes false, or break runs', 'Never'], answer: 1, explanation: 'The condition is checked before each round. break exits early.' },
    { question: 'What does continue do?', options: ['Restarts the program', 'Skips the rest of this round and moves to the next item', 'Ends the loop'], answer: 1, explanation: 'continue jumps to the next iteration. break is the one that ends the loop.' },
  ],
}

export default lesson
