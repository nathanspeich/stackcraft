import type { Lesson } from '../types'
import { fileContent, ranWith, steps } from '../checks'
import type { PyenvState } from '../../shell/sim/pyenv'
import { PACKAGE_SEED } from './26-2'

const PYPROJECT = '[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "inventory"\nversion = "0.1.0"\ndescription = "Keep a small inventory in a JSON file"\nrequires-python = ">=3.11"\ndependencies = [\n  "rich>=13",\n]\n\n[project.scripts]\ninventory = "inventory.cli:main"\n'

const lesson: Lesson = {
  id: 'w26d3',
  tier: 2,
  track: 'python',
  week: 26,
  day: 3,
  title: 'venv, pip install -e, requirements vs lock files',
  concept: `Ubuntu's system Python is managed by apt, so pip install there prints "externally-managed-environment" and stops. The fix is always a virtual environment: python3 -m venv .venv, then source .venv/bin/activate puts its bin folder first on PATH, so python, pip, and any console script you install come from it.

pip install -e . is the developer install. Editable means pip links the environment to your source folder: edits in src/ are live without reinstalling, and the inventory command from pyproject.toml appears right away.

Requirements files say what you want (rich>=13). A lock file says exactly what you got, every version pinned, dependencies included, so a teammate reproduces the same environment. pip freeze gives a quick lock; pip-compile from pip-tools makes a readable one that notes why each package is there.`,
  example: {
    language: 'bash',
    caption: 'From empty folder to reproducible environment',
    code: `python3 -m venv .venv
source .venv/bin/activate
pip install -e .            # your project, editable, plus its dependencies
inventory --help            # the console script exists now
pip install pip-tools
pip-compile requirements.in # writes requirements.txt with every version pinned
pip install -r requirements.txt
deactivate`,
  },
  task: {
    kind: 'shell',
    instructions: 'You are in ~/inventory. It has pyproject.toml (with rich as a dependency), the src/inventory package, and requirements.in listing the direct dependencies.\n1. Create .venv and activate it.\n2. Install the project editable: pip install -e .\n3. Run the new command: inventory --help\n4. Show the editable install: pip freeze (look for the -e line).\n5. Install pip-tools, then lock the direct dependencies: pip-compile requirements.in\n6. Read requirements.txt (cat) and note the # via comments, then install from it: pip install -r requirements.txt',
    seed: { ...PACKAGE_SEED, '/home/learner/inventory/pyproject.toml': PYPROJECT, '/home/learner/inventory/requirements.in': '# direct dependencies only; pip-compile turns this into requirements.txt\nrich>=13\nrequests\n' },
    cwd: '/home/learner/inventory',
    hints: ['Step 1: python3 -m venv .venv && source .venv/bin/activate. Check with which python3: it should point into .venv.', 'The dot in pip install -e . is the project folder (where pyproject.toml lives).', 'pip-compile is a command from the pip-tools package; install it first with pip install pip-tools.', 'Every line in requirements.txt is pinned with ==, and the # via comment says which requirement pulled it in.'],
    solution: { commands: ['python3 -m venv .venv', 'source .venv/bin/activate', 'pip install -e .', 'inventory --help', 'pip freeze', 'pip install pip-tools', 'pip-compile requirements.in', 'cat requirements.txt', 'pip install -r requirements.txt'] },
    check: (r) => {
      const p = r.state?.sims?.pyenv as PyenvState | undefined
      const venv = p?.venvs['/home/learner/inventory/.venv']
      const inv = venv?.packages.inventory
      const lock = fileContent(r, '/home/learner/inventory/requirements.txt') ?? ''
      return steps([
        [Boolean(venv) && r.env?.VIRTUAL_ENV === '/home/learner/inventory/.venv', 'Step 1: python3 -m venv .venv, then source .venv/bin/activate.'],
        [Boolean(inv?.editable) && Boolean(venv?.packages.rich), 'Step 2: pip install -e . inside the venv (it also pulls in rich).'],
        [ranWith(r, /^\s*inventory\s+(--help|-h)\s*$/, /usage: inventory/), 'Step 3: inventory --help should print a usage line; the command comes from [project.scripts].'],
        [ranWith(r, /pip\s+freeze/, /^-e \/home\/learner\/inventory$/m), 'Step 4: pip freeze should list the project as -e /home/learner/inventory.'],
        [Boolean(venv?.packages['pip-tools']), 'Step 5: pip install pip-tools.'],
        [/pip-compile/.test(lock) && /^requests==\d/m.test(lock) && /^rich==\d/m.test(lock) && /# via/.test(lock), 'Step 5: pip-compile requirements.in should write requirements.txt with requests and rich pinned and # via comments.'],
        [ranWith(r, /cat\s+requirements\.txt/, /# via/), 'Step 6: cat requirements.txt and read the # via comments.'],
        [ranWith(r, /pip\s+install\s+-r\s+requirements\.txt/, /Successfully installed|Requirement already satisfied/) && Boolean(venv?.packages.requests), 'Step 6: pip install -r requirements.txt installs the locked set.'],
      ], 'Editable install for you, lock file for everyone else. That is the daily rhythm of a Python project.')
    },
  },
  quiz: [
    { question: 'What does the -e in pip install -e . do?', options: ['Installs extras', 'Links the environment to your source folder so edits apply without reinstalling', 'Encrypts the package'], answer: 1, explanation: 'Editable installs are for development; users get the built wheel instead.' },
    { question: 'Why does pip install on Ubuntu\'s system Python refuse?', options: ['pip is not installed', 'The interpreter is marked externally managed to protect apt-installed packages; use a venv', 'The network is blocked'], answer: 1, explanation: 'PEP 668 keeps pip and apt from stepping on each other. A venv is the intended workaround.' },
    { question: 'What is the difference between requirements.in and requirements.txt after pip-compile?', options: ['None', '.in lists what you want with loose versions; .txt pins every package and its dependencies exactly', '.txt is for Windows'], answer: 1, explanation: 'The pinned file reproduces the environment; the loose file records intent.' },
  ],
}

export default lesson
