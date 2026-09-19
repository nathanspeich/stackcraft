import type { Lesson } from '../types'

const FILL_SCRIPT = `import random
import sqlite3
from datetime import date, timedelta

TOTAL = 1_000_000
BATCH = 50_000
random.seed(27)

con = sqlite3.connect("sales.db")
con.execute("PRAGMA synchronous = OFF")
prices = dict(con.execute("SELECT id, price FROM products"))
product_ids = list(prices)
customer_ids = [row[0] for row in con.execute("SELECT id FROM customers")]
start = date(2026, 1, 1)


def batch(n):
    for _ in range(n):
        product = random.choice(product_ids)
        qty = random.randint(1, 3)
        sold_on = (start + timedelta(days=random.randrange(365))).isoformat()
        yield (random.choice(customer_ids), product, sold_on, qty,
               round(qty * prices[product], 2))


done = 0
with con:
    while done < TOTAL:
        n = min(BATCH, TOTAL - done)
        con.executemany(
            "INSERT INTO sales (customer_id, product_id, sold_on, qty, amount)"
            " VALUES (?, ?, ?, ?, ?)",
            batch(n),
        )
        done += n
        print(f"{done:,} rows inserted", flush=True)

total = con.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
print("total rows:", total)
con.close()`

const lesson: Lesson = {
  id: 'w27d5',
  tier: 2,
  track: 'sql',
  week: 27,
  day: 5,
  title: 'Project: one million rows and the right index',
  concept: `Tuning is a measurement loop: time it, change one thing, time it again. Guessing which index to add is how databases end up with ten useless ones. So this project starts by making sales.db big enough that a bad plan actually hurts.

A Python script inserts one million sales in batches inside one transaction. Then sqlite3's .timer on prints how long each statement took as a Run Time line. You will run one query for a single day, read its plan (SCAN, every row), add an index on sold_on, and run the exact same query again (SEARCH, a few thousand rows).

The before and after numbers are the proof. Keep the habit: EXPLAIN QUERY PLAN first, then the index, then the timer.`,
  example: {
    language: 'text',
    caption: 'What .timer on looks like in sqlite3',
    code: `sqlite> .timer on
sqlite> SELECT COUNT(*) FROM sales WHERE sold_on = '2026-03-14';
2749
Run Time: real 0.152 user 0.147312 sys 0.004201
sqlite> CREATE INDEX idx_sales_date ON sales(sold_on);
Run Time: real 1.803 user 1.612095 sys 0.089443
sqlite> SELECT COUNT(*) FROM sales WHERE sold_on = '2026-03-14';
2749
Run Time: real 0.001 user 0.000611 sys 0.000104`,
  },
  task: {
    kind: 'real',
    intro: `This project runs inside the VM (multipass shell stackcraft), in the folder where sales.db lives (the one you added views to in week 24). If sales.db is missing, redo the first command block of week 24 day 5 to rebuild it.

You will fill sales with one million rows using the provided fill_sales.py, time a query for a single day, add an index on sold_on, and time the same query again. Keep the Run Time lines from both runs: the last step asks for them.

The app never touches your VM. It only reads what you paste.`,
    steps: [
      {
        instruction: 'Save the fill script and run it. It inserts a million sales in 20 batches and takes a while, usually under a minute. Paste the last line it prints, the total row count.',
        command: `cat > fill_sales.py <<'EOF'
${FILL_SCRIPT}
EOF
python3 fill_sales.py`,
        pasteLabel: 'Paste the "total rows:" line',
        check: [{ type: 'regex', pattern: 'total rows:\\s*1[\\d,]{6,}', label: 'a "total rows:" line with a number of at least one million' }],
        hint: 'The last line should read total rows: 1000045 (more if you added sales in week 24). If Python complains about sales.db or a missing table, you are in the wrong folder or sales.db was not rebuilt: cd to where it lives, or redo the rebuild block from week 24 day 5. If you ran the script twice you have two million rows, which is fine.',
        example: `950,000 rows inserted
1,000,000 rows inserted
total rows: 1000045`,
      },
      {
        instruction: 'Open the database, turn the timer on, ask for the plan, then run the query for real. Paste everything from the plan down to the second Run Time line. Note the Run Time of the query itself: you will need it again in the last step.\n\nIf the plan already says SEARCH, an index on sold_on exists from earlier play. Run DROP INDEX with its name and try again.',
        command: `sqlite3 sales.db
.timer on
EXPLAIN QUERY PLAN SELECT COUNT(*), ROUND(SUM(amount), 2) FROM sales WHERE sold_on = '2026-03-14';
SELECT COUNT(*), ROUND(SUM(amount), 2) FROM sales WHERE sold_on = '2026-03-14';`,
        pasteLabel: 'Paste the plan and the timed query output (before the index)',
        check: [{ type: 'includes', text: 'SCAN' }],
        hint: 'The plan line should read SCAN sales. If it says SEARCH, list your indexes with .indexes sales and DROP INDEX the one on sold_on, then rerun. Make sure .timer on was typed inside sqlite3, not in bash.',
        example: `QUERY PLAN
\`--SCAN sales
Run Time: real 0.000 user 0.000086 sys 0.000012
2749|84391.5
Run Time: real 0.164 user 0.158274 sys 0.005301`,
      },
      {
        instruction: 'Still inside sqlite3, create the index on sold_on, then ask for the plan and run the same query again. Paste from the plan down to the last Run Time line.',
        command: `CREATE INDEX idx_sales_date ON sales(sold_on);
EXPLAIN QUERY PLAN SELECT COUNT(*), ROUND(SUM(amount), 2) FROM sales WHERE sold_on = '2026-03-14';
SELECT COUNT(*), ROUND(SUM(amount), 2) FROM sales WHERE sold_on = '2026-03-14';`,
        pasteLabel: 'Paste the plan and the timed query output (after the index)',
        check: [{ type: 'includes', text: 'SEARCH', all: ['USING INDEX'] }],
        hint: 'The plan should now read SEARCH sales USING INDEX idx_sales_date (sold_on=?). If it still says SCAN, the CREATE INDEX did not run (check for an error above it) or you filtered on a different column than the index.',
        example: `QUERY PLAN
\`--SEARCH sales USING INDEX idx_sales_date (sold_on=?)
Run Time: real 0.000 user 0.000091 sys 0.000010
2749|84391.5
Run Time: real 0.002 user 0.001604 sys 0.000201`,
      },
      {
        instruction: 'Paste the two Run Time lines for the query itself, before and after the index, one per line. The first should be tens or hundreds of milliseconds, the second a few milliseconds. Then type .quit to leave sqlite3.',
        pasteLabel: 'Paste both Run Time lines (before and after)',
        check: [{ type: 'regex', pattern: 'Run Time', count: 2, label: 'two Run Time lines' }],
        hint: 'You need the Run Time line that follows the query result in step 2 and the one from step 3. If you lost the first one, DROP INDEX idx_sales_date, run the query again for the before number, then recreate the index.',
        example: `Run Time: real 0.164 user 0.158274 sys 0.005301
Run Time: real 0.002 user 0.001604 sys 0.000201`,
      },
    ],
  },
  quiz: [
    { question: 'Why fill the table with a million rows before tuning?', options: ['Indexes only work on big tables', 'With few rows every plan is fast, so you cannot measure the difference', 'sqlite3 requires it'], answer: 1, explanation: 'A bad plan on 45 rows is still instant. You need enough data for the scan to cost something.' },
    { question: 'What does .timer on do in sqlite3?', options: ['Limits each query to one second', 'Prints how long each statement took', 'Schedules queries'], answer: 1, explanation: 'It prints a Run Time line after every statement, which is how you compare before and after.' },
    { question: 'The query went from 0.16 s to 0.002 s after CREATE INDEX. What changed in the plan?', options: ['SCAN sales became SEARCH sales USING INDEX', 'The table got smaller', 'SQLite cached the answer'], answer: 0, explanation: 'The index let SQLite jump to the matching day instead of reading a million rows.' },
  ],
}

export default lesson
