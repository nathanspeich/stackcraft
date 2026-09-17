import type { Lesson } from '../types'
import { SHOP } from './shop'
import { hasObject, lastOk, sqlHas, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w05d2',
  tier: 1,
  track: 'sql',
  week: 5,
  day: 2,
  title: 'CREATE TABLE and INSERT',
  concept: `Before data goes in, a table needs a shape. CREATE TABLE names it and lists its columns, each with a type and optional rules.

SQLite types are simple: INTEGER for whole numbers, REAL for decimals, TEXT for strings. NOT NULL means the column must have a value. PRIMARY KEY marks the column that identifies each row; an INTEGER PRIMARY KEY fills itself in with the next number when you leave it out. DEFAULT gives a value when none is supplied.

INSERT adds rows. Name the columns, then give the values in the same order: INSERT INTO suppliers (name, country) VALUES ('Acme', 'PT'). Several rows can share one INSERT, separated by commas. Text goes in single quotes; numbers do not.

After inserting, SELECT to confirm what landed.`,
  example: {
    language: 'sql',
    caption: 'A new table and three rows',
    code: `CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'grey'
);
INSERT INTO tags (label, color) VALUES ('sale', 'red');
INSERT INTO tags (label) VALUES ('new'), ('staff pick');
SELECT * FROM tags;`,
  },
  task: {
    kind: 'sql',
    instructions: 'The shop needs to track suppliers. Run each step as its own statement, pressing Run after each:\n1. Create a table suppliers with columns id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, and rating INTEGER with a DEFAULT of 3.\n2. Insert Keycap Co from JP with rating 5. Leave id out so it fills itself in.\n3. Insert Cable Works from CN, leaving the rating out so the default applies.\n4. Insert Print House from PT with rating 4.\n5. Select everything from suppliers to see the three rows.',
    setup: SHOP,
    hints: ['CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, rating INTEGER DEFAULT 3);', "INSERT INTO suppliers (name, country, rating) VALUES ('Keycap Co', 'JP', 5);", "INSERT INTO suppliers (name, country) VALUES ('Cable Works', 'CN'); the rating becomes 3 by default.", 'SELECT * FROM suppliers;'],
    solution: { commands: ['CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, rating INTEGER DEFAULT 3);', "INSERT INTO suppliers (name, country, rating) VALUES ('Keycap Co', 'JP', 5);", "INSERT INTO suppliers (name, country) VALUES ('Cable Works', 'CN');", "INSERT INTO suppliers (name, country, rating) VALUES ('Print House', 'PT', 4);", 'SELECT * FROM suppliers;'] },
    check: (r) => {
      const rows = tableRows(r, 'suppliers')
      const byName = (n: string) => rows.find((x) => x.name === n)
      const schema = (r.schema?.suppliers ?? '').replace(/\s+/g, ' ').toLowerCase()
      return steps([
        lastOk(r),
        [hasObject(r, 'suppliers'), 'Step 1: create the suppliers table with CREATE TABLE.'],
        [/id integer primary key/.test(schema) && /name text not null/.test(schema) && /rating integer default 3/.test(schema), 'Columns should be: id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, rating INTEGER DEFAULT 3. Reset the database if you need to recreate it.'],
        [byName('Keycap Co')?.country === 'JP' && byName('Keycap Co')?.rating === 5, 'Step 2: insert Keycap Co from JP with rating 5.'],
        [byName('Cable Works')?.country === 'CN' && byName('Cable Works')?.rating === 3 && !sqlHas(r, /Cable Works'\s*,\s*'CN'\s*,\s*3/), 'Step 3: insert Cable Works from CN without a rating, so the DEFAULT of 3 fills it in.'],
        [byName('Print House')?.country === 'PT' && byName('Print House')?.rating === 4, 'Step 4: insert Print House from PT with rating 4.'],
        [rows.length === 3 && rows.map((x) => x.id).join(',') === '1,2,3', `suppliers should hold exactly 3 rows with ids 1, 2, 3 assigned automatically (it has ${rows.length}). Reset the database and redo the inserts if you added extras.`],
        [sqlHas(r, /SELECT\s+\*\s+FROM\s+suppliers/), 'Step 5: finish with SELECT * FROM suppliers.'],
      ], 'Table designed, rows inserted, defaults and auto ids working.')
    },
  },
  quiz: [
    { question: 'What does INTEGER PRIMARY KEY do in SQLite?', options: ['Sorts the table', 'Identifies each row and auto-assigns the next number when omitted', 'Makes the column text'], answer: 1, explanation: 'It is the row id. Leaving it out of an INSERT gives you the next free number.' },
    { question: 'Which is the correct way to insert text?', options: ["VALUES ('Acme')", 'VALUES ("Acme")', 'VALUES (Acme)'], answer: 0, explanation: 'Single quotes for string values. Double quotes are for identifiers in standard SQL.' },
    { question: 'What happens if you INSERT without a value for a NOT NULL column that has no DEFAULT?', options: ['It stores an empty string', 'The INSERT fails with an error', 'It stores 0'], answer: 1, explanation: 'NOT NULL is a promise the database enforces. The statement is rejected.' },
  ],
}

export default lesson
