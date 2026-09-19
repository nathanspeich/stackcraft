import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STORE = `"""store.py: catalog and checkout. Logs through a logger named after the module."""
import logging

log = logging.getLogger(__name__)


def load_catalog(path):
    log.debug("reading catalog from %s", path)
    items = ["Widget", "Cable", "Gadget"]
    log.info("loaded %d products", len(items))
    return items


def checkout(order_id, items):
    if not items:
        log.warning("order %s has no items", order_id)
        return False
    log.info("order %s checked out with %d items", order_id, len(items))
    return True
`

const PAYMENTS = `"""payments.py: charging cards. Also logs through its own module logger."""
import logging

log = logging.getLogger(__name__)


def charge(order_id, amount):
    log.debug("charging %.2f for order %s", amount, order_id)
    if amount <= 0:
        log.error("refusing to charge %.2f for order %s", amount, order_id)
        return False
    log.info("charged %.2f for order %s", amount, order_id)
    return True
`

const STARTER = `import logging
from logging.config import dictConfig

# 1. LOGGING config dictionary, then dictConfig(LOGGING)

import store
import payments

items = store.load_catalog("catalog.json")
store.checkout(1, items)
store.checkout(2, [])
payments.charge(1, 12.5)
payments.charge(2, 0)
`

const SOLUTION = `import logging
from logging.config import dictConfig

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "loggers": {
        "store": {"level": "DEBUG"},
        "payments": {"level": "ERROR"},
    },
    "root": {"level": "WARNING", "handlers": ["console"]},
}
dictConfig(LOGGING)

import store
import payments

items = store.load_catalog("catalog.json")
store.checkout(1, items)
store.checkout(2, [])
payments.charge(1, 12.5)
payments.charge(2, 0)
`

const lesson: Lesson = {
  id: 'w20d3',
  tier: 2,
  track: 'python',
  week: 20,
  day: 3,
  title: 'dictConfig and per-module loggers',
  concept: `Every module in a project should start with log = logging.getLogger(__name__). The logger is then named after the module, store or payments, so each record says where it came from, and you can turn one module up to DEBUG while the others stay quiet.

Loggers form a tree by name: store.db is a child of store, and everything is a child of the root. A record travels up the tree, so handlers are usually attached to the root only, once.

Configuring three handlers and five loggers by hand is tedious, so logging.config.dictConfig takes one dictionary that describes formatters, handlers, loggers, and the root. It is easy to load from a file. Set disable_existing_loggers to False, otherwise loggers created before the call go silent.`,
  example: {
    language: 'python',
    caption: 'One dictionary configures the whole tree',
    code: `from logging.config import dictConfig

dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "%(levelname)s %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler",
                             "formatter": "simple"}},
    "loggers": {"db": {"level": "DEBUG"}},
    "root": {"level": "WARNING", "handlers": ["console"]},
})
# db logs everything, every other module only WARNING and above`,
  },
  task: {
    kind: 'python',
    instructions: 'store.py and payments.py are in the working directory and each uses logging.getLogger(__name__). Configure them from main.py.\n1. Build a dictionary LOGGING with "version": 1 and "disable_existing_loggers": False.\n2. Add a formatter named "simple" with the format "%(levelname)s %(name)s: %(message)s", and a handler named "console" of class "logging.StreamHandler" that uses it.\n3. Under "loggers", set "store" to level "DEBUG" and "payments" to level "ERROR". Under "root", set level "WARNING" and handlers ["console"].\n4. Call dictConfig(LOGGING) before the imports of store and payments.\n5. Run. Expected five lines: two DEBUG/INFO lines from loading the catalog, two from the checkouts (INFO then WARNING), and one ERROR from payments. The INFO charge line stays hidden.',
    starter: STARTER,
    seed: { 'store.py': STORE, 'payments.py': PAYMENTS },
    hints: [
      '"formatters": {"simple": {"format": "%(levelname)s %(name)s: %(message)s"}}',
      '"handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}}',
      '"loggers": {"store": {"level": "DEBUG"}, "payments": {"level": "ERROR"}}, "root": {"level": "WARNING", "handlers": ["console"]}',
      'Loggers without handlers pass records up to the root, which is why only the root needs the console handler.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /["']version["']\s*:\s*1/) && codeHas(r, /["']disable_existing_loggers["']\s*:\s*False/), 'Step 1: the dictionary needs "version": 1 and "disable_existing_loggers": False.'],
        [codeHas(r, /["']simple["']\s*:\s*\{\s*["']format["']\s*:\s*["']%\(levelname\)s %\(name\)s: %\(message\)s["']/), 'Step 2: a formatter "simple" with format "%(levelname)s %(name)s: %(message)s".'],
        [codeHas(r, /["']console["']\s*:\s*\{[^}]*["']class["']\s*:\s*["']logging\.StreamHandler["']/), 'Step 2: a handler "console" with "class": "logging.StreamHandler" and "formatter": "simple".'],
        [codeHas(r, /["']store["']\s*:\s*\{\s*["']level["']\s*:\s*["']DEBUG["']/) && codeHas(r, /["']payments["']\s*:\s*\{\s*["']level["']\s*:\s*["']ERROR["']/), 'Step 3: "store" at level "DEBUG" and "payments" at level "ERROR" under "loggers".'],
        [codeHas(r, /["']root["']\s*:\s*\{[^}]*["']WARNING["'][^}]*\[\s*["']console["']\s*\]/), 'Step 3: "root" with level "WARNING" and handlers ["console"].'],
        [codeHas(r, /dictConfig\(LOGGING\)/), 'Step 4: call dictConfig(LOGGING).'],
        [ls[0] === 'DEBUG store: reading catalog from catalog.json' && ls[1] === 'INFO store: loaded 3 products', `Step 5: the first lines should be  DEBUG store: reading catalog from catalog.json  and  INFO store: loaded 3 products  (yours: ${JSON.stringify(ls.slice(0, 2).join(' | '))}).`],
        [ls[2] === 'INFO store: order 1 checked out with 3 items' && ls[3] === 'WARNING store: order 2 has no items', 'Step 5: then  INFO store: order 1 checked out with 3 items  and  WARNING store: order 2 has no items.'],
        [ls[4] === 'ERROR payments: refusing to charge 0.00 for order 2' && ls.length === 5, 'Step 5: the last line should be  ERROR payments: refusing to charge 0.00 for order 2  and nothing else: payments is at ERROR, so its INFO line stays hidden.'],
      ], 'Two modules, two volumes, one dictionary. Each line says exactly which module spoke.')
    },
  },
  quiz: [
    { question: 'What name does logging.getLogger(__name__) give the logger inside store.py?', options: ['__name__', 'store', 'root'], answer: 1, explanation: '__name__ is the module name, so the logger is called store and records show it.' },
    { question: 'The "store" logger has no handlers of its own. Where does its output go?', options: ['Nowhere', 'Up the tree to the root logger, which has the console handler', 'To a default file'], answer: 1, explanation: 'Records propagate to ancestor loggers, so handlers on the root see everything.' },
    { question: 'What does disable_existing_loggers: False prevent?', options: ['Loggers created before dictConfig ran being silenced', 'Duplicate output', 'DEBUG messages'], answer: 0, explanation: 'The default True disables every logger not named in the config, which surprises people whose modules were imported first.' },
  ],
}

export default lesson
