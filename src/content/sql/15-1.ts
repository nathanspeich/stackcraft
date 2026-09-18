import type { Lesson } from '../types'
import { SALES } from './sales'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w15d1',
  tier: 2,
  track: 'sql',
  week: 15,
  day: 1,
  title: 'The WITH clause',
  concept: `In week 10 you put a SELECT inside another SELECT. That works, but the inner query sits in the middle of the outer one, so you read the statement inside out.

A CTE (common table expression) fixes that. WITH name AS (...) gives a query a name, and the main SELECT below uses that name like a table. The statement now reads top to bottom: first the helper, then the answer.

The named query only exists for this one statement. Nothing is stored, no table is created, and the database runs it the same way it would run the subquery.

Use a CTE whenever a subquery would need its own comment. The name is the comment.`,
  example: {
    language: 'sql',
    caption: 'The same question, inside out and top to bottom',
    code: `-- subquery: read from the middle
SELECT c.name, t.total
FROM (SELECT customer_id, SUM(amount) AS total
      FROM sales GROUP BY customer_id) AS t
JOIN customers c ON c.id = t.customer_id;

-- CTE: read from the top
WITH totals AS (
  SELECT customer_id, SUM(amount) AS total
  FROM sales
  GROUP BY customer_id
)
SELECT c.name, t.total
FROM totals t
JOIN customers c ON c.id = t.customer_id;`,
  },
  task: {
    kind: 'sql',
    instructions: 'The database is the sales shop from this tier: customers, products, and sales (with sold_on, qty, amount). Run each step as its own statement.\n1. Write a CTE named totals that sums amount per customer_id, then select each customer\'s name and total from it, highest total first.\n2. Write a CTE named monthly with month (substr(sold_on, 1, 7)) and revenue (SUM of amount) grouped by month, then select month and revenue for months with revenue over 300, sorted by month.',
    setup: SALES,
    hints: ['WITH totals AS (SELECT customer_id, SUM(amount) AS total FROM sales GROUP BY customer_id) SELECT ... FROM totals t JOIN customers c ON c.id = t.customer_id ORDER BY t.total DESC;', 'substr(sold_on, 1, 7) turns 2026-03-11 into 2026-03. Give it the alias month and GROUP BY month.', 'WITH monthly AS (SELECT substr(sold_on, 1, 7) AS month, SUM(amount) AS revenue FROM sales GROUP BY month) SELECT month, revenue FROM monthly WHERE revenue > 300 ORDER BY month;'],
    solution: { commands: ['WITH totals AS (SELECT customer_id, SUM(amount) AS total FROM sales GROUP BY customer_id) SELECT c.name, t.total FROM totals t JOIN customers c ON c.id = t.customer_id ORDER BY t.total DESC;', 'WITH monthly AS (SELECT substr(sold_on, 1, 7) AS month, SUM(amount) AS revenue FROM sales GROUP BY month) SELECT month, revenue FROM monthly WHERE revenue > 300 ORDER BY month;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /WITH\s+totals\s+AS/) && sets.some((s) => flat(s) === 'Grace Kim:473|Ben Okafor:396|Emma Novak:212.5|Hugo Silva:192|Chloe Martin:185|Dev Patel:161.5|Ana Costa:96|Farid Aziz:52.5'), 'Step 1: WITH totals AS (...) then name and total, highest first. Grace Kim 473 should be on top and Farid Aziz 52.5 at the bottom.'],
        [sqlHas(r, /WITH\s+monthly\s+AS/) && sets.some((s) => flat(s) === '2026-04:368.5|2026-05:435.5|2026-06:322.5'), 'Step 2: WITH monthly AS (...) then months over 300: 2026-04 368.5, 2026-05 435.5, 2026-06 322.5.'],
      ], 'Top to bottom, just like reading.')
    },
  },
  quiz: [
    { question: 'What does WITH totals AS (...) create?', options: ['A permanent table named totals', 'A name for a query that lives for this one statement', 'An index on totals'], answer: 1, explanation: 'A CTE is a named query, not stored anywhere. It disappears when the statement finishes.' },
    { question: 'Why prefer a CTE over a subquery in FROM?', options: ['It runs faster', 'It reads top to bottom, with a name that says what the piece means', 'Subqueries are not allowed in FROM'], answer: 1, explanation: 'The database treats them alike. The CTE is easier for people to read.' },
    { question: 'Where does the main SELECT go?', options: ['Inside the parentheses', 'After the closing parenthesis of the last CTE', 'Before the WITH keyword'], answer: 1, explanation: 'WITH name AS (...) comes first, then the query that uses the name.' },
  ],
}

export default lesson
