import type { Lesson } from '../types'
import { codeHas, fileExists, noError, outLines, steps } from '../checks'

const REPORT_TODAY = 'host=stackbox\ndate=2026-09-17\ndisk_use=33%\nmem_used=812Mi\nload=0.08, 0.05, 0.01\nprocs=112\n'
const REPORT_YESTERDAY = 'host=stackbox\ndate=2026-09-16\ndisk_use=31%\nmem_used=790Mi\nload=0.42, 0.30, 0.20\nprocs=108\n'

const STARTER = `import sqlite3
import sys


def number(text):
    """Turn '33%' or '812Mi' or '0.08, 0.05, 0.01' into a number. Empty text becomes 0."""
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
    # open the file, split each line on "=" once, store key: value
    return facts


conn = sqlite3.connect("health.db")
cur = conn.cursor()
# create the samples table if it does not exist

for path in sys.argv[1:]:
    facts = parse(path)
    # insert one row with ? placeholders, then print a stored line

conn.commit()
# print samples in db: N using COUNT(*)
conn.close()
`

const SOLUTION = `import sqlite3
import sys


def number(text):
    """Turn '33%' or '812Mi' or '0.08, 0.05, 0.01' into a number. Empty text becomes 0."""
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


conn = sqlite3.connect("health.db")
cur = conn.cursor()
cur.execute("""CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY,
    host TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    disk_pct INTEGER,
    mem_used_mb INTEGER,
    load1 REAL,
    procs INTEGER)""")

for path in sys.argv[1:]:
    facts = parse(path)
    disk = int(number(facts["disk_use"]))
    mem = int(number(facts["mem_used"]))
    load1 = number(facts["load"])
    procs = int(number(facts["procs"]))
    cur.execute(
        "INSERT INTO samples (host, taken_at, disk_pct, mem_used_mb, load1, procs) VALUES (?, ?, ?, ?, ?, ?)",
        (facts["host"], facts["date"], disk, mem, load1, procs),
    )
    print(f"stored {facts['host']} {facts['date']}: disk {disk}%, load {load1}")

conn.commit()
cur.execute("SELECT COUNT(*) FROM samples")
print(f"samples in db: {cur.fetchone()[0]}")
conn.close()
`

