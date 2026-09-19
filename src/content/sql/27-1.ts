import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastOk, steps } from '../checks'

/** 20,000 extra sales on top of the week 18 seed, so a scan has something to scan. */
const BIG = SALES + `
INSERT INTO sales (customer_id, product_id, sold_on, qty, amount)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 20000)
SELECT (i * 7) % 8 + 1, (i * 13) % 8 + 1, date('2026-01-01', '+' || (i % 181) || ' days'), i % 3 + 1,
       (i % 3 + 1) * (SELECT price FROM products WHERE id = (i * 13) % 8 + 1)
FROM n;
`

const lesson: Lesson = {
  id: 'w27d1',
  tier: 2,
  track: 'sql',
  week: 27,
  day: 1,
  title: 'B-tree indexes and EXPLAIN QUERY PLAN',
  concept: `An index is a B-tree: sorted keys arranged as a shallow tree of pages. The top page says "keys below 5000 go left, above go right", the next level narrows again, and after three or four hops you are at the exact rows, whether the table has twenty thousand rows or twenty million. That is how an index turns a SCAN (read every row) into a SEARCH (jump to the matches).

Every table is already a B-tree keyed by its rowid, which INTEGER PRIMARY KEY reuses. So WHERE id = 7 is instant without an index; WHERE customer_id = 7 needs one.

EXPLAIN QUERY PLAN in front of a SELECT prints the plan. In the detail column, SCAN means trouble; SEARCH ... USING INDEX means the index is working.`,
  example: {
    language: 'sql',
    caption: 'Read the detail column',
    code: `EXPLAIN QUERY PLAN
SELECT * FROM sales WHERE customer_id = 7;
-- SCAN sales

EXPLAIN QUERY PLAN
SELECT * FROM sales WHERE id = 7;
-- SEARCH sales USING INTEGER PRIMARY KEY (rowid=?)

CREATE INDEX idx_sales_customer ON sales(customer_id);

EXPLAIN QUERY PLAN
SELECT * FROM sales WHERE customer_id = 7;
-- SEARCH sales USING INDEX idx_sales_customer (customer_id=?)`,
  },
  task: {
    kind: 'sql',
    instructions: 'This copy of sales.db has 20,045 sales. Run each step as its own statement.\n1. SELECT COUNT(*) FROM sales to see the size.\n2. EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7. Read the detail: SCAN sales.\n3. EXPLAIN QUERY PLAN SELECT * FROM sales WHERE id = 7. The primary key is already a B-tree, so it says SEARCH.\n4. CREATE INDEX idx_sales_customer ON sales(customer_id).\n5. Run the EXPLAIN from step 2 again. It should now say SEARCH ... USING INDEX idx_sales_customer.\n6. SELECT COUNT(*) FROM sales WHERE customer_id = 7. Expect 2508 rows found the fast way.',
    setup: BIG,
    hints: [
      'EXPLAIN QUERY PLAN goes in front of the SELECT, on the same statement: EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7;',
      'CREATE INDEX idx_sales_customer ON sales(customer_id);',
      'Use the up arrow to rerun the EXPLAIN after creating the index, then finish with SELECT COUNT(*) FROM sales WHERE customer_id = 7;',
    ],
    solution: {
      commands: [
        'SELECT COUNT(*) FROM sales;',
        'EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7;',
        'EXPLAIN QUERY PLAN SELECT * FROM sales WHERE id = 7;',
        'CREATE INDEX idx_sales_customer ON sales(customer_id);',
        'EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7;',
        'SELECT COUNT(*) FROM sales WHERE customer_id = 7;',
      ],
    },
    check: (r) => {
      const sets = r.results ?? []
      const details = sets.flatMap((s) => s.values.map((v) => String(v[v.length - 1])))
      const single = (n: number) => sets.some((s) => s.values.length === 1 && s.values[0].length === 1 && Number(s.values[0][0]) === n)
      const last = sets[sets.length - 1]
      const lastSingle = last && last.values.length === 1 && last.values[0].length === 1 && Number(last.values[0][0]) === 2508
      return steps([
        lastOk(r),
        [single(20045), 'Step 1: SELECT COUNT(*) FROM sales should return 20045.'],
        [details.some((d) => /^SCAN sales/.test(d)), 'Step 2: EXPLAIN QUERY PLAN SELECT * FROM sales WHERE customer_id = 7 before any index. The detail should say SCAN sales.'],
        [details.some((d) => /USING INTEGER PRIMARY KEY/.test(d)), 'Step 3: EXPLAIN QUERY PLAN SELECT * FROM sales WHERE id = 7. Expect SEARCH sales USING INTEGER PRIMARY KEY.'],
        [hasObject(r, 'idx_sales_customer') && /sales\s*\(\s*customer_id\s*\)/i.test(r.schema?.idx_sales_customer ?? ''), 'Step 4: CREATE INDEX idx_sales_customer ON sales(customer_id).'],
        [details.some((d) => /SEARCH sales USING INDEX idx_sales_customer/.test(d)), 'Step 5: rerun the EXPLAIN from step 2. It should now say SEARCH sales USING INDEX idx_sales_customer.'],
        [Boolean(lastSingle), 'Step 6: finish with SELECT COUNT(*) FROM sales WHERE customer_id = 7. Expect 2508.'],
      ], 'Three hops through a B-tree instead of 20,045 rows. That is the whole trick.')
    },
  },
  quiz: [
    { question: 'Why does a B-tree lookup stay fast as the table grows?', options: ['It caches every row in memory', 'The tree stays shallow, so a lookup is a few page hops', 'It skips rows at random'], answer: 1, explanation: 'Each level narrows the range a lot, so even millions of keys need only a few hops.' },
    { question: 'WHERE id = 7 is fast with no CREATE INDEX. Why?', options: ['SQLite guesses', 'The table itself is a B-tree keyed by the INTEGER PRIMARY KEY', 'Small numbers are always fast'], answer: 1, explanation: 'The rowid B-tree is the table. INTEGER PRIMARY KEY is an alias for the rowid.' },
    { question: 'EXPLAIN QUERY PLAN prints SCAN sales. What does that mean?', options: ['SQLite will read every row of sales', 'The query has a syntax error', 'An index is being used'], answer: 0, explanation: 'SCAN is a full read. On a big table that is where the time goes.' },
  ],
}

export default lesson
