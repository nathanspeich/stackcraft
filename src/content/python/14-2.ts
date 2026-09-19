import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `import json


class Item:
    """One kind of thing in stock. Yesterday's version, written by hand."""

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


# 3. Order dataclass: customer, items (default empty list), add(item), total()


# 4. build an order and print
`

const SOLUTION = `import json
from dataclasses import dataclass, field, asdict


@dataclass
class Item:
    """One kind of thing in stock."""
    name: str
    qty: int = 1
    price: float = 0.0

    def total(self):
        return self.qty * self.price

    def __str__(self):
        return f"{self.name} x{self.qty} @ {self.price:.2f} each"


@dataclass
class Order:
    customer: str
    items: list = field(default_factory=list)

    def add(self, item):
        self.items.append(item)

    def total(self):
        return sum(item.total() for item in self.items)


order = Order("Ana")
order.add(Item("Widget", 3, 2.5))
order.add(Item("Cable"))
print(order.items[1])
print(repr(order.items[0]))
print(Item("Widget", 3, 2.5) == Item("Widget", 3, 2.5))
print(f"order total: {order.total():.2f}")
print(json.dumps(asdict(order)))
`

const lesson: Lesson = {
  id: 'w14d2',
  tier: 2,
  track: 'python',
  week: 14,
  day: 2,
  title: 'Dataclasses',
  concept: `Yesterday's Item spent nine lines on __init__ and __repr__ that just copy arguments onto self. Every class that mostly holds data needs the same lines, so Python ships a shortcut: @dataclass from the dataclasses module.

You list the fields with type hints, and the decorator writes __init__, __repr__, and __eq__ for you. Equality compares field by field, so two Items with the same name, qty, and price are equal. Fields can have defaults. A mutable default like a list must use field(default_factory=list), otherwise every instance would share one list.

Dataclasses do not write __str__, so keep yours when you want a friendly form. asdict() turns an instance (and nested dataclasses) into plain dictionaries, which is exactly what json.dumps needs. That is how inventory.py will save itself later this week.`,
  example: {
    language: 'python',
    caption: 'A dataclass with a default and a JSON round trip',
    code: `from dataclasses import dataclass, asdict
import json

@dataclass
class Point:
    x: int
    y: int = 0

p = Point(2)
print(p)                 # Point(x=2, y=0)
print(p == Point(2, 0))  # True
print(json.dumps(asdict(p)))  # {"x": 2, "y": 0}`,
  },
  task: {
    kind: 'python',
    instructions: 'Rewrite Item as a dataclass and add an Order that holds items.\n1. Import dataclass, field, and asdict. Turn Item into a @dataclass with fields name: str, qty: int = 1, price: float = 0.0. Delete the hand-written __init__ and __repr__ but keep total() and __str__.\n2. Add a @dataclass Order with fields customer: str and items: list = field(default_factory=list), a method add(item) that appends, and total() that sums every item total.\n3. Create order = Order("Ana"), add Item("Widget", 3, 2.5) and Item("Cable").\n4. Print order.items[1], then repr(order.items[0]), then whether Item("Widget", 3, 2.5) == Item("Widget", 3, 2.5).\n5. Print  order total: 7.50  and then json.dumps(asdict(order)) on its own line.',
    starter: STARTER,
    hints: [
      'from dataclasses import dataclass, field, asdict, then @dataclass above class Item with name: str, qty: int = 1, price: float = 0.0 as the body.',
      'items: list = field(default_factory=list) gives each Order its own empty list.',
      'def total(self): return sum(item.total() for item in self.items)',
      'print(json.dumps(asdict(order))) prints nested dataclasses as plain JSON.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /@dataclass\s*\nclass Item/) && !codeHas(r, /def __init__/), 'Step 1: put @dataclass above class Item and delete the hand-written __init__.'],
        [codeHas(r, /qty:\s*int\s*=\s*1/) && codeHas(r, /price:\s*float\s*=\s*0\.0/), 'Step 1: declare the fields with defaults: qty: int = 1 and price: float = 0.0.'],
        [codeHas(r, /@dataclass\s*\nclass Order/) && codeHas(r, /field\(default_factory=list\)/), 'Step 2: add a @dataclass Order with items: list = field(default_factory=list).'],
        [ls[0] === 'Cable x1 @ 0.00 each', `Step 4: the first line should be  Cable x1 @ 0.00 each  (yours: ${JSON.stringify(ls[0] ?? '')}). The defaults fill in qty and price.`],
        [ls[1] === "Item(name='Widget', qty=3, price=2.5)", 'Step 4: the second line should be the dataclass repr  Item(name=\'Widget\', qty=3, price=2.5)'],
        [ls[2] === 'True', 'Step 4: two Items with the same fields should compare equal and print True.'],
        [ls[3] === 'order total: 7.50', 'Step 5: print  order total: 7.50  using Order.total().'],
        [codeHas(r, /asdict\(/) && ls[4] === '{"customer": "Ana", "items": [{"name": "Widget", "qty": 3, "price": 2.5}, {"name": "Cable", "qty": 1, "price": 0.0}]}', 'Step 5: the last line should be json.dumps(asdict(order)).'],
      ], 'Three lines of fields replaced twelve lines of boilerplate, and equality and JSON came free.')
    },
  },
  quiz: [
    { question: 'What does @dataclass generate for you?', options: ['__init__, __repr__, and __eq__', '__str__ and __len__', 'A database table'], answer: 0, explanation: 'It writes the constructor, the repr, and field-by-field equality. __str__ is still yours to write.' },
    { question: 'Why use field(default_factory=list) instead of items: list = []?', options: ['Lists cannot be defaults at all', 'A plain list default would be shared by every instance, so the factory makes a fresh one each time', 'It is faster'], answer: 1, explanation: 'Python evaluates a default once. default_factory calls list() per instance.' },
    { question: 'What does asdict(order) return?', options: ['A JSON string', 'A plain dictionary, with nested dataclasses converted too', 'A list of field names'], answer: 1, explanation: 'asdict gives dictionaries, and json.dumps turns those into text.' },
  ],
}

export default lesson
