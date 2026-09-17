import type { Lesson } from '../types'
import { codeHas, noError, outHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w03d4',
  tier: 1,
  track: 'python',
  week: 3,
  day: 4,
  title: 'Numbers and input',
  concept: `Python has two everyday number types: int for whole numbers and float for decimals. The usual operators work: + - * /. Division / always gives a float, even 10 / 2 which is 5.0. Two more are handy: // is integer division that drops the remainder, and % gives the remainder. 17 // 5 is 3 and 17 % 5 is 2. ** raises to a power.

round(x, 2) rounds to two decimals. abs, min, max, and sum do what their names say.

input("prompt") pauses, shows the prompt, and returns whatever the user typed, always as a string. To do math with it, convert: age = int(input("Age: ")). In this app, the Input box supplies the lines that input() reads, one per call.`,
  example: {
    language: 'python',
    caption: 'Reading two numbers',
    code: `a = int(input("First: "))
b = int(input("Second: "))
print("sum", a + b)
print("quotient", a // b, "remainder", a % b)
print("average", round((a + b) / 2, 2))`,
  },
  task: {
    kind: 'python',
    instructions: 'Read two whole numbers with input() (the Input box already holds 12 and 5). Then print, each on its own line and labelled exactly like this:\nsum: 17\nproduct: 60\nquotient: 2\nremainder: 2\naverage: 8.5\nUse int() to convert, // and % for quotient and remainder, and round the average to one decimal.',
    starter: '# Read two numbers and do arithmetic\n',
    stdin: '12\n5',
    hints: ['a = int(input("First: "))', 'print(f"sum: {a + b}") and so on.', 'round((a + b) / 2, 1) gives 8.5'],
    solution: { file: 'a = int(input("First: "))\nb = int(input("Second: "))\nprint(f"sum: {a + b}")\nprint(f"product: {a * b}")\nprint(f"quotient: {a // b}")\nprint(f"remainder: {a % b}")\nprint(f"average: {round((a + b) / 2, 1)}")\n' },
    check: (r) => {
      const [a, b] = (r.env?.STDIN ?? '').split('\n').map((x) => parseInt(x, 10))
      const ok = Number.isFinite(a) && Number.isFinite(b) && b !== 0
      return steps([
        [ok, 'Keep two whole numbers in the Input box, one per line.'],
        [noError(r), 'Your program raised an error. If it says EOF, you called input() more times than there are lines.'],
        [codeHas(r, /int\(\s*input\(/), 'Read the numbers with int(input(...)).'],
        [outHas(r, `sum: ${a + b}`), `Print sum: ${a + b}`],
        [outHas(r, `product: ${a * b}`), `Print product: ${a * b}`],
        [outHas(r, `quotient: ${Math.floor(a / b)}`) && codeHas(r, '//'), `Print quotient: ${Math.floor(a / b)} using //`],
        [outHas(r, `remainder: ${((a % b) + b) % b}`) && codeHas(r, '%'), `Print remainder: ${((a % b) + b) % b} using %`],
        [outHas(r, `average: ${Math.round(((a + b) / 2) * 10) / 10}`), `Print average: ${Math.round(((a + b) / 2) * 10) / 10} (rounded to one decimal)`],
      ], 'Input read, converted, and computed.')
    },
  },
  quiz: [
    { question: 'What does 7 // 2 give?', options: ['3.5', '3', '1'], answer: 1, explanation: '// is floor division. It drops the fractional part.' },
    { question: 'What type does input() return?', options: ['int', 'Whatever the user typed', 'str, always'], answer: 2, explanation: 'input always returns a string. Convert it with int() or float() when you need a number.' },
    { question: 'What is 10 % 3?', options: ['3', '1', '3.33'], answer: 1, explanation: '% is the remainder after division. 10 divided by 3 is 3 with 1 left over.' },
  ],
}

export default lesson
