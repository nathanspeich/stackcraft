import type { Lesson } from '../types'

/** The week 14 inventory.py with logging added: the complete reference for this project. */
const INVENTORY_PY = `#!/usr/bin/env python3
"""inventory.py: keep a small inventory in a JSON file.

Usage:
  python3 inventory.py add "Widget" 3
  python3 inventory.py remove "Widget" [qty]
  python3 inventory.py list
  python3 inventory.py --log-level DEBUG list
"""
import argparse
import json
import logging
from dataclasses import dataclass, asdict
from logging.handlers import RotatingFileHandler
from pathlib import Path

DATA_FILE = "inventory.json"
LOG_FILE = "inventory.log"
log = logging.getLogger("inventory")


def setup_logging(level_name):
    """Console at the requested level (INFO by default), full detail in a rotating file."""
    log.setLevel(logging.DEBUG)
    console = logging.StreamHandler()
    console.setLevel(getattr(logging, level_name.upper()))
    console.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    logfile = RotatingFileHandler(LOG_FILE, maxBytes=100_000, backupCount=3)
    logfile.setLevel(logging.DEBUG)
    logfile.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    log.addHandler(console)
    log.addHandler(logfile)


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
            log.debug("merged %d into existing %s", qty, name)
        else:
            self.items[name] = Item(name, qty)
            log.debug("created new item %s", name)
        return self.items[name]

    def remove(self, name, qty=None):
        if name not in self.items:
            raise KeyError(f"no such item: {name}")
        item = self.items[name]
        if qty is None or qty >= item.qty:
            del self.items[name]
            log.debug("deleted %s entirely", name)
        else:
            item.qty -= qty
            log.debug("took %d from %s, %d left", qty, name, item.qty)

    def __len__(self):
        return len(self.items)

    def __iter__(self):
        return iter(sorted(self.items.values(), key=lambda item: item.name))

    def __contains__(self, name):
        return name in self.items

    def save(self):
        data = [asdict(item) for item in self]
        self.path.write_text(json.dumps(data, indent=2) + "\\n")
        log.debug("saved %d item(s) to %s", len(data), self.path)

    @classmethod
    def load(cls, path=DATA_FILE):
        inv = cls(path)
        if inv.path.exists():
            for row in json.loads(inv.path.read_text()):
                inv.items[row["name"]] = Item(**row)
            log.debug("loaded %d item(s) from %s", len(inv), inv.path)
        else:
            log.debug("no %s yet, starting empty", inv.path)
        return inv


def build_parser():
    parser = argparse.ArgumentParser(description="Keep a small inventory in a JSON file")
    parser.add_argument("--file", default=DATA_FILE, help="where the data lives")
    parser.add_argument("--log-level", default="INFO",
                        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                        help="how much to print on the console (the log file always gets DEBUG)")
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
    setup_logging(args.log_level)
    log.debug("command %s with file %s", args.command, args.file)
    inv = Inventory.load(args.file)
    if args.command == "add":
        try:
            item = inv.add(args.name, args.qty)
        except ValueError as e:
            log.error("add %s rejected: %s", args.name, e)
            return 1
        inv.save()
        log.info("added %s", item)
        print(f"added {item}")
    elif args.command == "remove":
        try:
            inv.remove(args.name, args.qty)
        except KeyError as e:
            log.warning("remove failed: %s", e.args[0])
            return 1
        inv.save()
        log.info("removed %s", args.name)
        print(f"removed {args.name}")
    elif args.command == "list":
        log.info("listing %d item(s)", len(inv))
        for item in inv:
            print(item)
        print(f"{len(inv)} item(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`

