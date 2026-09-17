import type { Lesson } from '../types'
import { lastOk, sqlHas, steps } from '../checks'

/** A week of samples from two machines, as load.py would have stored them. */
export const HEALTH_DB = `
CREATE TABLE samples (
  id INTEGER PRIMARY KEY,
  host TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  disk_pct INTEGER,
  mem_used_mb INTEGER,
  load1 REAL,
  procs INTEGER
);
INSERT INTO samples (host, taken_at, disk_pct, mem_used_mb, load1, procs) VALUES
('stackbox', '2026-09-11', 31, 790, 0.12, 108),
('stackbox', '2026-09-12', 31, 802, 0.30, 110),
('stackbox', '2026-09-13', 32, 795, 0.08, 109),
('stackbox', '2026-09-14', 32, 810, 1.45, 131),
('stackbox', '2026-09-15', 33, 808, 0.22, 112),
('stackbox', '2026-09-16', 33, 790, 0.42, 108),
('stackbox', '2026-09-17', 33, 812, 0.08, 112),
('webbox', '2026-09-11', 74, 2210, 0.95, 164),
('webbox', '2026-09-12', 76, 2250, 1.10, 170),
('webbox', '2026-09-13', 78, 2300, 0.88, 168),
('webbox', '2026-09-14', 81, 2380, 2.05, 190),
('webbox', '2026-09-15', 83, 2400, 1.30, 175),
('webbox', '2026-09-16', 85, 2410, 1.62, 181),
('webbox', '2026-09-17', 88, 2450, 1.24, 178);
`

const lesson: Lesson = {
  id: 'w12d3',
  tier: 1,
  track: 'capstone',
  week: 12,
  day: 3,
  title: 'SQL queries produce the report',
  concept: `Imagine load.py has run every morning for a week on two machines. The samples table now holds 14 rows, and the questions a sysadmin asks are all SQL you know.

How busy is each machine on average? GROUP BY host with AVG. Which days crossed a disk threshold? WHERE disk_pct >= 80. What is the latest reading for each host? A correlated subquery that finds MAX(taken_at) for the same host. How fast is disk filling up? MAX minus MIN per host.

Each answer is one statement. Together they are the report, and tomorrow Python will run them and print the result in one go.

Read every result table as if it were your machine. Which host would you worry about?`,
  example: {
    language: 'sql',
    caption: 'Latest row per host, with a correlated subquery',
    code: `SELECT host, taken_at, load1
FROM samples s
WHERE taken_at = (SELECT MAX(taken_at) FROM samples WHERE host = s.host)
ORDER BY host;`,
  },
  task: {
    kind: 'sql',
    instructions: 'The database holds a week of samples for two hosts. Run each step as its own statement, pressing Run after each:\n1. Average load per host: host and avg_load (AVG of load1 rounded to 2 decimals), highest first.\n2. Disk warnings: host, taken_at, and disk_pct for every sample at 80 percent or more, oldest first.\n3. The latest sample per host: host, taken_at, and disk_pct, using a correlated subquery on MAX(taken_at), sorted by host.\n4. Disk growth over the week: host and growth (MAX disk_pct minus MIN disk_pct), grouped by host, biggest first.',
    setup: HEALTH_DB,
    hints: [
      'SELECT host, ROUND(AVG(load1), 2) AS avg_load FROM samples GROUP BY host ORDER BY avg_load DESC;',
      'SELECT host, taken_at, disk_pct FROM samples WHERE disk_pct >= 80 ORDER BY taken_at;',
      'SELECT host, taken_at, disk_pct FROM samples s WHERE taken_at = (SELECT MAX(taken_at) FROM samples WHERE host = s.host) ORDER BY host;',
      'SELECT host, MAX(disk_pct) - MIN(disk_pct) AS growth FROM samples GROUP BY host ORDER BY growth DESC;',
    ],
    solution: {
      commands: [
        'SELECT host, ROUND(AVG(load1), 2) AS avg_load FROM samples GROUP BY host ORDER BY avg_load DESC;',
        'SELECT host, taken_at, disk_pct FROM samples WHERE disk_pct >= 80 ORDER BY taken_at;',
        'SELECT host, taken_at, disk_pct FROM samples s WHERE taken_at = (SELECT MAX(taken_at) FROM samples WHERE host = s.host) ORDER BY host;',
        'SELECT host, MAX(disk_pct) - MIN(disk_pct) AS growth FROM samples GROUP BY host ORDER BY growth DESC;',
      ],
    },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /ROUND\s*\(\s*AVG\s*\(\s*load1/) && sets.some((s) => flat(s) === 'webbox:1.31|stackbox:0.38'), 'Step 1: webbox 1.31 then stackbox 0.38, from ROUND(AVG(load1), 2) AS avg_load with GROUP BY host, sorted DESC.'],
        [sets.some((s) => s.columns.length === 3 && flat(s) === 'webbox:2026-09-14:81|webbox:2026-09-15:83|webbox:2026-09-16:85|webbox:2026-09-17:88'), 'Step 2: four webbox rows from 2026-09-14 (81) to 2026-09-17 (88), using WHERE disk_pct >= 80 ORDER BY taken_at.'],
        [sqlHas(r, /\(\s*SELECT\s+MAX\s*\(\s*taken_at\s*\)/) && sets.some((s) => flat(s) === 'stackbox:2026-09-17:33|webbox:2026-09-17:88'), 'Step 3: stackbox 2026-09-17 33 and webbox 2026-09-17 88, with WHERE taken_at = (SELECT MAX(taken_at) FROM samples WHERE host = s.host).'],
        [sqlHas(r, /MAX\s*\(\s*disk_pct\s*\)\s*-\s*MIN\s*\(\s*disk_pct\s*\)/) && sets.some((s) => flat(s) === 'webbox:14|stackbox:2'), 'Step 4: webbox 14 then stackbox 2, from MAX(disk_pct) - MIN(disk_pct) AS growth, GROUP BY host, biggest first.'],
      ], 'Four questions, four answers: webbox is filling up 2 percent a day. That is a report.')
    },
    realSteps: [
      'On your Mac, run sqlite3 ~/health/health.db in Terminal, type the step 3 query, and press Enter. Your table has one or two rows, so the answer is short. Type .quit to leave sqlite3.',
    ],
  },
  quiz: [
    { question: 'Why does step 3 need a subquery instead of just MAX(taken_at)?', options: ['MAX is slow', 'MAX alone gives the date, but not the other columns of that row', 'Subqueries are required with dates'], answer: 1, explanation: 'GROUP BY host with MAX(taken_at) returns the latest date, but disk_pct would come from an arbitrary row. The subquery picks the whole row.' },
    { question: 'Which host should worry a sysadmin, and why?', options: ['stackbox, its load is low', 'webbox, its disk grows about 2 percent a day and is at 88', 'Neither, both are fine'], answer: 1, explanation: 'At that pace webbox fills up in under a week. The report exists to spot exactly this.' },
    { question: 'What does ROUND(AVG(load1), 2) return?', options: ['The average with 2 decimals', 'The two highest loads', 'The average multiplied by 2'], answer: 0, explanation: 'AVG runs first, ROUND trims the result to two decimal places.' },
  ],
}

export default lesson
