import type { Lesson } from '../types'
import { codeHas, fileContent, noError, outLines, steps } from '../checks'

const SEED = '[\n  {"name": "Cable", "qty": 5}\n]\n'

const STARTER = `import json
import sys


class Item:
    def __init__(self, name, qty):
        self.name = name
        self.qty = qty

    # 1. make qty a property whose setter rejects negatives

    def __repr__(self):
        return f"Item({self.name!r}, {self.qty})"

    def __str__(self):
        return f"{self.name} x{self.qty}"

    # 2. __eq__: same name and same qty


class Inventory:
    def __init__(self):
        self.items = {}

    def add(self, name, qty):
        name = Inventory.clean_name(name)
        if name in self.items:
            self.items[name].qty += qty
        else:
            self.items[name] = Item(name, qty)
        return self.items[name]

    # 3. __len__, __iter__ (sorted by name), __contains__

    # 4. save(self, path) and @classmethod load(cls, path)

    @staticmethod
    def clean_name(text):
        return text.strip().title()


command, *rest = sys.argv[1:] or ["list"]
inv = Inventory()  # 5. load inventory.json instead
if command == "add":
    item = inv.add(rest[0], int(rest[1]))
    print(f"added {item}")
    # save here
for item in inv:
    print(item)
print(f"{len(inv)} item(s)")
`

const SOLUTION = `import json
import sys


class Item:
    def __init__(self, name, qty):
        self.name = name
        self.qty = qty

    @property
    def qty(self):
        return self._qty

    @qty.setter
    def qty(self, value):
        if value < 0:
            raise ValueError("quantity cannot be negative")
        self._qty = value

    def __repr__(self):
        return f"Item({self.name!r}, {self.qty})"

    def __str__(self):
        return f"{self.name} x{self.qty}"

    def __eq__(self, other):
        return isinstance(other, Item) and (self.name, self.qty) == (other.name, other.qty)


class Inventory:
    def __init__(self):
        self.items = {}

    def add(self, name, qty):
        name = Inventory.clean_name(name)
        if name in self.items:
            self.items[name].qty += qty
        else:
            self.items[name] = Item(name, qty)
        return self.items[name]

    def __len__(self):
        return len(self.items)

    def __iter__(self):
        return iter(sorted(self.items.values(), key=lambda item: item.name))

    def __contains__(self, name):
        return name in self.items

    def save(self, path):
        data = [{"name": item.name, "qty": item.qty} for item in self]
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, path):
        inv = cls()
        try:
            with open(path) as f:
                rows = json.load(f)
        except FileNotFoundError:
            return inv
        for row in rows:
            inv.items[row["name"]] = Item(row["name"], row["qty"])
        return inv

    @staticmethod
    def clean_name(text):
        return text.strip().title()


command, *rest = sys.argv[1:] or ["list"]
inv = Inventory.load("inventory.json")
if command == "add":
    item = inv.add(rest[0], int(rest[1]))
    print(f"added {item}")
    inv.save("inventory.json")
for item in inv:
    print(item)
print(f"{len(inv)} item(s)")
`

