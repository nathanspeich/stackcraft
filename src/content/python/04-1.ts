import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w04d1',
  tier: 1,
  track: 'python',
  week: 4,
  day: 1,
  title: 'Lists',
  concept: `A list holds several values in order: fruits = ["apple", "pear", "fig"]. Lists can hold any type and can grow or shrink.

Indexing and slicing work like strings: fruits[0] is "apple", fruits[-1] is "fig", fruits[1:] is everything after the first. len(fruits) counts items.

fruits.append("kiwi") adds to the end. fruits.insert(0, "lime") puts one at a position. fruits.remove("pear") deletes by value, and fruits.pop() removes and returns the last item.

"fig" in fruits checks membership. sorted(fruits) returns a new sorted list; fruits.sort() sorts in place. sum, min, and max work on lists of numbers.

Unlike strings, lists are mutable: methods like append change the list itself and return None, so do not write fruits = fruits.append(x).`,
  example: {
    language: 'python',
    caption: 'Building and changing a list',
    code: `todo = ["email", "gym"]
todo.append("shop")
todo.insert(0, "coffee")
print(todo)
print(len(todo), todo[0], todo[-1])
todo.remove("gym")
print(sorted(todo))
print("shop" in todo)`,
  },
  task: {
    kind: 'python',
    instructions: 'Start with scores = [72, 95, 58, 84]. Then:\n1. Append 91 and print the list.\n2. Print the highest and lowest score on one line, separated by a space.\n3. Print the average rounded to one decimal (use sum and len).\n4. Remove the 58 and print the list sorted from high to low (sorted with reverse=True).\n5. Print the first three of that sorted list using a slice.',
    starter: 'scores = [72, 95, 58, 84]\n',
    hints: ['scores.append(91) then print(scores)', 'print(max(scores), min(scores))', 'round(sum(scores) / len(scores), 1)', 'top = sorted(scores, reverse=True) then print(top[:3])'],
    solution: { file: 'scores = [72, 95, 58, 84]\nscores.append(91)\nprint(scores)\nprint(max(scores), min(scores))\nprint(round(sum(scores) / len(scores), 1))\nscores.remove(58)\ntop = sorted(scores, reverse=True)\nprint(top)\nprint(top[:3])\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [ls[0] === '[72, 95, 58, 84, 91]' && codeHas(r, '.append('), 'Line 1: append 91 and print the list: [72, 95, 58, 84, 91]'],
        [ls[1] === '95 58', 'Line 2: highest and lowest: 95 58'],
        [ls[2] === '80.0', 'Line 3: the average rounded to one decimal: 80.0'],
        [ls[3] === '[95, 91, 84, 72]' && codeHas(r, '.remove(') && codeHas(r, 'reverse=True'), 'Line 4: remove 58, then print sorted(..., reverse=True): [95, 91, 84, 72]'],
        [ls[4] === '[95, 91, 84]' && codeHas(r, /\[\s*:\s*3\s*\]/), 'Line 5: the first three with a slice [:3]: [95, 91, 84]'],
      ], 'Lists built, measured, trimmed, and sliced.')
    },
  },
  quiz: [
    { question: 'What does [1, 2, 3][-1] give?', options: ['1', '3', 'An error'], answer: 1, explanation: 'Negative indexes count from the end. -1 is the last item.' },
    { question: 'What does nums.append(4) return?', options: ['The new list', '4', 'None'], answer: 2, explanation: 'append changes the list in place and returns None.' },
    { question: 'Which creates a new sorted list without changing the original?', options: ['sorted(nums)', 'nums.sort()', 'nums.sorted()'], answer: 0, explanation: 'sorted() returns a new list. .sort() rearranges the list itself.' },
  ],
}

export default lesson
