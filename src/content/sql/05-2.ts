import type { Lesson } from '../types'
import { SHOP } from './shop'
import { hasObject, sqlHas, steps, tableRows } from '../checks'

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
    instructions: 'The shop needs to track suppliers.\n1. Create a table suppliers with columns: id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, and rating INTEGER with a DEFAULT of 3.\n2. Insert three suppliers: Keycap Co from JP with rating 5, Cable Works from CN (leave the rating out so the default applies), and Print House from PT with rating 4. Let id fill itself in.\n3. Select everything from suppliers.',
    starter: '-- Create suppliers, insert three rows, then select them\n',
    setup: SHOP,
    hints: ['CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, rating INTEGER DEFAULT 3);', "INSERT INTO suppliers (name, country, rating) VALUES ('Keycap Co', 'JP', 5);", "INSERT INTO suppliers (name, country) VALUES ('Cable Works', 'CN'); the rating becomes 3 by default.", 'SELECT * FROM suppliers;'],
    solution: { file: "CREATE TABLE suppliers (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  country TEXT,\n  rating INTEGER DEFAULT 3\n);\nINSERT INTO suppliers (name, country, rating) VALUES ('Keycap Co', 'JP', 5);\nINSERT INTO suppliers (name, country) VALUES ('Cable Works', 'CN');\nINSERT INTO suppliers (name, country, rating) VALUES ('Print House', 'PT', 4);\nSELECT * FROM suppliers;\n" },
    check: (r) => {
      const rows = tableRows(r, 'suppliers')
      const byName = (n: string) => rows.find((x) => x.name === n)
      const schema = (r.schema?.suppliers ?? '').replace(/\s+/g, ' ').toLowerCase()
      return steps([
        [!r.error, `Your script stopped with an error: ${r.error}`],
        [hasObject(r, 'suppliers'), 'Create the suppliers table with CREATE TABLE.'],
        [/id integer primary key/.test(schema) && /name text not null/.test(schema) && /rating integer default 3/.test(schema), 'Columns should be: id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT, rating INTEGER DEFAULT 3.'],
        [rows.length === 3, `suppliers should hold exactly 3 rows, it has ${rows.length}.`],
        [byName('Keycap Co')?.country === 'JP' && byName('Keycap Co')?.rating === 5, 'Insert Keycap Co from JP with rating 5.'],
        [byName('Cable Works')?.country === 'CN' && byName('Cable Works')?.rating === 3 && !sqlHas(r, /Cable Works'\s*,\s*'CN'\s*,\s*3/), 'Insert Cable Works from CN without a rating, so the DEFAULT of 3 fills it in.'],
        [byName('Print House')?.rating === 4 && rows.map((x) => x.id).join(',') === '1,2,3', 'Insert Print House from PT with rating 4. The ids should be 1, 2, 3 assigned automatically.'],
        [sqlHas(r, /SELECT\s+\*\s+FROM\s+suppliers/), 'Finish with SELECT * FROM suppliers.'],
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
