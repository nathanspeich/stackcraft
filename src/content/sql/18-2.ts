import type { Lesson } from '../types'
import { SALES } from './sales'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w18d2',
  tier: 2,
  track: 'sql',
  week: 18,
  day: 2,
  title: 'PARTITION BY',
  concept: `Yesterday one window covered the whole table. PARTITION BY splits it into groups, and the function starts over in each group. ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) numbers the products inside every category from 1, so the row with n = 1 is the most expensive one in its category.

Think of PARTITION BY as GROUP BY that keeps the rows: every row still gets its own number.

The classic use is "top one per group" or "top three per group". Number the rows inside a CTE, then filter WHERE n = 1 in the main query. You cannot filter on a window function directly in WHERE, because the window is computed after WHERE runs. The CTE gets around that.`,
  example: {
    language: 'sql',
    caption: 'Best sale per customer: number inside the partition, then keep n = 1',
    code: `WITH ranked AS (
  SELECT customer_id, sold_on, amount,
         ROW_NUMBER() OVER (
           PARTITION BY customer_id
           ORDER BY amount DESC
         ) AS n
  FROM sales
)
SELECT customer_id, sold_on, amount
FROM ranked
WHERE n = 1;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement.\n1. Number products inside each category, most expensive first: category, name, price, and n from ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC). ORDER BY category, n.\n2. Number each customer\'s sales in date order, for customers 1 and 3 only: customer_id, sold_on, amount, n (PARTITION BY customer_id ORDER BY sold_on). ORDER BY customer_id, n.\n3. Each customer\'s biggest sale: a CTE named ranked that numbers sales per customer by amount DESC then sold_on, then the customer\'s name, sold_on, and amount for the rows with n = 1, ORDER BY amount DESC, name.',
    setup: SALES,
    hints: ['ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS n', 'WHERE customer_id IN (1, 3) goes before ORDER BY. The window still numbers each customer from 1.', 'WITH ranked AS (SELECT customer_id, sold_on, amount, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY amount DESC, sold_on) AS n FROM sales) SELECT c.name, r.sold_on, r.amount FROM ranked r JOIN customers c ON c.id = r.customer_id WHERE r.n = 1 ORDER BY r.amount DESC, c.name;'],
    solution: { commands: ['SELECT category, name, price, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS n FROM products ORDER BY category, n;', 'SELECT customer_id, sold_on, amount, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY sold_on) AS n FROM sales WHERE customer_id IN (1, 3) ORDER BY customer_id, n;', 'WITH ranked AS (SELECT customer_id, sold_on, amount, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY amount DESC, sold_on) AS n FROM sales) SELECT c.name, r.sold_on, r.amount FROM ranked r JOIN customers c ON c.id = r.customer_id WHERE r.n = 1 ORDER BY r.amount DESC, c.name;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /PARTITION\s+BY\s+category/) && sets.some((s) => flat(s) === 'bags:Backpack:49:1|electronics:Headphones:79:1|electronics:Mouse:24:2|electronics:USB-C cable:9:3|home:Desk lamp:29:1|home:Water bottle:15:2|stationery:Pen set:12:1|stationery:Notebook:4.5:2'), 'Step 1: PARTITION BY category ORDER BY price DESC, then ORDER BY category, n. Headphones is 1 in electronics, Mouse 2, USB-C cable 3.'],
        [sqlHas(r, /PARTITION\s+BY\s+customer_id\s+ORDER\s+BY\s+sold_on/) && sets.some((s) => flat(s) === '1:2026-01-05:49:1|1:2026-06-18:18:2|1:2026-06-20:29:3|3:2026-02-19:30:1|3:2026-02-21:58:2|3:2026-03-11:49:3|3:2026-03-22:48:4'), 'Step 2: customers 1 and 3 only, numbered by sold_on inside each customer: 3 rows for customer 1 and 4 for customer 3.'],
        [sqlHas(r, /WITH\s+ranked\s+AS/) && sqlHas(r, /\bn\s*=\s*1\b/) && sets.some((s) => flat(s) === 'Grace Kim:2026-05-10:237|Ben Okafor:2026-06-19:158|Dev Patel:2026-02-26:79|Emma Novak:2026-03-07:79|Hugo Silva:2026-04-25:79|Chloe Martin:2026-02-21:58|Ana Costa:2026-01-05:49|Farid Aziz:2026-04-02:48'), 'Step 3: WITH ranked AS (...) then WHERE n = 1, ordered by amount DESC then name: Grace Kim 237 first, Farid Aziz 48 last.'],
      ], 'Top of every group, no group left behind.')
    },
  },
  quiz: [
    { question: 'What does PARTITION BY do?', options: ['Deletes rows outside the group', 'Restarts the window function for each group', 'Sorts the whole table'], answer: 1, explanation: 'Each partition is numbered, ranked, or summed on its own, and all rows are kept.' },
    { question: 'Why put ROW_NUMBER in a CTE before filtering on it?', options: ['WHERE runs before window functions are computed', 'CTEs are faster', 'ROW_NUMBER only works inside WITH'], answer: 0, explanation: 'The window value does not exist yet when WHERE runs, so filter in an outer query.' },
    { question: 'Which query finds the most expensive product per category?', options: ['GROUP BY category with MAX(name)', 'ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC), then n = 1', 'ORDER BY price DESC LIMIT 1'], answer: 1, explanation: 'MAX(name) picks the alphabetically last name, not the priciest product. The window gives the whole row.' },
  ],
}

export default lesson
