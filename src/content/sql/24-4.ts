import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastCols, lastOk, lastRows, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w24d4',
  tier: 2,
  track: 'sql',
  week: 24,
  day: 4,
  title: 'Triggers and restricting what an app sees',
  concept: `A trigger is a rule the database enforces on its own: when this happens to this table, also run these statements. AFTER INSERT ON sales, lower the stock of the product sold and write a line to a log table. NEW.qty and NEW.product_id are the values just inserted. The app cannot forget, because the app is not doing it.

Use triggers for small bookkeeping like counters and audit tables. Keep them short and write them down: a trigger is invisible from the app side and surprises people.

Views work the other way: they limit what an app sees. Give the storefront a view with only the columns and rows it should know about. Internal columns and out-of-stock items stay hidden, and you can rearrange tables without changing the app.`,
  example: {
    language: 'sql',
    caption: 'Bookkeeping the app cannot skip',
    code: `CREATE TRIGGER sales_after_insert
AFTER INSERT ON sales
BEGIN
  UPDATE products SET stock = stock - NEW.qty
  WHERE id = NEW.product_id;
  INSERT INTO stock_log (sale_id, product_id, change)
  VALUES (NEW.id, NEW.product_id, -NEW.qty);
END;

-- what the storefront is allowed to see
CREATE VIEW shop_products AS
SELECT id, name, category, price
FROM products WHERE stock > 0;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each.\n1. Create the log table: stock_log (id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL, product_id INTEGER NOT NULL, change INTEGER NOT NULL).\n2. Create the trigger sales_after_insert from the example, BEGIN to END in one Run.\n3. Insert a sale: INSERT INTO sales VALUES (46, 1, 2, \'2026-06-28\', 2, 58.0).\n4. SELECT stock FROM products WHERE id = 2. The desk lamp had 14, so expect 12.\n5. SELECT * FROM stock_log. One row, change -2.\n6. Create the view shop_products from the example: id, name, category, price for products with stock > 0.\n7. SELECT * FROM shop_products ORDER BY name. Seven products, no stock column, and no Mouse (its stock is 0).',
    setup: SALES,
    hints: [
      'CREATE TABLE stock_log (id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL, product_id INTEGER NOT NULL, change INTEGER NOT NULL);',
      'Copy the trigger from the example exactly. Both statements inside BEGIN ... END end with a semicolon, and so does END.',
      "INSERT INTO sales VALUES (46, 1, 2, '2026-06-28', 2, 58.0); then check products and stock_log.",
      'CREATE VIEW shop_products AS SELECT id, name, category, price FROM products WHERE stock > 0; then SELECT * FROM shop_products ORDER BY name;',
    ],
    solution: {
      commands: [
        'CREATE TABLE stock_log (id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL, product_id INTEGER NOT NULL, change INTEGER NOT NULL);',
        'CREATE TRIGGER sales_after_insert AFTER INSERT ON sales BEGIN UPDATE products SET stock = stock - NEW.qty WHERE id = NEW.product_id; INSERT INTO stock_log (sale_id, product_id, change) VALUES (NEW.id, NEW.product_id, -NEW.qty); END;',
        "INSERT INTO sales VALUES (46, 1, 2, '2026-06-28', 2, 58.0);",
        'SELECT stock FROM products WHERE id = 2;',
        'SELECT * FROM stock_log;',
        'CREATE VIEW shop_products AS SELECT id, name, category, price FROM products WHERE stock > 0;',
        'SELECT * FROM shop_products ORDER BY name;',
      ],
    },
    check: (r) => {
      const trig = r.schema?.sales_after_insert ?? ''
      const lamp = tableRows(r, 'products').find((p) => p.id === 2)
      const log = tableRows(r, 'stock_log')
      const sets = r.results ?? []
      const single = (n: number) => sets.some((s) => s.values.length === 1 && s.values[0].length === 1 && Number(s.values[0][0]) === n)
      const logSet = sets.some((s) => s.columns.map((c) => c.toLowerCase()).includes('change') && s.values.length === 1)
      const view = r.schema?.shop_products ?? ''
      const last = lastRows(r)
      const cols = lastCols(r)
      return steps([
        lastOk(r),
        [hasObject(r, 'stock_log') && /sale_id/i.test(r.schema?.stock_log ?? '') && /change/i.test(r.schema?.stock_log ?? ''), 'Step 1: CREATE TABLE stock_log with id, sale_id, product_id, and change.'],
        [hasObject(r, 'sales_after_insert') && /AFTER\s+INSERT\s+ON\s+sales/i.test(trig) && /UPDATE\s+products/i.test(trig) && /INSERT\s+INTO\s+stock_log/i.test(trig), 'Step 2: CREATE TRIGGER sales_after_insert AFTER INSERT ON sales that updates products and inserts into stock_log.'],
        [tableRows(r, 'sales').some((s) => s.id === 46) && Number(lamp?.stock) === 12, "Step 3: INSERT INTO sales VALUES (46, 1, 2, '2026-06-28', 2, 58.0). The trigger should drop the desk lamp's stock to 12."],
        [single(12), 'Step 4: SELECT stock FROM products WHERE id = 2 should return 12.'],
        [log.length === 1 && Number(log[0].change) === -2 && Number(log[0].product_id) === 2 && logSet, 'Step 5: SELECT * FROM stock_log should show one row: sale 46, product 2, change -2.'],
        [hasObject(r, 'shop_products') && /WHERE\s+stock\s*>\s*0/i.test(view) && !/SELECT\s+\*/i.test(view), 'Step 6: CREATE VIEW shop_products AS SELECT id, name, category, price FROM products WHERE stock > 0.'],
        [cols.includes('name') && cols.includes('price') && !cols.includes('stock') && last.length === 7 && !last.some((row) => row.name === 'Mouse'), 'Step 7: finish with SELECT * FROM shop_products ORDER BY name. Seven rows, no stock column, no Mouse.'],
      ], 'The trigger keeps stock honest and the view keeps the app in its lane.')
    },
  },
  quiz: [
    { question: 'When does an AFTER INSERT trigger on sales run?', options: ['Once a day', 'Every time a row is inserted into sales', 'Only when the app calls it'], answer: 1, explanation: 'The database fires it on every insert, whoever did the inserting.' },
    { question: 'Why can triggers surprise other developers?', options: ['They are slow', 'They run invisibly, outside the app code', 'They require a restart'], answer: 1, explanation: 'Nothing in the app shows that extra statements run. Keep triggers small and documented.' },
    { question: 'How does a view help restrict what an app sees?', options: ['It encrypts the table', 'It exposes only chosen columns and rows', 'It blocks all writes'], answer: 1, explanation: 'The app queries the view, and the view only includes what it should.' },
  ],
}

export default lesson
