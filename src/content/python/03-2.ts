import type { Lesson } from '../types'
import { codeHas, noError, outHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w03d2',
  tier: 1,
  track: 'python',
  week: 3,
  day: 2,
  title: 'Variables and types with f-strings',
  concept: `A variable is a name that points at a value. name = "Ada" stores the string, and from then on name means "Ada". You can reassign it any time.

Every value has a type. "Ada" is a str, 36 is an int, 1.62 is a float, and True is a bool. type(x) tells you which. Types matter because "3" + 4 is an error but 3 + 4 is 7. int("3") converts a string to a number, str(4) goes the other way.

f-strings are the friendly way to mix values into text. Put f before the opening quote and wrap variables in braces: f"{name} is {age} years old". Python fills in the values. You can format numbers too: f"{price:.2f}" shows two decimals.`,
  example: {
    language: 'python',
    caption: 'Types and an f-string',
    code: `name = "Ada"
age = 36
height = 1.62
print(type(name), type(age), type(height))
print(f"{name} is {age} years old and {height} m tall")
age = age + 1
print(f"Next year {name} will be {age}")`,
  },
  task: {
    kind: 'python',
    instructions: 'Create three variables: city set to "Lisbon", population set to 545923, and area set to 100.05 (square km).\nThen print:\n1. The type of each variable on one line, using type().\n2. An f-string: Lisbon has 545923 people.\n3. An f-string with the density rounded to one decimal: Density: 5456.5 per km2  (density is population divided by area, formatted with :.1f).',
    starter: '# Variables and f-strings\ncity = "Lisbon"\n',
    hints: ['print(type(city), type(population), type(area))', 'print(f"{city} has {population} people.")', 'print(f"Density: {population / area:.1f} per km2")'],
    solution: { file: 'city = "Lisbon"\npopulation = 545923\narea = 100.05\nprint(type(city), type(population), type(area))\nprint(f"{city} has {population} people.")\nprint(f"Density: {population / area:.1f} per km2")\n' },
    check: (r) =>
      steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /population\s*=\s*545923/) && codeHas(r, /area\s*=\s*100\.05/), 'Define population = 545923 and area = 100.05.'],
        [outHas(r, "<class 'str'> <class 'int'> <class 'float'>"), 'Print the three types on one line with type(), in the order city, population, area.'],
        [outHas(r, 'Lisbon has 545923 people.') && codeHas(r, /f["']/), 'Print the sentence with an f-string: Lisbon has 545923 people.'],
        [outHas(r, 'Density: 5456.5 per km2') && codeHas(r, /:\.1f/), 'Print the density with one decimal using :.1f in the f-string.'],
      ], 'Variables, types, and f-strings: the everyday tools.'),
  },
  quiz: [
    { question: 'What is the type of 3.0?', options: ['int', 'float', 'str'], answer: 1, explanation: 'A decimal point makes it a float, even if the fraction is zero.' },
    { question: 'What does f"{2 * 3} apples" produce?', options: ['{2 * 3} apples', '6 apples', 'An error'], answer: 1, explanation: 'Inside the braces of an f-string, expressions are evaluated.' },
    { question: 'Why does "5" + 5 fail?', options: ['Numbers cannot be added', 'You cannot add a str and an int', '5 is too small'], answer: 1, explanation: 'Convert first: int("5") + 5 is 10, and "5" + str(5) is "55".' },
  ],
}

export default lesson
