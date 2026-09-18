import type { Lesson } from '../types'
import { ORG_SCRIPT } from './org'

const TREE_QUERY = `WITH RECURSIVE tree AS (
  SELECT id, name, title, 0 AS depth
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.title, t.depth + 1
  FROM employees e
  JOIN tree t ON e.manager_id = t.id
)
SELECT depth, name, title
FROM tree
ORDER BY depth, name;`

const lesson: Lesson = {
  id: 'w15d5',
  tier: 2,
  track: 'sql',
  week: 15,
  day: 5,
  title: 'Project: org chart with a recursive CTE',
  concept: `So far SQL has lived inside the app. On a real machine the same SQLite engine comes as a command-line tool called sqlite3. You give it a file name, and that file is the whole database: tables, data, and views in one portable file.

sqlite3 org.db opens (or creates) the file and waits for statements. Feed it a script through a here-doc and it runs every statement, then exits. Dot commands like .headers on and .mode column are settings for the tool, not SQL, and .quit leaves.

Today you install the tool in the VM, load a small company into org.db, and print the org chart with the recursive CTE from day 3. The app only reads what you paste.`,
  example: {
    language: 'bash',
    caption: 'Create a database from a script, then query it',
    code: `sqlite3 org.db <<'EOF'
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO employees VALUES (1, 'Maya Chen');
EOF

sqlite3 -header -column org.db "SELECT * FROM employees;"`,
  },
  task: {
    kind: 'real',
    intro: `This week's project happens inside the VM: open Terminal on the Mac and run multipass shell stackcraft first.

You will install the sqlite3 command-line tool, create org.db with an employees table where every row points at its manager, and run a recursive CTE that prints each person with their depth in the tree. The CEO is depth 0, her direct reports are depth 1, and so on.

The app never talks to the VM. Each step tells you what to paste, and simple pattern checks confirm it.`,
    steps: [
      {
        instruction: 'Install the sqlite3 tool with apt, then check that it answers with a version number. Ubuntu 24.04 ships 3.45, which is plenty.',
        command: 'sudo apt update && sudo apt install -y sqlite3\nsqlite3 --version',
        pasteLabel: 'Paste the output of sqlite3 --version',
        check: [{ type: 'regex', pattern: '\\b3\\.\\d+\\.\\d+\\b', label: 'a version number like 3.45.1' }],
        hint: 'If the command is not found, the install did not finish. Run sudo apt install -y sqlite3 again and read the last lines for errors, then run sqlite3 --version on its own.',
        example: '3.45.1 2024-01-30 16:01:20 e876e51a0ed5c5b3126f52e532044363a014bc594cfefa87ffb5b82257cc467a (64-bit)',
      },
      {
        instruction: 'Create org.db in your home folder from the provided script. The here-doc feeds the whole script to sqlite3, which runs it and exits. Then count the rows to prove the load worked.',
        command: `cd ~\nsqlite3 org.db <<'EOF'\n${ORG_SCRIPT}EOF\nsqlite3 org.db "SELECT COUNT(*) FROM employees;"`,
        pasteLabel: 'Paste the output of the COUNT query',
        check: [{ type: 'regex', pattern: '^\\s*10\\s*$', flags: 'm', label: 'a line with the number 10' }],
        hint: 'You should see exactly 10. If you see an error about the table already existing, you ran the script twice: rm org.db and run it again. If you see 0, the INSERT did not run, so paste the whole block again including the EOF line.',
        example: '10',
      },
      {
        instruction: 'Now the org chart. Run the recursive CTE with headers and column mode so the output is readable. The depth column must come first. Every one of the 10 people should appear, with Maya Chen at depth 0 and three people at depth 2.\n\nTip: -header and -column are flags of the sqlite3 tool, and the query is passed as one quoted argument.',
        command: `sqlite3 -header -column org.db "\n${TREE_QUERY}\n"`,
        pasteLabel: 'Paste the output of the org chart query',
        check: [
          { type: 'lines', atLeast: 10 },
          { type: 'regex', pattern: '^\\s*0[\\s|]', flags: 'm', label: 'a row with depth 0 (the CEO)' },
          { type: 'regex', pattern: '^\\s*2[\\s|]', flags: 'm', label: 'a row with depth 2' },
        ],
        hint: 'Make sure depth is the first column in the SELECT and that you ordered by depth. If only one row appears, the UNION ALL step is missing or joins on the wrong column: it must be e.manager_id = t.id.',
        example: `depth  name          title
-----  ------------  -------------------
0      Maya Chen     CEO
1      Luis Ortega   CTO
1      Priya Nair    CFO
2      Ella Fischer  Accountant
2      Sara Lund     Ops lead
2      Tom Baker     Engineering manager
3      Ken Adachi    Engineer
3      Nina Rossi    Engineer
3      Omar Haddad   SRE
4      Jake Moore    Intern`,
      },
    ],
  },
  quiz: [
    { question: 'What is org.db?', options: ['A folder of CSV files', 'One file holding the whole database', 'A running server process'], answer: 1, explanation: 'SQLite keeps tables, data, and views in a single portable file.' },
    { question: 'What does the here-doc do in sqlite3 org.db <<\'EOF\'?', options: ['Feeds every line up to EOF to sqlite3 as input', 'Creates a file named EOF', 'Opens an editor'], answer: 0, explanation: 'The shell passes the lines as standard input, so sqlite3 runs them as a script.' },
    { question: 'Which of these is a sqlite3 dot command rather than SQL?', options: ['SELECT 1;', '.mode column', 'PRAGMA foreign_keys = ON;'], answer: 1, explanation: 'Dot commands configure the command-line tool. PRAGMA is SQL that SQLite understands.' },
  ],
}

export default lesson
