import type { Lesson } from '../types'
import { SHOP } from './shop'
import { lastOk, lastRows, steps } from '../checks'

const lesson: Lesson = {
  id: 'w08d1',
  tier: 1,
  track: 'sql',
  week: 8,
  day: 1,
  title: 'Aggregates',
  concept: `Aggregate functions boil many rows down to one value. COUNT counts rows, SUM adds a column up, AVG averages it, and MIN and MAX find the extremes.

SELECT COUNT(*), AVG(price) FROM products returns a single row. COUNT(*) counts every row; COUNT(city) counts only rows where city is not NULL, which is a useful difference.

Aggregates ignore NULL, so AVG of a column with gaps averages only the values present.

ROUND(AVG(price), 2) tidies decimals. Name results with AS so the output reads well: COUNT(*) AS n.

Add a WHERE to aggregate over a subset: total stock of hardware only. Aggregates and plain columns do not mix in one SELECT unless you GROUP BY, which is tomorrow.`,
  example: {
    language: 'sql',
    caption: 'One row of answers',
    code: `SELECT COUNT(*) AS n,
       MIN(price) AS cheapest,
       MAX(price) AS priciest,
       ROUND(AVG(price), 2) AS avg_price
FROM products;

SELECT SUM(stock) AS hardware_units FROM products WHERE category = 'hardware';
SELECT COUNT(*) AS customers, COUNT(city) AS with_city FROM customers;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Build up one query against products in steps, running it after each addition to see the new column appear. The final version returns a single row with five columns named with AS exactly like this:\n1. n, the number of products (COUNT).\n2. cheapest, the MIN price.\n3. priciest, the MAX price.\n4. avg_price, the AVG price rounded to 2 decimals.\n5. units, the SUM of stock.\nThe last statement you run should have all five.',
    setup: SHOP,
    hints: ['SELECT COUNT(*) AS n FROM products; then add the others one by one, separated by commas.', 'MIN(price) AS cheapest, MAX(price) AS priciest', 'ROUND(AVG(price), 2) AS avg_price', 'SUM(stock) AS units'],
    solution: { commands: ['SELECT COUNT(*) AS n FROM products;', 'SELECT COUNT(*) AS n, MIN(price) AS cheapest, MAX(price) AS priciest FROM products;', 'SELECT COUNT(*) AS n, MIN(price) AS cheapest, MAX(price) AS priciest, ROUND(AVG(price), 2) AS avg_price, SUM(stock) AS units FROM products;'] },
    check: (r) => {
      const row = lastRows(r)[0] ?? {}
      return steps([
        lastOk(r),
        [lastRows(r).length === 1, 'The query should return exactly one row.'],
        [row.n === 8, 'n should be 8: COUNT(*) AS n'],
        [row.cheapest === 4 && row.priciest === 89, 'cheapest should be 4 and priciest 89: MIN(price) AS cheapest, MAX(price) AS priciest.'],
        [row.avg_price === 33.88 && /ROUND\s*\(\s*AVG/i.test(r.input), 'avg_price should be 33.88: ROUND(AVG(price), 2) AS avg_price'],
        [row.units === 500, 'units should be 500: SUM(stock) AS units'],
      ], 'Eight rows became one line of facts.')
    },
  },
  quiz: [
    { question: 'What is the difference between COUNT(*) and COUNT(city)?', options: ['None', 'COUNT(city) skips rows where city is NULL', 'COUNT(*) is slower'], answer: 1, explanation: 'Aggregates ignore NULLs, so counting a column counts only present values.' },
    { question: 'What does SELECT AVG(price) FROM products WHERE stock = 0 do?', options: ['Averages all prices', 'Averages prices of out-of-stock products only', 'Fails'], answer: 1, explanation: 'WHERE filters rows before the aggregate runs.' },
    { question: 'Why does SELECT name, MAX(price) FROM products give a confusing result?', options: ['name is not a column', 'Plain columns and aggregates need GROUP BY to make sense together', 'MAX needs ROUND'], answer: 1, explanation: 'Without GROUP BY, SQLite picks an arbitrary name to go with the max. Tomorrow fixes this.' },
  ],
}

export default lesson
