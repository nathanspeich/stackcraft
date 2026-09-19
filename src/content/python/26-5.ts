import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'w26d5',
  tier: 2,
  track: 'python',
  week: 26,
  day: 5,
  title: 'Project: the inventory package',
  badge: 'packager',
  concept: `The week 14 script becomes a real package on the VM: a src/inventory folder with core.py (the classes) and cli.py (the argparse main), a pyproject.toml that declares the inventory console script, and a pipx install so the command works from any folder.

The move is mostly cut and paste. The classes go to core.py unchanged. main() goes to cli.py with one new line at the top, from .core import Inventory, and one small change: parse_args(argv) so tests can call main with a list. The if __name__ block stays out, because the console script calls main() directly.

pipx builds the package into its own environment and links the command into ~/.local/bin. After pipx ensurepath and a fresh shell, which inventory finds it anywhere.`,
  example: {
    language: 'text',
    caption: 'The finished layout',
    code: `~/inventory
  pyproject.toml         name, version, [project.scripts]
  README.md
  src/inventory/
    __init__.py          __version__
    core.py              Item, Inventory
    cli.py               main() with argparse
  tests/                 from week 17, if you kept them`,
  },
  task: {
    kind: 'real',
    intro: 'This runs inside the VM (multipass shell stackcraft). You turn ~/inventory/inventory.py into an installable package called inventory with an inventory command, install it with pipx, and run it from a folder that has nothing to do with the project.\n\nStep 1 has the complete reference layout in one block: pyproject.toml, __init__.py, core.py, and cli.py. If your week 14 or week 20 script has extra features, move them across, but the reference works on its own.\n\nThe app only reads what you paste. Three pastes: the pipx listing, the path of the command, and its help text.',
    steps: [
      {
        instruction: 'Create the src layout, write the four files, install pipx, and install the project with it. The here-docs below are complete; paste the whole block into the VM. Then paste the output of pipx list.',
        command: `cd ~/inventory
mkdir -p src/inventory
cat > pyproject.toml <<'EOF'
[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"

[project]
name = "inventory"
version = "0.1.0"
description = "Keep a small inventory in a JSON file"
requires-python = ">=3.11"
dependencies = []

[project.scripts]
inventory = "inventory.cli:main"
EOF
cat > src/inventory/__init__.py <<'EOF'
"""inventory: keep a small inventory in a JSON file."""

__version__ = "0.1.0"
EOF
cat > src/inventory/core.py <<'EOF'
import json
from dataclasses import dataclass, asdict
from pathlib import Path

DATA_FILE = "inventory.json"


@dataclass
class Item:
    name: str
    qty: int = 1

    def __str__(self):
        return f"{self.name} x{self.qty}"


class Inventory:
    def __init__(self, path=DATA_FILE):
        self.path = Path(path)
        self.items = {}

    def add(self, name, qty=1):
        if qty <= 0:
            raise ValueError("quantity must be positive")
        if name in self.items:
            self.items[name].qty += qty
        else:
            self.items[name] = Item(name, qty)
        return self.items[name]

    def remove(self, name, qty=None):
        if name not in self.items:
            raise KeyError(f"no such item: {name}")
        if qty is None or qty >= self.items[name].qty:
            del self.items[name]
        else:
            self.items[name].qty -= qty

    def __len__(self):
        return len(self.items)

    def __iter__(self):
        return iter(sorted(self.items.values(), key=lambda i: i.name))

    def __contains__(self, name):
        return name in self.items

    def save(self):
        self.path.write_text(json.dumps([asdict(i) for i in self], indent=2) + "\\n")

    @classmethod
    def load(cls, path=DATA_FILE):
        inv = cls(path)
        if inv.path.exists():
            for row in json.loads(inv.path.read_text()):
                inv.items[row["name"]] = Item(**row)
        return inv
EOF
cat > src/inventory/cli.py <<'EOF'
import argparse

from .core import DATA_FILE, Inventory


def build_parser():
    parser = argparse.ArgumentParser(prog="inventory", description="Keep a small inventory in a JSON file")
    parser.add_argument("--file", default=DATA_FILE, help="where the data lives")
    sub = parser.add_subparsers(dest="command", required=True)
    p_add = sub.add_parser("add", help="add an item")
    p_add.add_argument("name")
    p_add.add_argument("qty", type=int, nargs="?", default=1)
    p_remove = sub.add_parser("remove", help="remove an item, or part of its quantity")
    p_remove.add_argument("name")
    p_remove.add_argument("qty", type=int, nargs="?")
    sub.add_parser("list", help="list everything")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    inv = Inventory.load(args.file)
    if args.command == "add":
        try:
            item = inv.add(args.name, args.qty)
        except ValueError as e:
            print(f"error: {e}")
            return 1
        inv.save()
        print(f"added {item}")
    elif args.command == "remove":
        try:
            inv.remove(args.name, args.qty)
        except KeyError as e:
            print(f"error: {e.args[0]}")
            return 1
        inv.save()
        print(f"removed {args.name}")
    else:
        for item in inv:
            print(item)
        print(f"{len(inv)} item(s)")
    return 0
EOF
sudo apt install -y pipx
pipx ensurepath
pipx install .
pipx list`,
        pasteLabel: 'Paste the output of pipx list',
        check: [{ type: 'includes', text: 'inventory' }, { type: 'regex', pattern: 'package inventory \\d+\\.\\d+|venvs are in|inventory\\s+\\d+\\.\\d+', label: 'the pipx listing with the inventory package' }],
        hint: 'If pipx install fails, read the pip error it quotes: a typo in pyproject.toml is the usual cause, and "No apps associated" means the [project.scripts] table is missing. Run pipx install . from ~/inventory, the folder that holds pyproject.toml.',
        example: 'venvs are in /home/ubuntu/.local/share/pipx/venvs\napps are exposed on your $PATH at /home/ubuntu/.local/bin\nmanual pages are exposed at /home/ubuntu/.local/share/man\n   package inventory 0.1.0, installed using Python 3.12.3\n    - inventory\n',
      },
      {
        instruction: 'pipx ensurepath added ~/.local/bin to PATH in ~/.bashrc, but only new shells see it. Leave the VM with exit, come back in with multipass shell stackcraft, and ask the shell where the command lives.',
        command: `exit
multipass shell stackcraft
which inventory`,
        pasteLabel: 'Paste the output of which inventory',
        check: [{ type: 'regex', pattern: '/inventory\\s*$', flags: 'm', label: 'a path ending in /inventory, like /home/ubuntu/.local/bin/inventory' }],
        hint: 'If which prints nothing, the PATH change has not taken effect: run  source ~/.bashrc  or  export PATH="$HOME/.local/bin:$PATH"  and try again. The path should end in .local/bin/inventory.',
        example: '/home/ubuntu/.local/bin/inventory\n',
      },
      {
        instruction: 'Prove it works from a folder that is not the project: go to /tmp and ask for help. Add an item there too if you like; the JSON file lands in whatever folder you run it from, or wherever --file points.',
        command: `cd /tmp
inventory --help
inventory add Widget 3
inventory list`,
        pasteLabel: 'Paste the output of inventory --help',
        check: [{ type: 'includes', text: 'usage' }, { type: 'regex', pattern: 'add|remove|list', label: 'the add, remove, and list subcommands in the help' }],
        hint: 'If you see "No module named inventory" the package did not install into the pipx venv: run pipx uninstall inventory, then pipx install . again from ~/inventory. If the help is from your old script, check that which inventory points into .local/bin.',
        example: 'usage: inventory [-h] [--file FILE] {add,remove,list} ...\n\nKeep a small inventory in a JSON file\n\npositional arguments:\n  {add,remove,list}\n    add              add an item\n    remove           remove an item, or part of its quantity\n    list             list everything\n\noptions:\n  -h, --help         show this help message and exit\n  --file FILE        where the data lives\n',
      },
    ],
  },
  quiz: [
    { question: 'Why does cli.py import with  from .core import Inventory  instead of  import inventory ?', options: ['It is shorter', 'A relative import inside the package works wherever the package is installed', 'import inventory is not allowed in packages'], answer: 1, explanation: 'Relative imports refer to the package itself, so the code does not care where pip put it.' },
    { question: 'What does pipx install . do with the console script?', options: ['Copies cli.py to /usr/bin', 'Builds the project into a private venv and links the inventory launcher into ~/.local/bin', 'Adds an alias to .bashrc'], answer: 1, explanation: 'Each pipx package gets its own venv; only its commands are exposed.' },
    { question: 'You edit src/inventory/cli.py after pipx install. Does the installed command change?', options: ['Yes, immediately', 'No: pipx installed a built copy; run pipx reinstall inventory (or install with -e for development)', 'Only after a reboot'], answer: 1, explanation: 'Unlike pip install -e in a venv, a plain pipx install is a snapshot of the project.' },
  ],
}

export default lesson
