import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w04d4',
  tier: 1,
  track: 'python',
  week: 4,
  day: 4,
  title: 'Functions',
  concept: `A function packages code you want to reuse. def greet(name): starts one, the indented body follows, and greet("Ada") calls it.

Parameters are the names in the definition. Arguments are the values you pass. A parameter can have a default: def area(width, height=1): means height is optional.

return sends a value back to the caller and ends the function. A function with no return gives None. Printing inside a function shows text; returning lets the caller use the result, which is usually what you want.

The first line of the body can be a docstring, a string that explains what the function does. Keep functions short and give them verb names: load_config, is_even, total_price.`,
  example: {
    language: 'python',
    caption: 'Define, call, return',
    code: `def area(width, height=1):
    """Return the area of a rectangle."""
    return width * height

def is_even(n):
    return n % 2 == 0

print(area(3, 4))
print(area(5))
print(is_even(10), is_even(7))`,
  },
  task: {
    kind: 'python',
    instructions: 'Define three functions and call them:\n1. greet(name) returns the string  Hello, <name>!  Print greet("Ada").\n2. area(width, height=1) returns width times height. Print area(4, 5) and area(6).\n3. is_even(n) returns True or False. Print is_even(8) and is_even(3) on one line.\n4. Give area a docstring, then print area.__doc__.',
    starter: '# Define greet, area, and is_even\n',
    hints: ['def greet(name):\n    return f"Hello, {name}!"', 'def area(width, height=1):\n    """Return the area of a rectangle."""\n    return width * height', 'def is_even(n):\n    return n % 2 == 0', 'print(area.__doc__) prints the docstring.'],
    solution: { file: 'def greet(name):\n    return f"Hello, {name}!"\n\ndef area(width, height=1):\n    """Return the area of a rectangle."""\n    return width * height\n\ndef is_even(n):\n    return n % 2 == 0\n\nprint(greet("Ada"))\nprint(area(4, 5))\nprint(area(6))\nprint(is_even(8), is_even(3))\nprint(area.__doc__)\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /def\s+greet\s*\(\s*name\s*\)/) && codeHas(r, /def\s+area\s*\(\s*width\s*,\s*height\s*=\s*1\s*\)/) && codeHas(r, /def\s+is_even\s*\(\s*n\s*\)/), 'Define greet(name), area(width, height=1), and is_even(n) with def.'],
        [ls[0] === 'Hello, Ada!' && codeHas(r, /return\s+f?["']Hello/), 'Line 1: greet returns (not prints) Hello, Ada! and you print the result.'],
        [ls[1] === '20' && ls[2] === '6', 'Lines 2 and 3: area(4, 5) is 20 and area(6) is 6 using the default height.'],
        [ls[3] === 'True False', 'Line 4: True False from is_even(8) and is_even(3).'],
        [codeHas(r, /def\s+area[^\n]*\n\s+"""/) && ls[4]?.length > 0 && ls[4] !== 'None', 'Add a docstring as the first line inside area, then print(area.__doc__).'],
      ], 'Functions with parameters, defaults, returns, and a docstring.')
    },
  },
  quiz: [
    { question: 'What does a function return if it has no return statement?', options: ['0', 'None', 'An empty string'], answer: 1, explanation: 'Every function returns something. Without return, that something is None.' },
    { question: 'In def f(a, b=2), what is b?', options: ['A required parameter', 'A parameter with a default value', 'A global variable'], answer: 1, explanation: 'Callers can omit b and get 2, or pass their own value.' },
    { question: 'What is the difference between print and return inside a function?', options: ['None', 'print shows text; return hands a value back to the caller', 'return shows text; print hands a value back'], answer: 1, explanation: 'Use return so the caller can store, compare, or reuse the result.' },
  ],
}

export default lesson
