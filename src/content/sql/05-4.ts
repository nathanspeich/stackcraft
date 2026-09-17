import type { Lesson } from '../types'
import { SHOP } from './shop'
import { lastOk, sqlHas, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w05d4',
  tier: 1,
  track: 'sql',
  week: 5,
  day: 4,
  title: 'UPDATE and DELETE safely',
  concept: `UPDATE changes rows: UPDATE products SET price = 42 WHERE id = 3. DELETE removes them: DELETE FROM orders WHERE id = 4. Both take a WHERE, and that WHERE is the whole story.

Without WHERE, UPDATE changes every row and DELETE empties the table. There is no undo. So the habit is: write the SELECT first with the same WHERE, look at the rows it returns, and only then change SELECT ... into UPDATE or DELETE.

SET can use the old value: SET stock = stock + 10. Several columns can change at once, separated by commas.

Foreign keys can block a DELETE: you cannot remove an order that still has items pointing at it. Delete the dependent rows first, then the parent.`,
  example: {
    language: 'sql',
    caption: 'Look before you change',
    code: `SELECT id, name, price FROM products WHERE name = 'Monitor arm';
UPDATE products SET price = 42.00 WHERE name = 'Monitor arm';

SELECT * FROM order_items WHERE order_id = 4;
DELETE FROM order_items WHERE order_id = 4;
DELETE FROM orders WHERE id = 4;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each. Every UPDATE and DELETE must have a WHERE.\n1. SELECT the Python primer row so you see it before changing it.\n2. UPDATE its stock to 20.\n3. UPDATE every product in the merch category so its price goes up by 1 (use the old value: price + 1).\n4. Order 4 was cancelled. DELETE its rows from order_items first.\n5. DELETE the order itself from orders.\n6. SELECT COUNT(*) FROM orders to confirm 7 remain.',
    setup: SHOP,
    hints: ["UPDATE products SET stock = 20 WHERE name = 'Python primer';", "UPDATE products SET price = price + 1 WHERE category = 'merch';", 'DELETE FROM order_items WHERE order_id = 4; then DELETE FROM orders WHERE id = 4;', 'If you see FOREIGN KEY constraint failed, the items still point at the order. Delete them first.'],
    solution: { commands: ["SELECT * FROM products WHERE name = 'Python primer';", "UPDATE products SET stock = 20 WHERE name = 'Python primer';", "UPDATE products SET price = price + 1 WHERE category = 'merch';", 'DELETE FROM order_items WHERE order_id = 4;', 'DELETE FROM orders WHERE id = 4;', 'SELECT COUNT(*) FROM orders;'] },
    check: (r) => {
      const products = tableRows(r, 'products')
      const p = (id: number) => products.find((x) => x.id === id)
      const noWhere = (r.history ?? []).some((h) => /^\s*(UPDATE|DELETE)\b/i.test(h) && !/\bWHERE\b/i.test(h))
      return steps([
        lastOk(r),
        [!noWhere, 'Every UPDATE and DELETE needs a WHERE clause. One of yours had none. Reset the database and try again.'],
        [sqlHas(r, /SELECT[^;]*Python primer/), 'Step 1: select the Python primer row so you see what you are about to change.'],
        [p(6)?.stock === 20, 'Step 2: UPDATE the Python primer so stock = 20.'],
        [p(7)?.price === 5 && p(8)?.price === 40 && p(1)?.price === 89, 'Step 3: raise only merch prices by 1 with SET price = price + 1 WHERE category = \'merch\' (Sticker pack 5, Hoodie 40, everything else unchanged). If you ran it twice, reset the database.'],
        [tableRows(r, 'order_items').every((x) => x.order_id !== 4), 'Step 4: delete the order_items rows where order_id = 4.'],
        [tableRows(r, 'orders').length === 7 && !tableRows(r, 'orders').some((x) => x.id === 4), 'Step 5: delete order 4 from orders. The other 7 must remain.'],
        [(r.rows?.[0] && Object.values(r.rows[0])[0] === 7) === true, 'Step 6: finish with SELECT COUNT(*) FROM orders, which should return 7.'],
      ], 'Changed exactly what you meant to, nothing more.')
    },
  },
  quiz: [
    { question: 'What does UPDATE products SET stock = 0 do without a WHERE?', options: ['Nothing', 'Sets stock to 0 for every product', 'Fails with an error'], answer: 1, explanation: 'No WHERE means every row. Always write the SELECT with the same WHERE first.' },
    { question: 'Why might DELETE FROM orders WHERE id = 4 fail?', options: ['Orders cannot be deleted', 'Rows in another table still reference it through a foreign key', 'The id is too small'], answer: 1, explanation: 'With foreign keys on, dependent rows must go first.' },
    { question: 'How do you raise every hardware price by 10 percent?', options: ["UPDATE products SET price = price * 1.1 WHERE category = 'hardware'", 'UPDATE products SET price + 10%', "SELECT price * 1.1 WHERE category = 'hardware'"], answer: 0, explanation: 'SET can use the current value of the column in its expression.' },
  ],
}

export default lesson
