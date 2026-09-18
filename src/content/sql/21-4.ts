import type { Lesson } from '../types'
import { hasObject, sqlFailed, sqlHas, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w21d4',
  tier: 2,
  track: 'sql',
  week: 21,
  day: 4,
  title: 'Naming, types, NOT NULL, defaults',
  concept: `Good tables are boring to read. Names: lowercase snake_case, tables plural (tasks), foreign keys ending in _id, dates ending in _at or _on. Avoid renaming later; other code will depend on the names.

Types: INTEGER for counts and ids, REAL for measurements, TEXT for names and dates (SQLite stores dates as ISO text like 2026-09-18), INTEGER 0 or 1 for booleans.

NOT NULL on every column that must have a value. NULL means unknown, and unknown spreads through sums and comparisons. DEFAULT fills a sensible value when the insert leaves it out, and CHECK rejects nonsense like priority 9.

Denormalizing, storing a computed value like an order total, is fine when reads vastly outnumber writes and you update it in one place.`,
  example: {
    language: 'sql',
    caption: 'A table that defends itself',
    code: `CREATE TABLE tasks (
  id         INTEGER PRIMARY KEY,
  title      TEXT    NOT NULL,
  priority   INTEGER NOT NULL DEFAULT 3
             CHECK (priority BETWEEN 1 AND 5),
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tasks (title) VALUES ('Write the schema');
-- priority 3, done 0, created_at now`,
  },
  task: {
    kind: 'sql',
    instructions: 'The console starts empty. Run each step as its own statement.\n1. Create the tasks table exactly as in the example: id, title NOT NULL, priority NOT NULL DEFAULT 3 with a CHECK between 1 and 5, done NOT NULL DEFAULT 0, created_at NOT NULL DEFAULT CURRENT_TIMESTAMP.\n2. Insert a task giving only the title \'Write the schema\'.\n3. Insert \'Fix the bug\' with priority 1.\n4. Try to insert a task with only a priority and no title. It must fail.\n5. Try to insert \'Nope\' with priority 9. It must fail too.\n6. Select id, title, priority, and done from tasks ORDER BY id and see the defaults filled in.',
    hints: ['CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);', "INSERT INTO tasks (title) VALUES ('Write the schema'); then INSERT INTO tasks (title, priority) VALUES ('Fix the bug', 1);", 'The failing inserts are the point: INSERT INTO tasks (priority) VALUES (2); answers NOT NULL constraint failed, and priority 9 answers CHECK constraint failed.'],
    solution: { commands: ['CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);', "INSERT INTO tasks (title) VALUES ('Write the schema');", "INSERT INTO tasks (title, priority) VALUES ('Fix the bug', 1);", 'INSERT INTO tasks (priority) VALUES (2);', "INSERT INTO tasks (title, priority) VALUES ('Nope', 9);", 'SELECT id, title, priority, done FROM tasks ORDER BY id;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      const schema = r.schema?.tasks ?? ''
      const rows = tableRows(r, 'tasks')
      return steps([
        [hasObject(r, 'tasks') && /title\s+TEXT\s+NOT\s+NULL/i.test(schema) && /DEFAULT\s+3/i.test(schema) && /CHECK\s*\(\s*priority\s+BETWEEN\s+1\s+AND\s+5\s*\)/i.test(schema) && /done\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i.test(schema) && /DEFAULT\s+CURRENT_TIMESTAMP/i.test(schema), 'Step 1: CREATE TABLE tasks with NOT NULL on title, DEFAULT 3 and CHECK (priority BETWEEN 1 AND 5) on priority, DEFAULT 0 on done, and DEFAULT CURRENT_TIMESTAMP on created_at.'],
        [rows.some((t) => t.title === 'Write the schema' && t.priority === 3 && t.done === 0 && typeof t.created_at === 'string' && t.created_at.length >= 19), "Step 2: INSERT INTO tasks (title) VALUES ('Write the schema'); and let the defaults fill priority, done, and created_at."],
        [rows.some((t) => t.title === 'Fix the bug' && t.priority === 1), "Step 3: INSERT INTO tasks (title, priority) VALUES ('Fix the bug', 1);"],
        [sqlFailed(r, /INSERT\s+INTO\s+tasks\s*\(\s*priority\s*\)/, /NOT NULL constraint failed/), 'Step 4: INSERT INTO tasks (priority) VALUES (2); must fail with NOT NULL constraint failed.'],
        [sqlFailed(r, /INSERT\s+INTO\s+tasks[\s\S]*\b9\b/, /CHECK constraint failed/), "Step 5: INSERT INTO tasks (title, priority) VALUES ('Nope', 9); must fail with CHECK constraint failed."],
        [rows.length === 2 && sqlHas(r, /SELECT\s+id\s*,\s*title\s*,\s*priority\s*,\s*done\s+FROM\s+tasks/) && sets.some((s) => flat(s) === '1:Write the schema:3:0|2:Fix the bug:1:0'), 'Step 6: SELECT id, title, priority, done FROM tasks ORDER BY id; should show exactly two rows: Write the schema 3 0 and Fix the bug 1 0.'],
      ], 'The table now refuses bad data so your code does not have to.')
    },
  },
  quiz: [
    { question: 'Why put NOT NULL on most columns?', options: ['It makes queries faster', 'NULL means unknown and spreads through sums and comparisons', 'SQLite requires it'], answer: 1, explanation: 'A column that must have a value should say so, and the database will enforce it.' },
    { question: 'Which name follows the conventions?', options: ['CreatedDate', 'created_at', 'created date'], answer: 1, explanation: 'Lowercase snake_case, with a suffix that says it is a timestamp.' },
    { question: 'When is storing a computed total in a table acceptable?', options: ['Never', 'When reads far outnumber writes and one place updates it', 'Only for text'], answer: 1, explanation: 'Denormalizing trades some risk of drift for speed. Do it on purpose, not by accident.' },
  ],
}

export default lesson
