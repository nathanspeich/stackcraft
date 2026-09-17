import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w07d5',
  tier: 1,
  track: 'python',
  week: 7,
  day: 5,
  title: 'Command-line scripts with argparse',
  concept: `Real tools take options: grep -i, ls -l. Your scripts can too. sys.argv is the raw list of arguments, but argparse turns them into a proper interface with help text and error messages for free.

Create a parser: parser = argparse.ArgumentParser(description="...") . Add arguments: parser.add_argument("name") for a required positional, parser.add_argument("--times", type=int, default=1) for an option with a type and default, and parser.add_argument("--loud", action="store_true") for a flag. Then args = parser.parse_args() and use args.name, args.times, args.loud.

Running the script with --help prints usage built from your definitions. Wrong types or missing arguments produce a clear error and exit code 2.

In this app, the Command-line arguments box supplies what would follow python3 main.py.`,
  example: {
    language: 'python',
    caption: 'python3 main.py Ada --times 2 --loud',
    code: `import argparse

parser = argparse.ArgumentParser(description="Greet someone")
parser.add_argument("name")
parser.add_argument("--times", type=int, default=1)
parser.add_argument("--loud", action="store_true")
args = parser.parse_args()

msg = f"Hello, {args.name}!"
if args.loud:
    msg = msg.upper()
for _ in range(args.times):
    print(msg)`,
  },
  task: {
    kind: 'python',
    instructions: 'Build a small command-line tool with argparse:\n1. A required positional argument  word .\n2. An option  --repeat  with type int and default 1.\n3. A flag  --reverse  (store_true).\nPrint the word (reversed if the flag is set) repeat times, one per line. The arguments box holds  stack --repeat 3 --reverse , so the expected output is kcats three times. Try --help in the box too.',
    starter: 'import argparse\n\nparser = argparse.ArgumentParser(description="Repeat a word")\n',
    argv: ['stack', '--repeat', '3', '--reverse'],
    hints: ['parser.add_argument("word")', 'parser.add_argument("--repeat", type=int, default=1)', 'parser.add_argument("--reverse", action="store_true")', 'word = args.word[::-1] if args.reverse else args.word'],
    solution: { file: 'import argparse\n\nparser = argparse.ArgumentParser(description="Repeat a word")\nparser.add_argument("word")\nparser.add_argument("--repeat", type=int, default=1)\nparser.add_argument("--reverse", action="store_true")\nargs = parser.parse_args()\n\nword = args.word[::-1] if args.reverse else args.word\nfor _ in range(args.repeat):\n    print(word)\n' },
    check: (r) => {
      const argv = (r.env?.ARGV ?? '').split(/\s+/).filter(Boolean)
      const word = argv.find((a) => !a.startsWith('-') && argv[argv.indexOf(a) - 1] !== '--repeat')
      const rep = argv.includes('--repeat') ? parseInt(argv[argv.indexOf('--repeat') + 1], 10) : 1
      const rev = argv.includes('--reverse')
      const expected = word ? Array(rep).fill(rev ? [...word].reverse().join('') : word) : []
      const ls = outLines(r)
      return steps([
        [Boolean(word) && !argv.includes('--help') && !argv.includes('-h'), 'Put a word plus options in the arguments box, for example: stack --repeat 3 --reverse'],
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /add_argument\(\s*["']word["']/), 'Add the positional argument "word".'],
        [codeHas(r, /add_argument\(\s*["']--repeat["'][^)]*type\s*=\s*int/) && codeHas(r, /default\s*=\s*1/), 'Add --repeat with type=int and default=1.'],
        [codeHas(r, /add_argument\(\s*["']--reverse["'][^)]*action\s*=\s*["']store_true["']/), 'Add --reverse with action="store_true".'],
        [ls.join('|') === expected.join('|'), `With these arguments the output should be ${expected.length} line(s) of ${expected[0]}.`],
      ], 'A real command-line tool with help, types, and a flag.')
    },
  },
  quiz: [
    { question: 'What does action="store_true" make an argument?', options: ['A required option', 'A flag that is False unless present', 'A list'], answer: 1, explanation: 'Flags take no value. Present means True, absent means False.' },
    { question: 'What does argparse do if a required argument is missing?', options: ['Uses None', 'Prints usage and exits with code 2', 'Asks with input()'], answer: 1, explanation: 'It reports the problem and stops, which is what a command-line tool should do.' },
    { question: 'What does type=int do on add_argument?', options: ['Converts the text to an int and rejects non-numbers', 'Formats the help text', 'Nothing, arguments are always strings'], answer: 0, explanation: 'argparse applies the type and produces an error for invalid values.' },
  ],
}

export default lesson