const lesson: Lesson = {
  id: 'w14d4',
  tier: 2,
  track: 'python',
  week: 14,
  day: 4,
  title: 'Properties, class and static methods, dunders',
  concept: `A property is a method that looks like an attribute. With @property, item.qty runs a getter; with @qty.setter, item.qty = 5 runs a setter that can validate. The real value hides in self._qty. Callers keep writing plain attribute access, and you keep control.

Dunder methods (double underscore) let your objects join Python's built-in syntax. __len__ makes len(inv) work, __iter__ makes for item in inv work, __contains__ makes "Cable" in inv work, and __eq__ decides what == means.

A @classmethod receives the class instead of an instance, which makes it the natural home for alternative constructors like Inventory.load(path). A @staticmethod receives neither; it is a plain helper that lives inside the class because it belongs with it, like clean_name.`,
  example: {
    language: 'python',
    caption: 'A validated property and a classmethod constructor',
    code: `class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius        # goes through the setter

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("below absolute zero")
        self._celsius = value

    @classmethod
    def from_fahrenheit(cls, f):
        return cls((f - 32) * 5 / 9)

t = Temperature.from_fahrenheit(212)
print(t.celsius)   # 100.0`,
  },
  task: {
    kind: 'python',
    instructions: 'Finish the in-app inventory. inventory.json already holds one Cable, and the arguments box says  add Widget 3 .\n1. Turn qty into a property backed by self._qty. The setter raises ValueError("quantity cannot be negative") when value < 0.\n2. Add __eq__ to Item: two items are equal when name and qty match (check isinstance first).\n3. In Inventory add __len__ (number of items), __iter__ (items sorted by name, use sorted with key=lambda item: item.name), and __contains__ (name in self.items).\n4. Add save(self, path) that writes a JSON list of {"name": ..., "qty": ...} dictionaries with indent=2, and a @classmethod load(cls, path) that builds an Inventory from that file (return an empty one if the file is missing).\n5. At the bottom, load from "inventory.json" instead of Inventory(), and call inv.save("inventory.json") after adding. Expected output: added Widget x3, Cable x5, Widget x3, 2 item(s).',
    starter: STARTER,
    seed: { 'inventory.json': SEED },
    argv: ['add', 'Widget', '3'],
    hints: [
      '@property def qty(self): return self._qty, then @qty.setter def qty(self, value): check value < 0, then self._qty = value. The existing self.qty = qty in __init__ now uses the setter.',
      'def __iter__(self): return iter(sorted(self.items.values(), key=lambda item: item.name))',
      'save: data = [{"name": item.name, "qty": item.qty} for item in self]; then json.dump(data, f, indent=2)',
      'load: inv = cls(); open the file inside try/except FileNotFoundError; for row in json.load(f): inv.items[row["name"]] = Item(row["name"], row["qty"]); return inv',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const raw = fileContent(r, 'inventory.json') ?? ''
      let rows: { name?: string; qty?: number }[] = []
      try { rows = JSON.parse(raw) } catch { rows = [] }
      return steps([
        [(r.env?.ARGV ?? '') === 'add Widget 3', 'Keep  add Widget 3  in the arguments box.'],
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /@property\s*\n\s*def qty\(self\)/) && codeHas(r, /@qty\.setter/) && codeHas(r, /self\._qty/), 'Step 1: @property def qty and @qty.setter, storing the value in self._qty.'],
        [codeHas(r, /def __eq__\(self, other\)/) && codeHas(r, /isinstance\(other, Item\)/), 'Step 2: add __eq__(self, other) to Item and check isinstance(other, Item).'],
        [codeHas(r, /def __len__\(self\)/) && codeHas(r, /def __iter__\(self\)/) && codeHas(r, /def __contains__\(self, /), 'Step 3: add __len__, __iter__, and __contains__ to Inventory.'],
        [codeHas(r, /@classmethod\s*\n\s*def load\(cls, /) && codeHas(r, /def save\(self, /), 'Step 4: save(self, path) and a @classmethod load(cls, path).'],
        [codeHas(r, /Inventory\.load\("inventory\.json"\)/), 'Step 5: replace Inventory() with Inventory.load("inventory.json").'],
        [ls[0] === 'added Widget x3', `Step 5: the first line should be  added Widget x3  (yours: ${JSON.stringify(ls[0] ?? '')}).`],
        [ls[1] === 'Cable x5' && ls[2] === 'Widget x3' && ls[3] === '2 item(s)', 'Step 5: then Cable x5, Widget x3 (sorted by name), and 2 item(s). Cable comes from the loaded file.'],
        [rows.length === 2 && rows[0]?.name === 'Cable' && rows[0]?.qty === 5 && rows[1]?.name === 'Widget' && rows[1]?.qty === 3, 'Step 5: after inv.save, inventory.json should hold Cable 5 and Widget 3 as a JSON list of {"name", "qty"} objects.'],
        [/\n  \{/.test(raw), 'Step 4: save with indent=2 so the file is readable.'],
      ], 'Load, change, save. That is the whole inventory tool; tomorrow it becomes a real command on the VM.')
    },
  },
  quiz: [
    { question: 'What happens when you write item.qty = -1 with a validating property?', options: ['The setter runs and raises ValueError', 'Python stores -1 silently', 'A new attribute called _qty is created with -1'], answer: 0, explanation: 'Assignment goes through the setter, which is where validation lives.' },
    { question: 'Which dunder makes  for item in inv  work?', options: ['__len__', '__iter__', '__contains__'], answer: 1, explanation: '__iter__ returns an iterator; __len__ powers len() and __contains__ powers the in operator.' },
    { question: 'Why is load a classmethod rather than a regular method?', options: ['Regular methods cannot open files', 'It builds a new instance from data, so it needs the class (cls) and no existing object', 'Classmethods run faster'], answer: 1, explanation: 'Alternative constructors receive cls and return cls(...), which also works for subclasses.' },
  ],
}

export default lesson
