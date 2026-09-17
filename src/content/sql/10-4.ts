import type { Lesson } from '../types'
import { SHOP } from './shop'
import { lastOk, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w10d4',
  tier: 1,
  track: 'sql',
  week: 10,
  day: 4,
  title: 'Transactions',
  concept: `Some changes only make sense together. Placing an order means inserting the order, inserting its items, and lowering stock. If the program crashes halfway, you have an order with no items or stock that dropped for nothing.

A transaction makes a group of statements all-or-nothing. BEGIN starts one. COMMIT makes every change since BEGIN permanent at once. ROLLBACK throws them all away as if nothing happened.

Until COMMIT, other connections do not see the changes, and if the process dies the database rolls back on its own.

Transactions are also a safety net: BEGIN, run the risky UPDATE, SELECT to check, then COMMIT or ROLLBACK. Python's sqlite3 opens transactions for you and commits when you say so.`,
  example: {
    language: 'sql',
    caption: 'All or nothing',
    code: `BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 1;
INSERT INTO orders (id, customer_id, ordered_on) VALUES (9, 3, '2025-08-05');
INSERT INTO order_items VALUES (9, 1, 1);
COMMIT;

BEGIN;
UPDATE products SET price = 0;   -- oops
ROLLBACK;                        -- phew`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each. The database keeps the transaction open between statements, just like a real sqlite3 session.\n1. BEGIN a transaction.\n2. Lower the stock of product 1 by one.\n3. Insert order 9 for customer 3 dated 2025-08-05 with status new.\n4. Insert an order_items row for order 9, product 1, qty 1.\n5. COMMIT.\n6. BEGIN a second transaction.\n7. Run UPDATE products SET price = 0 with no WHERE. Yes, really.\n8. ROLLBACK to undo it.\n9. Prove it with three SELECTs: COUNT(*) FROM orders (9), stock FROM products WHERE id = 1 (11), and MIN(price) FROM products (still 4).',
    setup: SHOP,
    hints: ['BEGIN; then the UPDATE, two INSERTs, and COMMIT, each as its own statement.', "INSERT INTO orders (id, customer_id, ordered_on, status) VALUES (9, 3, '2025-08-05', 'new'); and INSERT INTO order_items VALUES (9, 1, 1);", 'BEGIN; UPDATE products SET price = 0; ROLLBACK; then check with SELECT MIN(price) FROM products;'],
    solution: { commands: ['BEGIN;', 'UPDATE products SET stock = stock - 1 WHERE id = 1;', "INSERT INTO orders (id, customer_id, ordered_on, status) VALUES (9, 3, '2025-08-05', 'new');", 'INSERT INTO order_items VALUES (9, 1, 1);', 'COMMIT;', 'BEGIN;', 'UPDATE products SET price = 0;', 'ROLLBACK;', 'SELECT COUNT(*) FROM orders;', 'SELECT stock FROM products WHERE id = 1;', 'SELECT MIN(price) FROM products;'] },
    check: (r) => {
      const h = r.history ?? []
      const orders = tableRows(r, 'orders')
      const p1 = tableRows(r, 'products').find((p) => p.id === 1)
      const minPrice = Math.min(...tableRows(r, 'products').map((p) => Number(p.price)))
      const sets = r.results ?? []
      const single = (n: number) => sets.some((s) => s.values.length === 1 && s.values[0].length === 1 && s.values[0][0] === n)
      const iBegin = h.findIndex((s) => /^\s*BEGIN\b/i.test(s))
      const iCommit = h.findIndex((s, i) => i > iBegin && /^\s*COMMIT\b/i.test(s))
      const iZero = h.findIndex((s) => /SET\s+price\s*=\s*0\b/i.test(s) && !/\bWHERE\b/i.test(s))
      const iRollback = h.findIndex((s, i) => i > iZero && /^\s*ROLLBACK\b/i.test(s))
      return steps([
        lastOk(r),
        [iBegin >= 0 && iCommit > iBegin, 'Steps 1 and 5: wrap the order in BEGIN ... COMMIT, each run as its own statement.'],
        [orders.length === 9 && orders.some((o) => o.id === 9 && o.customer_id === 3) && tableRows(r, 'order_items').some((i) => i.order_id === 9 && i.product_id === 1) && p1?.stock === 11, 'Steps 2 to 4, inside the first transaction: stock of product 1 down to 11, order 9 for customer 3, and its order_items row. If the numbers drifted, reset the database and redo it.'],
        [iZero >= 0 && iRollback > iZero && minPrice === 4, 'Steps 6 to 8: BEGIN, UPDATE products SET price = 0, then ROLLBACK, so prices stay intact (MIN 4).'],
        [single(9) && single(11) && single(4), 'Step 9: finish with the three SELECTs returning 9, 11, and 4.'],
      ], 'Committed what mattered, rolled back the mistake.')
    },
  },
  quiz: [
    { question: 'What does ROLLBACK do?', options: ['Undoes every change since BEGIN', 'Deletes the table', 'Saves the changes'], answer: 0, explanation: 'The database returns to how it was at BEGIN.' },
    { question: 'Why put an order insert and a stock update in one transaction?', options: ['It runs faster', 'So both happen or neither does', 'SQLite requires it'], answer: 1, explanation: 'A crash between them would leave the data inconsistent. A transaction prevents that.' },
    { question: 'What happens to an uncommitted transaction if the program crashes?', options: ['It is committed', 'It is rolled back automatically', 'The database is corrupted'], answer: 1, explanation: 'Changes are not permanent until COMMIT.' },
  ],
}

export default lesson
