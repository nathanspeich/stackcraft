// Seed for week 15 (CTEs): a small company's org chart. Each employee points at their manager, and the boss has none.
export const ORG = `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  manager_id INTEGER REFERENCES employees(id),
  salary INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Maya Chen', 'CEO', NULL, 180000),
  (2, 'Luis Ortega', 'CTO', 1, 150000),
  (3, 'Priya Nair', 'CFO', 1, 145000),
  (4, 'Tom Baker', 'Engineering manager', 2, 120000),
  (5, 'Sara Lund', 'Ops lead', 2, 110000),
  (6, 'Ken Adachi', 'Engineer', 4, 95000),
  (7, 'Nina Rossi', 'Engineer', 4, 92000),
  (8, 'Omar Haddad', 'SRE', 5, 98000),
  (9, 'Ella Fischer', 'Accountant', 3, 70000),
  (10, 'Jake Moore', 'Intern', 6, 32000);
`

/** The same table as a sqlite3 script for the week 15 project, pasted into the VM to create org.db. */
export const ORG_SCRIPT = ORG.trim() + '\n'
