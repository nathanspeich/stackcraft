import type { Lesson } from '../types'
import { codeHas, outHas, steps } from '../checks'

const INVENTORY_MODULE = `"""inventory.py: the classes from week 14, as a module with no command-line code."""
import json
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class Item:
    name: str
    qty: int = 1

    def __str__(self):
        return f"{self.name} x{self.qty}"


class Inventory:
    def __init__(self, path="inventory.json"):
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
    def load(cls, path="inventory.json"):
        inv = cls(path)
        if inv.path.exists():
            for row in json.loads(inv.path.read_text()):
                inv.items[row["name"]] = Item(**row)
        return inv
`

const CONFTEST = `"""conftest.py: fixtures shared by every test file in this folder."""
import pytest

from inventory import Inventory


@pytest.fixture
def inv(tmp_path):
    """An inventory that saves into a temporary folder, holding 5 cables."""
    inventory = Inventory(tmp_path / "inventory.json")
    inventory.add("Cable", 5)
    return inventory
`

const STARTER = `"""tests/test_inventory.py: the tests for the inventory module."""
import pytest

# 1. import Inventory and Item from inventory

# the inv fixture comes from conftest.py: an inventory holding 5 cables


pytest.main()
`

const SOLUTION = `"""tests/test_inventory.py: the tests for the inventory module."""
import pytest

from inventory import Inventory, Item


def test_add_new(inv):
    inv.add("Widget", 3)
    assert len(inv) == 2
    assert "Widget" in inv


def test_add_merges(inv):
    inv.add("Cable", 2)
    assert inv.items["Cable"].qty == 7


def test_add_rejects_zero(inv):
    with pytest.raises(ValueError, match="positive"):
        inv.add("Widget", 0)


def test_remove_missing(inv):
    with pytest.raises(KeyError):
        inv.remove("Nothing")


def test_save_and_load(inv):
    inv.save()
    again = Inventory.load(inv.path)
    assert list(again) == [Item("Cable", 5)]


pytest.main()
`

const lesson: Lesson = {
  id: 'w17d4',
  tier: 2,
  track: 'python',
  week: 17,
  day: 4,
  title: 'Organizing tests, coverage, red-green-refactor',
  concept: `Real projects keep tests apart from the code. The layout is a tests/ folder next to the module, files named test_<module>.py, and a conftest.py holding fixtures that every test file can use without importing anything. pytest loads conftest.py on its own. Run pytest from the project root and it finds the whole tree.

Coverage answers "which lines did the tests run?". pytest --cov=inventory prints a table with a percentage per file and a TOTAL. It cannot tell you the tests are good, only which code they never touched, which is a good list of what to test next.

Red-green-refactor is the rhythm: write a failing test for the behavior you want (red), write the least code that passes (green), then tidy the code while the tests guard you (refactor).`,
  example: {
    language: 'text',
    caption: 'A project layout pytest understands',
    code: `inventory/
  inventory.py          the code
  tests/
    conftest.py         shared fixtures (no import needed)
    test_inventory.py   the tests

$ python3 -m pytest -v
tests/test_inventory.py::test_add_new PASSED
tests/test_inventory.py::test_remove_missing PASSED

$ python3 -m pytest --cov=inventory
Name           Stmts   Miss  Cover
inventory.py      44      6    86%`,
  },
  task: {
    kind: 'python',
    instructions: 'The editor plays the role of tests/test_inventory.py. inventory.py and conftest.py sit next to it in the working directory; conftest.py defines an inv fixture holding 5 cables.\n1. Import Inventory and Item from inventory.\n2. Write test_add_new(inv): add "Widget" 3, then assert len(inv) == 2 and "Widget" in inv.\n3. Write test_add_merges(inv): add "Cable" 2, then assert inv.items["Cable"].qty == 7.\n4. Write test_add_rejects_zero(inv) using pytest.raises(ValueError, match="positive") around inv.add("Widget", 0), and test_remove_missing(inv) using pytest.raises(KeyError) around inv.remove("Nothing").\n5. Write test_save_and_load(inv): inv.save(), then again = Inventory.load(inv.path), then assert list(again) == [Item("Cable", 5)]. Run: expect  5 passed.',
    starter: STARTER,
    seed: { 'inventory.py': INVENTORY_MODULE, 'conftest.py': CONFTEST },
    hints: [
      'from inventory import Inventory, Item',
      'The fixture is used by naming it: def test_add_new(inv): inv.add("Widget", 3) then assert len(inv) == 2',
      'with pytest.raises(KeyError):\n    inv.remove("Nothing")',
      'Item is a dataclass, so Item("Cable", 5) == Item("Cable", 5) is True and list(again) compares cleanly.',
    ],
    solution: { file: SOLUTION },
    check: (r) => steps([
      [codeHas(r, /pytest\.main\(\)/), 'Keep pytest.main() as the last line.'],
      [codeHas(r, /from inventory import .*Inventory/), 'Step 1: from inventory import Inventory, Item'],
      [codeHas(r, /def test_add_new\(inv\)/) && outHas(r, /test_add_new PASSED/), 'Step 2: test_add_new(inv) should add Widget 3 and check len(inv) == 2 and "Widget" in inv.'],
      [codeHas(r, /def test_add_merges\(inv\)/) && outHas(r, /test_add_merges PASSED/), 'Step 3: test_add_merges(inv) should add 2 more cables and expect qty 7.'],
      [codeHas(r, /pytest\.raises\(ValueError,\s*match=["']positive["']\)/) && outHas(r, /test_add_rejects_zero PASSED/), 'Step 4: test_add_rejects_zero(inv) should use pytest.raises(ValueError, match="positive").'],
      [codeHas(r, /pytest\.raises\(KeyError\)/) && outHas(r, /test_remove_missing PASSED/), 'Step 4: test_remove_missing(inv) should use pytest.raises(KeyError) around inv.remove("Nothing").'],
      [codeHas(r, /Inventory\.load\(inv\.path\)/) && outHas(r, /test_save_and_load PASSED/), 'Step 5: test_save_and_load(inv) should save, load from inv.path, and compare list(again) to [Item("Cable", 5)].'],
      [outHas(r, /\b5 passed\b/) && !outHas(r, /FAILED/), 'Expected  5 passed  with no failures.'],
    ], 'A real test file for a real module, with fixtures shared through conftest.py.'),
  },
  quiz: [
    { question: 'Where do fixtures go when several test files need them?', options: ['In every test file, copied', 'In conftest.py, which pytest loads automatically', 'In the module under test'], answer: 1, explanation: 'conftest.py is discovered by pytest and its fixtures are available to every test in that folder tree.' },
    { question: 'What does 86% coverage tell you?', options: ['86% of the tests passed', '86% of the lines in the file ran during the tests', 'The code is 86% correct'], answer: 1, explanation: 'Coverage measures lines executed, not correctness. The missing 14% is a to-do list.' },
    { question: 'In red-green-refactor, what is the green step?', options: ['Writing the least code that makes the failing test pass', 'Deleting tests that fail', 'Adding more tests'], answer: 0, explanation: 'Red is a failing test, green is minimal code to pass it, refactor is cleanup under test protection.' },
  ],
}

export default lesson
