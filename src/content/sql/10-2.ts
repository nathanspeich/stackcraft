import type { Lesson } from '../types'
import { SHOP } from './shop'
import { hasObject, lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w10d2',
  tier: 1,
  track: 'sql',
  week: 10,
  day: 2,
  title: 'Indexes and EXPLAIN',
  concept: `Without an index, finding orders for customer 3 means reading every order row. With eight rows that is instant. With eight million it is not.

An index is a sorted lookup structure on one or more columns, like the index at the back of a book. CREATE INDEX idx_orders_customer ON orders(customer_id) lets the database jump straight to matching rows.

EXPLAIN QUERY PLAN in front of a SELECT shows how SQLite will run it. SCAN orders means read everything. SEARCH orders USING INDEX means it found a shortcut. Run it before and after adding an index.

Indexes cost disk space and slow writes a little, because every insert updates them. Index the columns you filter and join on, usually foreign keys. Primary keys are indexed automatically.`,
  example: {
    language: 'sql',
    caption: 'Before and after',
    code: `EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;
-- SCAN orders

CREATE INDEX idx_orders_customer ON orders(customer_id);

EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;
-- SEARCH orders USING INDEX idx_orders_customer (customer_id=?)`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each:\n1. Run EXPLAIN QUERY PLAN on SELECT * FROM orders WHERE customer_id = 1 and read the detail column: it should say SCAN.\n2. Create an index named idx_orders_customer on orders(customer_id).\n3. Run the same EXPLAIN QUERY PLAN again (press the up arrow twice) and confirm it now says SEARCH ... USING INDEX.\n4. Create a second index idx_items_product on order_items(product_id), since product_id is a foreign key that joins use.',
    setup: SHOP,
    hints: ['EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;', 'CREATE INDEX idx_orders_customer ON orders(customer_id);', 'CREATE INDEX idx_items_product ON order_items(product_id);'],
    solution: { commands: ['EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;', 'CREATE INDEX idx_orders_customer ON orders(customer_id);', 'EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1;', 'CREATE INDEX idx_items_product ON order_items(product_id);'] },
    check: (r) => {
      const details = (r.results ?? []).flatMap((s) => s.values.map((v) => String(v[v.length - 1])))
      return steps([
        lastOk(r),
        [sqlHas(r, /EXPLAIN\s+QUERY\s+PLAN/) && details.some((d) => /^SCAN orders/.test(d)), 'Step 1: run EXPLAIN QUERY PLAN on the customer query before creating the index. The detail should read SCAN orders.'],
        [hasObject(r, 'idx_orders_customer') && /orders\s*\(\s*customer_id\s*\)/i.test(r.schema?.idx_orders_customer ?? ''), 'Step 2: CREATE INDEX idx_orders_customer ON orders(customer_id).'],
        [details.some((d) => /SEARCH orders USING INDEX idx_orders_customer/.test(d)), 'Step 3: run the same EXPLAIN QUERY PLAN after the index. It should say SEARCH orders USING INDEX idx_orders_customer.'],
        [hasObject(r, 'idx_items_product') && /order_items\s*\(\s*product_id\s*\)/i.test(r.schema?.idx_items_product ?? ''), 'Step 4: create idx_items_product on order_items(product_id).'],
      ], 'SCAN became SEARCH. That is what an index buys you.')
    },
  },
  quiz: [
    { question: 'What does SCAN mean in a query plan?', options: ['The table is read row by row', 'An index was used', 'The query failed'], answer: 0, explanation: 'A full scan. Fine for small tables, slow for big ones.' },
    { question: 'Which columns are usually worth indexing?', options: ['Every column', 'Columns used in WHERE and JOIN conditions, especially foreign keys', 'Only text columns'], answer: 1, explanation: 'Index what you search and join on. Everything else is wasted space and slower writes.' },
    { question: 'What is a downside of indexes?', options: ['Slower SELECTs', 'They make inserts and updates a little slower and use disk space', 'They break foreign keys'], answer: 1, explanation: 'Every write must also update the index.' },
  ],
}

export default lesson
