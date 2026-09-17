import type { Lesson } from '../types'
import { codeHas, fileExists, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w10d5',
  tier: 1,
  track: 'sql',
  week: 10,
  day: 5,
  title: 'Python plus sqlite3',
  concept: `Python ships with sqlite3, so a program can use a real database with no installation.

conn = sqlite3.connect("shop.db") opens or creates the file. cur = conn.cursor() gives you something to run statements on. cur.execute("SELECT ...") runs one, cur.fetchall() returns the rows as tuples, and cur.fetchone() returns just one.

Never build SQL by pasting values into the string. Use placeholders: cur.execute("INSERT INTO items VALUES (?, ?)", (name, price)). The library escapes the values, which prevents SQL injection and quoting bugs. executemany runs one statement for a whole list of rows.

Changes are inside a transaction until conn.commit(). Close with conn.close(), or use with conn: which commits for you.

This is the bridge: Python for logic and files, SQL for the data.`,
  example: {
    language: 'python',
    caption: 'Create, insert with placeholders, query',
    code: `import sqlite3

conn = sqlite3.connect("shop.db")
cur = conn.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT, price REAL)")
cur.executemany("INSERT INTO items (name, price) VALUES (?, ?)", [("cable", 9.5), ("hoodie", 39.0)])
conn.commit()
cur.execute("SELECT name, price FROM items WHERE price > ?", (10,))
for name, price in cur.fetchall():
    print(name, price)
conn.close()`,
  },
  task: {
    kind: 'python',
    instructions: 'Write a program that:\n1. Connects to inventory.db and creates a table items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, qty INTEGER NOT NULL).\n2. Inserts these rows with executemany and ? placeholders: keyboard 12, cable 140, hoodie 15, sticker 300.\n3. Commits.\n4. Selects name and qty for items with qty below 50, sorted by name, and prints each as  keyboard: 12 .\n5. Prints the total quantity as  total: 467  using SUM in SQL and fetchone.',
    starter: 'import sqlite3\n\nconn = sqlite3.connect("inventory.db")\ncur = conn.cursor()\n',
    hints: ['cur.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, qty INTEGER NOT NULL)")', 'cur.executemany("INSERT INTO items (name, qty) VALUES (?, ?)", [("keyboard", 12), ("cable", 140), ("hoodie", 15), ("sticker", 300)])', 'cur.execute("SELECT name, qty FROM items WHERE qty < ? ORDER BY name", (50,)) then loop over cur.fetchall()', 'cur.execute("SELECT SUM(qty) FROM items") then total = cur.fetchone()[0]'],
    solution: { file: 'import sqlite3\n\nconn = sqlite3.connect("inventory.db")\ncur = conn.cursor()\ncur.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, qty INTEGER NOT NULL)")\ncur.executemany("INSERT INTO items (name, qty) VALUES (?, ?)", [("keyboard", 12), ("cable", 140), ("hoodie", 15), ("sticker", 300)])\nconn.commit()\ncur.execute("SELECT name, qty FROM items WHERE qty < ? ORDER BY name", (50,))\nfor name, qty in cur.fetchall():\n    print(f"{name}: {qty}")\ncur.execute("SELECT SUM(qty) FROM items")\nprint(f"total: {cur.fetchone()[0]}")\nconn.close()\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [fileExists(r, 'inventory.db') && codeHas(r, /CREATE TABLE[^"']*items/), 'Connect to inventory.db and create the items table.'],
        [codeHas(r, /executemany\(/) && codeHas(r, /VALUES\s*\(\s*\?\s*,\s*\?\s*\)/), 'Insert the four rows with executemany and ? placeholders.'],
        [codeHas(r, /\.commit\(\)/), 'Call conn.commit() after inserting.'],
        [ls[0] === 'hoodie: 15' && ls[1] === 'keyboard: 12', 'Lines 1 and 2: hoodie: 15 then keyboard: 12 (qty below 50, sorted by name).'],
        [ls[2] === 'total: 467' && codeHas(r, /SUM\(qty\)/i) && codeHas(r, /fetchone\(\)/), 'Line 3: total: 467 from SELECT SUM(qty) and fetchone().'],
      ], 'Python and SQL working together. Tier 1 SQL complete.')
    },
  },
  quiz: [
    { question: 'Why use ? placeholders instead of f-strings for SQL?', options: ['They are faster to type', 'The library escapes values safely, preventing SQL injection', 'f-strings do not work with sqlite3'], answer: 1, explanation: 'User input pasted into SQL can change the query. Placeholders keep data as data.' },
    { question: 'When do inserts become permanent with sqlite3?', options: ['Immediately', 'After conn.commit()', 'After cur.fetchall()'], answer: 1, explanation: 'sqlite3 opens a transaction for you. commit ends it.' },
    { question: 'What does cur.fetchone() return after SELECT COUNT(*)?', options: ['A number', 'A tuple with one value', 'A list of tuples'], answer: 1, explanation: 'Rows are tuples, so index [0] to get the value.' },
  ],
}

export default lesson
