import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastOk, lastRows, steps } from '../checks'

/** 20,000 extra sales on top of the week 18 seed. */
const BIG = SALES + `
INSERT INTO sales (customer_id, product_id, sold_on, qty, amount)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 20000)
SELECT (i * 7) % 8 + 1, (i * 13) % 8 + 1, date('2026-01-01', '+' || (i % 181) || ' days'), i % 3 + 1,
       (i % 3 + 1) * (SELECT price FROM products WHERE id = (i * 13) % 8 + 1)
FROM n;
`

const lesson: Lesson = {
  id: 'w27d2',
  tier: 2,
  track: 'sql',
  week: 27,
  day: 2,
  title: 'Composite, column order, covering indexes',
  concept: `A composite index covers several columns: ON sales(customer_id, sold_on). It is sorted by the first column, then by the second within it, like a phone book sorted by last name then first name. You can find every Smith, or Smith, John, but you cannot find every John without reading the whole book.

So column order decides what the index can answer. WHERE customer_id = 7 AND sold_on >= '2026-05-01' uses that index. WHERE sold_on >= '2026-05-01' alone cannot, and falls back to a SCAN.

A covering index holds every column a query needs. SUM(amount) WHERE customer_id = 7 with an index on (customer_id, amount) never opens the table at all: the plan says USING COVERING INDEX. Design indexes around the queries you actually run, not one per column.`,
  example: {
    language: 'sql',
    caption: 'Leftmost column first, and covering when it pays',
    code: `CREATE INDEX idx_sales_cust_date
  ON sales(customer_id, sold_on);

-- uses the index: customer_id is the leftmost column
SELECT * FROM sales
WHERE customer_id = 7 AND sold_on >= '2026-05-01';

-- cannot use it: sold_on is the second column
SELECT * FROM sales WHERE sold_on >= '2026-05-01';

CREATE INDEX idx_sales_cust_amount
  ON sales(customer_id, amount);
-- SUM(amount) WHERE customer_id = ? is now covered`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement.\n1. CREATE INDEX idx_sales_cust_date ON sales(customer_id, sold_on).\n2. EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7 AND sold_on >= \'2026-05-01\'. Expect SEARCH using the index on both columns.\n3. EXPLAIN QUERY PLAN SELECT * FROM sales WHERE sold_on >= \'2026-05-01\'. Only the second column: expect SCAN sales.\n4. CREATE INDEX idx_sales_cust_amount ON sales(customer_id, amount).\n5. EXPLAIN QUERY PLAN SELECT SUM(amount) FROM sales WHERE customer_id = 7. Expect USING COVERING INDEX idx_sales_cust_amount.',
    setup: BIG,
    hints: [
      'CREATE INDEX idx_sales_cust_date ON sales(customer_id, sold_on);',
      "EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7 AND sold_on >= '2026-05-01'; and then the same without the customer_id part.",
      'CREATE INDEX idx_sales_cust_amount ON sales(customer_id, amount); then EXPLAIN QUERY PLAN SELECT SUM(amount) FROM sales WHERE customer_id = 7;',
    ],
    solution: {
      commands: [
        'CREATE INDEX idx_sales_cust_date ON sales(customer_id, sold_on);',
        "EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7 AND sold_on >= '2026-05-01';",
        "EXPLAIN QUERY PLAN SELECT * FROM sales WHERE sold_on >= '2026-05-01';",
        'CREATE INDEX idx_sales_cust_amount ON sales(customer_id, amount);',
        'EXPLAIN QUERY PLAN SELECT SUM(amount) FROM sales WHERE customer_id = 7;',
      ],
    },
    check: (r) => {
      const sets = r.results ?? []
      const details = sets.flatMap((s) => s.values.map((v) => String(v[v.length - 1])))
      const h = r.history ?? []
      const o = r.outputs ?? []
      const scanAlone = h.some((s, i) => /EXPLAIN\s+QUERY\s+PLAN[\s\S]*WHERE\s+sold_on\s*>=/i.test(s) && !/customer_id/i.test(s) && /SCAN sales/.test(o[i] ?? ''))
      const lastDetail = lastRows(r).map((row) => String(row.detail ?? ''))
      return steps([
        lastOk(r),
        [hasObject(r, 'idx_sales_cust_date') && /sales\s*\(\s*customer_id\s*,\s*sold_on\s*\)/i.test(r.schema?.idx_sales_cust_date ?? ''), 'Step 1: CREATE INDEX idx_sales_cust_date ON sales(customer_id, sold_on).'],
        [details.some((d) => /SEARCH sales USING INDEX idx_sales_cust_date \(customer_id=\? AND sold_on>\?\)/.test(d)), "Step 2: EXPLAIN QUERY PLAN the query with customer_id = 7 AND sold_on >= '2026-05-01'. Expect SEARCH sales USING INDEX idx_sales_cust_date (customer_id=? AND sold_on>?)."],
        [scanAlone, "Step 3: EXPLAIN QUERY PLAN SELECT * FROM sales WHERE sold_on >= '2026-05-01' with no customer_id. It should say SCAN sales."],
        [hasObject(r, 'idx_sales_cust_amount') && /sales\s*\(\s*customer_id\s*,\s*amount\s*\)/i.test(r.schema?.idx_sales_cust_amount ?? ''), 'Step 4: CREATE INDEX idx_sales_cust_amount ON sales(customer_id, amount).'],
        [lastDetail.some((d) => /USING COVERING INDEX idx_sales_cust_amount/.test(d)), 'Step 5: finish with EXPLAIN QUERY PLAN SELECT SUM(amount) FROM sales WHERE customer_id = 7. Expect USING COVERING INDEX idx_sales_cust_amount.'],
      ], 'Leftmost column first, and a covering index that never touches the table.')
    },
  },
  quiz: [
    { question: 'An index is on (customer_id, sold_on). Which WHERE can use it?', options: ['WHERE sold_on = \'2026-05-01\'', 'WHERE customer_id = 7', 'Neither'], answer: 1, explanation: 'The leftmost column must be in the filter. A query on only the second column cannot use it.' },
    { question: 'What does USING COVERING INDEX mean?', options: ['The index has every column the query needs, so the table is never read', 'The index covers the whole disk', 'Two indexes were combined'], answer: 0, explanation: 'All the data comes from the index B-tree itself, which saves a second lookup per row.' },
    { question: 'You often run WHERE city = ? AND joined_on > ?. What is the best single index?', options: ['ON customers(joined_on)', 'ON customers(city, joined_on)', 'One index per column'], answer: 1, explanation: 'Equality column first, then the range column, in one composite index.' },
  ],
}

export default lesson
