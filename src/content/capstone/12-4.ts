import type { Lesson } from '../types'
import { codeHas, noError, outHas, outLines, steps } from '../checks'

const rep = (host: string, date: string, disk: number, mem: number, load: string, procs: number) =>
  `host=${host}\ndate=${date}\ndisk_use=${disk}%\nmem_used=${mem}Mi\nload=${load}\nprocs=${procs}\n`

const SEED = {
  'stackbox-2026-09-16.txt': rep('stackbox', '2026-09-16', 33, 790, '0.42, 0.30, 0.20', 108),
  'stackbox-2026-09-17.txt': rep('stackbox', '2026-09-17', 33, 812, '0.08, 0.05, 0.01', 112),
  'webbox-2026-09-16.txt': rep('webbox', '2026-09-16', 85, 2410, '1.62, 1.40, 1.31', 181),
  'webbox-2026-09-17.txt': rep('webbox', '2026-09-17', 88, 2450, '1.24, 1.35, 1.30', 178),
}

const COMMON = `import sqlite3
import sys


def number(text):
    """Keep the leading digits and dot of a string: '33%' becomes 33.0. Empty text becomes 0."""
    digits = ""
    for ch in text:
        if ch.isdigit() or ch == ".":
            digits += ch
        elif digits:
            break
    return float(digits) if digits else 0


def parse(path):
    """Read key=value lines into a dictionary."""
    facts = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if "=" in line:
                key, value = line.split("=", 1)
                facts[key] = value
    return facts


def load(conn, paths):
    """Day 2's loader: one row per report file."""
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY, host TEXT NOT NULL, taken_at TEXT NOT NULL,
        disk_pct INTEGER, mem_used_mb INTEGER, load1 REAL, procs INTEGER)""")
    for path in paths:
        f = parse(path)
        cur.execute(
            "INSERT INTO samples (host, taken_at, disk_pct, mem_used_mb, load1, procs) VALUES (?, ?, ?, ?, ?, ?)",
            (f["host"], f["date"], int(number(f["disk_use"])), int(number(f["mem_used"])), number(f["load"]), int(number(f["procs"]))),
        )
    conn.commit()


SUMMARY_SQL = """
SELECT host,
       (SELECT taken_at FROM samples WHERE host = s.host ORDER BY taken_at DESC LIMIT 1) AS latest,
       (SELECT disk_pct FROM samples WHERE host = s.host ORDER BY taken_at DESC LIMIT 1) AS disk,
       ROUND(AVG(load1), 2) AS avg_load
FROM samples s
GROUP BY host
ORDER BY host
"""
`

const STARTER = COMMON + `

def report(conn):
    cur = conn.cursor()
    print("Server health report")
    # 1. run SUMMARY_SQL and print one line per host:
    #    f"{host:<10}  {latest}  disk {disk}%  load {avg_load:.2f}"
    # 2. print "Warnings:" then, for each host whose latest sample has disk_pct >= 80,
    #    print f"  {host} disk at {disk}%"


conn = sqlite3.connect(":memory:")
load(conn, sys.argv[1:])
report(conn)
`

const SOLUTION = COMMON + `

def report(conn):
    cur = conn.cursor()
    print("Server health report")
    cur.execute(SUMMARY_SQL)
    for host, latest, disk, avg_load in cur.fetchall():
        print(f"{host:<10}  {latest}  disk {disk}%  load {avg_load:.2f}")
    print("Warnings:")
    cur.execute(
        "SELECT host, disk_pct FROM samples s "
        "WHERE taken_at = (SELECT MAX(taken_at) FROM samples WHERE host = s.host) AND disk_pct >= 80 "
        "ORDER BY host"
    )
    for host, disk in cur.fetchall():
        print(f"  {host} disk at {disk}%")


conn = sqlite3.connect(":memory:")
load(conn, sys.argv[1:])
report(conn)
`

