import type { Lesson } from '../types'
import { codeHas, fileExists, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w09d3',
  tier: 1,
  track: 'python',
  week: 9,
  day: 3,
  title: 'subprocess and OS automation',
  concept: `Python is a good glue language: it can walk folders, copy files, and run other programs, which is how a lot of automation on Linux is written.

os and pathlib handle paths and folders: os.listdir(".") lists names, os.path.exists(p) checks, os.makedirs(p, exist_ok=True) creates folders. shutil.copy(src, dst) copies a file and shutil.move renames or moves. Path("x.txt").suffix gives ".txt".

subprocess runs commands. subprocess.run(["ls", "-l"]) runs ls and lets its output through. Add capture_output=True, text=True to get the output back as a string in result.stdout, with result.returncode telling you whether it succeeded. Pass the command as a list of words, not one string, so spaces and quotes cannot surprise you.

In this sandbox, subprocess simulates a few common commands (echo, ls, uname, date, df, cat) and there is a small working directory with files.`,
  example: {
    language: 'python',
    caption: 'Copy files, run a command',
    code: `import os, shutil, subprocess

os.makedirs("backup", exist_ok=True)
for name in os.listdir("."):
    if name.endswith(".txt"):
        shutil.copy(name, os.path.join("backup", name))
print(sorted(os.listdir("backup")))
result = subprocess.run(["uname", "-a"], capture_output=True, text=True)
print(result.returncode, result.stdout.strip())`,
  },
  task: {
    kind: 'python',
    instructions: 'The working directory holds a.txt, b.txt, notes.md, and data.csv.\n1. Create a folder called archive (it must not fail if it already exists).\n2. Copy every .txt file into archive with shutil, then print the sorted contents of archive.\n3. Run the command  echo backup done  with subprocess, capturing output as text, and print its stdout stripped.\n4. Run  uname  the same way and print  kernel: Linux  using its output.\n5. Print how many files are in the working directory itself, not counting folders (use os.path.isfile).',
    starter: 'import os\nimport shutil\nimport subprocess\n',
    seed: { 'a.txt': 'alpha\n', 'b.txt': 'beta\n', 'notes.md': '# notes\n', 'data.csv': 'x,y\n1,2\n' },
    hints: ['os.makedirs("archive", exist_ok=True)', 'for name in os.listdir("."): if name.endswith(".txt"): shutil.copy(name, os.path.join("archive", name))', 'r = subprocess.run(["echo", "backup", "done"], capture_output=True, text=True); print(r.stdout.strip())', 'sum(1 for n in os.listdir(".") if os.path.isfile(n))'],
    solution: { file: 'import os\nimport shutil\nimport subprocess\n\nos.makedirs("archive", exist_ok=True)\nfor name in os.listdir("."):\n    if name.endswith(".txt"):\n        shutil.copy(name, os.path.join("archive", name))\nprint(sorted(os.listdir("archive")))\nr = subprocess.run(["echo", "backup", "done"], capture_output=True, text=True)\nprint(r.stdout.strip())\nu = subprocess.run(["uname"], capture_output=True, text=True)\nprint(f"kernel: {u.stdout.strip()}")\nprint(sum(1 for n in os.listdir(".") if os.path.isfile(n)))\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [fileExists(r, 'archive/a.txt') && fileExists(r, 'archive/b.txt') && !fileExists(r, 'archive/notes.md') && codeHas(r, 'exist_ok=True') && codeHas(r, 'shutil.copy'), 'Create archive with exist_ok=True and copy only the .txt files into it with shutil.copy.'],
        [ls[0] === "['a.txt', 'b.txt']", "Line 1: ['a.txt', 'b.txt'], the sorted contents of archive."],
        [ls[1] === 'backup done' && codeHas(r, /subprocess\.run\(\s*\[\s*["']echo["']/) && codeHas(r, 'capture_output=True'), 'Line 2: backup done from subprocess.run(["echo", ...], capture_output=True, text=True).'],
        [ls[2] === 'kernel: Linux' && codeHas(r, /["']uname["']/), 'Line 3: kernel: Linux using the captured output of uname.'],
        [ls[3] === '4' && codeHas(r, 'os.path.isfile'), 'Line 4: 4 files in the working directory, counted with os.path.isfile.'],
      ], 'Folders made, files copied, commands run and captured.')
    },
  },
  quiz: [
    { question: 'Why pass a command to subprocess.run as a list?', options: ['It runs faster', 'Each item is one argument, so spaces and quotes cannot break it', 'Strings are not allowed'], answer: 1, explanation: '["grep", "-i", "my file"] is unambiguous. A single string needs shell=True and careful quoting.' },
    { question: 'What does capture_output=True do?', options: ['Prints the output twice', 'Stores stdout and stderr on the result instead of printing them', 'Runs the command in the background'], answer: 1, explanation: 'Add text=True to get strings rather than bytes.' },
    { question: 'What does os.makedirs("a/b", exist_ok=True) do if a/b exists?', options: ['Raises an error', 'Nothing, quietly', 'Deletes and recreates it'], answer: 1, explanation: 'exist_ok makes it idempotent, which is what scripts you run repeatedly want.' },
  ],
}

export default lesson
