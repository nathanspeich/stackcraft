import type { Lesson } from '../types'
import { SALES } from './sales'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w18d1',
  tier: 2,
  track: 'sql',
  week: 18,
  day: 1,
  title: 'OVER, ROW_NUMBER, RANK, DENSE_RANK',
  badge: 'window-shopper',
  concept: `GROUP BY squashes rows into one per group. Sometimes you want to keep every row and still look at its neighbours: number them, rank them, add a running total. That is what a window function does.

Any function followed by OVER (...) is a window function. The parentheses say how to line the rows up, usually ORDER BY something. ROW_NUMBER() OVER (ORDER BY amount DESC) gives 1, 2, 3 down the sorted list, with no rows lost.

RANK and DENSE_RANK handle ties. Two rows with the same amount get the same rank. RANK then skips numbers (1, 2, 2, 4), like a podium. DENSE_RANK does not skip (1, 2, 2, 3).

Window functions run after WHERE and GROUP BY, so they can rank aggregates too.`,
  example: {
    language: 'sql',
    caption: 'Three ways to number the same list',
    code: `SELECT id, amount,
       ROW_NUMBER() OVER (ORDER BY amount DESC) AS n,
       RANK()       OVER (ORDER BY amount DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY amount DESC) AS dense
FROM sales
ORDER BY amount DESC, id;
-- with amounts 237, 158, 79, 79, 79, 79, 72:
-- n:     1 2 3 4 5 6 7
-- rnk:   1 2 3 3 3 3 7
-- dense: 1 2 3 3 3 3 4`,
  },
  task: {
    kind: 'sql',
    instructions: 'The sales database again: customers, products, and sales (sold_on, qty, amount). Run each step as its own statement.\n1. Number the sales in date order: id, sold_on, amount, and n from ROW_NUMBER() OVER (ORDER BY sold_on, id). Show the first 5 with LIMIT 5.\n2. Rank sales by amount, biggest first: id, amount, rnk (RANK) and dense (DENSE_RANK), both OVER (ORDER BY amount DESC). ORDER BY amount DESC, id and LIMIT 8.\n3. Rank customers by what they spent: name, total (SUM of amount), and rnk from RANK() OVER (ORDER BY SUM(s.amount) DESC). Join sales to customers, GROUP BY c.id, ORDER BY rnk.',
    setup: SALES,
    hints: ['SELECT id, sold_on, amount, ROW_NUMBER() OVER (ORDER BY sold_on, id) AS n FROM sales LIMIT 5;', 'RANK() OVER (ORDER BY amount DESC) AS rnk, DENSE_RANK() OVER (ORDER BY amount DESC) AS dense', 'A window can order by an aggregate: RANK() OVER (ORDER BY SUM(s.amount) DESC). The GROUP BY happens first, then the ranking.'],
    solution: { commands: ['SELECT id, sold_on, amount, ROW_NUMBER() OVER (ORDER BY sold_on, id) AS n FROM sales LIMIT 5;', 'SELECT id, amount, RANK() OVER (ORDER BY amount DESC) AS rnk, DENSE_RANK() OVER (ORDER BY amount DESC) AS dense FROM sales ORDER BY amount DESC, id LIMIT 8;', 'SELECT c.name, SUM(s.amount) AS total, RANK() OVER (ORDER BY SUM(s.amount) DESC) AS rnk FROM sales s JOIN customers c ON c.id = s.customer_id GROUP BY c.id ORDER BY rnk;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /ROW_NUMBER\(\)\s*OVER/) && sets.some((s) => flat(s) === '1:2026-01-02:29:1|2:2026-01-05:49:2|3:2026-01-11:24:3|4:2026-01-13:49:4|5:2026-01-21:4.5:5'), 'Step 1: ROW_NUMBER() OVER (ORDER BY sold_on, id) AS n, LIMIT 5. Sale 1 on 2026-01-02 gets n 1.'],
        [sqlHas(r, /DENSE_RANK\(\)\s*OVER/) && sets.some((s) => flat(s) === '30:237:1:1|43:158:2:2|10:79:3:3|12:79:3:3|24:79:3:3|25:79:3:3|21:72:7:4|8:58:8:5'), 'Step 2: id, amount, rnk, dense ordered by amount DESC, id, LIMIT 8. The four 79s share rank 3, then RANK jumps to 7 while DENSE_RANK goes to 4.'],
        [sqlHas(r, /RANK\(\)\s*OVER\s*\(\s*ORDER\s+BY\s+SUM/) && sets.some((s) => flat(s) === 'Grace Kim:473:1|Ben Okafor:396:2|Emma Novak:212.5:3|Hugo Silva:192:4|Chloe Martin:185:5|Dev Patel:161.5:6|Ana Costa:96:7|Farid Aziz:52.5:8'), 'Step 3: name, total, rnk with RANK() OVER (ORDER BY SUM(s.amount) DESC). Grace Kim 473 is rank 1, Farid Aziz 52.5 is rank 8.'],
      ], 'Every row kept, every row numbered. Window Shopper badge earned.')
    },
  },
  quiz: [
    { question: 'What makes a function a window function?', options: ['It is written in capitals', 'It is followed by OVER (...)', 'It needs GROUP BY'], answer: 1, explanation: 'OVER defines the window of rows the function looks at.' },
    { question: 'Amounts are 50, 40, 40, 30. What does RANK give the 30?', options: ['3', '4', '2'], answer: 1, explanation: 'RANK skips after a tie: 1, 2, 2, 4. DENSE_RANK would give 3.' },
    { question: 'How does ROW_NUMBER differ from GROUP BY?', options: ['It keeps every row', 'It removes duplicates', 'It only works on numbers'], answer: 0, explanation: 'Window functions add a column to each row instead of collapsing rows.' },
  ],
}

export default lesson
