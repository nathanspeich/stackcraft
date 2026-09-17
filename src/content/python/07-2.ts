import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w07d2',
  tier: 1,
  track: 'python',
  week: 7,
  day: 2,
  title: 'Errors and try/except',
  concept: `When something goes wrong, Python raises an exception and, unless you handle it, the program stops with a traceback. The last line names the error: ValueError for a bad conversion like int("abc"), ZeroDivisionError, FileNotFoundError, KeyError, TypeError.

try/except lets you handle the cases you expect. Put the risky code in try, and the recovery in except ValueError:. Catch the specific error, not a bare except, so real bugs still show up. You can keep the error object: except ValueError as e: print(e).

else runs if no error happened, finally runs no matter what, which is where cleanup goes.

You can raise your own: raise ValueError("age must be positive"). Good functions fail loudly on bad input instead of returning nonsense.`,
  example: {
    language: 'python',
    caption: 'Handling the errors you expect',
    code: `def safe_int(text):
    try:
        return int(text)
    except ValueError:
        return None

for t in ["10", "x", "4"]:
    print(t, "->", safe_int(t))
try:
    with open("missing.txt") as f:
        print(f.read())
except FileNotFoundError as e:
    print("no such file:", e.filename)`,
  },
  task: {
    kind: 'python',
    instructions: '1. Write safe_divide(a, b) that returns a / b, or the string  cannot divide by zero  when b is 0, using try/except ZeroDivisionError. Print safe_divide(10, 4) and safe_divide(1, 0).\n2. Loop over ["12", "seven", "3"] and for each print  number: 12  or  not a number: seven , catching ValueError.\n3. Try to open missing.txt and print  missing.txt not found  from an except FileNotFoundError block.\n4. Write check_age(age) that raises ValueError with the message  age must be positive  when age is negative. Call it inside try/except and print the message.',
    starter: '# try, except, raise\n',
    hints: ['try:\n    return a / b\nexcept ZeroDivisionError:\n    return "cannot divide by zero"', 'try: n = int(text) ... except ValueError: print(f"not a number: {text}")', 'except FileNotFoundError: print("missing.txt not found")', 'raise ValueError("age must be positive") then except ValueError as e: print(e)'],
    solution: { file: 'def safe_divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return "cannot divide by zero"\n\nprint(safe_divide(10, 4))\nprint(safe_divide(1, 0))\n\nfor text in ["12", "seven", "3"]:\n    try:\n        n = int(text)\n        print(f"number: {n}")\n    except ValueError:\n        print(f"not a number: {text}")\n\ntry:\n    with open("missing.txt") as f:\n        print(f.read())\nexcept FileNotFoundError:\n    print("missing.txt not found")\n\ndef check_age(age):\n    if age < 0:\n        raise ValueError("age must be positive")\n    return age\n\ntry:\n    check_age(-3)\nexcept ValueError as e:\n    print(e)\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an unhandled error. Every risky call needs a try block around it.'],
        [ls[0] === '2.5' && ls[1] === 'cannot divide by zero' && codeHas(r, 'except ZeroDivisionError'), 'Lines 1 and 2: 2.5 and cannot divide by zero, using except ZeroDivisionError.'],
        [ls.slice(2, 5).join('|') === 'number: 12|not a number: seven|number: 3' && codeHas(r, 'except ValueError'), 'Lines 3 to 5: number: 12, not a number: seven, number: 3 with except ValueError.'],
        [ls[5] === 'missing.txt not found' && codeHas(r, 'except FileNotFoundError'), 'Line 6: missing.txt not found from except FileNotFoundError.'],
        [ls[6] === 'age must be positive' && codeHas(r, /raise\s+ValueError\(\s*["']age must be positive["']\s*\)/), 'Line 7: raise ValueError("age must be positive") in check_age and print the caught message.'],
      ], 'Errors expected, caught, and raised on purpose.')
    },
  },
  quiz: [
    { question: 'Which error does int("hello") raise?', options: ['TypeError', 'ValueError', 'KeyError'], answer: 1, explanation: 'The type is right (a string) but the value cannot be converted, so it is a ValueError.' },
    { question: 'Why avoid a bare except: with nothing after it?', options: ['It is slower', 'It hides every error, including real bugs and Ctrl+C', 'It is a syntax error'], answer: 1, explanation: 'Catch the specific exceptions you can handle and let the rest surface.' },
    { question: 'When does the finally block run?', options: ['Only if there was an error', 'Only if there was no error', 'Always'], answer: 2, explanation: 'finally runs after try and except regardless, which makes it right for cleanup.' },
  ],
}

export default lesson