const lesson: Lesson = {
  id: 'w20d5',
  tier: 2,
  track: 'python',
  week: 20,
  day: 5,
  title: 'Project: logging in inventory.py',
  concept: `inventory.py prints its results, and that stays: "added Widget x3" is the output the user asked for. What it lacks is a record of what happened and why. This project adds a logger named inventory with two handlers: a console handler whose level comes from a --log-level flag (INFO by default), and a RotatingFileHandler that always records DEBUG into inventory.log.

The pattern is a setup_logging(level_name) function called once at the start of main(), right after argparse has read the flag. Methods log at DEBUG (what they touched), main logs milestones at INFO, rejected input at WARNING or ERROR.

Because the logger name and formats are set in one place, the week 17 tests still pass untouched: they call main() and read stdout, and logging goes to stderr and the file.`,
  example: {
    language: 'python',
    caption: 'A --log-level flag feeding the console handler',
    code: `parser.add_argument("--log-level", default="INFO",
                    choices=["DEBUG", "INFO", "WARNING", "ERROR"])
args = parser.parse_args()

console = logging.StreamHandler()
console.setLevel(getattr(logging, args.log_level))
log.addHandler(console)

# python3 tool.py --log-level DEBUG add Widget 2
# DEBUG: loaded 1 item(s) from inventory.json
# INFO: added Widget x5`,
  },
  task: {
    kind: 'real',
    intro: `You will add logging to the inventory.py in ~/inventory on the VM, then prove it with three pastes: a normal run, a run at DEBUG, and the tail of the log file.

Open the box with  multipass shell stackcraft  and cd ~/inventory. Add a setup_logging function with a console StreamHandler and a RotatingFileHandler for inventory.log, a --log-level flag on the argument parser, and log calls in the methods and in main. Step 1 contains the complete reference version if you would rather paste it and read the diff against your week 14 file.

If you kept the week 17 venv, run  python3 -m pytest -q  afterwards: everything should still pass. The app only checks the text you paste; it never touches the VM.`,
    steps: [
      {
        instruction: 'Update inventory.py with logging. The command writes the reference version over the old file (your week 14 data file inventory.json is untouched). Then run a normal list command and paste the output: the console shows INFO lines and the results, but no DEBUG lines.',
        command: `cd ~/inventory
cat > inventory.py <<'EOF'
${INVENTORY_PY}EOF
python3 inventory.py list`,
        pasteLabel: 'Paste the output of python3 inventory.py list',
        check: [
          { type: 'includes', text: 'INFO' },
          { type: 'not', pattern: 'DEBUG', label: 'no DEBUG lines at the default level' },
          { type: 'includes', text: 'item(s)' },
        ],
        hint: 'No INFO line means the console handler is missing or its level is above INFO: the default for --log-level should be "INFO". If DEBUG lines appear, the console handler level is DEBUG; only the file handler should be. The results (Widget x3, 1 item(s)) still come from print.',
        example: `INFO: listing 1 item(s)
Widget x3
1 item(s)`,
      },
      {
        instruction: 'Run an add command with the flag set to DEBUG and paste the output. Now the console shows the detailed lines from load, add, and save as well.',
        command: `cd ~/inventory
python3 inventory.py --log-level DEBUG add "Widget" 2`,
        pasteLabel: 'Paste the output of python3 inventory.py --log-level DEBUG add "Widget" 2',
        check: [
          { type: 'includes', text: 'DEBUG' },
          { type: 'includes', text: 'Widget' },
        ],
        hint: 'If argparse complains about --log-level, the flag must be defined on the main parser (before add_subparsers) and passed before the subcommand. If no DEBUG lines appear, the logger itself is above DEBUG: call log.setLevel(logging.DEBUG) on the logger and let each handler filter.',
        example: `DEBUG: command add with file inventory.json
DEBUG: loaded 1 item(s) from inventory.json
DEBUG: merged 2 into existing Widget
DEBUG: saved 1 item(s) to inventory.json
INFO: added Widget x5
added Widget x5`,
      },
      {
        instruction: 'Show the last five lines of the log file. Every line should carry a timestamp, a level name, and the logger name, whatever the console level was.',
        command: 'tail -n 5 ~/inventory/inventory.log',
        pasteLabel: 'Paste the output of tail -n 5 inventory.log',
        check: [
          { type: 'regex', pattern: '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}', label: 'a timestamp like 2026-09-18 10:12:03' },
          { type: 'regex', pattern: '\\b(DEBUG|INFO|WARNING|ERROR|CRITICAL)\\b', label: 'a level name such as DEBUG or INFO' },
          { type: 'lines', atLeast: 2 },
        ],
        hint: 'No such file means the RotatingFileHandler was never added, or it points somewhere else: check LOG_FILE. Lines without a timestamp mean the file handler has no Formatter with %(asctime)s. Remember the file handler sits at DEBUG regardless of --log-level.',
        example: `2026-09-18 10:12:03 DEBUG inventory: loaded 1 item(s) from inventory.json
2026-09-18 10:12:03 INFO inventory: listing 1 item(s)
2026-09-18 10:12:41 DEBUG inventory: command add with file inventory.json
2026-09-18 10:12:41 DEBUG inventory: merged 2 into existing Widget
2026-09-18 10:12:41 INFO inventory: added Widget x5`,
      },
    ],
  },
  quiz: [
    { question: 'Why does --log-level change the console handler and not the logger?', options: ['Loggers cannot change level at runtime', 'The logger stays at DEBUG so the file always gets everything; only the console gets quieter or louder', 'argparse can only set handler levels'], answer: 1, explanation: 'The logger must let DEBUG through for the file. The console handler is the one whose verbosity the user controls.' },
    { question: 'Why do the week 17 tests still pass after adding logging?', options: ['Logging is disabled during tests', 'Results still go to stdout via print, and the tests read stdout; log lines go to stderr and the file', 'pytest ignores stderr'], answer: 1, explanation: 'Keeping program output on print and commentary on logging keeps the two separate.' },
    { question: 'Which message belongs at WARNING in the tool?', options: ['saved 1 item(s) to inventory.json', 'remove failed: no such item, because the user made a mistake but the program is fine', 'listing 3 item(s)'], answer: 1, explanation: 'A rejected request is noteworthy but not a failure of the program itself.' },
  ],
}

export default lesson
