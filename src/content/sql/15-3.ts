import type { Lesson } from '../types'
import { ORG } from './org'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w15d3',
  tier: 2,
  track: 'sql',
  week: 15,
  day: 3,
  title: 'Recursive CTEs',
  concept: `Some data points at itself. An employee has a manager who is also an employee. A folder holds folders. A plain JOIN can only go one level deep, and you do not know how deep the tree is.

A recursive CTE loops for you. WITH RECURSIVE tree AS (anchor UNION ALL step) SELECT ... The anchor picks the starting rows, like the boss with no manager. The step joins the table to tree, so each round adds the people who report to the previous round. It stops when a round adds nothing.

Track depth by selecting 0 in the anchor and depth + 1 in the step.

The same trick makes a number sequence: start at 1, add 1 while n < 10. Handy for filling in missing dates.`,
  example: {
    language: 'sql',
    caption: 'Anchor, then step, until nothing new appears',
    code: `WITH RECURSIVE tree AS (
  SELECT id, name, 0 AS depth
  FROM employees
  WHERE manager_id IS NULL          -- anchor: the boss
  UNION ALL
  SELECT e.id, e.name, t.depth + 1
  FROM employees e
  JOIN tree t ON e.manager_id = t.id  -- step: their reports
)
SELECT depth, name FROM tree ORDER BY depth, name;`,
  },
  task: {
    kind: 'sql',
    instructions: 'The database has one table, employees (id, name, title, manager_id, salary). The CEO has manager_id NULL. Run each step as its own statement.\n1. Warm up: a recursive CTE named nums(n) that starts at 1 and adds 1 while n < 10. Select n from it.\n2. A recursive CTE named tree that starts from the employee with no manager at depth 0 and adds each person\'s reports at depth + 1. Select depth, name, and title, ordered by depth then name.\n3. Everyone under Luis Ortega (id 2): a recursive CTE named reports that starts from id 2 and follows manager_id downward. Select just the names, without Luis himself, sorted by name.',
    setup: ORG,
    hints: ['WITH RECURSIVE nums(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM nums WHERE n < 10) SELECT n FROM nums;', 'The anchor is SELECT id, name, title, 0 AS depth FROM employees WHERE manager_id IS NULL. The step joins employees e to tree t ON e.manager_id = t.id and selects t.depth + 1.', 'For step 3 the anchor is WHERE id = 2. Keep id and manager_id in the CTE so the step can join. Filter with WHERE id <> 2 in the final SELECT.'],
    solution: { commands: ['WITH RECURSIVE nums(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM nums WHERE n < 10) SELECT n FROM nums;', 'WITH RECURSIVE tree AS (SELECT id, name, title, 0 AS depth FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, e.title, t.depth + 1 FROM employees e JOIN tree t ON e.manager_id = t.id) SELECT depth, name, title FROM tree ORDER BY depth, name;', 'WITH RECURSIVE reports AS (SELECT id, name, manager_id FROM employees WHERE id = 2 UNION ALL SELECT e.id, e.name, e.manager_id FROM employees e JOIN reports r ON e.manager_id = r.id) SELECT name FROM reports WHERE id <> 2 ORDER BY name;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /WITH\s+RECURSIVE\s+nums/) && sets.some((s) => flat(s) === '1|2|3|4|5|6|7|8|9|10'), 'Step 1: WITH RECURSIVE nums(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM nums WHERE n < 10) should list 1 to 10.'],
        [sqlHas(r, /WITH\s+RECURSIVE\s+tree/) && sets.some((s) => flat(s) === '0:Maya Chen:CEO|1:Luis Ortega:CTO|1:Priya Nair:CFO|2:Ella Fischer:Accountant|2:Sara Lund:Ops lead|2:Tom Baker:Engineering manager|3:Ken Adachi:Engineer|3:Nina Rossi:Engineer|3:Omar Haddad:SRE|4:Jake Moore:Intern'), 'Step 2: tree with depth, name, title ordered by depth then name: Maya Chen at 0, Luis Ortega and Priya Nair at 1, down to Jake Moore at 4.'],
        [sqlHas(r, /WITH\s+RECURSIVE\s+reports/) && sets.some((s) => flat(s) === 'Jake Moore|Ken Adachi|Nina Rossi|Omar Haddad|Sara Lund|Tom Baker'), 'Step 3: reports starting from id 2, names without Luis, sorted: Jake Moore, Ken Adachi, Nina Rossi, Omar Haddad, Sara Lund, Tom Baker.'],
      ], 'You walked the whole tree without knowing its height.')
    },
  },
  quiz: [
    { question: 'What does the anchor part of a recursive CTE do?', options: ['Picks the starting rows', 'Stops the loop', 'Sorts the result'], answer: 0, explanation: 'The anchor runs once. The step part then repeats, feeding on the previous round.' },
    { question: 'When does the recursion stop?', options: ['After 100 rounds', 'When a round produces no new rows', 'When you write LIMIT'], answer: 1, explanation: 'Each round joins to the last round. Once nothing matches, the loop ends.' },
    { question: 'How do you know how deep each row is?', options: ['SQLite adds a depth column', 'Select 0 in the anchor and depth + 1 in the step', 'Use COUNT(*)'], answer: 1, explanation: 'You carry the depth along yourself, adding one per round.' },
  ],
}

export default lesson
