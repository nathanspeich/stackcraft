import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w06d3',
  tier: 1,
  track: 'linux',
  week: 6,
  day: 3,
  title: 'Package managers: apt',
  concept: `On Linux you rarely download installers from websites. A package manager fetches software from trusted repositories, checks it, installs it, and later updates it. On Ubuntu and Debian that tool is apt.

sudo apt update refreshes the list of available packages. It installs nothing, it just downloads the catalog. Run it first.

sudo apt install name installs a package, along with anything it depends on. sudo apt remove name uninstalls it.

apt list --installed shows what is present, and apt search word looks through the catalog. Neither needs sudo because they only read.

Installing changes the system, which is why install and remove need sudo. If you forget, apt tells you it cannot acquire the lock.`,
  example: {
    language: 'bash',
    caption: 'Install a tool the proper way',
    code: `sudo apt update
Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease
Reading package lists... Done
sudo apt install tree
Setting up tree ...
tree ~/projects
projects
├── notes
│   └── ideas.txt
└── website`,
  },
  task: {
    kind: 'shell',
    instructions: 'The tree command is not installed yet.\n1. Try apt install tree without sudo and read the error.\n2. Refresh the package list the right way.\n3. Install tree with sudo.\n4. Run tree on ~/projects.\n5. Check that tree appears in the installed list.',
    seed: HOME_SEED,
    hints: ['apt install tree fails with a lock error because you are not root.', 'sudo apt update, then sudo apt install tree.', 'apt list --installed | grep tree'],
    solution: { commands: ['apt install tree', 'sudo apt update', 'sudo apt install tree', 'tree ~/projects', 'apt list --installed | grep tree'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*apt(-get)?\s+install\s+tree/, /are you root|Permission denied/), 'First try apt install tree without sudo to see the error.'],
        [ranWith(r, /^\s*sudo\s+apt(-get)?\s+update/, /Reading package lists/), 'Refresh the catalog with sudo apt update.'],
        [(r.state?.packages ?? []).includes('tree'), 'Install it: sudo apt install tree.'],
        [ranWith(r, /^\s*tree\b.*projects/, /├──|└──/), 'Run tree ~/projects.'],
        [ranWith(r, /^\s*apt\s+list\s+--installed/, /tree\//), 'Confirm with apt list --installed | grep tree.'],
      ], 'Package installed the Linux way: catalog, sudo, verify.'),
  },
  quiz: [
    { question: 'What does sudo apt update do?', options: ['Upgrades all installed software', 'Refreshes the list of available packages', 'Installs security patches'], answer: 1, explanation: 'update downloads the catalog. upgrade is the command that actually updates installed packages.' },
    { question: 'Why does apt install need sudo?', options: ['It changes system files that only root may write', 'It downloads from the internet', 'It always needs a password'], answer: 0, explanation: 'Installing writes into /usr and /etc, which are owned by root.' },
    { question: 'Which command shows whether htop is installed?', options: ['apt list --installed | grep htop', 'sudo apt install htop', 'apt update htop'], answer: 0, explanation: 'apt list --installed prints everything present. Piping to grep narrows it down.' },
  ],
}

export default lesson
