import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `class Item:
    def __init__(self, name, qty):
        self.name = name
        self.qty = qty

    def __str__(self):
        return f"{self.name} x{self.qty}"


# 1. PerishableItem(Item) with an extra expires attribute


# 2. Inventory that holds a list of items


# 3. describe(inv): a plain function


inv = None  # build the inventory here
`

const SOLUTION = `class Item:
    def __init__(self, name, qty):
        self.name = name
        self.qty = qty

    def __str__(self):
        return f"{self.name} x{self.qty}"


class PerishableItem(Item):
    def __init__(self, name, qty, expires):
        super().__init__(name, qty)
        self.expires = expires

    def __str__(self):
        return f"{super().__str__()} (expires {self.expires})"


class Inventory:
    def __init__(self):
        self.items = []

    def add(self, item):
        self.items.append(item)

    def total_qty(self):
        return sum(item.qty for item in self.items)

    def expiring(self):
        return [item for item in self.items if isinstance(item, PerishableItem)]


def describe(inv):
    return f"{len(inv.items)} kinds, {inv.total_qty()} units"


inv = Inventory()
inv.add(Item("Widget", 3))
inv.add(PerishableItem("Milk", 2, "2026-10-01"))
inv.add(Item("Cable", 5))
for item in inv.items:
    print(item)
print(describe(inv))
print("expiring:", [str(item) for item in inv.expiring()])
`

const lesson: Lesson = {
  id: 'w14d3',
  tier: 2,
  track: 'python',
  week: 14,
  day: 3,
  title: 'Inheritance vs composition',
  concept: `Inheritance says "is a": a PerishableItem is an Item with one extra fact, an expiry date. The subclass calls super().__init__ to let the parent store the shared fields, then adds its own. It can override a method and still reuse the parent's version through super().

Composition says "has a": an Inventory has items. It keeps them in a list and offers methods for the whole collection. Nothing is inherited; the objects simply hold each other.

Beginners reach for inheritance too often. Use it only for a true is-a relationship with shared behavior, and composition whenever one thing contains or uses another. And when there is no state to keep between calls, skip the class: a plain function that takes the data as an argument is shorter and easier to test.`,
  example: {
    language: 'python',
    caption: 'Is-a with super(), has-a with a list',
    code: `class Animal:
    def __init__(self, name):
        self.name = name
    def speak(self):
        return f"{self.name} makes a sound"

class Dog(Animal):          # a Dog is an Animal
    def speak(self):
        return super().speak() + ": woof"

class Shelter:              # a Shelter has animals
    def __init__(self):
        self.animals = []

print(Dog("Rex").speak())   # Rex makes a sound: woof`,
  },
  task: {
    kind: 'python',
    instructions: 'Extend Item with a subclass, then hold items in an Inventory.\n1. Write class PerishableItem(Item) whose __init__(self, name, qty, expires) calls super().__init__(name, qty) and stores expires. Override __str__ so it returns  Milk x2 (expires 2026-10-01)  by reusing super().__str__().\n2. Write class Inventory with self.items = [] in __init__, add(item) that appends, total_qty() that sums the quantities, and expiring() that returns the items that are PerishableItem (use isinstance).\n3. Write a plain function describe(inv) that returns  3 kinds, 10 units  from len(inv.items) and inv.total_qty().\n4. Build inv with Item("Widget", 3), PerishableItem("Milk", 2, "2026-10-01"), and Item("Cable", 5). Print each item on its own line, then print(describe(inv)), then print("expiring:", [str(item) for item in inv.expiring()]).',
    starter: STARTER,
    hints: [
      'class PerishableItem(Item): def __init__(self, name, qty, expires): super().__init__(name, qty); self.expires = expires',
      'return f"{super().__str__()} (expires {self.expires})"',
      'def expiring(self): return [item for item in self.items if isinstance(item, PerishableItem)]',
      'def describe(inv): return f"{len(inv.items)} kinds, {inv.total_qty()} units"',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /class PerishableItem\(Item\)/) && codeHas(r, /super\(\)\.__init__\(/), 'Step 1: class PerishableItem(Item) whose __init__ calls super().__init__(name, qty).'],
        [codeHas(r, /class Inventory/) && codeHas(r, /def total_qty\(self\)/) && codeHas(r, /isinstance\(/), 'Step 2: class Inventory with add, total_qty, and expiring using isinstance.'],
        [codeHas(r, /^def describe\(/m), 'Step 3: describe(inv) is a plain function, not a method.'],
        [ls[0] === 'Widget x3' && ls[2] === 'Cable x5', 'Step 4: print each item; the first line should be  Widget x3  and the third  Cable x5'],
        [ls[1] === 'Milk x2 (expires 2026-10-01)', `Step 1: the second line should be  Milk x2 (expires 2026-10-01)  (yours: ${JSON.stringify(ls[1] ?? '')}).`],
        [ls[3] === '3 kinds, 10 units', 'Step 4: print(describe(inv)) should give  3 kinds, 10 units'],
        [ls[4] === "expiring: ['Milk x2 (expires 2026-10-01)']", 'Step 4: the last line should be  expiring: [\'Milk x2 (expires 2026-10-01)\']'],
      ], 'An is-a subclass, a has-a container, and a plain function, each where it fits.')
    },
  },
  quiz: [
    { question: 'What does super().__init__(name, qty) do in a subclass?', options: ['Creates a second object', 'Runs the parent class __init__ so the shared attributes get stored', 'Deletes the parent attributes'], answer: 1, explanation: 'The parent still does its part; the subclass only adds what is new.' },
    { question: 'An Inventory holding a list of items is an example of what?', options: ['Inheritance', 'Composition: the inventory has items', 'Polymorphism'], answer: 1, explanation: 'Has-a relationships are modelled by holding objects, not by subclassing.' },
    { question: 'When is a plain function better than a class?', options: ['When there is no state to keep between calls', 'Whenever the code is under 50 lines', 'Never, classes are always clearer'], answer: 0, explanation: 'A function that takes its data as arguments is shorter and easier to test than a class with one method.' },
  ],
}

export default lesson
