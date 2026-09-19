import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastCols, lastOk, lastRows, steps } from '../checks'

const lesson: Lesson = {
  id: 'w24d2',
  tier: 2,
  track: 'sql',
  week: 24,
  day: 2,
  title: 'Views for reporting, views on views',
  concept: `Reports ask the same questions every week: revenue per month, sales per product, totals per category. Put each question in a view and the report becomes a plain SELECT anyone can run.

Views can be built on other views. product_revenue sums sales per product; category_revenue sums product_revenue per category. Each layer is short and easy to test on its own, and if the way you compute revenue changes, you fix it in one place and every layer above picks it up.

Two habits keep this tidy. Name views by the question they answer, like monthly_revenue, not by how they work. And keep the tower low: a view on a view on a view is fine, but eight layers deep is slow to run and painful to debug.`,
  example: {
    language: 'sql',
    caption: 'One layer per question',
    code: `CREATE VIEW product_revenue AS
SELECT p.name AS product, p.category,
       SUM(s.qty) AS units,
       ROUND(SUM(s.amount), 2) AS revenue
FROM sales s
JOIN products p ON p.id = s.product_id
GROUP BY p.id;

-- built on the view above
CREATE VIEW category_revenue AS
SELECT category, SUM(units) AS units,
       ROUND(SUM(revenue), 2) AS revenue
FROM product_revenue
GROUP BY category;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each.\n1. Create a view monthly_revenue with columns month (substr(sold_on, 1, 7)), sales_count (COUNT(*)), and revenue (ROUND(SUM(amount), 2)), grouped by month.\n2. SELECT * FROM monthly_revenue ORDER BY month. Six months, May at 435.5.\n3. Create product_revenue exactly as in the example: product, category, units, revenue, one row per product.\n4. Create category_revenue on top of product_revenue: category, SUM(units) AS units, ROUND(SUM(revenue), 2) AS revenue, grouped by category.\n5. SELECT * FROM category_revenue ORDER BY revenue DESC. Electronics should lead with 1059.',
    setup: SALES,
    hints: [
      'CREATE VIEW monthly_revenue AS SELECT substr(sold_on, 1, 7) AS month, COUNT(*) AS sales_count, ROUND(SUM(amount), 2) AS revenue FROM sales GROUP BY month;',
      'Copy product_revenue from the example. GROUP BY p.id gives one row per product.',
      'category_revenue selects FROM product_revenue, not from sales. Group by category.',
      'SELECT * FROM category_revenue ORDER BY revenue DESC;',
    ],
    solution: {
      commands: [
        'CREATE VIEW monthly_revenue AS SELECT substr(sold_on, 1, 7) AS month, COUNT(*) AS sales_count, ROUND(SUM(amount), 2) AS revenue FROM sales GROUP BY month;',
        'SELECT * FROM monthly_revenue ORDER BY month;',
        'CREATE VIEW product_revenue AS SELECT p.name AS product, p.category, SUM(s.qty) AS units, ROUND(SUM(s.amount), 2) AS revenue FROM sales s JOIN products p ON p.id = s.product_id GROUP BY p.id;',
        'CREATE VIEW category_revenue AS SELECT category, SUM(units) AS units, ROUND(SUM(revenue), 2) AS revenue FROM product_revenue GROUP BY category;',
        'SELECT * FROM category_revenue ORDER BY revenue DESC;',
      ],
    },
    check: (r) => {
      const sets = r.results ?? []
      const monthly = r.schema?.monthly_revenue ?? ''
      const monthSet = sets.some((s) => {
        const cols = s.columns.map((c) => c.toLowerCase())
        const im = cols.indexOf('month')
        const ir = cols.indexOf('revenue')
        return s.values.length === 6 && im >= 0 && ir >= 0 && s.values.some((v) => v[im] === '2026-05' && Number(v[ir]) === 435.5)
      })
      const product = r.schema?.product_revenue ?? ''
      const category = r.schema?.category_revenue ?? ''
      const last = lastRows(r)
      const revenues = last.map((row) => Number(row.revenue))
      const sorted = revenues.every((v, i) => i === 0 || v <= revenues[i - 1])
      return steps([
        lastOk(r),
        [hasObject(r, 'monthly_revenue') && /^CREATE VIEW/i.test(monthly) && /substr\s*\(\s*sold_on/i.test(monthly) && /GROUP\s+BY/i.test(monthly), 'Step 1: CREATE VIEW monthly_revenue with month, sales_count, and revenue, grouped by month.'],
        [monthSet, 'Step 2: SELECT * FROM monthly_revenue ORDER BY month. Expect 6 rows, with 2026-05 at 435.5.'],
        [hasObject(r, 'product_revenue') && /JOIN\s+products/i.test(product) && /GROUP\s+BY/i.test(product), 'Step 3: create product_revenue with product, category, units, and revenue per product (see the example).'],
        [hasObject(r, 'category_revenue') && /FROM\s+product_revenue/i.test(category) && /GROUP\s+BY\s+category/i.test(category), 'Step 4: create category_revenue that selects FROM product_revenue and groups by category.'],
        [lastCols(r).includes('category') && lastCols(r).includes('revenue') && last.length === 4 && String(last[0]?.category) === 'electronics' && Number(last[0]?.revenue) === 1059 && sorted, 'Step 5: finish with SELECT * FROM category_revenue ORDER BY revenue DESC. Electronics first at 1059.'],
      ], 'Three reporting views, stacked. The weekly report is now three SELECTs.')
    },
  },
  quiz: [
    { question: 'category_revenue is built on product_revenue. You fix a bug in product_revenue. What happens to category_revenue?', options: ['It must be recreated', 'It picks up the fix automatically', 'It keeps the old numbers'], answer: 1, explanation: 'A view on a view reruns the lower view each time, so a fix flows upward.' },
    { question: 'Which name follows the advice in this lesson?', options: ['join_sales_products_grouped', 'monthly_revenue', 'view2'], answer: 1, explanation: 'Name a view after the question it answers.' },
    { question: 'Why avoid a tower of many stacked views?', options: ['SQLite allows at most three', 'Each query reruns every layer, so it gets slow and hard to debug', 'Views cannot reference other views'], answer: 1, explanation: 'Layers are fine, but every level adds work and hides where a number came from.' },
  ],
}

export default lesson
