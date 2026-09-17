import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w07d3',
  tier: 1,
  track: 'python',
  week: 7,
  day: 3,
  title: 'Modules and the standard library',
  concept: `A module is a file of Python you can import. Python ships with hundreds, called the standard library, and they cover most everyday jobs so you do not write them yourself.

import math gives math.sqrt, math.pi, math.floor. from collections import Counter imports one name directly. import random as rnd renames it.

Useful modules to know: math for numbers, random for choices and shuffles, datetime for dates and durations, os and pathlib for files and folders, json for data exchange, collections for Counter and defaultdict, and sys for arguments and exit codes.

Your own files are modules too: if helpers.py sits next to main.py, then import helpers works. Read the docs at docs.python.org; help(math) works in a Python shell as well.`,
  example: {
    language: 'python',
    caption: 'Four imports',
    code: `import math
from collections import Counter
from datetime import date
import os

print(math.sqrt(144), round(math.pi, 3))
print(Counter("mississippi").most_common(2))
d = date(2026, 9, 17)
print(d.strftime("%A %d %B %Y"))
print(os.path.join("home", "learner", "notes.txt"))`,
  },
  task: {
    kind: 'python',
    instructions: '1. Import math and print the square root of 2025 and the ceiling of 7.2 on one line.\n2. From collections import Counter and print the two most common letters in the word  bookkeeper  (use most_common(2)).\n3. From datetime import date, make date(2026, 12, 25) and print it formatted as  Friday 25 December 2026  with strftime.\n4. Print the number of days between date(2026, 9, 17) and that Christmas date (subtract them and use .days).\n5. Import os and print os.path.join("var", "log", "syslog").',
    starter: '# Standard library tour\n',
    hints: ['import math then print(math.sqrt(2025), math.ceil(7.2))', 'print(Counter("bookkeeper").most_common(2))', 'xmas = date(2026, 12, 25) then xmas.strftime("%A %d %B %Y")', '(xmas - date(2026, 9, 17)).days'],
    solution: { file: 'import math\nfrom collections import Counter\nfrom datetime import date\nimport os\n\nprint(math.sqrt(2025), math.ceil(7.2))\nprint(Counter("bookkeeper").most_common(2))\nxmas = date(2026, 12, 25)\nprint(xmas.strftime("%A %d %B %Y"))\nprint((xmas - date(2026, 9, 17)).days)\nprint(os.path.join("var", "log", "syslog"))\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [ls[0] === '45.0 8' && codeHas(r, 'import math'), 'Line 1: 45.0 8 from math.sqrt(2025) and math.ceil(7.2).'],
        [ls[1] === "[('e', 3), ('o', 2)]" && codeHas(r, 'Counter'), "Line 2: [('e', 3), ('o', 2)] from Counter(...).most_common(2)."],
        [ls[2] === 'Friday 25 December 2026' && codeHas(r, 'strftime'), 'Line 3: Friday 25 December 2026 using strftime("%A %d %B %Y").'],
        [ls[3] === '99' && codeHas(r, '.days'), 'Line 4: 99 days, from subtracting the two dates and reading .days.'],
        [ls[4] === 'var/log/syslog' && codeHas(r, 'os.path.join'), 'Line 5: var/log/syslog from os.path.join.'],
      ], 'Five modules, no reinventing.')
    },
  },
  quiz: [
    { question: 'What does from math import sqrt let you write?', options: ['math.sqrt(9)', 'sqrt(9)', 'import.sqrt(9)'], answer: 1, explanation: 'from-import brings the name itself into your file, no prefix needed.' },
    { question: 'Which module counts occurrences with Counter?', options: ['math', 'collections', 'itertools'], answer: 1, explanation: 'collections holds Counter, defaultdict, deque, and namedtuple.' },
    { question: 'If tools.py is next to main.py, how do you use its functions?', options: ['include tools', 'import tools', 'open("tools.py")'], answer: 1, explanation: 'Any .py file on the path, including the current folder, is importable by name.' },
  ],
}

export default lesson
