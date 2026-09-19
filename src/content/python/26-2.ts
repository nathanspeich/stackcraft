import type { Lesson } from '../types'
import { fileContent, ranWith, steps } from '../checks'
import type { PyenvState } from '../../shell/sim/pyenv'

const CLI = 'import argparse\n\nfrom .core import Inventory\n\n\ndef main(argv=None):\n    parser = argparse.ArgumentParser(prog="inventory", description="Keep a small inventory in a JSON file")\n    parser.add_argument("--file", default="inventory.json")\n    sub = parser.add_subparsers(dest="command", required=True)\n    p_add = sub.add_parser("add")\n    p_add.add_argument("name")\n    p_add.add_argument("qty", type=int, nargs="?", default=1)\n    p_rm = sub.add_parser("remove")\n    p_rm.add_argument("name")\n    sub.add_parser("list")\n    args = parser.parse_args(argv)\n    inv = Inventory.load(args.file)\n    if args.command == "add":\n        print(f"added {inv.add(args.name, args.qty)}")\n        inv.save()\n    elif args.command == "remove":\n        inv.remove(args.name)\n        inv.save()\n        print(f"removed {args.name}")\n    else:\n        for item in inv:\n            print(item)\n        print(f"{len(inv)} item(s)")\n    return 0\n'

const CORE = 'import json\nfrom dataclasses import dataclass, asdict\nfrom pathlib import Path\n\n\n@dataclass\nclass Item:\n    name: str\n    qty: int = 1\n\n    def __str__(self):\n        return f"{self.name} x{self.qty}"\n\n\nclass Inventory:\n    def __init__(self, path="inventory.json"):\n        self.path = Path(path)\n        self.items = {}\n\n    def add(self, name, qty=1):\n        if name in self.items:\n            self.items[name].qty += qty\n        else:\n            self.items[name] = Item(name, qty)\n        return self.items[name]\n\n    def remove(self, name):\n        del self.items[name]\n\n    def __len__(self):\n        return len(self.items)\n\n    def __iter__(self):\n        return iter(sorted(self.items.values(), key=lambda i: i.name))\n\n    def save(self):\n        self.path.write_text(json.dumps([asdict(i) for i in self], indent=2) + "\\n")\n\n    @classmethod\n    def load(cls, path="inventory.json"):\n        inv = cls(path)\n        if inv.path.exists():\n            for row in json.loads(inv.path.read_text()):\n                inv.items[row["name"]] = Item(**row)\n        return inv\n'

export const PACKAGE_SEED: Record<string, string> = {
  '/home/learner/inventory/src/inventory/__init__.py': '"""inventory: keep a small inventory in a JSON file."""\n\n__version__ = "0.1.0"\n',
  '/home/learner/inventory/src/inventory/core.py': CORE,
  '/home/learner/inventory/src/inventory/cli.py': CLI,
  '/home/learner/inventory/README.md': '# inventory\n\nA tiny command-line inventory tool.\n',
}

