import type { Lesson } from '../types'
import { SHOP } from './shop'
import { hasObject, sqlHas, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w08d3',
  tier: 1,
  track: 'sql',
  week: 8,
  day: 3,
  title: 'Primary and foreign keys',
  concept: `Keys are how tables relate to each other without copying data around.

A primary key uniquely identifies a row. In the shop, customers.id is one. It never changes and no two rows share it.

A foreign key is a column that holds another table's primary key. orders.customer_id holds a customers.id, which is how an order knows who placed it. Declare it with REFERENCES customers(id) so the database enforces it: no order for customer 99 if there is no such customer, and no deleting a customer who still has orders.

In SQLite, enforcement needs PRAGMA foreign_keys = ON, which this app sets for you.

CHECK adds other rules: CHECK (rating BETWEEN 1 AND 5). Constraints catch mistakes the moment they happen.`,
  example: {
    language: 'sql',
    caption: 'A child table with a foreign key',
    code: `CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT
);
INSERT INTO reviews (product_id, rating, body) VALUES (1, 5, 'Clicky and solid');
INSERT INTO reviews (product_id, rating) VALUES (99, 3);
-- Error: FOREIGN KEY constraint failed`,
  },
  task: {
    kind: 'sql',
    instructions: '1. Create a reviews table: id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL that REFERENCES products(id), rating INTEGER NOT NULL with CHECK (rating BETWEEN 1 AND 5), and body TEXT.\n2. Insert two valid reviews: product 1 rated 5 with the body Clicky, and product 4 rated 4 with no body.\n3. As the last statement, try to insert a review for product 99 rated 3, and watch the foreign key reject it. Your script will stop at that error, which is expected here.',
    starter: '-- Keys and constraints\n',
    setup: SHOP,
    hints: ['CREATE TABLE reviews (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), body TEXT);', "INSERT INTO reviews (product_id, rating, body) VALUES (1, 5, 'Clicky'), (4, 4, NULL);", 'INSERT INTO reviews (product_id, rating) VALUES (99, 3); should fail with FOREIGN KEY constraint failed.'],
    solution: { file: "CREATE TABLE reviews (\n  id INTEGER PRIMARY KEY,\n  product_id INTEGER NOT NULL REFERENCES products(id),\n  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),\n  body TEXT\n);\nINSERT INTO reviews (product_id, rating, body) VALUES (1, 5, 'Clicky');\nINSERT INTO reviews (product_id, rating) VALUES (4, 4);\nINSERT INTO reviews (product_id, rating) VALUES (99, 3);\n" },
    check: (r) => {
      const schema = (r.schema?.reviews ?? '').replace(/\s+/g, ' ').toLowerCase()
      const rows = tableRows(r, 'reviews')
      return steps([
        [hasObject(r, 'reviews'), 'Create the reviews table first.'],
        [/references products\s*\(\s*id\s*\)/.test(schema), 'product_id must REFERENCES products(id).'],
        [/check\s*\(\s*rating between 1 and 5\s*\)/.test(schema), 'rating needs CHECK (rating BETWEEN 1 AND 5).'],
        [rows.length === 2 && rows.some((x) => x.product_id === 1 && x.rating === 5 && x.body === 'Clicky') && rows.some((x) => x.product_id === 4 && x.rating === 4 && x.body === null), 'Insert exactly two valid reviews: product 1 rated 5 with body Clicky, product 4 rated 4 with no body.'],
        [sqlHas(r, /VALUES\s*\(\s*99\s*,/) && /FOREIGN KEY constraint failed/.test(r.error ?? ''), 'Make the last statement an insert for product 99. It should fail with FOREIGN KEY constraint failed.'],
      ], 'The database now refuses bad data on your behalf.')
    },
  },
  quiz: [
    { question: 'What is a foreign key?', options: ['A key from another country', 'A column holding another table\'s primary key', 'An encrypted column'], answer: 1, explanation: 'It links a row to a row in the referenced table.' },
    { question: 'What happens when you insert an order for a customer id that does not exist, with foreign keys on?', options: ['The customer is created', 'The insert fails', 'The order gets NULL'], answer: 1, explanation: 'The constraint rejects the row. That is the point.' },
    { question: 'What does CHECK (qty > 0) do?', options: ['Counts rows', 'Rejects rows where qty is 0 or negative', 'Indexes qty'], answer: 1, explanation: 'CHECK constraints enforce a rule on every insert and update.' },
  ],
}

export default lesson
