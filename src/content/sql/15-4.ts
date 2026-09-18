import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w15d4',
  tier: 2,
  track: 'sql',
  week: 15,
  day: 4,
  title: 'CTEs vs subqueries vs views',
  concept: `You now have three ways to name a piece of a query. They do the same work, so choose by who reads it and how often.

A subquery is inline. Fine for one small piece: WHERE price > (SELECT AVG(price) ...).

A CTE lives for one statement. Best when a query has several steps, or when a piece would be repeated.

A view is a saved query: CREATE VIEW monthly_revenue AS SELECT ... Then anyone can SELECT FROM monthly_revenue, in any statement, tomorrow too. Views are stored in the schema, so they need a name that will still make sense next year. A view holds no data of its own; each SELECT reruns the query.

Rule of thumb: subquery for tiny, CTE for this query, view for every query.`,
  example: {
    language: 'sql',
    caption: 'Save it once, use it everywhere',
    code: `CREATE VIEW monthly_revenue AS
SELECT substr(sold_on, 1, 7) AS month,
       SUM(amount) AS revenue
FROM sales
GROUP BY month;

SELECT * FROM monthly_revenue;

DROP VIEW monthly_revenue;   -- when it is no longer wanted`,
  },
  task: {
    kind: 'sql',
    instructions: 'Same sales database. Run each step as its own statement.\n1. Create a view named monthly_revenue with month (substr(sold_on, 1, 7)) and revenue (SUM of amount), grouped by month.\n2. Use the view: select month and revenue for the single best month (ORDER BY revenue DESC LIMIT 1).\n3. Combine the view with a subquery: select month and revenue from monthly_revenue where revenue is above the average revenue from the same view, sorted by month.',
    setup: SALES,
    hints: ['CREATE VIEW monthly_revenue AS SELECT substr(sold_on, 1, 7) AS month, SUM(amount) AS revenue FROM sales GROUP BY month;', 'A view is used exactly like a table: SELECT month, revenue FROM monthly_revenue ORDER BY revenue DESC LIMIT 1;', 'WHERE revenue > (SELECT AVG(revenue) FROM monthly_revenue) ORDER BY month'],
    solution: { commands: ['CREATE VIEW monthly_revenue AS SELECT substr(sold_on, 1, 7) AS month, SUM(amount) AS revenue FROM sales GROUP BY month;', 'SELECT month, revenue FROM monthly_revenue ORDER BY revenue DESC LIMIT 1;', 'SELECT month, revenue FROM monthly_revenue WHERE revenue > (SELECT AVG(revenue) FROM monthly_revenue) ORDER BY month;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [hasObject(r, 'monthly_revenue') && /CREATE\s+VIEW/i.test(r.schema?.monthly_revenue ?? ''), 'Step 1: CREATE VIEW monthly_revenue AS SELECT substr(sold_on, 1, 7) AS month, SUM(amount) AS revenue FROM sales GROUP BY month;'],
        [sqlHas(r, /FROM\s+monthly_revenue[\s\S]*LIMIT\s+1/) && sets.some((s) => flat(s) === '2026-05:435.5'), 'Step 2: the best month from the view is 2026-05 with 435.5. ORDER BY revenue DESC LIMIT 1.'],
        [sqlHas(r, /FROM\s+monthly_revenue\s+WHERE[\s\S]*\(\s*SELECT\s+AVG\(revenue\)\s+FROM\s+monthly_revenue\s*\)/) && sets.some((s) => flat(s) === '2026-03:297|2026-04:368.5|2026-05:435.5|2026-06:322.5'), 'Step 3: months above the average, using (SELECT AVG(revenue) FROM monthly_revenue): 2026-03 to 2026-06.'],
      ], 'Three tools, and now you know which one to reach for.')
    },
  },
  quiz: [
    { question: 'Which one survives after the statement finishes?', options: ['A CTE', 'A subquery', 'A view'], answer: 2, explanation: 'Views are saved in the schema. CTEs and subqueries exist only inside their statement.' },
    { question: 'Does a view store a copy of the data?', options: ['Yes, it is refreshed on COMMIT', 'No, each SELECT reruns the saved query', 'Only if it has an index'], answer: 1, explanation: 'A normal view is a saved query, so it always shows current data.' },
    { question: 'A five-step report is used in one Python script. Which fits best?', options: ['Chained CTEs in that one statement', 'Five nested subqueries', 'Five views'], answer: 0, explanation: 'Several named steps in one statement read best, and nothing needs to be saved in the schema.' },
  ],
}

export default lesson
