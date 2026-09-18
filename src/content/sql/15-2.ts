import type { Lesson } from '../types'
import { SALES } from './sales'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w15d2',
  tier: 2,
  track: 'sql',
  week: 15,
  day: 2,
  title: 'Chaining several CTEs',
  concept: `One WITH can hold several named queries, separated by commas. Each one can use the ones above it, so a hard question becomes a chain of easy steps: first group, then average, then compare.

WITH monthly AS (...), avg_month AS (SELECT AVG(revenue) FROM monthly) SELECT ... The second CTE reads from the first by name. Only the last SELECT, after the closing parenthesis, is the real query.

This is how analysts build reports: every step gets a name you can test on its own. If a number looks wrong, replace the final SELECT with SELECT * FROM avg_month and look at that piece alone.

Order matters. A CTE can only refer to names defined before it.`,
  example: {
    language: 'sql',
    caption: 'Three steps, three names',
    code: `WITH monthly AS (
  SELECT substr(sold_on, 1, 7) AS month,
         SUM(amount) AS revenue
  FROM sales
  GROUP BY month
),
avg_month AS (
  SELECT AVG(revenue) AS avg_revenue FROM monthly
)
SELECT month, revenue
FROM monthly, avg_month
WHERE revenue > avg_revenue
ORDER BY month;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Same sales database. Run each step as its own statement.\n1. Chain two CTEs: monthly (month and revenue as yesterday) and avg_month (the AVG of revenue from monthly, as avg_revenue). Select month and revenue for months above the average, sorted by month.\n2. Chain three: product_totals (product_id and total amount per product), category_totals (category and total, by joining product_totals to products and grouping by category), and grand (SUM of total from category_totals as grand_total). Select category, total, and pct, which is ROUND(100.0 * total / grand_total, 1), biggest total first.',
    setup: SALES,
    hints: ['Separate CTEs with a comma: WITH monthly AS (...), avg_month AS (...) SELECT ...', 'A CTE with one row can simply be listed in FROM: FROM monthly, avg_month WHERE revenue > avg_revenue.', 'category_totals: SELECT p.category, SUM(pt.total) AS total FROM product_totals pt JOIN products p ON p.id = pt.product_id GROUP BY p.category', 'Final SELECT for step 2: SELECT category, total, ROUND(100.0 * total / grand_total, 1) AS pct FROM category_totals, grand ORDER BY total DESC;'],
    solution: { commands: ['WITH monthly AS (SELECT substr(sold_on, 1, 7) AS month, SUM(amount) AS revenue FROM sales GROUP BY month), avg_month AS (SELECT AVG(revenue) AS avg_revenue FROM monthly) SELECT month, revenue FROM monthly, avg_month WHERE revenue > avg_revenue ORDER BY month;', 'WITH product_totals AS (SELECT product_id, SUM(amount) AS total FROM sales GROUP BY product_id), category_totals AS (SELECT p.category, SUM(pt.total) AS total FROM product_totals pt JOIN products p ON p.id = pt.product_id GROUP BY p.category), grand AS (SELECT SUM(total) AS grand_total FROM category_totals) SELECT category, total, ROUND(100.0 * total / grand_total, 1) AS pct FROM category_totals, grand ORDER BY total DESC;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /WITH\s+monthly\s+AS[\s\S]*,\s*avg_month\s+AS/) && sets.some((s) => flat(s) === '2026-03:297|2026-04:368.5|2026-05:435.5|2026-06:322.5'), 'Step 1: monthly then avg_month, giving 2026-03 297, 2026-04 368.5, 2026-05 435.5, 2026-06 322.5.'],
        [sqlHas(r, /WITH\s+product_totals\s+AS[\s\S]*category_totals\s+AS[\s\S]*grand\s+AS/) && sets.some((s) => flat(s) === 'electronics:1059:59.9|home:352:19.9|bags:245:13.9|stationery:112.5:6.4'), 'Step 2: product_totals, category_totals, grand, then category, total, pct: electronics 1059 59.9, home 352 19.9, bags 245 13.9, stationery 112.5 6.4.'],
      ], 'A report built one named step at a time.')
    },
  },
  quiz: [
    { question: 'How do you write two CTEs in one statement?', options: ['WITH a AS (...) WITH b AS (...)', 'WITH a AS (...), b AS (...)', 'WITH a, b AS (...)'], answer: 1, explanation: 'One WITH, then the named queries separated by commas.' },
    { question: 'Can the second CTE read from the first?', options: ['Yes, by its name', 'No, CTEs cannot see each other', 'Only through a subquery'], answer: 0, explanation: 'Each CTE can use every name defined above it in the same WITH.' },
    { question: 'A chained report gives a wrong number. What is the quickest check?', options: ['Rewrite it as one big subquery', 'Replace the final SELECT with SELECT * FROM one of the CTEs', 'Add an index'], answer: 1, explanation: 'Looking at each named step on its own shows where the numbers went wrong.' },
  ],
}

export default lesson
