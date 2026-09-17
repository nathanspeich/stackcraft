import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w03d1',
  tier: 1,
  track: 'python',
  week: 3,
  day: 1,
  title: 'Setup and print',
  concept: `Python is a language for telling the computer what to do in short, readable lines. On Linux you run a file of Python with python3 script.py. Here the app runs it when you press Run.

print shows something on the screen. print("Hello") prints the text inside the quotes, called a string. Without quotes, Python treats it as code: print(7 * 6) works out the multiplication and prints 42.

print can take several things separated by commas and puts a space between them: print("Total:", 42).

Lines starting with # are comments. Python ignores them, and future you will thank present you.

Python cares about exact spelling and matching brackets. Read error messages from the bottom up: the last line says what went wrong.`,
  example: {
    language: 'python',
    caption: 'main.py',
    code: `# My first program
print("Hello, world")
print(7 * 6)
print("Seven times six is", 7 * 6)`,
  },
  task: {
    kind: 'python',
    instructions: 'Write a program that prints exactly three lines:\n1. Hello, Stackcraft\n2. The result of 12 * 12, calculated by Python, not typed in.\n3. The words Python is and the number 3, printed with a single print and a comma.',
    starter: '# Print three lines\n',
    hints: ['print("Hello, Stackcraft")', 'print(12 * 12) lets Python do the math.', 'print("Python is", 3) prints both with a space between.'],
    solution: { file: 'print("Hello, Stackcraft")\nprint(12 * 12)\nprint("Python is", 3)\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last line of the red text.'],
        [ls[0] === 'Hello, Stackcraft', 'The first line should be exactly: Hello, Stackcraft'],
        [ls[1] === '144' && codeHas(r, /12\s*\*\s*12/), 'The second line should be 144, calculated with 12 * 12 inside print.'],
        [ls[2] === 'Python is 3' && codeHas(r, /print\(\s*["']Python is["']\s*,\s*3\s*\)/), 'The third line should come from print("Python is", 3).'],
      ], 'Three prints, one program. You are writing Python.')
    },
  },
  quiz: [
    { question: 'What does print(2 + 3) show?', options: ['2 + 3', '5', 'Nothing'], answer: 1, explanation: 'Python evaluates the expression first, then prints the result.' },
    { question: 'What does print("2 + 3") show?', options: ['5', '2 + 3', 'An error'], answer: 1, explanation: 'Quotes make it a string, printed exactly as written.' },
    { question: 'How do you run a file called app.py on Linux?', options: ['python3 app.py', 'run app.py', './app'], answer: 0, explanation: 'python3 followed by the file name runs the script.' },
  ],
}

export default lesson
