import type { Lesson } from '../types'

/** Complete reference implementation, shown in the step so a stuck learner can still finish. */
const INVENTORY_PY = `#!/usr/bin/env python3
"""inventory.py: keep a small inventory in a JSON file.

Usage:
  python3 inventory.py add "Widget" 3
  python3 inventory.py remove "Widget" [qty]
  python3 inventory.py list
"""
import argparse
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
        item = self.items[name]
        if qty is None or qty >= item.qty:
            del self.items[name]
        else:
            item.qty -= qty

    def __len__(self):
        return len(self.items)

    def __iter__(self):
        return iter(sorted(self.items.values(), key=lambda item: item.name))

    def __contains__(self, name):
        return name in self.items

    def save(self):
        data = [asdict(item) for item in self]
        self.path.write_text(json.dumps(data, indent=2) + "\\n")

    @classmethod
    def load(cls, path=DATA_FILE):
        inv = cls(path)
        if inv.path.exists():
            for row in json.loads(inv.path.read_text()):
                inv.items[row["name"]] = Item(**row)
        return inv


def build_parser():
    parser = argparse.ArgumentParser(description="Keep a small inventory in a JSON file")
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
    elif args.command == "list":
        for item in inv:
            print(item)
        print(f"{len(inv)} item(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`

const lesson: Lesson = {
  id: 'w14d5',
  tier: 2,
  track: 'python',
  week: 14,
  day: 5,
  title: 'Project: inventory.py',
  concept: `This week's project ties the four days together into one file: inventory.py, a command-line tool that keeps a list of items in a JSON file. It uses a dataclass for Item, a class with dunders and a classmethod constructor for Inventory, and argparse subcommands for add, remove, and list.

argparse subparsers are new. parser.add_subparsers() creates a slot for a command word; each sub.add_parser("add") gets its own arguments. After parsing, args.command tells you which one was used.

The tool lives on the VM from week 13 and grows all tier long: week 17 tests it, week 20 adds logging, week 25 puts it in a container, week 26 packages it. So take a minute to make it tidy.`,
  example: {
    language: 'python',
    caption: 'Subcommands with argparse',
    code: `import argparse

parser = argparse.ArgumentParser()
sub = parser.add_subparsers(dest="command", required=True)
p_add = sub.add_parser("add")
p_add.add_argument("name")
p_add.add_argument("qty", type=int, nargs="?", default=1)
sub.add_parser("list")

args = parser.parse_args(["add", "Widget", "3"])
print(args.command, args.name, args.qty)   # add Widget 3`,
  },
  task: {
    kind: 'real',
    intro: `You will build inventory.py inside the VM and prove it works by pasting its output. Open the box with  multipass shell stackcraft  on your Mac, then work in a folder called ~/inventory.

The tool has three commands. add NAME [QTY] adds an item or raises its quantity, remove NAME [QTY] takes some or all of it away, and list prints everything sorted by name. Every command loads inventory.json first and saves it afterwards, so the data survives between runs.

Write it yourself from this week's in-app version if you can. If you get stuck, the first step contains a complete reference implementation you can paste in with one command. Either way, read it: weeks 17 and 20 build on exactly this file.

Remember that the app never touches your machine. It only checks the text you paste.`,
    steps: [
      {
        instruction: 'Inside the VM, create the project folder and the file. The command below writes the reference implementation; skip the cat part if you would rather type your own version, but keep the same command names and output format. Then run the built-in help and paste it.',
        command: `mkdir -p ~/inventory && cd ~/inventory
cat > inventory.py <<'EOF'
${INVENTORY_PY}EOF
python3 inventory.py --help`,
        pasteLabel: 'Paste the output of python3 inventory.py --help',
        check: [
          { type: 'includes', text: 'usage:' },
          { type: 'includes', text: 'add', all: ['remove', 'list'] },
        ],
        hint: 'The help text comes from argparse. If you see a traceback instead, the file did not save completely: run  tail -3 inventory.py  and make sure the last line is  raise SystemExit(main()). Make sure you ran the command inside the VM (the prompt should show ubuntu@stackcraft).',
        example: `usage: inventory.py [-h] [--file FILE] {add,remove,list} ...

Keep a small inventory in a JSON file

positional arguments:
  {add,remove,list}
    add              add an item
    remove           remove an item, or part of its quantity
    list             list everything

options:
  -h, --help         show this help message and exit
  --file FILE        where the data lives`,
      },
      {
        instruction: 'Add a Widget with quantity 3, then list the inventory. Paste both outputs together.',
        command: `cd ~/inventory
python3 inventory.py add "Widget" 3
python3 inventory.py list`,
        pasteLabel: 'Paste the output of the add and list commands',
        check: [
          { type: 'includes', text: 'Widget' },
          { type: 'includes', text: '3' },
        ],
        hint: 'Expected something like  added Widget x3  followed by  Widget x3  and  1 item(s). If list prints 0 item(s), add is not calling inv.save() or list is loading a different file: both must use the same path (inventory.json in the current folder).',
        example: `added Widget x3
Widget x3
1 item(s)`,
      },
      {
        instruction: 'Show the JSON file the tool wrote. It should be a list of objects with name and qty, pretty-printed with indent=2.',
        command: 'cat ~/inventory/inventory.json',
        pasteLabel: 'Paste the output of cat inventory.json',
        check: [
          { type: 'regex', pattern: '^\\s*[\\[{]', label: 'text that starts like JSON, with [ or {' },
          { type: 'regex', pattern: '"name":\\s*"Widget"', label: 'a "name": "Widget" entry' },
          { type: 'regex', pattern: '"qty":\\s*\\d+', label: 'a "qty": number entry' },
        ],
        hint: 'If the file is missing, save() never ran. If it is on one line, pass indent=2 to json.dumps. The keys must be "name" and "qty" so that Item(**row) can rebuild each item when loading.',
        example: `[
  {
    "name": "Widget",
    "qty": 3
  }
]`,
      },
    ],
  },
  quiz: [
    { question: 'After parser.parse_args(["remove", "Cable"]), where is the word remove?', options: ['args.remove', 'args.command, because add_subparsers was given dest="command"', 'args[0]'], answer: 1, explanation: 'The dest name of the subparsers group holds which subcommand was used.' },
    { question: 'Why does every command load the JSON first and save afterwards?', options: ['argparse requires it', 'Each run is a fresh process, so the file is the only memory between runs', 'JSON files must be rewritten to stay valid'], answer: 1, explanation: 'Nothing survives the end of a process except what was written to disk.' },
    { question: 'What does Item(**row) do when row is {"name": "Widget", "qty": 3}?', options: ['Creates a tuple', 'Calls Item(name="Widget", qty=3), unpacking the dictionary as keyword arguments', 'Raises a TypeError'], answer: 1, explanation: 'Double-star unpacking turns dictionary keys into keyword arguments, which is why the JSON keys must match the field names.' },
  ],
}

export default lesson
