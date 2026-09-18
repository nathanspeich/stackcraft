import type { Lesson } from '../types'
import { hasObject, lastOk, sqlHas, steps, tableRows } from '../checks'

const SHEET = `
CREATE TABLE sheet (
  order_id INTEGER,
  customer_name TEXT,
  customer_city TEXT,
  product TEXT,
  category TEXT,
  qty INTEGER
);
INSERT INTO sheet VALUES
  (1, 'Ana Costa', 'Lisbon', 'Notebook', 'stationery', 2),
  (2, 'Ben Okafor', 'Leeds', 'Desk lamp', 'home', 1),
  (3, 'Ana Costa', 'Lisbon', 'Desk lamp', 'home', 1),
  (4, 'Chloe Martin', 'Lyon', 'Notebook', 'stationery', 5),
  (5, 'Ben Okafor', 'Leeds', 'Backpack', 'bags', 1),
  (6, 'Chloe Martin', 'Lyon', 'Backpack', 'bags', 2);
`

const lesson: Lesson = {
  id: 'w21d2',
  tier: 2,
  track: 'sql',
  week: 21,
  day: 2,
  title: 'First, second, and third normal form',
  concept: `A spreadsheet with one row per order and columns for customer name, city, product, and category works until Ana moves. Now you must fix her city on every row, and one missed row means two Anas. Normalization removes that: the same fact stored in many places.

First normal form: one value per cell. No "Notebook, Desk lamp" in one column. Split into rows.

Second normal form: every column depends on the whole key. In a line keyed by order and product, the category depends on the product alone, so it moves to a products table.

Third normal form: no column depends on another non-key column. City depends on the customer, not the order, so it moves to customers.

Each fact lives once; everything else points at it with an id.`,
  example: {
    language: 'text',
    caption: 'The messy sheet and where its columns end up',
    code: `sheet: order_id, customer_name, customer_city, product, category, qty

customers: id, name, city           <- city depends on the customer
products:  id, name, category       <- category depends on the product
orders:    id, customer_id, product_id, qty`,
  },
  task: {
    kind: 'sql',
    instructions: 'The database has one messy table, sheet, shown in the example. Split it into three clean tables and fill them from the sheet. Run each step as its own statement.\n1. Create customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT).\n2. Create products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL).\n3. Create orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL).\n4. Fill customers with INSERT INTO customers (name, city) SELECT DISTINCT customer_name, customer_city FROM sheet ORDER BY customer_name. The id fills itself.\n5. Fill products the same way from product and category, ORDER BY product.\n6. Fill orders: INSERT ... SELECT s.order_id, c.id, p.id, s.qty FROM sheet s joined to customers on name and to products on name.\n7. Prove nothing was lost: select id, customer name, product name (AS product), and qty from orders joined to both tables, ORDER BY id. It should read exactly like the sheet.',
    setup: SHEET,
    hints: ['Leave id out of the INSERT column list and INTEGER PRIMARY KEY numbers the rows for you.', 'INSERT INTO products (name, category) SELECT DISTINCT product, category FROM sheet ORDER BY product;', 'INSERT INTO orders (id, customer_id, product_id, qty) SELECT s.order_id, c.id, p.id, s.qty FROM sheet s JOIN customers c ON c.name = s.customer_name JOIN products p ON p.name = s.product;', 'SELECT o.id, c.name, p.name AS product, o.qty FROM orders o JOIN customers c ON c.id = o.customer_id JOIN products p ON p.id = o.product_id ORDER BY o.id;'],
    solution: { commands: ['CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);', 'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL);', 'CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL);', 'INSERT INTO customers (name, city) SELECT DISTINCT customer_name, customer_city FROM sheet ORDER BY customer_name;', 'INSERT INTO products (name, category) SELECT DISTINCT product, category FROM sheet ORDER BY product;', 'INSERT INTO orders (id, customer_id, product_id, qty) SELECT s.order_id, c.id, p.id, s.qty FROM sheet s JOIN customers c ON c.name = s.customer_name JOIN products p ON p.name = s.product;', 'SELECT o.id, c.name, p.name AS product, o.qty FROM orders o JOIN customers c ON c.id = o.customer_id JOIN products p ON p.id = o.product_id ORDER BY o.id;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      const orders = r.schema?.orders ?? ''
      const customers = tableRows(r, 'customers')
      const products = tableRows(r, 'products')
      return steps([
        lastOk(r),
        [hasObject(r, 'customers') && /name\s+TEXT\s+NOT\s+NULL/i.test(r.schema?.customers ?? ''), 'Step 1: CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);'],
        [hasObject(r, 'products') && /category\s+TEXT\s+NOT\s+NULL/i.test(r.schema?.products ?? ''), 'Step 2: CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL);'],
        [hasObject(r, 'orders') && /REFERENCES\s+customers/i.test(orders) && /REFERENCES\s+products/i.test(orders), 'Step 3: CREATE TABLE orders with customer_id and product_id foreign keys and qty INTEGER NOT NULL.'],
        [customers.length === 3 && customers.some((c) => c.name === 'Ana Costa' && c.city === 'Lisbon'), 'Step 4: INSERT INTO customers (name, city) SELECT DISTINCT customer_name, customer_city FROM sheet ORDER BY customer_name; should give 3 customers.'],
        [products.length === 3 && products.some((p) => p.name === 'Backpack' && p.category === 'bags'), 'Step 5: INSERT INTO products (name, category) SELECT DISTINCT product, category FROM sheet ORDER BY product; should give 3 products.'],
        [tableRows(r, 'orders').length === 6 && sqlHas(r, /INSERT\s+INTO\s+orders[\s\S]*SELECT[\s\S]*FROM\s+sheet/), 'Step 6: fill orders from sheet with INSERT ... SELECT, joining customers on name and products on name, so there are 6 orders.'],
        [sqlHas(r, /SELECT[\s\S]*FROM\s+orders[\s\S]*JOIN\s+customers[\s\S]*JOIN\s+products/) && sets.some((s) => flat(s) === '1:Ana Costa:Notebook:2|2:Ben Okafor:Desk lamp:1|3:Ana Costa:Desk lamp:1|4:Chloe Martin:Notebook:5|5:Ben Okafor:Backpack:1|6:Chloe Martin:Backpack:2'), 'Step 7: join orders to customers and products and order by id. Row 1 should be Ana Costa, Notebook, 2.'],
      ], 'Each fact now lives in exactly one place.')
    },
  },
  quiz: [
    { question: 'A cell holds "Notebook, Desk lamp". Which form does that break?', options: ['First normal form', 'Second normal form', 'Third normal form'], answer: 0, explanation: 'One value per cell is the first rule. Split it into rows.' },
    { question: 'Why move the customer\'s city out of the orders sheet?', options: ['Cities are too long', 'It depends on the customer, not the order, so it would be repeated and could drift', 'SQLite cannot store it'], answer: 1, explanation: 'Third normal form: a column that depends on another non-key column belongs in that thing\'s own table.' },
    { question: 'After normalizing, how do you get the sheet view back?', options: ['You cannot', 'JOIN the tables on their ids', 'Copy the data back'], answer: 1, explanation: 'Joins rebuild any flat view you like, while each fact is stored once.' },
  ],
}

export default lesson
