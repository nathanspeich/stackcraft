import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastOk, lastRows, sqlHas, steps } from '../checks'

/** A 20,000-row click log: 4,000 sessions, and a kind column that is 'view' 95 percent of the time. */
const CLICKS = SALES + `
CREATE TABLE clicks (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  kind TEXT NOT NULL,
  clicked_at TEXT NOT NULL
);
INSERT INTO clicks (session_id, product_id, kind, clicked_at)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 20000)
SELECT (i * 37) % 4000 + 1, (i * 13) % 8 + 1,
       CASE WHEN i % 20 = 0 THEN 'buy' ELSE 'view' END,
       datetime('2026-06-01', '+' || (i * 97) || ' seconds')
FROM n;
`

const lesson: Lesson = {
  id: 'w27d3',
  tier: 2,
  track: 'sql',
  week: 27,
  day: 3,
  title: 'When indexes hurt, ANALYZE',
  concept: `An index is a second copy of part of the table, kept sorted. Every INSERT, UPDATE, or DELETE has to update it too. Five indexes mean six writes per row. On a log table taking thousands of inserts a minute, that is the difference between keeping up and falling behind.

Indexes also help only when they narrow the search. A kind column that is 'view' for 95 percent of rows narrows almost nothing, and reading 19,000 rows through an index is slower than a straight scan.

ANALYZE measures your real data and stores the results in sqlite_stat1. A stat of "20000 10000" means 20,000 rows, about 10,000 per distinct value: nearly useless. "20000 5" means 5 per value: excellent. The planner reads these numbers, so rerun ANALYZE after big loads.`,
  example: {
    language: 'sql',
    caption: 'Let ANALYZE grade your indexes',
    code: `CREATE INDEX idx_clicks_kind ON clicks(kind);
ANALYZE;
SELECT * FROM sqlite_stat1;
-- clicks | idx_clicks_kind | 20000 10000
-- half the table per value: this index is dead weight

DROP INDEX idx_clicks_kind;
CREATE INDEX idx_clicks_session ON clicks(session_id);
ANALYZE;
SELECT * FROM sqlite_stat1;
-- clicks | idx_clicks_session | 20000 5`,
  },
  task: {
    kind: 'sql',
    instructions: 'The clicks table has 20,000 rows. Run each step as its own statement.\n1. Someone indexed kind: CREATE INDEX idx_clicks_kind ON clicks(kind).\n2. ANALYZE.\n3. SELECT * FROM sqlite_stat1 WHERE idx IS NOT NULL. The stat reads 20000 10000: each value matches half the table.\n4. That index costs every insert and helps nothing. DROP INDEX idx_clicks_kind.\n5. CREATE INDEX idx_clicks_session ON clicks(session_id), the column the app really filters on.\n6. ANALYZE again.\n7. SELECT * FROM sqlite_stat1 WHERE idx IS NOT NULL. Now the stat reads 20000 5.',
    setup: CLICKS,
    hints: [
      'ANALYZE; is a complete statement on its own. Run it after every index change in this task.',
      'SELECT * FROM sqlite_stat1 WHERE idx IS NOT NULL; shows one row per index: table, index, then "rows rows-per-value".',
      'DROP INDEX idx_clicks_kind; then CREATE INDEX idx_clicks_session ON clicks(session_id); then ANALYZE; and the SELECT again.',
    ],
    solution: {
      commands: [
        'CREATE INDEX idx_clicks_kind ON clicks(kind);',
        'ANALYZE;',
        'SELECT * FROM sqlite_stat1 WHERE idx IS NOT NULL;',
        'DROP INDEX idx_clicks_kind;',
        'CREATE INDEX idx_clicks_session ON clicks(session_id);',
        'ANALYZE;',
        'SELECT * FROM sqlite_stat1 WHERE idx IS NOT NULL;',
      ],
    },
    check: (r) => {
      const sets = r.results ?? []
      const statRow = (idx: string, stat: string) => sets.some((s) => s.values.some((v) => v.includes(idx) && v.includes(stat)))
      const analyzes = (r.history ?? []).filter((s) => /^\s*ANALYZE\b/i.test(s)).length
      const last = lastRows(r)
      return steps([
        lastOk(r),
        [sqlHas(r, /CREATE\s+INDEX\s+idx_clicks_kind\s+ON\s+clicks\s*\(\s*kind\s*\)/), 'Step 1: CREATE INDEX idx_clicks_kind ON clicks(kind).'],
        [analyzes >= 1, 'Step 2: run ANALYZE.'],
        [statRow('idx_clicks_kind', '20000 10000'), 'Step 3: SELECT * FROM sqlite_stat1 WHERE idx IS NOT NULL. Expect idx_clicks_kind with stat 20000 10000.'],
        [!hasObject(r, 'idx_clicks_kind') && sqlHas(r, /DROP\s+INDEX\s+idx_clicks_kind/), 'Step 4: DROP INDEX idx_clicks_kind. It narrows nothing and slows every insert.'],
        [hasObject(r, 'idx_clicks_session') && /clicks\s*\(\s*session_id\s*\)/i.test(r.schema?.idx_clicks_session ?? ''), 'Step 5: CREATE INDEX idx_clicks_session ON clicks(session_id).'],
        [analyzes >= 2, 'Step 6: run ANALYZE again so the stats cover the new index.'],
        [last.some((row) => String(row.idx) === 'idx_clicks_session' && String(row.stat) === '20000 5') && !last.some((row) => String(row.idx) === 'idx_clicks_kind'), 'Step 7: finish with SELECT * FROM sqlite_stat1 WHERE idx IS NOT NULL. Expect idx_clicks_session with stat 20000 5 and no idx_clicks_kind.'],
      ], 'One index that paid its way, one that did not. ANALYZE told you which.')
    },
  },
  quiz: [
    { question: 'Why do indexes slow down writes?', options: ['They lock the table', 'Every insert or update must also update each index', 'They use more CPU for reads'], answer: 1, explanation: 'An index is a sorted copy that must stay in sync with the table.' },
    { question: 'sqlite_stat1 shows "20000 10000" for an index. What does that say?', options: ['20,000 rows, about 10,000 per distinct value, so the index barely narrows anything', 'The index is 10,000 bytes', 'The table needs 10,000 more rows'], answer: 0, explanation: 'The second number is the average rows per value. Close to the row count means the column is not selective.' },
    { question: 'When should you rerun ANALYZE?', options: ['Before every SELECT', 'After big loads or changes in the data shape', 'Never, it runs automatically'], answer: 1, explanation: 'The stats are a snapshot. Refresh them when the data changes a lot.' },
  ],
}

export default lesson
