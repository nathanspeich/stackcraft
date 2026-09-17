import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w03d5',
  tier: 1,
  track: 'python',
  week: 3,
  day: 5,
  title: 'Conditionals',
  concept: `Programs make decisions with if. The line ends with a colon, and the indented block below it runs only when the condition is true. Indentation is not decoration in Python: it defines the block. Use four spaces.

Conditions compare values: == equal, != not equal, <, >, <=, >=. Combine them with and, or, and not.

elif adds another test that runs only if the ones above failed, and else catches everything remaining. Python checks top to bottom and runs the first block that matches, so put the most specific test first.

Values themselves can act as conditions: 0, an empty string, and an empty list count as False, everything else as True.`,
  example: {
    language: 'python',
    caption: 'if, elif, else',
    code: `temp = int(input("Temperature: "))
if temp >= 30:
    print("hot")
elif temp >= 20:
    print("warm")
elif temp >= 10:
    print("mild")
else:
    print("cold")
if temp > 35 or temp < 0:
    print("extreme")`,
  },
  task: {
    kind: 'python',
    instructions: 'Read a whole number score from input(). Print one word for its grade:\n90 or more: excellent\n70 to 89: good\n50 to 69: pass\nbelow 50: fail\nThen, on a second line, print retry if the score is below 50 or the score is exactly 100, otherwise print done. Try a few values in the Input box; the check uses whatever is there.',
    starter: 'score = int(input("Score: "))\n',
    stdin: '73',
    hints: ['if score >= 90: ... elif score >= 70: ... elif score >= 50: ... else: ...', 'The second line needs or: if score < 50 or score == 100:', 'Indent the body of each branch by four spaces.'],
    solution: { file: 'score = int(input("Score: "))\nif score >= 90:\n    print("excellent")\nelif score >= 70:\n    print("good")\nelif score >= 50:\n    print("pass")\nelse:\n    print("fail")\nif score < 50 or score == 100:\n    print("retry")\nelse:\n    print("done")\n' },
    check: (r) => {
      const n = parseInt((r.env?.STDIN ?? '').trim(), 10)
      const grade = n >= 90 ? 'excellent' : n >= 70 ? 'good' : n >= 50 ? 'pass' : 'fail'
      const flag = n < 50 || n === 100 ? 'retry' : 'done'
      const ls = outLines(r)
      return steps([
        [Number.isFinite(n), 'Put one whole number in the Input box.'],
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /^\s*elif\b/m) && codeHas(r, /^\s*else\s*:/m), 'Use if, elif, and else for the four grades.'],
        [ls[ls.length - 2] === grade, `For ${n} the grade line should be: ${grade}`],
        [codeHas(r, /\bor\b/) && ls[ls.length - 1] === flag, `For ${n} the second line should be: ${flag} (use or in the condition).`],
      ], 'Decisions made, branches taken.')
    },
  },
  quiz: [
    { question: 'What does elif mean?', options: ['Else, if the previous conditions were false', 'End of if', 'Repeat the if'], answer: 0, explanation: 'elif chains extra tests that run only when the earlier ones did not match.' },
    { question: 'What is wrong with: if x = 5:', options: ['Missing else', '= assigns; comparison needs ==', 'x must be a string'], answer: 1, explanation: 'A single = is assignment. Use == to compare.' },
    { question: 'Which value counts as False in a condition?', options: ['"0"', '0', '"False"'], answer: 1, explanation: 'The number 0 is falsy. Non-empty strings, even "0" or "False", are truthy.' },
  ],
}

export default lesson
