import type { Lesson } from '../types'
import { SALES } from './sales'
import { lastCols, lastOk, lastRows, steps } from '../checks'

/** 20,000 extra sales plus the two indexes a tuned sales table would have. */
const BIG = SALES + `
INSERT INTO sales (customer_id, product_id, sold_on, qty, amount)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 20000)
SELECT (i * 7) % 8 + 1, (i * 13) % 8 + 1, date('2026-01-01', '+' || (i % 181) || ' days'), i % 3 + 1,
       (i % 3 + 1) * (SELECT price FROM products WHERE id = (i * 13) % 8 + 1)
FROM n;
CREATE INDEX idx_sales_date ON sales(sold_on);
CREATE INDEX idx_sales_customer ON sales(customer_id);
`

const lesson: Lesson = {
  id: 'w27d4',
  tier: 2,
  track: 'sql',
  week: 27,
  day: 4,
  title: 'Rewriting slow queries',
  concept: `Most slow queries are fixed by rewriting, not by adding hardware. Three habits catch most of them.

Select only the columns you need. SELECT * drags every column across the wire and blocks covering indexes from helping.

Never wrap an indexed column in a function inside WHERE. strftime('%Y-%m', sold_on) = '2026-05' hides sold_on from its index, so SQLite scans. Rewrite it as a range: sold_on >= '2026-05-01' AND sold_on < '2026-06-01'. Same answer, SEARCH instead of SCAN.

Spot the N+1 pattern. An app loads 8 customers, then runs one query per customer for their totals: 9 round trips. With 8,000 customers that is 8,001. One JOIN with GROUP BY answers it in a single trip. Whenever a loop contains a query, ask if a JOIN could replace the loop.`,
  example: {
    language: 'sql',
    caption: 'Same answers, far less work',
    code: `-- function on the column: SCAN
SELECT * FROM sales
WHERE strftime('%Y-%m', sold_on) = '2026-05';

-- range on the column: SEARCH, and only needed columns
SELECT id, amount FROM sales
WHERE sold_on >= '2026-05-01' AND sold_on < '2026-06-01';

-- one query instead of one per customer
SELECT c.name, COUNT(*) AS purchases,
       ROUND(SUM(s.amount), 2) AS total
FROM customers c
JOIN sales s ON s.customer_id = c.id
GROUP BY c.id
ORDER BY total DESC;`,
  },
  task: {
    kind: 'sql',
    instructions: 'sales has 20,045 rows and indexes on sold_on and customer_id. Run each step as its own statement.\n1. EXPLAIN QUERY PLAN SELECT * FROM sales WHERE strftime(\'%Y-%m\', sold_on) = \'2026-05\'. Despite the index: SCAN sales.\n2. EXPLAIN QUERY PLAN the rewrite: SELECT id, amount FROM sales WHERE sold_on >= \'2026-05-01\' AND sold_on < \'2026-06-01\'. Expect SEARCH using idx_sales_date.\n3. Run the real thing: SELECT COUNT(*), ROUND(SUM(amount), 2) FROM sales with that same range. Expect 3419 and 189271.5.\n4. Replace an N+1 loop with one query: name, COUNT(*) AS purchases, ROUND(SUM(s.amount), 2) AS total from customers joined to sales, GROUP BY c.id, ORDER BY total DESC. Eight rows.',
    setup: BIG,
    hints: [
      "EXPLAIN QUERY PLAN SELECT * FROM sales WHERE strftime('%Y-%m', sold_on) = '2026-05';",
      "The range form: WHERE sold_on >= '2026-05-01' AND sold_on < '2026-06-01'. Use it in steps 2 and 3.",
      'Step 4 is the last query in the example: FROM customers c JOIN sales s ON s.customer_id = c.id GROUP BY c.id ORDER BY total DESC.',
    ],
    solution: {
      commands: [
        "EXPLAIN QUERY PLAN SELECT * FROM sales WHERE strftime('%Y-%m', sold_on) = '2026-05';",
        "EXPLAIN QUERY PLAN SELECT id, amount FROM sales WHERE sold_on >= '2026-05-01' AND sold_on < '2026-06-01';",
        "SELECT COUNT(*), ROUND(SUM(amount), 2) FROM sales WHERE sold_on >= '2026-05-01' AND sold_on < '2026-06-01';",
        'SELECT c.name, COUNT(*) AS purchases, ROUND(SUM(s.amount), 2) AS total FROM customers c JOIN sales s ON s.customer_id = c.id GROUP BY c.id ORDER BY total DESC;',
      ],
    },
    check: (r) => {
      const h = r.history ?? []
      const o = r.outputs ?? []
      const sets = r.results ?? []
      const fnScan = h.some((s, i) => /EXPLAIN\s+QUERY\s+PLAN[\s\S]*strftime/i.test(s) && /SCAN sales/.test(o[i] ?? ''))
      const rangeSearch = h.some((s, i) => /EXPLAIN\s+QUERY\s+PLAN[\s\S]*sold_on\s*>=/i.test(s) && /SEARCH sales USING INDEX idx_sales_date/.test(o[i] ?? ''))
      const totals = sets.some((s) => s.values.length === 1 && s.values[0].length === 2 && Number(s.values[0][0]) === 3419 && Number(s.values[0][1]) === 189271.5)
      const last = lastRows(r)
      const cols = lastCols(r)
      const vals = last.map((row) => Number(row.total))
      const sorted = vals.every((v, i) => i === 0 || v <= vals[i - 1])
      const lastIsJoin = /JOIN[\s\S]*GROUP\s+BY/i.test(r.input) && !/SELECT\s+\*/i.test(r.input)
      return steps([
        lastOk(r),
        [fnScan, "Step 1: EXPLAIN QUERY PLAN SELECT * FROM sales WHERE strftime('%Y-%m', sold_on) = '2026-05'. The detail should say SCAN sales."],
        [rangeSearch, "Step 2: EXPLAIN QUERY PLAN SELECT id, amount FROM sales WHERE sold_on >= '2026-05-01' AND sold_on < '2026-06-01'. Expect SEARCH sales USING INDEX idx_sales_date."],
        [totals, 'Step 3: SELECT COUNT(*), ROUND(SUM(amount), 2) FROM sales with the May range. Expect 3419 and 189271.5.'],
        [lastIsJoin && cols.includes('name') && cols.includes('purchases') && cols.includes('total') && last.length === 8 && sorted, 'Step 4: finish with the single JOIN + GROUP BY query: name, purchases, total for all eight customers, ORDER BY total DESC.'],
      ], 'Range instead of function, columns instead of star, one JOIN instead of a loop.')
    },
  },
  quiz: [
    { question: "Why does WHERE strftime('%Y-%m', sold_on) = '2026-05' ignore the index on sold_on?", options: ['strftime is not allowed in WHERE', 'The index stores sold_on values, not the function results', 'The index is on the wrong table'], answer: 1, explanation: 'SQLite cannot look up a computed value in an index of raw values. Filter on the column itself with a range.' },
    { question: 'What is the N+1 pattern?', options: ['One query to load a list, then one more query per item', 'A query with N+1 joins', 'An index with too many columns'], answer: 0, explanation: 'The fix is usually one JOIN or one IN (...) query that fetches everything at once.' },
    { question: 'Why avoid SELECT * in application code?', options: ['It is invalid in SQLite', 'It moves columns you do not need and blocks covering indexes', 'It always returns duplicates'], answer: 1, explanation: 'Name the columns. Less data moves, and the planner has more options.' },
  ],
}

export default lesson
