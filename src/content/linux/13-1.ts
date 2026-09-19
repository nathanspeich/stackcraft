import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'w13d1',
  tier: 2,
  track: 'linux',
  week: 13,
  day: 1,
  title: 'Setup check and script structure',
  concept: `Welcome to Tier 2. From now on every week ends with a project on a real Linux machine. macOS has no apt, systemd, or ufw, so the projects run inside a free Ubuntu virtual machine on your Mac, created with Multipass. In this course "the box" and "the VM" both mean that machine.

Today you install Multipass, create a VM called stackcraft, open a shell in it, and let your Mac reach it over SSH. The app never connects to your machine: it only reads what you paste.

While things download, learn the skeleton every serious bash script starts with: a shebang line, set -euo pipefail so mistakes stop the script instead of hiding, variables in lower_case, and double quotes around every expansion.`,
  example: {
    language: 'bash',
    caption: 'The skeleton of a well-behaved script',
    code: `#!/bin/bash
set -euo pipefail

# -e  stop on the first failing command
# -u  treat unset variables as errors
# -o pipefail  a pipeline fails if any part fails

name="\${1:-world}"
echo "Hello, $name"`,
  },
  task: {
    kind: 'real',
    intro: `Everything below happens on your Mac's Terminal and, once it exists, inside the VM. Reset note: if the VM ever breaks, run multipass delete stackcraft and multipass purge on the Mac, then redo this lesson.

Multipass downloads an Ubuntu image the first time, so the launch step can take a few minutes.`,
    steps: [
      {
        instruction: 'On the Mac, install Multipass with Homebrew (install Homebrew first from brew.sh if you do not have it), then print its version.',
        command: 'brew install --cask multipass\nmultipass version',
        pasteLabel: 'Paste the output of multipass version',
        check: [{ type: 'regex', pattern: 'multipass(d)?\\s+v?\\d+\\.\\d+', label: 'a line like "multipass 1.15.0"' }],
        hint: 'If brew says the cask is already installed, just run multipass version. If the command is not found, open a new Terminal window so PATH is refreshed.',
        example: 'multipass   1.15.1+mac\nmultipassd  1.15.1+mac\n',
      },
      {
        instruction: 'Create the VM with 2 CPUs, 4 GB of memory, and a 20 GB disk, then list your VMs. The state should be Running.',
        command: 'multipass launch --name stackcraft --cpus 2 --memory 4G --disk 20G\nmultipass list',
        pasteLabel: 'Paste the output of multipass list',
        check: [{ type: 'includes', text: 'stackcraft' }, { type: 'includes', text: 'Running' }],
        hint: 'If the launch failed halfway, run multipass delete stackcraft, multipass purge, and launch again. A slow network is the usual cause.',
        example: 'Name                    State             IPv4             Image\nstackcraft              Running           192.168.64.5     Ubuntu 24.04 LTS\n',
      },
      {
        instruction: 'Open a shell inside the VM and run the setup check. You should see Linux, a Python 3.11 or newer, git, and the user ubuntu.',
        command: 'multipass shell stackcraft\n# now inside the VM:\nuname -a; python3 --version; git --version; whoami',
        pasteLabel: 'Paste the four lines from inside the VM',
        check: [
          { type: 'includes', text: 'Linux' },
          { type: 'regex', pattern: 'Python 3\\.(1[1-9]|[2-9]\\d)', label: 'a Python version of 3.11 or newer' },
          { type: 'regex', pattern: 'git version \\d', label: 'a git version line' },
          { type: 'includes', text: 'ubuntu' },
        ],
        hint: 'If git is missing, run sudo apt update && sudo apt install -y git inside the VM. The prompt inside the VM looks like ubuntu@stackcraft:~$.',
        example: 'Linux stackcraft 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024 aarch64 aarch64 aarch64 GNU/Linux\nPython 3.12.3\ngit version 2.43.0\nubuntu\n',
      },
      {
        instruction: `Let the Mac reach the VM with plain ssh. On the Mac, create a key if you have none, copy the public key into the VM's authorized_keys, then ssh in and run hostname. Type exit to leave the VM shell first.

The IP comes from multipass list. Save it: you will use ssh ubuntu@IP in later weeks.`,
        command: `# on the Mac
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
multipass exec stackcraft -- bash -c "mkdir -p ~/.ssh && echo '$(cat ~/.ssh/id_ed25519.pub)' >> ~/.ssh/authorized_keys"
ssh ubuntu@$(multipass info stackcraft | awk '/IPv4/ {print $2}') hostname`,
        pasteLabel: 'Paste the ssh command you ran and its output',
        check: [{ type: 'includes', text: 'ssh' }, { type: 'includes', text: 'stackcraft' }],
        hint: 'Answer yes to the "authenticity of host" question the first time. If you get "Permission denied (publickey)", the key was not appended: run the multipass exec line again and check with multipass exec stackcraft -- cat ~/.ssh/authorized_keys.',
        example: 'ssh ubuntu@192.168.64.5 hostname\nThe authenticity of host \'192.168.64.5\' can\'t be established.\nAre you sure you want to continue connecting (yes/no/[fingerprint])? yes\nstackcraft\n',
      },
    ],
  },
  quiz: [
    { question: 'Why does Tier 2 use an Ubuntu VM instead of macOS directly?', options: ['macOS cannot run bash', 'macOS has no apt, systemd, or ufw, and the projects need them', 'Multipass is faster than macOS'], answer: 1, explanation: 'The tools the projects practise are Linux tools. The VM gives you a real Ubuntu without a second computer.' },
    { question: 'What does set -euo pipefail do?', options: ['Prints every command', 'Stops on errors, unset variables, and failing pipelines', 'Makes the script executable'], answer: 1, explanation: 'Three safety switches: -e exits on failure, -u catches typos in variable names, pipefail catches a failure hidden inside a pipe.' },
    { question: 'How does the app verify a project day?', options: ['It connects to the VM over SSH', 'It reads the text you paste and checks it for patterns', 'It runs the commands for you'], answer: 1, explanation: 'The app never talks to your machine. Pasted output is all it sees.' },
  ],
}

export default lesson
