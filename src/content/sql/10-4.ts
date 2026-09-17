import type { Lesson } from '../types'
import { SHOP } from './shop'
import { sqlHas, steps, tableRows } from '../checks'

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
    instructions: '1. In one transaction (BEGIN ... COMMIT): lower the stock of product 1 by one, insert order 9 for customer 3 dated 2025-08-05 with status new, and insert an order_items row for order 9, product 1, qty 1.\n2. In a second transaction: run UPDATE products SET price = 0 with no WHERE, then ROLLBACK it.\n3. Finish with three SELECTs to prove it: COUNT(*) FROM orders (9), stock FROM products WHERE id = 1 (11), and MIN(price) FROM products (still 4).',
    starter: '-- Two transactions: one committed, one rolled back\n',
    setup: SHOP,
    hints: ['BEGIN; UPDATE products SET stock = stock - 1 WHERE id = 1; INSERT INTO orders (id, customer_id, ordered_on, status) VALUES (9, 3, \'2025-08-05\', \'new\'); INSERT INTO order_items VALUES (9, 1, 1); COMMIT;', 'BEGIN; UPDATE products SET price = 0; ROLLBACK;', 'SELECT COUNT(*) FROM orders; SELECT stock FROM products WHERE id = 1; SELECT MIN(price) FROM products;'],
    solution: { file: "BEGIN;\nUPDATE products SET stock = stock - 1 WHERE id = 1;\nINSERT INTO orders (id, customer_id, ordered_on, status) VALUES (9, 3, '2025-08-05', 'new');\nINSERT INTO order_items VALUES (9, 1, 1);\nCOMMIT;\n\nBEGIN;\nUPDATE products SET price = 0;\nROLLBACK;\n\nSELECT COUNT(*) FROM orders;\nSELECT stock FROM products WHERE id = 1;\nSELECT MIN(price) FROM products;\n" },
    check: (r) => {
      const orders = tableRows(r, 'orders')
      const p1 = tableRows(r, 'products').find((p) => p.id === 1)
      const minPrice = Math.min(...tableRows(r, 'products').map((p) => Number(p.price)))
      const sets = r.results ?? []
      const single = (n: number) => sets.some((s) => s.values.length === 1 && s.values[0].length === 1 && s.values[0][0] === n)
      return steps([
        [!r.error, `Your script stopped with an error: ${r.error}`],
        [sqlHas(r, /BEGIN[\s\S]*COMMIT/), 'Wrap the order in BEGIN ... COMMIT.'],
        [orders.length === 9 && orders.some((o) => o.id === 9 && o.customer_id === 3) && tableRows(r, 'order_items').some((i) => i.order_id === 9 && i.product_id === 1) && p1?.stock === 11, 'Inside the first transaction: stock of product 1 down to 11, order 9 for customer 3, and its order_items row.'],
        [sqlHas(r, /SET\s+price\s*=\s*0\s*;/) && sqlHas(r, /ROLLBACK/) && minPrice === 4, 'Second transaction: UPDATE products SET price = 0 followed by ROLLBACK, so prices stay intact (MIN 4).'],
        [single(9) && single(11) && single(4), 'Finish with the three SELECTs returning 9, 11, and 4.'],
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
