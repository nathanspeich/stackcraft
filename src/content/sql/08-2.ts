import type { Lesson } from '../types'
import { SHOP } from './shop'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w08d2',
  tier: 1,
  track: 'sql',
  week: 8,
  day: 2,
  title: 'GROUP BY and HAVING',
  concept: `GROUP BY splits rows into groups and runs the aggregates once per group. SELECT category, COUNT(*) FROM products GROUP BY category gives one row per category with its count.

The rule: every column in the SELECT is either inside an aggregate or listed in GROUP BY. Break it and the result is meaningless.

WHERE filters rows before grouping. HAVING filters the groups afterwards, using aggregate results: HAVING COUNT(*) >= 3 keeps only categories with three or more products. You cannot put an aggregate in WHERE, that is what HAVING is for.

ORDER BY can sort by an aggregate too: ORDER BY COUNT(*) DESC. The clause order grows to SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.`,
  example: {
    language: 'sql',
    caption: 'Per-group counts, then filter the groups',
    code: `SELECT category, COUNT(*) AS n, ROUND(AVG(price), 2) AS avg_price
FROM products
GROUP BY category
ORDER BY category;

SELECT category, COUNT(*) AS n
FROM products
GROUP BY category
HAVING COUNT(*) >= 3;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each:\n1. For each product category: category, n (count), and avg_price (average price rounded to 2 decimals), sorted by category.\n2. The same grouping, but keep only categories with at least 3 products, using HAVING. Return category and n.\n3. For orders: each status with its count as n, sorted by n from highest to lowest.',
    setup: SHOP,
    hints: ['SELECT category, COUNT(*) AS n, ROUND(AVG(price), 2) AS avg_price FROM products GROUP BY category ORDER BY category;', 'Add HAVING COUNT(*) >= 3 after GROUP BY.', 'SELECT status, COUNT(*) AS n FROM orders GROUP BY status ORDER BY n DESC;'],
    solution: { commands: ['SELECT category, COUNT(*) AS n, ROUND(AVG(price), 2) AS avg_price FROM products GROUP BY category ORDER BY category;', 'SELECT category, COUNT(*) AS n FROM products GROUP BY category HAVING COUNT(*) >= 3 ORDER BY category;', 'SELECT status, COUNT(*) AS n FROM orders GROUP BY status ORDER BY n DESC;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /GROUP\s+BY\s+category/) && sets.some((s) => flat(s) === 'books:3:28.17|hardware:3:47.83|merch:2:21.5'), 'Step 1: books 3 28.17, hardware 3 47.83, merch 2 21.5, sorted by category.'],
        [sqlHas(r, /HAVING\s+COUNT\(\*\)\s*>=\s*3/) && sets.some((s) => flat(s) === 'books:3|hardware:3'), 'Step 2: only books and hardware remain after HAVING COUNT(*) >= 3.'],
        [sqlHas(r, /GROUP\s+BY\s+status/) && sets.some((s) => flat(s) === 'shipped:4|new:3|cancelled:1'), 'Step 3: shipped 4, new 3, cancelled 1, sorted by n DESC.'],
      ], 'Grouped, aggregated, and filtered the groups.')
    },
  },
  quiz: [
    { question: 'Where does HAVING go?', options: ['Before WHERE', 'After GROUP BY', 'After ORDER BY'], answer: 1, explanation: 'SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.' },
    { question: 'Why can you not write WHERE COUNT(*) > 2?', options: ['COUNT needs parentheses', 'WHERE runs before grouping, so no counts exist yet', 'You can'], answer: 1, explanation: 'Aggregates exist only after GROUP BY. Filter them with HAVING.' },
    { question: 'SELECT city, COUNT(*) FROM customers GROUP BY city. How many rows for customers with NULL city?', options: ['They are skipped', 'One group for NULL', 'One row each'], answer: 1, explanation: 'NULL values form their own single group.' },
  ],
}

export default lesson
