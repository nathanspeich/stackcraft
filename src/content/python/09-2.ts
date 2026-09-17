import type { Lesson } from '../types'
import { codeHas, fileContent, noError, outLines, steps } from '../checks'

const PEOPLE = 'name,city,age\nana,Lisbon,34\nraj,Pune,28\nkim,Seoul,41\nzoe,Oslo,25\n'
const CONFIG = '{"app": "stackcraft", "retries": 3, "features": ["cards", "map"]}\n'

const lesson: Lesson = {
  id: 'w09d2',
  tier: 1,
  track: 'python',
  week: 9,
  day: 2,
  title: 'JSON and CSV',
  concept: `Two file formats carry most data between programs.

CSV is a spreadsheet as text: one row per line, commas between fields, usually a header row. The csv module handles quoting and commas inside values for you. csv.DictReader(f) yields one dictionary per row keyed by the header, and csv.DictWriter writes them back. Everything read from CSV is a string, so convert numbers yourself.

JSON is the format of web APIs and config files. It looks like Python dictionaries and lists. json.load(f) reads a file into Python objects, json.loads(text) parses a string, json.dump(obj, f, indent=2) writes a file, and json.dumps(obj) gives a string. Types map naturally: objects to dicts, arrays to lists, true to True, null to None.`,
  example: {
    language: 'python',
    caption: 'CSV in, JSON out',
    code: `import csv, json

with open("people.csv") as f:
    rows = list(csv.DictReader(f))
print(rows[0]["name"], rows[0]["age"])
total = sum(int(r["age"]) for r in rows)
print(total / len(rows))
with open("people.json", "w") as f:
    json.dump(rows, f, indent=2)
with open("config.json") as f:
    cfg = json.load(f)
print(cfg["retries"])`,
  },
  task: {
    kind: 'python',
    instructions: 'people.csv and config.json are in the working directory.\n1. Read people.csv with csv.DictReader and print each name and city as  ana lives in Lisbon .\n2. Print the average age with one decimal (ages are strings, convert them).\n3. Read config.json with json.load and print the app name and the number of features on one line.\n4. Build a dictionary {"count": 4, "cities": [...sorted city names...]} and write it to summary.json with json.dump and indent=2.',
    starter: 'import csv\nimport json\n',
    seed: { 'people.csv': PEOPLE, 'config.json': CONFIG },
    hints: ['with open("people.csv") as f: rows = list(csv.DictReader(f))', 'sum(int(r["age"]) for r in rows) / len(rows)', 'cfg = json.load(f) then print(cfg["app"], len(cfg["features"]))', 'json.dump({"count": len(rows), "cities": sorted(r["city"] for r in rows)}, f, indent=2)'],
    solution: { file: 'import csv\nimport json\n\nwith open("people.csv") as f:\n    rows = list(csv.DictReader(f))\nfor r in rows:\n    print(f"{r[\'name\']} lives in {r[\'city\']}")\nprint(round(sum(int(r["age"]) for r in rows) / len(rows), 1))\nwith open("config.json") as f:\n    cfg = json.load(f)\nprint(cfg["app"], len(cfg["features"]))\nsummary = {"count": len(rows), "cities": sorted(r["city"] for r in rows)}\nwith open("summary.json", "w") as f:\n    json.dump(summary, f, indent=2)\n' },
    check: (r) => {
      const ls = outLines(r)
      let parsed: unknown = null
      try { parsed = JSON.parse(fileContent(r, 'summary.json') ?? '') } catch { parsed = null }
      const p = parsed as { count?: number; cities?: string[] } | null
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, 'DictReader') && ls.slice(0, 4).join('|') === 'ana lives in Lisbon|raj lives in Pune|kim lives in Seoul|zoe lives in Oslo', 'Lines 1 to 4: name lives in city for each row, read with csv.DictReader.'],
        [ls[4] === '32.0', 'Line 5: the average age 32.0 (convert the strings with int).'],
        [ls[5] === 'stackcraft 2' && codeHas(r, 'json.load('), 'Line 6: stackcraft 2 from json.load on config.json.'],
        [Boolean(p) && p?.count === 4 && JSON.stringify(p?.cities) === '["Lisbon","Oslo","Pune","Seoul"]' && codeHas(r, 'json.dump('), 'Write summary.json with json.dump: {"count": 4, "cities": ["Lisbon", "Oslo", "Pune", "Seoul"]}'],
        [/\n  "count"/.test(fileContent(r, 'summary.json') ?? ''), 'Pass indent=2 to json.dump so the file is readable.'],
      ], 'CSV read, JSON read and written. Data moves.')
    },
  },
  quiz: [
    { question: 'What does csv.DictReader give you per row?', options: ['A list of strings', 'A dictionary keyed by the header names', 'A tuple'], answer: 1, explanation: 'Each row becomes a dict like {"name": "ana", "age": "34"}. Values are strings.' },
    { question: 'Which function reads JSON from a file object?', options: ['json.loads', 'json.load', 'json.read'], answer: 1, explanation: 'load reads from a file, loads parses a string. The s stands for string.' },
    { question: 'What does JSON null become in Python?', options: ['0', '""', 'None'], answer: 2, explanation: 'null maps to None, true and false to True and False.' },
  ],
}

export default lesson