const lesson: Lesson = {
  id: 'w12d2',
  tier: 1,
  track: 'capstone',
  week: 12,
  day: 2,
  title: 'Python parses it into SQLite',
  concept: `Yesterday's report.txt is six key=value lines. Today load.py turns any number of those files into rows in a SQLite table, so the facts can pile up day after day and be queried later.

The shape is the same as every file-to-database program you will ever write. Read the file line by line. Split each line on the first = to get a key and a value. Convert text like 33% or 812Mi into numbers. Insert one row per file using ? placeholders. Commit.

A helper called number() is provided: it keeps the leading digits and dot of a string, so number("33%") is 33.0 and number("0.42, 0.30") is 0.42. Wrap it in int() where a whole number makes sense.

CREATE TABLE IF NOT EXISTS lets the script run again tomorrow.`,
  example: {
    language: 'python',
    caption: 'Reading key=value lines into a dictionary',
    code: `facts = {}
with open("report.txt") as f:
    for line in f:
        line = line.strip()
        if "=" in line:
            key, value = line.split("=", 1)
            facts[key] = value

print(facts["host"])            # stackbox
print(int(number(facts["disk_use"])))   # 33`,
  },
  task: {
    kind: 'python',
    instructions: 'Finish load.py. It is run with two report files as arguments (see the Arguments box).\n1. Complete parse(path) so it returns a dictionary of the key=value lines in the file.\n2. Create the table samples with columns id INTEGER PRIMARY KEY, host TEXT NOT NULL, taken_at TEXT NOT NULL, disk_pct INTEGER, mem_used_mb INTEGER, load1 REAL, procs INTEGER. Use CREATE TABLE IF NOT EXISTS.\n3. For each file, insert one row with ? placeholders: host, date as taken_at, and the numbers from disk_use, mem_used, load (first value only) and procs, using number() and int().\n4. After each insert print  stored stackbox 2026-09-16: disk 31%, load 0.42  (host, date, disk, load).\n5. Commit, then print  samples in db: 2  using SELECT COUNT(*) and fetchone.',
    starter: STARTER,
    seed: { 'report-yesterday.txt': REPORT_YESTERDAY, 'report.txt': REPORT_TODAY },
    argv: ['report-yesterday.txt', 'report.txt'],
    hints: [
      'Inside parse: with open(path) as f: for line in f: ... key, value = line.strip().split("=", 1) then facts[key] = value',
      'cur.execute("CREATE TABLE IF NOT EXISTS samples (id INTEGER PRIMARY KEY, host TEXT NOT NULL, taken_at TEXT NOT NULL, disk_pct INTEGER, mem_used_mb INTEGER, load1 REAL, procs INTEGER)")',
      'disk = int(number(facts["disk_use"])); load1 = number(facts["load"]); then cur.execute("INSERT INTO samples (host, taken_at, disk_pct, mem_used_mb, load1, procs) VALUES (?, ?, ?, ?, ?, ?)", (facts["host"], facts["date"], disk, mem, load1, procs))',
      'print(f"stored {facts[\'host\']} {facts[\'date\']}: disk {disk}%, load {load1}") and at the end cur.execute("SELECT COUNT(*) FROM samples"); print(f"samples in db: {cur.fetchone()[0]}")',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /split\(\s*["']=["']\s*,\s*1\s*\)/) && codeHas(r, /with open\(/), 'Step 1: parse should open the file and split each line on "=" once: line.split("=", 1).'],
        [codeHas(r, /CREATE TABLE IF NOT EXISTS samples/i) && codeHas(r, /load1 REAL/i) && fileExists(r, 'health.db'), 'Step 2: CREATE TABLE IF NOT EXISTS samples with the seven columns, including load1 REAL.'],
        [codeHas(r, /INSERT INTO samples/i) && codeHas(r, /VALUES\s*\((\s*\?\s*,){5}\s*\?\s*\)/), 'Step 3: INSERT INTO samples ... VALUES (?, ?, ?, ?, ?, ?) with six placeholders.'],
        [ls[0] === 'stored stackbox 2026-09-16: disk 31%, load 0.42', `Step 4: the first line should be  stored stackbox 2026-09-16: disk 31%, load 0.42  (yours: ${JSON.stringify(ls[0] ?? '')}).`],
        [ls[1] === 'stored stackbox 2026-09-17: disk 33%, load 0.08', 'Step 4: the second line should be  stored stackbox 2026-09-17: disk 33%, load 0.08'],
        [ls[2] === 'samples in db: 2' && codeHas(r, /COUNT\(\*\)/i) && codeHas(r, /\.commit\(\)/), 'Step 5: commit, then print  samples in db: 2  from SELECT COUNT(*) FROM samples.'],
      ], 'Text files became rows. The database now remembers every run.')
    },
    realSteps: [
      'On your Mac, save this program as ~/health/load.py and run python3 load.py report.txt (the report.txt from day 1). If python3 is missing, macOS offers to install the developer tools; accept.',
      'Run sqlite3 health.db "SELECT * FROM samples;" in Terminal (sqlite3 ships with macOS) and confirm your row is there.',
    ],
  },
  quiz: [
    { question: 'Why split on "=" with a limit of 1?', options: ['It is faster', 'So a value containing = stays whole', 'split needs two arguments'], answer: 1, explanation: 'Only the first = separates key from value. Anything after it belongs to the value.' },
    { question: 'What does CREATE TABLE IF NOT EXISTS give you?', options: ['A faster table', 'The script can run again without failing on an existing table', 'Automatic backups'], answer: 1, explanation: 'Without IF NOT EXISTS, the second run would stop with "table samples already exists".' },
    { question: 'Why pass values as a tuple with ? placeholders?', options: ['sqlite3 escapes them safely, so quotes and odd text cannot break the SQL', 'It is the only syntax sqlite3 accepts', 'Tuples are faster than strings'], answer: 0, explanation: 'Placeholders keep data as data. Building SQL with f-strings invites injection and quoting bugs.' },
  ],
}

export default lesson
