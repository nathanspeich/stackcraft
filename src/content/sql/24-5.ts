import type { Lesson } from '../types'
import { SALES_SCRIPT } from './sales'

const VIEWS = `CREATE VIEW monthly_revenue AS
SELECT substr(sold_on, 1, 7) AS month,
       COUNT(*) AS sales_count,
       ROUND(SUM(amount), 2) AS revenue
FROM sales
GROUP BY month;

CREATE VIEW top_customers AS
SELECT c.name, c.city,
       COUNT(*) AS purchases,
       ROUND(SUM(s.amount), 2) AS total_spent
FROM customers c
JOIN sales s ON s.customer_id = c.id
GROUP BY c.id
ORDER BY total_spent DESC;

CREATE VIEW low_stock AS
SELECT id, name, category, stock
FROM products
WHERE stock < 5
ORDER BY stock;`

const lesson: Lesson = {
  id: 'w24d5',
  tier: 2,
  track: 'sql',
  week: 24,
  day: 5,
  title: 'Project: reporting views in sales.db',
  concept: `Time to give the week 18 database a reporting layer. Three views answer the three questions a small shop asks most: how did each month go, who are the best customers, and what is about to run out.

On a real database you create views with the sqlite3 tool, the same way you created the tables. .schema then prints every CREATE statement in the file, views included, a quick way to confirm they were saved. Views live inside sales.db, so anyone who copies the file gets the reports too.

Once the views exist, a report is one line: sqlite3 sales.db "SELECT * FROM monthly_revenue". That line can go in a cron job, a bash script, or a Python program, none of which need to know how revenue is calculated.`,
  example: {
    language: 'bash',
    caption: 'Create a view, then use it from the shell',
    code: `sqlite3 sales.db <<'EOF'
CREATE VIEW low_stock AS
SELECT id, name, category, stock
FROM products WHERE stock < 5
ORDER BY stock;
EOF

sqlite3 -header -column sales.db \\
  "SELECT * FROM low_stock;"
# id  name          category     stock
# --  ------------  -----------  -----
# 8   Mouse         electronics  0
# 5   Water bottle  home         2`,
  },
  task: {
    kind: 'real',
    intro: `This project runs inside the VM (multipass shell stackcraft). You will add three reporting views to the sales.db you built in week 18: monthly_revenue, top_customers, and low_stock. They are the same shapes you practised this week, saved into the real file.

Go to the folder where sales.db lives (your home folder, unless you put it somewhere else). If the file is gone, the first command block rebuilds it from the week 18 script before adding the views, so you are never stuck.

The app never touches your VM. It only reads what you paste, so copy the output exactly as the terminal shows it.`,
    steps: [
      {
        instruction: 'Create the three views. The block below first rebuilds sales.db if it is missing, then adds the views, then prints the schema. Run it inside the VM, then paste the output of the last command (.schema).\n\nIf a CREATE VIEW fails with "already exists", you ran it twice: that is fine, the views are there.',
        command: `cd ~
test -f sales.db || sqlite3 sales.db <<'EOF'
${SALES_SCRIPT}EOF

sqlite3 sales.db <<'EOF'
${VIEWS}
EOF

sqlite3 sales.db .schema`,
        pasteLabel: 'Paste the output of sqlite3 sales.db .schema',
        check: [{ type: 'regex', pattern: 'CREATE VIEW', count: 3, label: 'CREATE VIEW at least three times' }],
        hint: 'The paste should show the three CREATE TABLE lines followed by three CREATE VIEW blocks. If you see fewer views, run sqlite3 sales.db and type .tables to see what exists, then create the missing view by hand. If sqlite3 is not installed, run sudo apt install -y sqlite3 first.',
        example: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, joined_on TEXT NOT NULL);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL DEFAULT 0);
CREATE TABLE sales (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER NOT NULL REFERENCES products(id), sold_on TEXT NOT NULL, qty INTEGER NOT NULL, amount REAL NOT NULL);
CREATE VIEW monthly_revenue AS
SELECT substr(sold_on, 1, 7) AS month,
       COUNT(*) AS sales_count,
       ROUND(SUM(amount), 2) AS revenue
FROM sales
GROUP BY month
/* monthly_revenue(month,sales_count,revenue) */;
CREATE VIEW top_customers AS
SELECT c.name, c.city,
       COUNT(*) AS purchases,
       ROUND(SUM(s.amount), 2) AS total_spent
FROM customers c
JOIN sales s ON s.customer_id = c.id
GROUP BY c.id
ORDER BY total_spent DESC
/* top_customers(name,city,purchases,total_spent) */;
CREATE VIEW low_stock AS
SELECT id, name, category, stock
FROM products
WHERE stock < 5
ORDER BY stock
/* low_stock(id,name,category,stock) */;`,
      },
      {
        instruction: 'Query one of the views from the shell and paste the result. monthly_revenue is a good one: six months, one line each. Try the other two as well, they are yours now.',
        command: `sqlite3 -header -column sales.db "SELECT * FROM monthly_revenue;"

sqlite3 -header -column sales.db "SELECT * FROM top_customers LIMIT 3;"
sqlite3 -header -column sales.db "SELECT * FROM low_stock;"`,
        pasteLabel: 'Paste the result of one view query',
        check: [{ type: 'lines', atLeast: 3 }],
        hint: 'The output should have a header line, a dashed line, and at least one data row. If you see "no such view", the CREATE VIEW in step 1 did not run: rerun that block. If the result is empty, check that sales has rows with sqlite3 sales.db "SELECT COUNT(*) FROM sales;".',
        example: `month    sales_count  revenue
-------  -----------  -------
2026-01  5            155.5
2026-02  6            189.5
2026-03  7            297.0
2026-04  8            368.5
2026-05  9            435.5
2026-06  10           322.5`,
      },
    ],
  },
  quiz: [
    { question: 'Where is a view stored?', options: ['In a separate .view file', 'Inside the database file, in sqlite_master', 'Only in the current sqlite3 session'], answer: 1, explanation: 'Views are part of the database file, so they travel with it.' },
    { question: 'What does .schema show in sqlite3?', options: ['Only table names', 'The CREATE statements for tables, indexes, views, and triggers', 'The row counts'], answer: 1, explanation: 'It prints the SQL that defines every object in the database.' },
    { question: 'A cron job runs sqlite3 sales.db "SELECT * FROM low_stock" nightly. You change how low stock is defined. What must change?', options: ['The cron job', 'Only the view', 'Both'], answer: 1, explanation: 'That is the point of the view: the query stays the same, the definition lives in one place.' },
  ],
}

export default lesson
