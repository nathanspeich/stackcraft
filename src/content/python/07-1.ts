import type { Lesson } from '../types'
import { codeHas, fileContent, noError, outLines, steps } from '../checks'

const NOTES = 'Monday: planned the week\nTuesday: fixed the bike\nWednesday: called grandma\nThursday: learned about files\n'

const lesson: Lesson = {
  id: 'w07d1',
  tier: 1,
  track: 'python',
  week: 7,
  day: 1,
  title: 'Reading and writing files',
  concept: `Programs become useful when they remember things between runs, and the simplest memory is a text file.

Open a file with a with block: with open("notes.txt") as f: reads by default, and the file closes itself when the block ends. Inside, f.read() gives the whole text, f.readlines() a list of lines, and looping for line in f: goes line by line. Lines keep their trailing newline, so call .strip() when you need clean text.

To write, pass a mode: open("out.txt", "w") creates or overwrites, open("out.txt", "a") appends. Then f.write("text\\n"). write does not add newlines for you.

Files are relative to the current directory unless you give a full path. Missing files raise FileNotFoundError, which the next lesson handles.`,
  example: {
    language: 'python',
    caption: 'Read, count, write, append',
    code: `with open("notes.txt") as f:
    lines = f.readlines()
print(len(lines), "lines")
for line in lines:
    print("-", line.strip())
with open("summary.txt", "w") as f:
    f.write(f"{len(lines)} notes\\n")
with open("summary.txt", "a") as f:
    f.write("checked\\n")`,
  },
  task: {
    kind: 'python',
    instructions: 'A file notes.txt is in the working directory.\n1. Read it and print how many lines it has as  4 lines .\n2. Print only the day names (the part before the colon), one per line.\n3. Write a new file summary.txt containing one line:  4 notes\n4. Append a second line to summary.txt:  done\n5. Read summary.txt back and print its contents.',
    starter: '# notes.txt is next to your program\n',
    seed: { 'notes.txt': NOTES },
    hints: ['with open("notes.txt") as f: lines = f.readlines()', 'line.split(":")[0] gives the day name.', 'Use mode "w" to write and "a" to append. Remember the \\n.', 'Open it again with the default mode and print(f.read())'],
    solution: { file: 'with open("notes.txt") as f:\n    lines = f.readlines()\nprint(f"{len(lines)} lines")\nfor line in lines:\n    print(line.split(":")[0])\nwith open("summary.txt", "w") as f:\n    f.write(f"{len(lines)} notes\\n")\nwith open("summary.txt", "a") as f:\n    f.write("done\\n")\nwith open("summary.txt") as f:\n    print(f.read())\n' },
    check: (r) => {
      const ls = outLines(r)
      const summary = fileContent(r, 'summary.txt') ?? ''
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /with\s+open\(/), 'Open files with a with block: with open("notes.txt") as f:'],
        [ls[0] === '4 lines', 'Line 1: 4 lines'],
        [ls.slice(1, 5).join('|') === 'Monday|Tuesday|Wednesday|Thursday', 'Lines 2 to 5: Monday, Tuesday, Wednesday, Thursday (split each line on the colon).'],
        [summary.startsWith('4 notes\n') && codeHas(r, /open\([^)]*["']w["']/), 'Write summary.txt with mode "w" containing the line 4 notes.'],
        [summary === '4 notes\ndone\n' && codeHas(r, /open\([^)]*["']a["']/), 'Append the line done with mode "a". The file should hold exactly two lines.'],
        [ls.slice(5, 7).join('|') === '4 notes|done', 'Read summary.txt back and print it.'],
      ], 'Read, transformed, written, appended, and verified.')
    },
  },
  quiz: [
    { question: 'Why use with open(...) as f?', options: ['It is faster', 'The file closes automatically when the block ends', 'It is required by Python'], answer: 1, explanation: 'with guarantees the file is closed even if an error happens inside the block.' },
    { question: 'What does mode "w" do to an existing file?', options: ['Appends to it', 'Overwrites it', 'Raises an error'], answer: 1, explanation: '"w" truncates the file first. Use "a" to keep the old contents.' },
    { question: 'Why does print(line) after readlines show blank lines between entries?', options: ['readlines adds spaces', 'Each line keeps its newline and print adds another', 'The file is corrupted'], answer: 1, explanation: 'Strip the newline with .strip() or use print(line, end="").' },
  ],
}

export default lesson
