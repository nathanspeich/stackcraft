import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w09d1',
  tier: 1,
  track: 'python',
  week: 9,
  day: 1,
  title: 'Classes',
  concept: `A class bundles data and the functions that work on it. class Dog: starts one. Creating a Dog is called instantiating, and each one is an object.

__init__ runs when an object is created and sets up its attributes: def __init__(self, name): self.name = name. self is the object itself, and every method takes it as the first parameter. Dog("Rex") passes "Rex" as name.

Methods are functions inside the class: def bark(self): print(f"{self.name} says woof"). Call them with rex.bark().

__str__ returns the text shown when you print the object, so print(rex) can say something better than a memory address.

Use classes when several functions share the same data. For a bag of values with no behavior, a dictionary is often enough.`,
  example: {
    language: 'python',
    caption: 'A class with state and behavior',
    code: `class Counter:
    def __init__(self, start=0):
        self.value = start

    def add(self, n=1):
        self.value += n

    def __str__(self):
        return f"Counter at {self.value}"

c = Counter(10)
c.add()
c.add(5)
print(c.value)
print(c)`,
  },
  task: {
    kind: 'python',
    instructions: 'Write a class BankAccount:\n1. __init__(self, owner, balance=0) stores both.\n2. deposit(self, amount) adds to the balance.\n3. withdraw(self, amount) subtracts it, but prints  insufficient funds  and changes nothing if amount is more than the balance.\n4. __str__ returns  <owner>: <balance>  such as  Ada: 70 .\nThen create BankAccount("Ada", 50), deposit 30, withdraw 10, try to withdraw 500, and print the account.',
    starter: 'class BankAccount:\n    def __init__(self, owner, balance=0):\n        pass\n',
    hints: ['self.owner = owner and self.balance = balance in __init__', 'def deposit(self, amount): self.balance += amount', 'if amount > self.balance: print("insufficient funds") else: self.balance -= amount', 'def __str__(self): return f"{self.owner}: {self.balance}"'],
    solution: { file: 'class BankAccount:\n    def __init__(self, owner, balance=0):\n        self.owner = owner\n        self.balance = balance\n\n    def deposit(self, amount):\n        self.balance += amount\n\n    def withdraw(self, amount):\n        if amount > self.balance:\n            print("insufficient funds")\n        else:\n            self.balance -= amount\n\n    def __str__(self):\n        return f"{self.owner}: {self.balance}"\n\nacct = BankAccount("Ada", 50)\nacct.deposit(30)\nacct.withdraw(10)\nacct.withdraw(500)\nprint(acct)\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /class\s+BankAccount/) && codeHas(r, /def\s+__init__\s*\(\s*self\s*,\s*owner\s*,\s*balance\s*=\s*0\s*\)/), 'Define class BankAccount with __init__(self, owner, balance=0).'],
        [codeHas(r, /def\s+deposit\s*\(\s*self/) && codeHas(r, /def\s+withdraw\s*\(\s*self/), 'Add deposit and withdraw methods that take self and amount.'],
        [codeHas(r, /def\s+__str__\s*\(\s*self\s*\)/), 'Add a __str__ method.'],
        [ls[0] === 'insufficient funds', 'Withdrawing 500 should print insufficient funds and leave the balance alone.'],
        [ls[1] === 'Ada: 70', 'print(acct) should show Ada: 70 (50 + 30 - 10).'],
      ], 'A class with state, behavior, and a friendly print.')
    },
  },
  quiz: [
    { question: 'What is self?', options: ['The class itself', 'The object the method is being called on', 'A keyword for the first argument'], answer: 1, explanation: 'Python passes the instance as the first parameter, conventionally named self.' },
    { question: 'When does __init__ run?', options: ['When the class is defined', 'Each time an object is created', 'When print is called'], answer: 1, explanation: '__init__ is the initializer that sets up a new instance.' },
    { question: 'What does __str__ control?', options: ['How the object prints', 'How the object is compared', 'How the object is created'], answer: 0, explanation: 'print and str() call __str__ to get a readable description.' },
  ],
}

export default lesson
