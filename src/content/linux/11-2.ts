import type { Lesson } from '../types'
import { HOME_SEED, fileContent, hasExecBit, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w11d2',
  tier: 1,
  track: 'linux',
  week: 11,
  day: 2,
  title: 'Bash scripting basics',
  concept: `A script is a file of commands that bash runs top to bottom. Anything you can type, you can script.

The first line is the shebang, #!/bin/bash. It tells the system which program should run the file. Lines starting with # are comments.

Variables work like in the terminal: name="Sam" and then "$name". Put variables in double quotes so values with spaces stay together. $(command) runs a command and gives you its output, so today=$(date) captures the date.

Scripts receive arguments: $1 is the first, $2 the second, $# is how many.

Run a script with bash script.sh, or make it executable with chmod +x and run ./script.sh. The ./ says look in this directory, because the current directory is not on PATH.`,
  example: {
    language: 'bash',
    caption: 'greet.sh',
    code: `#!/bin/bash
# Greets whoever is named on the command line
name="\${1:-friend}"        # first argument, or "friend" if none
host=$(hostname)
echo "Hello, $name! Welcome to $host."
echo "You passed $# argument(s)."`,
  },
  task: {
    kind: 'shell',
    instructions: 'Write greet.sh in the editor above so that it:\n1. Starts with a bash shebang.\n2. Stores the first argument in a variable called name.\n3. Prints exactly: Hello, <name>! Welcome to Stackcraft.\nThen make it executable and run it as ./greet.sh Ada so it prints Hello, Ada! Welcome to Stackcraft.',
    seed: HOME_SEED,
    file: '/home/learner/greet.sh',
    starter: '#!/bin/bash\n# greet.sh: say hello to the person named as the first argument\n\n',
    hints: ['name="$1" captures the first argument.', 'echo "Hello, $name! Welcome to Stackcraft."', 'chmod +x greet.sh, then ./greet.sh Ada'],
    solution: { file: '#!/bin/bash\nname="$1"\necho "Hello, $name! Welcome to Stackcraft."\n', commands: ['chmod +x greet.sh', './greet.sh Ada'] },
    check: (r) => {
      const src = fileContent(r, '/home/learner/greet.sh') ?? ''
      return steps([
        [/^#!\/bin\/(ba)?sh/.test(src) || /^#!\/usr\/bin\/env bash/.test(src), 'The first line of greet.sh should be the shebang #!/bin/bash.'],
        [/\bname=/.test(src) && /\$1|\$\{1/.test(src), 'Store the first argument in a variable: name="$1".'],
        [/echo\b.*\$\{?name\}?/.test(src), 'Print the greeting with echo and the $name variable.'],
        [hasExecBit(r, '/home/learner/greet.sh'), 'Make it executable with chmod +x greet.sh.'],
        [ranWith(r, /^\s*\.\/greet\.sh\s+Ada\b/, /^Hello, Ada! Welcome to Stackcraft\.\n$/), 'Run ./greet.sh Ada. It should print exactly: Hello, Ada! Welcome to Stackcraft.'],
      ], 'Your first script from scratch: shebang, variable, argument, output.')
    },
  },
  quiz: [
    { question: 'What is #!/bin/bash for?', options: ['A comment describing the script', 'It tells the system which interpreter runs the file', 'It loads bash settings'], answer: 1, explanation: 'The shebang line makes ./script.sh run under bash even if you use another shell.' },
    { question: 'Inside a script, what is $1?', options: ['The first line', 'The exit code', 'The first command-line argument'], answer: 2, explanation: '$1, $2 and so on are the positional arguments. $# is how many there are.' },
    { question: 'Why write ./script.sh instead of script.sh?', options: ['The current directory is not on PATH', './ makes it run faster', 'It is required for all commands'], answer: 0, explanation: 'Without a slash the shell searches PATH only. ./ points at the file explicitly.' },
  ],
}

export default lesson
