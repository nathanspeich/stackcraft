import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w03d3',
  tier: 1,
  track: 'python',
  week: 3,
  day: 3,
  title: 'Strings',
  concept: `Strings are sequences of characters, and Python gives you a lot of tools for them.

Methods are called with a dot: s.upper() returns an upper-case copy, s.lower() the opposite, s.strip() removes spaces from both ends, s.replace("a", "b") swaps text, and s.split() breaks a sentence into a list of words. Methods return new strings; the original is unchanged.

len(s) counts characters. Indexing picks one: s[0] is the first character and s[-1] the last. Slicing picks a range: s[0:3] is the first three characters, s[4:] everything from position 4 on.

"fox" in s checks whether one string appears inside another. Strings can be joined with +, and repeated with *.`,
  example: {
    language: 'python',
    caption: 'Common string moves',
    code: `s = "  Hello, World  "
print(s.strip())
print(s.strip().lower())
print(len(s.strip()))
words = "the quick brown fox".split()
print(words)
print(words[0], words[-1])
print("brown" in words)`,
  },
  task: {
    kind: 'python',
    instructions: 'Start with sentence = "  the quick brown fox jumps  ". Print, one per line:\n1. The sentence stripped of the outer spaces.\n2. The stripped sentence in upper case.\n3. The number of words (split it first).\n4. The stripped sentence with fox replaced by cat.\n5. The first word and the last word, separated by a space.',
    starter: 'sentence = "  the quick brown fox jumps  "\n',
    hints: ['clean = sentence.strip()', 'clean.upper() and len(clean.split())', 'clean.replace("fox", "cat")', 'words = clean.split() then print(words[0], words[-1])'],
    solution: { file: 'sentence = "  the quick brown fox jumps  "\nclean = sentence.strip()\nprint(clean)\nprint(clean.upper())\nwords = clean.split()\nprint(len(words))\nprint(clean.replace("fox", "cat"))\nprint(words[0], words[-1])\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [ls[0] === 'the quick brown fox jumps' && codeHas(r, '.strip()'), 'Line 1: the sentence with outer spaces removed, using .strip().'],
        [ls[1] === 'THE QUICK BROWN FOX JUMPS' && codeHas(r, '.upper()'), 'Line 2: the stripped sentence in upper case with .upper().'],
        [ls[2] === '5' && codeHas(r, '.split('), 'Line 3: the word count, 5, from len() of .split().'],
        [ls[3] === 'the quick brown cat jumps' && codeHas(r, '.replace('), 'Line 4: fox replaced by cat with .replace().'],
        [ls[4] === 'the jumps', 'Line 5: first and last word: the jumps'],
      ], 'Strings sliced, split, and reshaped.')
    },
  },
  quiz: [
    { question: 'What does "python"[0] give?', options: ['"p"', '"n"', '"python"'], answer: 0, explanation: 'Indexing starts at 0, so [0] is the first character.' },
    { question: 'After s = "hi"; s.upper(), what is s?', options: ['"HI"', '"hi"', 'None'], answer: 1, explanation: 'String methods return a new value. s stays "hi" unless you assign the result back.' },
    { question: 'What does "a,b,c".split(",") return?', options: ['"a b c"', '["a", "b", "c"]', '3'], answer: 1, explanation: 'split breaks the string at each separator and returns a list of pieces.' },
  ],
}

export default lesson
