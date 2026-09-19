import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const INIT = '"""inventory: a small package for tracking stock."""\n\n__version__ = "0.1.0"\n\nfrom .core import Item, Inventory\n\n__all__ = ["Item", "Inventory", "__version__"]\n'

const CORE = 'from dataclasses import dataclass\n\n\n@dataclass\nclass Item:\n    name: str\n    qty: int = 1\n\n    def __str__(self):\n        return f"{self.name} x{self.qty}"\n\n\nclass Inventory:\n    def __init__(self):\n        self.items = {}\n\n    def add(self, name, qty=1):\n        if name in self.items:\n            self.items[name].qty += qty\n        else:\n            self.items[name] = Item(name, qty)\n        return self.items[name]\n\n    def __len__(self):\n        return len(self.items)\n\n    def __iter__(self):\n        return iter(sorted(self.items.values(), key=lambda i: i.name))\n'

const REPORT = '# A relative import: "from the core module in this same package"\nfrom .core import Inventory\n\n\ndef summary(inv: Inventory) -> str:\n    total = sum(item.qty for item in inv)\n    return f"{len(inv)} item(s), {total} unit(s)"\n\n\ndef lines(inv: Inventory) -> list[str]:\n    return [str(item) for item in inv]\n'

const lesson: Lesson = {
  id: 'w26d1',
  tier: 2,
  track: 'python',
  week: 26,
  day: 1,
  title: 'Modules, packages, imports',
  concept: `A module is one .py file. A package is a folder of modules with an __init__.py inside; the folder name becomes the import name. import inventory runs inventory/__init__.py, and import inventory.core loads the core module within it.

__init__.py can be empty, or it can pull the important names up a level: from .core import Item lets users write from inventory import Item without knowing where it lives. __version__ usually sits there too.

Inside a package, from .core import Inventory is a relative import: the dot means "this package". Outside it, use absolute imports: from inventory.core import Inventory. Relative imports only work when Python treats the folder as a package, which is why running a file inside one directly often fails; python -m inventory.report runs it as a module instead.`,
  example: {
    language: 'python',
    caption: 'One package, three ways to import from it',
    code: `# folder layout:
#   inventory/__init__.py   from .core import Item, Inventory
#   inventory/core.py       class Item, class Inventory
#   inventory/report.py     from .core import Inventory

import inventory                          # runs __init__.py
from inventory import Inventory           # re-exported by __init__
from inventory.core import Item           # absolute path to the module
from inventory import report              # a submodule
print(inventory.__version__, report.summary(Inventory()))`,
  },
  task: {
    kind: 'python',
    instructions: 'The working directory holds the package: inventory/__init__.py, inventory/core.py, inventory/report.py (read the example for what each exports). Write main.py so that it:\n1. Imports the package and prints  version: 0.1.0  using inventory.__version__.\n2. Imports Inventory with  from inventory import Inventory  and Item with an absolute import from inventory.core, then makes an Inventory and adds Widget 3, Gadget 5, and Widget 2 more.\n3. Imports report as a submodule (from inventory import report) and prints each of report.lines(inv), one per line.\n4. Prints  summary: 2 item(s), 10 unit(s)  using report.summary.\n5. Prints  module: inventory.report  using report.__name__, and  type: Item  using type(inv.items["Widget"]).__name__.',
    starter: '# main.py: use the inventory package that sits next to this file\n',
    seed: { 'inventory/__init__.py': INIT, 'inventory/core.py': CORE, 'inventory/report.py': REPORT },
    hints: ['Start with: import inventory  then print(f"version: {inventory.__version__}")', 'from inventory import Inventory  and  from inventory.core import Item  both work; the first is possible because __init__.py re-exports it.', 'from inventory import report  gives you the module; report.lines(inv) returns a list of strings to print one per line.', 'report.__name__ is the dotted module name. type(obj).__name__ is the class name as a string.'],
    solution: { file: 'import inventory\nfrom inventory import Inventory\nfrom inventory.core import Item\nfrom inventory import report\n\nprint(f"version: {inventory.__version__}")\n\ninv = Inventory()\ninv.add("Widget", 3)\ninv.add("Gadget", 5)\ninv.add("Widget", 2)\n\nfor line in report.lines(inv):\n    print(line)\nprint(f"summary: {report.summary(inv)}")\nprint(f"module: {report.__name__}")\nprint(f"type: {type(inv.items[\'Widget\']).__name__}")\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line: an ImportError usually means a wrong dotted path.'],
        [ls[0] === 'version: 0.1.0' && codeHas(r, /import inventory\b/) && codeHas(r, '__version__'), 'Line 1: version: 0.1.0 from inventory.__version__ (import inventory first).'],
        [codeHas(r, /from inventory import Inventory\b/) && codeHas(r, /from inventory\.core import Item\b/), 'Step 2: import Inventory with from inventory import Inventory, and Item with from inventory.core import Item.'],
        [ls[1] === 'Gadget x5' && ls[2] === 'Widget x5' && codeHas(r, /from inventory import report\b/) && codeHas(r, 'report.lines'), 'Lines 2 and 3: Gadget x5 then Widget x5, printed from report.lines(inv) after adding Widget 3, Gadget 5, Widget 2.'],
        [ls[3] === 'summary: 2 item(s), 10 unit(s)' && codeHas(r, 'report.summary'), 'Line 4: summary: 2 item(s), 10 unit(s) using report.summary(inv).'],
        [ls[4] === 'module: inventory.report' && codeHas(r, '__name__'), 'Line 5: module: inventory.report from report.__name__.'],
        [ls[5] === 'type: Item', 'Line 6: type: Item from type(inv.items["Widget"]).__name__.'],
      ], 'You can read a package layout and import from it three ways. Tomorrow you turn one into something pip can install.')
    },
  },
  quiz: [
    { question: 'What makes a folder a package?', options: ['A README', 'An __init__.py file inside it', 'A capital letter in the name'], answer: 1, explanation: 'Python runs __init__.py when the package is imported; even an empty one marks the folder.' },
    { question: 'What does the dot mean in  from .core import Inventory ?', options: ['The current working directory', 'The package this file belongs to', 'The parent folder'], answer: 1, explanation: 'A relative import is resolved against the importing module\'s package, not the shell\'s directory.' },
    { question: 'Why does  python inventory/report.py  fail with a relative import?', options: ['report.py has a syntax error', 'Run directly, the file is not part of a package, so "." has no meaning; use python -m inventory.report', 'Relative imports need Python 2'], answer: 1, explanation: 'python -m keeps the package context; running the path does not.' },
  ],
}

export default lesson
