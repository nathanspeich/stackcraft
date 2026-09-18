import type { Lesson } from '../types'
import { SALES } from './sales'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w18d4',
  tier: 2,
  track: 'sql',
  week: 18,
  day: 4,
  title: 'LAG, LEAD, NTILE, FIRST_VALUE',
  concept: `Four more window functions that answer everyday questions.

LAG(col) OVER (ORDER BY month) returns the value from the previous row, so revenue - LAG(revenue) is the month-over-month change. The first row has no previous row and gets NULL. LEAD looks at the next row instead, handy for "when did this customer buy again".

NTILE(4) OVER (ORDER BY total DESC) deals rows into 4 buckets of equal size: quartiles. Top customers land in bucket 1.

FIRST_VALUE(name) OVER (PARTITION BY category ORDER BY price) puts the first row's value of the partition on every row, so each product can see the cheapest item in its category.

All four take the same OVER clause you already know.`,
  example: {
    language: 'sql',
    caption: 'Compare each month with the one before',
    code: `WITH monthly AS (
  SELECT substr(sold_on, 1, 7) AS month,
         SUM(amount) AS revenue
  FROM sales GROUP BY month
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev,
       revenue - LAG(revenue) OVER (ORDER BY month) AS change
FROM monthly;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement.\n1. Month-over-month: a CTE named monthly (month, revenue as before), then month, revenue, prev (LAG of revenue OVER (ORDER BY month)) and change (revenue minus that LAG). ORDER BY month.\n2. For customer 1: customer_id, sold_on, and next_sale from LEAD(sold_on) OVER (PARTITION BY customer_id ORDER BY sold_on). WHERE customer_id = 1, ORDER BY sold_on.\n3. Quartiles: a CTE named totals (customer_id, total as SUM of amount), then name, total, and quartile from NTILE(4) OVER (ORDER BY total DESC), joined to customers, ORDER BY total DESC.\n4. Cheapest per category: category, name, price, and cheapest from FIRST_VALUE(name) OVER (PARTITION BY category ORDER BY price). ORDER BY category, price.',
    setup: SALES,
    hints: ['LAG(revenue) OVER (ORDER BY month) AS prev, revenue - LAG(revenue) OVER (ORDER BY month) AS change', 'LEAD(sold_on) OVER (PARTITION BY customer_id ORDER BY sold_on) AS next_sale', 'NTILE(4) OVER (ORDER BY t.total DESC) AS quartile, from totals t JOIN customers c ON c.id = t.customer_id', 'FIRST_VALUE(name) OVER (PARTITION BY category ORDER BY price) AS cheapest'],
    solution: { commands: ['WITH monthly AS (SELECT substr(sold_on, 1, 7) AS month, SUM(amount) AS revenue FROM sales GROUP BY month) SELECT month, revenue, LAG(revenue) OVER (ORDER BY month) AS prev, revenue - LAG(revenue) OVER (ORDER BY month) AS change FROM monthly ORDER BY month;', 'SELECT customer_id, sold_on, LEAD(sold_on) OVER (PARTITION BY customer_id ORDER BY sold_on) AS next_sale FROM sales WHERE customer_id = 1 ORDER BY sold_on;', 'WITH totals AS (SELECT customer_id, SUM(amount) AS total FROM sales GROUP BY customer_id) SELECT c.name, t.total, NTILE(4) OVER (ORDER BY t.total DESC) AS quartile FROM totals t JOIN customers c ON c.id = t.customer_id ORDER BY t.total DESC;', 'SELECT category, name, price, FIRST_VALUE(name) OVER (PARTITION BY category ORDER BY price) AS cheapest FROM products ORDER BY category, price;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.map((x) => x ?? 'NULL').join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /LAG\(revenue\)\s*OVER/) && sets.some((s) => flat(s) === '2026-01:155.5:NULL:NULL|2026-02:189.5:155.5:34|2026-03:297:189.5:107.5|2026-04:368.5:297:71.5|2026-05:435.5:368.5:67|2026-06:322.5:435.5:-113'), 'Step 1: month, revenue, prev, change. January has NULL prev and change; June should show -113.'],
        [sqlHas(r, /LEAD\(sold_on\)\s*OVER/) && sets.some((s) => flat(s) === '1:2026-01-05:2026-06-18|1:2026-06-18:2026-06-20|1:2026-06-20:NULL'), 'Step 2: customer 1 has three sales; next_sale is the following date and NULL on the last one.'],
        [sqlHas(r, /NTILE\(4\)\s*OVER/) && sets.some((s) => flat(s) === 'Grace Kim:473:1|Ben Okafor:396:1|Emma Novak:212.5:2|Hugo Silva:192:2|Chloe Martin:185:3|Dev Patel:161.5:3|Ana Costa:96:4|Farid Aziz:52.5:4'), 'Step 3: name, total, quartile: two customers per bucket, Grace Kim and Ben Okafor in quartile 1.'],
        [sqlHas(r, /FIRST_VALUE\(name\)\s*OVER\s*\(\s*PARTITION\s+BY\s+category/) && sets.some((s) => flat(s) === 'bags:Backpack:49:Backpack|electronics:USB-C cable:9:USB-C cable|electronics:Mouse:24:USB-C cable|electronics:Headphones:79:USB-C cable|home:Water bottle:15:Water bottle|home:Desk lamp:29:Water bottle|stationery:Notebook:4.5:Notebook|stationery:Pen set:12:Notebook'), 'Step 4: every electronics row should show USB-C cable as cheapest, every home row Water bottle, ordered by category then price.'],
      ], 'You can now look back, look ahead, and bucket.')
    },
  },
  quiz: [
    { question: 'What does LAG(revenue) return on the first row?', options: ['0', 'NULL', 'The last row\'s revenue'], answer: 1, explanation: 'There is no previous row, so LAG has nothing to return.' },
    { question: 'What does NTILE(4) do?', options: ['Keeps the top 4 rows', 'Splits the rows into 4 equal buckets numbered 1 to 4', 'Multiplies by 4'], answer: 1, explanation: 'Useful for quartiles: bucket 1 is the top quarter of the ordered rows.' },
    { question: 'FIRST_VALUE(name) OVER (PARTITION BY category ORDER BY price) shows what?', options: ['The cheapest product name in each row\'s category', 'The first product ever inserted', 'The most expensive product'], answer: 0, explanation: 'Ordered by price ascending, the first value in each partition is the cheapest.' },
  ],
}

export default lesson
