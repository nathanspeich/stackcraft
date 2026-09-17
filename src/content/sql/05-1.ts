import type { Lesson } from '../types'
import { SHOP } from './shop'
import { column, lastCols, lastRows, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w05d1',
  tier: 1,
  track: 'sql',
  week: 5,
  day: 1,
  title: 'What a database is, SQLite basics',
  concept: `A database stores data in tables: rows of records, columns of fields, like a spreadsheet that many programs can share safely. SQL is the language for asking questions of it and changing it, and it reads close to English.

SQLite is a complete database in a single file, built into Python, phones, and browsers. It is where most people should start, and it is what runs here.

SELECT is the question. SELECT * FROM products returns every column of every row. Name columns to get only those: SELECT name, price FROM products. COUNT(*) counts rows.

Statements end with a semicolon. Keywords are usually written in capitals by convention, but SQL does not care. Table and column names do matter.

The special table sqlite_master lists what is in the database.`,
  example: {
    language: 'sql',
    caption: 'Looking around a new database',
    code: `SELECT name FROM sqlite_master WHERE type = 'table';
SELECT * FROM customers;
SELECT name, price FROM products;
SELECT COUNT(*) FROM orders;`,
  },
  task: {
    kind: 'sql',
    instructions: 'This lesson\'s database is a small online shop. Write four statements:\n1. List the table names from sqlite_master (type = \'table\').\n2. Select every column from products.\n3. Select only name and city from customers.\n4. Count the rows in orders.\nRun and read each result table.',
    starter: '-- The shop database is loaded before your script runs\n',
    setup: SHOP,
    hints: ["SELECT name FROM sqlite_master WHERE type = 'table';", 'SELECT * FROM products;', 'SELECT name, city FROM customers;', 'SELECT COUNT(*) FROM orders;'],
    solution: { file: "SELECT name FROM sqlite_master WHERE type = 'table';\nSELECT * FROM products;\nSELECT name, city FROM customers;\nSELECT COUNT(*) FROM orders;\n" },
    check: (r) => {
      const sets = r.results ?? []
      const has = (pred: (s: { columns: string[]; values: unknown[][] }) => boolean) => sets.some(pred)
      return steps([
        [!r.error, `Your script stopped with an error: ${r.error}`],
        [has((s) => s.values.map((v) => v[0]).join(',') === 'customers,products,orders,order_items'), "Statement 1: SELECT name FROM sqlite_master WHERE type = 'table' should list the four tables."],
        [has((s) => s.columns.length === 5 && s.values.length === 8 && s.columns.includes('stock')), 'Statement 2: SELECT * FROM products should return 8 rows with 5 columns.'],
        [has((s) => s.columns.map((c) => c.toLowerCase()).join(',') === 'name,city' && s.values.length === 6), 'Statement 3: SELECT name, city FROM customers should return 6 rows with exactly those two columns.'],
        [sqlHas(r, /COUNT\(\*\)/) && lastCols(r).length === 1 && column(r, lastCols(r)[0])[0] === '8' && lastRows(r).length === 1, 'Statement 4: SELECT COUNT(*) FROM orders should be last and return 8.'],
      ], 'Four questions asked, four answers read. That is SQL.')
    },
  },
  quiz: [
    { question: 'What does SELECT * mean?', options: ['Select all rows', 'Select all columns', 'Select the first row'], answer: 1, explanation: 'The star means every column. Which rows come back is decided by WHERE, covered on day 3.' },
    { question: 'What is SQLite?', options: ['A small SQL keyword', 'A database engine that stores everything in one file', 'A spreadsheet program'], answer: 1, explanation: 'SQLite needs no server. The whole database is a single file on disk.' },
    { question: 'Which table lists the tables in an SQLite database?', options: ['sqlite_master', 'tables', 'schema'], answer: 0, explanation: 'sqlite_master holds the name, type, and CREATE statement of every object.' },
  ],
}

export default lesson
