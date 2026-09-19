import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `class Item:
    """One kind of thing in stock."""

    # 1. __init__(self, name, qty, price): store all three

    # 2. total(self): quantity times price

    # 3. __repr__: Item('Widget', 3, 2.5)

    # 4. __str__: Widget x3 @ 2.50 each


# 5. create widget and gadget, then print them
`

const SOLUTION = `class Item:
    """One kind of thing in stock."""

    def __init__(self, name, qty, price):
        self.name = name
        self.qty = qty
        self.price = price

    def total(self):
        return self.qty * self.price

    def __repr__(self):
        return f"Item({self.name!r}, {self.qty}, {self.price})"

    def __str__(self):
        return f"{self.name} x{self.qty} @ {self.price:.2f} each"


widget = Item("Widget", 3, 2.5)
gadget = Item("Gadget", 1, 10)
print(widget)
print(repr(gadget))
print([widget, gadget])
print(f"total: {widget.total() + gadget.total():.2f}")
`

const lesson: Lesson = {
  id: 'w14d1',
  tier: 2,
  track: 'python',
  week: 14,
  day: 1,
  title: 'Classes review, __init__, __repr__ and __str__',
  concept: `A class bundles data and the functions that work on that data. In Tier 1 you wrote classes with __init__ to store attributes on self and methods that read them. This week they build a real tool, so let us sharpen the details.

Python gives every object two text forms. __repr__ is for developers: unambiguous, ideally looking like the code that would rebuild the object, such as Item('Widget', 3, 2.5). __str__ is for people: friendly, like Widget x3. print() and f-strings use __str__. A list of objects, the debugger, and error messages use __repr__.

If you only write one, write __repr__: when __str__ is missing, Python falls back to it. The !r conversion inside an f-string inserts the repr of a value, which adds the quotes around strings.`,
  example: {
    language: 'python',
    caption: 'Two text forms for one object',
    code: `class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point({self.x}, {self.y})"

    def __str__(self):
        return f"({self.x}, {self.y})"

p = Point(2, 5)
print(p)          # (2, 5)
print([p])        # [Point(2, 5)]
print(f"{p!r}")   # Point(2, 5)`,
  },
  task: {
    kind: 'python',
    instructions: 'Build the Item class that the inventory tool will use all week.\n1. Write __init__(self, name, qty, price) that stores all three on self.\n2. Add a method total(self) that returns qty times price.\n3. Add __repr__ that returns  Item(\'Widget\', 3, 2.5)  for Item("Widget", 3, 2.5). Use {self.name!r} so the quotes appear.\n4. Add __str__ that returns  Widget x3 @ 2.50 each  (price with two decimals).\n5. Below the class create widget = Item("Widget", 3, 2.5) and gadget = Item("Gadget", 1, 10). Print widget, then repr(gadget), then the list [widget, gadget], then  total: 17.50  using both totals with two decimals.',
    starter: STARTER,
    hints: [
      'def __init__(self, name, qty, price): self.name = name, then the same for qty and price.',
      'return f"Item({self.name!r}, {self.qty}, {self.price})" gives the quotes around the name.',
      'f"{self.name} x{self.qty} @ {self.price:.2f} each" formats the price with two decimals.',
      'print(f"total: {widget.total() + gadget.total():.2f}")',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /def __init__\(self, name, qty, price\)/), 'Step 1: write __init__(self, name, qty, price) inside Item.'],
        [codeHas(r, /def total\(self\)/), 'Step 2: add a total(self) method.'],
        [codeHas(r, /def __repr__\(self\)/), 'Step 3: add __repr__.'],
        [codeHas(r, /def __str__\(self\)/), 'Step 4: add __str__.'],
        [ls[0] === 'Widget x3 @ 2.50 each', `Step 5: the first line should be  Widget x3 @ 2.50 each  (yours: ${JSON.stringify(ls[0] ?? '')}).`],
        [ls[1] === "Item('Gadget', 1, 10)", `Step 5: the second line should be  Item('Gadget', 1, 10)  (yours: ${JSON.stringify(ls[1] ?? '')}).`],
        [ls[2] === "[Item('Widget', 3, 2.5), Item('Gadget', 1, 10)]", 'Step 5: printing the list should use the repr of each item.'],
        [ls[3] === 'total: 17.50', 'Step 5: the last line should be  total: 17.50'],
      ], 'Item has a developer face and a human face. Tomorrow a dataclass writes most of this for you.')
    },
  },
  quiz: [
    { question: 'Which method does print(obj) use?', options: ['__repr__ always', '__str__, falling back to __repr__ if __str__ is missing', '__init__'], answer: 1, explanation: 'print and f-strings call str(), which uses __str__ and falls back to __repr__.' },
    { question: 'What does {self.name!r} do inside an f-string?', options: ['Raises an error if name is empty', 'Inserts repr(self.name), so strings get their quotes', 'Right-aligns the name'], answer: 1, explanation: 'The !r conversion calls repr on the value, which is how Item(\'Widget\', ...) gets its quotes.' },
    { question: 'Why is a good __repr__ worth writing even for a small class?', options: ['It makes objects faster', 'Lists, error messages, and the debugger all show it, so bugs are easier to read', 'Python refuses to print objects without it'], answer: 1, explanation: 'Without it you see <Item object at 0x...>, which tells you nothing.' },
  ],
}

export default lesson