const lesson: Lesson = {
  id: 'w12d4',
  tier: 1,
  track: 'capstone',
  week: 12,
  day: 4,
  title: 'Review day',
  concept: `Step back and look at what you built. collect.sh runs commands and writes facts. load.py reads the facts into a table. SQL asks questions of the table. Three languages, one job each, joined by plain text files and a database file. That is how most real tooling is glued together.

Today the last piece: report.py runs the queries from Python and prints a report a person can read. The loader from day 2 and the summary query are given. You write report(): loop over the rows, format them with f-strings, then run a second query for the warnings.

Notice what each layer is good at. Bash is unbeatable for running commands. Python handles parsing and formatting. SQL answers questions over many rows without loops.`,
  example: {
    language: 'python',
    caption: 'Printing query rows with aligned columns',
    code: `cur.execute("SELECT host, disk_pct FROM samples ORDER BY host")
for host, disk in cur.fetchall():
    print(f"{host:<10}  disk {disk}%")
# stackbox    disk 33%
# webbox      disk 88%
#
# :<10 pads the host to 10 characters, :.2f prints 2 decimals`,
  },
  task: {
    kind: 'python',
    instructions: 'Finish report(conn). The program loads four report files (see the Arguments box) into an in-memory database, then your function prints:\n1. One line per host from SUMMARY_SQL, formatted as  stackbox    2026-09-17  disk 33%  load 0.25  using f"{host:<10}  {latest}  disk {disk}%  load {avg_load:.2f}".\n2. A line reading  Warnings:\n3. One line  <host> disk at <n>%  indented by two spaces, for each host whose latest sample has disk_pct of 80 or more. Write this query yourself: the correlated subquery from day 3 plus AND disk_pct >= 80, sorted by host.',
    starter: STARTER,
    seed: SEED,
    argv: Object.keys(SEED),
    hints: [
      'cur.execute(SUMMARY_SQL) then for host, latest, disk, avg_load in cur.fetchall(): print(f"{host:<10}  {latest}  disk {disk}%  load {avg_load:.2f}")',
      'Warnings query: SELECT host, disk_pct FROM samples s WHERE taken_at = (SELECT MAX(taken_at) FROM samples WHERE host = s.host) AND disk_pct >= 80 ORDER BY host',
      'for host, disk in cur.fetchall(): print(f"  {host} disk at {disk}%")',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const warnIdx = ls.indexOf('Warnings:')
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [ls[0] === 'Server health report', 'The first line should be  Server health report'],
        [codeHas(r, /execute\(\s*SUMMARY_SQL\s*\)/) && /^stackbox\s+2026-09-17\s+disk 33%\s+load 0\.25$/.test(ls[1] ?? ''), `Step 1: run SUMMARY_SQL. Line 2 should read  stackbox    2026-09-17  disk 33%  load 0.25  (yours: ${JSON.stringify(ls[1] ?? '')}).`],
        [/^webbox\s+2026-09-17\s+disk 88%\s+load 1\.43$/.test(ls[2] ?? ''), 'Step 1: line 3 should read  webbox      2026-09-17  disk 88%  load 1.43'],
        [warnIdx === 3, 'Step 2: line 4 should be  Warnings:'],
        [codeHas(r, /disk_pct\s*>=\s*80/) && codeHas(r, /MAX\s*\(\s*taken_at\s*\)/i), 'Step 3: write a query with the MAX(taken_at) subquery AND disk_pct >= 80.'],
        [ls[4] === '  webbox disk at 88%' && !outHas(r, /stackbox disk at/), 'Step 3: exactly one warning line:  webbox disk at 88%  (two leading spaces). stackbox is fine and must not appear.'],
      ], 'Bash, Python, and SQL in one tool. That is the whole stack, in miniature.')
    },
    realSteps: [
      'On your Mac, save this as ~/health/report.py, then run the whole pipeline in Terminal: bash collect.sh report.txt && python3 report.py report.txt. Read the one-line report for your own machine.',
      'Look at ~/health with ls -l. You now have a bash script, two Python programs, a text report, and a SQLite database that you wrote yourself.',
    ],
  },
  quiz: [
    { question: 'Why keep the summary in SQL instead of computing averages in Python?', options: ['Python cannot average', 'SQL does grouping and averaging over many rows in one statement, with no loops to get wrong', 'SQL is always faster'], answer: 1, explanation: 'Each layer does what it is best at. Aggregation over rows is what SQL is for.' },
    { question: 'What does {host:<10} do in an f-string?', options: ['Cuts the host to 10 characters', 'Left-aligns it in a 10-character column', 'Repeats it 10 times'], answer: 1, explanation: 'The < means left-align and 10 is the width. Columns line up.' },
    { question: 'How do the three programs talk to each other?', options: ['Through function calls', 'Through a text file and a database file', 'They do not, each runs alone'], answer: 1, explanation: 'collect.sh writes report.txt, load.py writes health.db, report.py reads it. Files are the interface.' },
  ],
}

export default lesson