const lesson: Lesson = {
  id: 'w26d2',
  tier: 2,
  track: 'python',
  week: 26,
  day: 2,
  title: 'pyproject.toml, wheels, entry points',
  concept: `pyproject.toml is the one file that turns a folder into an installable project. [build-system] names the tool that builds it (setuptools is the classic choice). [project] holds the metadata: name, version, description, requires-python, dependencies.

[project.scripts] is the part that matters most for a tool. inventory = "inventory.cli:main" tells pip to create an executable called inventory that imports inventory.cli and calls main(). That is how pytest, black, and flask get their commands.

The src layout puts the package in src/inventory so tests import the installed copy, not the folder by accident. python -m build reads pyproject.toml and writes dist/: a .tar.gz source distribution and a .whl wheel. A wheel is just a zip that pip can install anywhere.`,
  example: {
    language: 'text',
    caption: 'A minimal pyproject.toml with one console script',
    code: `[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"

[project]
name = "inventory"
version = "0.1.0"
description = "Keep a small inventory in a JSON file"
requires-python = ">=3.11"
dependencies = []

[project.scripts]
inventory = "inventory.cli:main"`,
  },
  task: {
    kind: 'shell',
    instructions: 'You are in ~/inventory, which holds src/inventory/ with __init__.py, core.py, and cli.py (cli.py defines main). Write pyproject.toml in the editor, then build a wheel.\n1. pyproject.toml: a [build-system] table using setuptools, a [project] table with name inventory, version 0.1.0, a description, and requires-python; and a [project.scripts] entry  inventory = "inventory.cli:main".\n2. Make and activate a virtual environment: python3 -m venv .venv then source .venv/bin/activate\n3. Install the build tool into it: pip install build\n4. Build: python3 -m build\n5. Look at the result: ls dist',
    seed: PACKAGE_SEED,
    cwd: '/home/learner/inventory',
    file: '/home/learner/inventory/pyproject.toml',
    starter: '# pyproject.toml for the inventory package\n\n[build-system]\n\n[project]\n\n[project.scripts]\n',
    hints: ['Copy the example above: setuptools in [build-system], the metadata in [project], and the script line in [project.scripts].', 'TOML strings need double quotes; the version must be a string like "0.1.0".', 'python3 -m build says "No module named build" until you pip install build inside the active venv.', 'The wheel name tells you the name, version, and that it works on any Python 3: inventory-0.1.0-py3-none-any.whl'],
    solution: {
      file: '[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "inventory"\nversion = "0.1.0"\ndescription = "Keep a small inventory in a JSON file"\nrequires-python = ">=3.11"\ndependencies = []\n\n[project.scripts]\ninventory = "inventory.cli:main"\n',
      commands: ['python3 -m venv .venv', 'source .venv/bin/activate', 'pip install build', 'python3 -m build', 'ls dist'],
    },
    check: (r) => {
      const t = fileContent(r, '/home/learner/inventory/pyproject.toml') ?? ''
      const p = r.state?.sims?.pyenv as PyenvState | undefined
      const venv = p?.venvs['/home/learner/inventory/.venv']
      return steps([
        [/^\[build-system\]\s*$/m.test(t) && /requires\s*=\s*\[\s*"setuptools[^"]*"\s*\]/.test(t) && /build-backend\s*=\s*"setuptools\.build_meta"/.test(t), 'Step 1: [build-system] with requires = ["setuptools>=61"] and build-backend = "setuptools.build_meta".'],
        [/^\[project\]\s*$/m.test(t) && /^name\s*=\s*"inventory"\s*$/m.test(t) && /^version\s*=\s*"0\.1\.0"\s*$/m.test(t) && /^description\s*=\s*"[^"]+"/m.test(t) && /^requires-python\s*=\s*">=3\.\d+"/m.test(t), 'Step 1: [project] needs name = "inventory", version = "0.1.0", a description, and requires-python = ">=3.11".'],
        [/^\[project\.scripts\]\s*$/m.test(t) && /^inventory\s*=\s*"inventory\.cli:main"\s*$/m.test(t), 'Step 1: under [project.scripts] add  inventory = "inventory.cli:main"'],
        [Boolean(venv) && r.env?.VIRTUAL_ENV === '/home/learner/inventory/.venv', 'Step 2: python3 -m venv .venv, then source .venv/bin/activate (VIRTUAL_ENV should be set afterwards).'],
        [Boolean(venv?.packages.build), 'Step 3: pip install build inside the venv.'],
        [Boolean(p?.built.includes('/home/learner/inventory/dist/inventory-0.1.0-py3-none-any.whl')) && Boolean(p?.built.includes('/home/learner/inventory/dist/inventory-0.1.0.tar.gz')), 'Step 4: python3 -m build should end with "Successfully built inventory-0.1.0.tar.gz and inventory-0.1.0-py3-none-any.whl". Fix any error it prints about pyproject.toml first.'],
        [ranWith(r, /ls\s+dist\/?/, /inventory-0\.1\.0-py3-none-any\.whl/), 'Step 5: ls dist should show the wheel and the tar.gz.'],
      ], 'A wheel in dist/ is the unit of Python distribution. Tomorrow you install this project the developer way, and on day 4 you ship it.')
    },
  },
  quiz: [
    { question: 'What does  inventory = "inventory.cli:main"  under [project.scripts] create?', options: ['A file called inventory.cli', 'An executable named inventory that calls main() in the inventory.cli module', 'A shell alias'], answer: 1, explanation: 'pip writes a tiny launcher into the environment\'s bin folder for every console script.' },
    { question: 'What is a wheel?', options: ['A compiled binary', 'A zip archive of the package plus metadata that pip installs without building', 'A Docker image for Python'], answer: 1, explanation: 'py3-none-any in the name means pure Python, any platform.' },
    { question: 'Why use the src layout (src/inventory) instead of inventory/ at the top?', options: ['It is required by pip', 'Tests and tools then import the installed package rather than the loose folder, catching packaging mistakes early', 'It makes imports shorter'], answer: 1, explanation: 'With the package one level down, the only way to import it is to install it, which is exactly what your users do.' },
  ],
}

export default lesson
