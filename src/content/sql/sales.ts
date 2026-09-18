// Shared seed for the Tier 2 SQL weeks (18, 24, 27): a small shop's customers, products, and sales across the first half of 2026.
export const SALES = `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, joined_on TEXT NOT NULL);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL DEFAULT 0);
CREATE TABLE sales (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER NOT NULL REFERENCES products(id), sold_on TEXT NOT NULL, qty INTEGER NOT NULL, amount REAL NOT NULL);
INSERT INTO customers VALUES
  (1, 'Ana Costa', 'Lisbon', '2025-11-03'),
  (2, 'Ben Okafor', 'Leeds', '2025-11-20'),
  (3, 'Chloe Martin', 'Lyon', '2025-12-08'),
  (4, 'Dev Patel', 'Pune', '2026-01-05'),
  (5, 'Emma Novak', 'Prague', '2026-01-19'),
  (6, 'Farid Aziz', 'Oslo', '2026-02-02'),
  (7, 'Grace Kim', 'Seoul', '2026-02-24'),
  (8, 'Hugo Silva', 'Porto', '2026-03-15');
INSERT INTO products VALUES
  (1, 'Notebook', 'stationery', 4.5, 120),
  (2, 'Desk lamp', 'home', 29.0, 14),
  (3, 'USB-C cable', 'electronics', 9.0, 3),
  (4, 'Backpack', 'bags', 49.0, 8),
  (5, 'Water bottle', 'home', 15.0, 2),
  (6, 'Headphones', 'electronics', 79.0, 11),
  (7, 'Pen set', 'stationery', 12.0, 40),
  (8, 'Mouse', 'electronics', 24.0, 0);
INSERT INTO sales VALUES
  (1, 2, 2, '2026-01-02', 1, 29.0),
  (2, 1, 4, '2026-01-05', 1, 49.0),
  (3, 2, 7, '2026-01-11', 2, 24.0),
  (4, 2, 4, '2026-01-13', 1, 49.0),
  (5, 2, 1, '2026-01-21', 1, 4.5),
  (6, 4, 1, '2026-02-02', 1, 4.5),
  (7, 3, 5, '2026-02-19', 2, 30.0),
  (8, 3, 2, '2026-02-21', 2, 58.0),
  (9, 5, 3, '2026-02-24', 1, 9.0),
  (10, 4, 6, '2026-02-26', 1, 79.0),
  (11, 2, 1, '2026-02-28', 2, 9.0),
  (12, 5, 6, '2026-03-07', 1, 79.0),
  (13, 3, 4, '2026-03-11', 1, 49.0),
  (14, 5, 8, '2026-03-14', 1, 24.0),
  (15, 8, 5, '2026-03-15', 2, 30.0),
  (16, 2, 2, '2026-03-16', 2, 58.0),
  (17, 7, 3, '2026-03-18', 1, 9.0),
  (18, 3, 8, '2026-03-22', 2, 48.0),
  (19, 6, 8, '2026-04-02', 2, 48.0),
  (20, 8, 2, '2026-04-03', 1, 29.0),
  (21, 5, 8, '2026-04-11', 3, 72.0),
  (22, 2, 1, '2026-04-18', 3, 13.5),
  (23, 5, 8, '2026-04-19', 1, 24.0),
  (24, 7, 6, '2026-04-22', 1, 79.0),
  (25, 8, 6, '2026-04-25', 1, 79.0),
  (26, 2, 8, '2026-04-27', 1, 24.0),
  (27, 2, 3, '2026-05-05', 2, 18.0),
  (28, 7, 5, '2026-05-07', 1, 15.0),
  (29, 7, 5, '2026-05-08', 3, 45.0),
  (30, 7, 6, '2026-05-10', 3, 237.0),
  (31, 7, 4, '2026-05-13', 1, 49.0),
  (32, 2, 3, '2026-05-16', 1, 9.0),
  (33, 4, 4, '2026-05-22', 1, 49.0),
  (34, 8, 3, '2026-05-24', 1, 9.0),
  (35, 5, 1, '2026-05-25', 1, 4.5),
  (36, 8, 7, '2026-06-02', 2, 24.0),
  (37, 7, 7, '2026-06-05', 1, 12.0),
  (38, 8, 7, '2026-06-11', 1, 12.0),
  (39, 4, 2, '2026-06-12', 1, 29.0),
  (40, 8, 3, '2026-06-14', 1, 9.0),
  (41, 6, 1, '2026-06-17', 1, 4.5),
  (42, 1, 3, '2026-06-18', 2, 18.0),
  (43, 2, 6, '2026-06-19', 2, 158.0),
  (44, 1, 2, '2026-06-20', 1, 29.0),
  (45, 7, 3, '2026-06-25', 3, 27.0);
`

/** The same data as a sqlite3 script the learner can paste on the real machine to create sales.db. */
export const SALES_SCRIPT = SALES.trim() + '\n'
