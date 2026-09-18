import type { Lesson } from '../types'
import { SALES_SCRIPT } from './sales'

const TOP3 = `WITH monthly AS (
  SELECT substr(sold_on, 1, 7) AS month, product_id,
         SUM(amount) AS revenue
  FROM sales
  GROUP BY month, product_id
),
ranked AS (
  SELECT month, product_id, revenue,
         ROW_NUMBER() OVER (
           PARTITION BY month ORDER BY revenue DESC
         ) AS n
  FROM monthly
)
SELECT r.month, p.name, r.revenue
FROM ranked r
JOIN products p ON p.id = r.product_id
WHERE r.n <= 3
ORDER BY r.month, r.n;`

const RUNNING = `SELECT sold_on,
       SUM(amount) AS revenue,
       SUM(SUM(amount)) OVER (ORDER BY sold_on) AS running_total
FROM sales
GROUP BY sold_on
ORDER BY sold_on;`

const MOM = `WITH monthly AS (
  SELECT substr(sold_on, 1, 7) AS month,
         SUM(amount) AS revenue
  FROM sales
  GROUP BY month
)
SELECT month, revenue,
       revenue - LAG(revenue) OVER (ORDER BY month) AS change
FROM monthly
ORDER BY month;`

const lesson: Lesson = {
  id: 'w18d5',
  tier: 2,
  track: 'sql',
  week: 18,
  day: 5,
  title: 'Project: sales.db analytics',
  concept: `The shop you have been querying all week becomes a real file today: sales.db in the VM, built with the sqlite3 tool from week 15. The same file comes back in week 24 for views and week 27 for tuning, so keep it.

Then three reports that analysts write every week. Top three products per month is PARTITION BY plus ROW_NUMBER inside a CTE. A running total of revenue by day is SUM OVER with ORDER BY; grouping by day first means summing a sum, which is fine because window functions run after GROUP BY. Month-over-month change is LAG.

Use -header -column so the output has a header row. Each pasted result is checked for that header and a few lines, nothing more.`,
  example: {
    language: 'bash',
    caption: 'A query file keeps long SQL out of the shell line',
    code: `cat > top3.sql <<'EOF'
SELECT ...
EOF
sqlite3 -header -column sales.db < top3.sql`,
  },
  task: {
    kind: 'real',
    intro: `Inside the VM (multipass shell stackcraft), you will create sales.db from the provided script and run three analytics queries against it with the sqlite3 tool.

Each query is given in full below in case you get stuck, but try writing it yourself first: they are exactly what you did on days 2, 3, and 4, with column names you already know.

Keep sales.db in your home folder. Weeks 24 and 27 add views and indexes to this same file.`,
    steps: [
      {
        instruction: 'Create sales.db from the provided script, then count the rows in sales. The script is the same data you used in the app all week.',
        command: `cd ~\nsqlite3 sales.db <<'EOF'\n${SALES_SCRIPT}EOF\nsqlite3 sales.db "SELECT COUNT(*) FROM sales;"`,
        pasteLabel: 'Paste the output of the COUNT query',
        check: [{ type: 'regex', pattern: '^\\s*45\\s*$', flags: 'm', label: 'a line with the number 45' }],
        hint: 'You should see exactly 45. An error about a table already existing means the script ran twice: rm sales.db and run it once. Make sure the closing EOF line was pasted too.',
        example: '45',
      },
      {
        instruction: 'Query 1: top 3 products per month by revenue. Group sales by month and product in a CTE, number them per month with ROW_NUMBER() OVER (PARTITION BY month ORDER BY revenue DESC) in a second CTE, and keep n <= 3. Columns: month, name, revenue. Run it with -header -column.',
        command: `sqlite3 -header -column sales.db "\n${TOP3}\n"`,
        pasteLabel: 'Paste the top 3 products per month output',
        check: [
          { type: 'regex', pattern: '^\\s*month\\b', flags: 'mi', label: 'a header row starting with month' },
          { type: 'regex', pattern: '2026-0[1-6]', label: 'month values like 2026-01' },
          { type: 'lines', atLeast: 3 },
        ],
        hint: 'No header row? Add -header before -column. If you see only one row per month, check the WHERE: it should be n <= 3, and the ROW_NUMBER must be PARTITION BY month.',
        example: `month    name          revenue
-------  ------------  -------
2026-01  Backpack      98.0
2026-01  Desk lamp     29.0
2026-01  Pen set       24.0
2026-02  Headphones    79.0
2026-02  Desk lamp     58.0
2026-02  Water bottle  30.0
2026-03  Headphones    79.0
2026-03  Mouse         72.0
2026-03  Desk lamp     58.0`,
      },
      {
        instruction: 'Query 2: running total of revenue by day. GROUP BY sold_on for the daily revenue, then SUM(SUM(amount)) OVER (ORDER BY sold_on) for the running total. Columns: sold_on, revenue, running_total.',
        command: `sqlite3 -header -column sales.db "\n${RUNNING}\n"`,
        pasteLabel: 'Paste the running total output',
        check: [
          { type: 'regex', pattern: '^\\s*sold_on\\b', flags: 'mi', label: 'a header row starting with sold_on' },
          { type: 'regex', pattern: '\\d{4}-\\d{2}-\\d{2}', label: 'dates like 2026-01-02' },
          { type: 'lines', atLeast: 3 },
        ],
        hint: 'SUM(SUM(amount)) looks odd but is right: the inner SUM is the GROUP BY aggregate, the outer one is the window over those daily sums. Remember -header.',
        example: `sold_on     revenue  running_total
----------  -------  -------------
2026-01-02  29.0     29.0
2026-01-05  49.0     78.0
2026-01-11  24.0     102.0
2026-01-13  49.0     151.0
2026-01-21  4.5      155.5
2026-02-02  4.5      160.0`,
      },
      {
        instruction: 'Query 3: month-over-month change. A monthly CTE, then revenue - LAG(revenue) OVER (ORDER BY month) AS change. Columns: month, revenue, change. One month should show a negative change.',
        command: `sqlite3 -header -column sales.db "\n${MOM}\n"`,
        pasteLabel: 'Paste the month-over-month output',
        check: [
          { type: 'regex', pattern: '^\\s*month\\b', flags: 'mi', label: 'a header row starting with month' },
          { type: 'lines', atLeast: 3 },
          { type: 'any', of: [{ type: 'regex', pattern: '-\\d+(\\.\\d+)?' }, { type: 'regex', pattern: '\\+\\d+(\\.\\d+)?' }], label: 'a signed change value such as -113.0' },
        ],
        hint: 'The change column must be revenue minus LAG(revenue), not LAG on its own. With this data June drops from 435.5 to 322.5, so a -113.0 should appear. The first month shows an empty change because there is no previous month.',
        example: `month    revenue  change
-------  -------  ------
2026-01  155.5
2026-02  189.5    34.0
2026-03  297.0    107.5
2026-04  368.5    71.5
2026-05  435.5    67.0
2026-06  322.5    -113.0`,
      },
    ],
  },
  quiz: [
    { question: 'Why is SUM(SUM(amount)) OVER (...) valid?', options: ['SQLite ignores the outer SUM', 'GROUP BY runs first, then the window sums the group results', 'It is a typo that happens to work'], answer: 1, explanation: 'Window functions run after grouping, so they can aggregate the aggregates.' },
    { question: 'What does -header do for sqlite3?', options: ['Prints column names above the rows', 'Shows the schema', 'Sorts the output'], answer: 0, explanation: 'Without it the tool prints bare rows, which is fine for scripts but hard to read.' },
    { question: 'Which pair gives top 3 per month?', options: ['GROUP BY month LIMIT 3', 'ROW_NUMBER with PARTITION BY month, then n <= 3', 'ORDER BY revenue DESC LIMIT 3'], answer: 1, explanation: 'LIMIT cuts the whole result. Numbering inside each month and filtering keeps three per month.' },
  ],
}

export default lesson
