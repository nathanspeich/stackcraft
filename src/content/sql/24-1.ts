import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastCols, lastOk, lastRows, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w24d1',
  tier: 2,
  track: 'sql',
  week: 24,
  day: 1,
  title: 'CREATE VIEW and why views exist',
  concept: `A view is a saved SELECT with a name. CREATE VIEW sales_detail AS SELECT ... stores the query, not its rows. Every time you SELECT FROM sales_detail, SQLite runs the saved query against the live tables, so a view is never out of date.

Why bother? First, you stop retyping the same three-table join in every report. Second, everyone shares one definition of "revenue" or "active customer", so numbers agree across reports. Third, a view hides messy joins and column names behind a clean, table-like face.

Views show up in sqlite_master with type view. They take no space and cost nothing until queried. The one catch: a view runs its whole query every time, so keep the SELECT underneath it reasonable.`,
  example: {
    language: 'sql',
    caption: 'Save the join once, query it like a table',
    code: `CREATE VIEW sales_detail AS
SELECT s.id, s.sold_on,
       c.name AS customer,
       p.name AS product,
       s.qty, s.amount
FROM sales s
JOIN customers c ON c.id = s.customer_id
JOIN products p ON p.id = s.product_id;

SELECT customer, product, amount
FROM sales_detail
WHERE sold_on >= '2026-06-01';`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each. The database is the sales shop from week 18.\n1. Write the join first: SELECT s.id, s.sold_on, c.name AS customer, p.name AS product, s.qty, s.amount FROM sales joined to customers and products. It should return 45 rows.\n2. Turn that exact query into a view named sales_detail with CREATE VIEW sales_detail AS ...\n3. Query the view: SELECT product, qty, amount FROM sales_detail WHERE customer = \'Grace Kim\' ORDER BY sold_on. Expect 8 rows.\n4. Prove it is stored: SELECT name, type FROM sqlite_master WHERE type = \'view\'.',
    setup: SALES,
    hints: [
      'The join: FROM sales s JOIN customers c ON c.id = s.customer_id JOIN products p ON p.id = s.product_id. Alias the two name columns AS customer and AS product.',
      'CREATE VIEW sales_detail AS followed by the whole SELECT from step 1, no parentheses needed.',
      "Once the view exists, it works like a table: SELECT product, qty, amount FROM sales_detail WHERE customer = 'Grace Kim' ORDER BY sold_on;",
      "SELECT name, type FROM sqlite_master WHERE type = 'view';",
    ],
    solution: {
      commands: [
        'SELECT s.id, s.sold_on, c.name AS customer, p.name AS product, s.qty, s.amount FROM sales s JOIN customers c ON c.id = s.customer_id JOIN products p ON p.id = s.product_id;',
        'CREATE VIEW sales_detail AS SELECT s.id, s.sold_on, c.name AS customer, p.name AS product, s.qty, s.amount FROM sales s JOIN customers c ON c.id = s.customer_id JOIN products p ON p.id = s.product_id;',
        "SELECT product, qty, amount FROM sales_detail WHERE customer = 'Grace Kim' ORDER BY sold_on;",
        "SELECT name, type FROM sqlite_master WHERE type = 'view';",
      ],
    },
    check: (r) => {
      const sets = r.results ?? []
      const cols = (s: { columns: string[] }) => s.columns.map((c) => c.toLowerCase())
      const joinSet = sets.some((s) => s.values.length === 45 && cols(s).includes('customer') && cols(s).includes('product'))
      const viewSql = r.schema?.sales_detail ?? ''
      const graceSet = sets.some((s) => s.values.length === 8 && cols(s).includes('product') && cols(s).includes('amount'))
      const last = lastRows(r)
      return steps([
        lastOk(r),
        [joinSet, 'Step 1: run the three-table join with c.name AS customer and p.name AS product. It should return 45 rows.'],
        [hasObject(r, 'sales_detail') && /^CREATE VIEW/i.test(viewSql) && /JOIN/i.test(viewSql) && /AS\s+customer/i.test(viewSql) && /AS\s+product/i.test(viewSql), 'Step 2: CREATE VIEW sales_detail AS ... using the join from step 1, with the customer and product aliases.'],
        [sqlHas(r, /FROM\s+sales_detail[\s\S]*Grace Kim/) && graceSet, "Step 3: SELECT product, qty, amount FROM sales_detail WHERE customer = 'Grace Kim' ORDER BY sold_on. Expect 8 rows."],
        [lastCols(r).includes('name') && lastCols(r).includes('type') && last.some((row) => row.name === 'sales_detail' && row.type === 'view'), "Step 4: finish with SELECT name, type FROM sqlite_master WHERE type = 'view'. It should list sales_detail."],
      ], 'The join now has a name. Every report can start from sales_detail.')
    },
  },
  quiz: [
    { question: 'What does a view store?', options: ['A copy of the rows', 'The SELECT query, run fresh each time', 'Only the column names'], answer: 1, explanation: 'A view is a saved query. Its rows come from the live tables whenever you query it.' },
    { question: 'A colleague changes a price in products. What does a view built on products show?', options: ['The new price right away', 'The old price until the view is rebuilt', 'An error'], answer: 0, explanation: 'The view reruns its query, so it always reflects the current tables.' },
    { question: 'Which is a good reason to create a view?', options: ['To make the database smaller', 'So every report uses the same join and definitions', 'To speed up INSERTs'], answer: 1, explanation: 'Views remove repetition and keep everyone on one definition. They do not shrink or speed up anything by themselves.' },
  ],
}

export default lesson
