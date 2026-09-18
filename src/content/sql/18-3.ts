import type { Lesson } from '../types'
import { SALES } from './sales'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w18d3',
  tier: 2,
  track: 'sql',
  week: 18,
  day: 3,
  title: 'Running totals and frame clauses',
  concept: `Aggregates like SUM and AVG can be window functions too. SUM(amount) OVER (ORDER BY sold_on) does not add up everything: with an ORDER BY, the window for each row is the rows from the start up to that row. That is a running total, with each row's own amount next to it.

The exact set of rows is the frame. The default with ORDER BY is "from the first row to the current row". You can say it yourself, or change it, with ROWS BETWEEN: ROWS BETWEEN 2 PRECEDING AND CURRENT ROW means this row and the two before it. AVG over that frame is a three-row moving average, which smooths spiky numbers.

Add PARTITION BY and the running total restarts in each group, such as each month.`,
  example: {
    language: 'sql',
    caption: 'Running total and a moving average',
    code: `SELECT sold_on, amount,
       SUM(amount) OVER (ORDER BY sold_on, id) AS running
FROM sales;

SELECT sold_on, revenue,
       AVG(revenue) OVER (
         ORDER BY sold_on
         ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS avg3
FROM daily;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement.\n1. Running total of January sales: sold_on, amount, and running from SUM(amount) OVER (ORDER BY sold_on, id), WHERE sold_on < \'2026-02-01\', ORDER BY sold_on, id.\n2. The same for January and February (sold_on < \'2026-03-01\') but restarting each month: add a first column month (substr(sold_on, 1, 7)) and PARTITION BY substr(sold_on, 1, 7) in the window. Columns: month, sold_on, amount, running.\n3. Three-day moving average: a CTE named daily with sold_on and revenue (SUM of amount per sold_on), then sold_on, revenue, and avg3 = ROUND(AVG(revenue) OVER (ORDER BY sold_on ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2). ORDER BY sold_on LIMIT 6.',
    setup: SALES,
    hints: ['SUM(amount) OVER (ORDER BY sold_on, id) AS running', 'SUM(amount) OVER (PARTITION BY substr(sold_on, 1, 7) ORDER BY sold_on, id) AS running', 'WITH daily AS (SELECT sold_on, SUM(amount) AS revenue FROM sales GROUP BY sold_on) SELECT sold_on, revenue, ROUND(AVG(revenue) OVER (ORDER BY sold_on ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS avg3 FROM daily ORDER BY sold_on LIMIT 6;'],
    solution: { commands: ["SELECT sold_on, amount, SUM(amount) OVER (ORDER BY sold_on, id) AS running FROM sales WHERE sold_on < '2026-02-01' ORDER BY sold_on, id;", "SELECT substr(sold_on, 1, 7) AS month, sold_on, amount, SUM(amount) OVER (PARTITION BY substr(sold_on, 1, 7) ORDER BY sold_on, id) AS running FROM sales WHERE sold_on < '2026-03-01' ORDER BY sold_on, id;", 'WITH daily AS (SELECT sold_on, SUM(amount) AS revenue FROM sales GROUP BY sold_on) SELECT sold_on, revenue, ROUND(AVG(revenue) OVER (ORDER BY sold_on ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS avg3 FROM daily ORDER BY sold_on LIMIT 6;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /SUM\(amount\)\s*OVER\s*\(\s*ORDER\s+BY/) && sets.some((s) => flat(s) === '2026-01-02:29:29|2026-01-05:49:78|2026-01-11:24:102|2026-01-13:49:151|2026-01-21:4.5:155.5'), 'Step 1: January running total: 29, 78, 102, 151, 155.5.'],
        [sqlHas(r, /SUM\(amount\)\s*OVER\s*\(\s*PARTITION\s+BY\s+substr/) && sets.some((s) => flat(s) === '2026-01:2026-01-02:29:29|2026-01:2026-01-05:49:78|2026-01:2026-01-11:24:102|2026-01:2026-01-13:49:151|2026-01:2026-01-21:4.5:155.5|2026-02:2026-02-02:4.5:4.5|2026-02:2026-02-19:30:34.5|2026-02:2026-02-21:58:92.5|2026-02:2026-02-24:9:101.5|2026-02:2026-02-26:79:180.5|2026-02:2026-02-28:9:189.5'), 'Step 2: month, sold_on, amount, running with PARTITION BY substr(sold_on, 1, 7). February should restart at 4.5 and end at 189.5.'],
        [sqlHas(r, /ROWS\s+BETWEEN\s+2\s+PRECEDING\s+AND\s+CURRENT\s+ROW/) && sets.some((s) => flat(s) === '2026-01-02:29:29|2026-01-05:49:39|2026-01-11:24:34|2026-01-13:49:40.67|2026-01-21:4.5:25.83|2026-02-02:4.5:19.33'), 'Step 3: daily CTE, then avg3 with ROWS BETWEEN 2 PRECEDING AND CURRENT ROW, rounded to 2: 29, 39, 34, 40.67, 25.83, 19.33.'],
      ], 'Running totals and smooth averages, all in one pass.')
    },
  },
  quiz: [
    { question: 'What does SUM(amount) OVER (ORDER BY sold_on) compute?', options: ['The grand total on every row', 'A running total up to each row', 'The amount of the first row'], answer: 1, explanation: 'With ORDER BY, the default frame runs from the first row to the current one.' },
    { question: 'Which frame gives a 3-row moving average?', options: ['ROWS BETWEEN 2 PRECEDING AND CURRENT ROW', 'ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING', 'ROWS 3'], answer: 0, explanation: 'Two rows before plus the current row makes three.' },
    { question: 'How do you restart a running total every month?', options: ['Add LIMIT', 'Add PARTITION BY month to the window', 'Use GROUP BY month'], answer: 1, explanation: 'PARTITION BY makes the sum start again in each month while keeping every row.' },
  ],
}

export default lesson
