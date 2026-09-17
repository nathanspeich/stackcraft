/** A small shop database shared by the SQL lessons. Every lesson seeds a fresh copy. */
export const SHOP_SCHEMA = `
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  joined TEXT NOT NULL
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  ordered_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL
);
`

export const SHOP_DATA = `
INSERT INTO customers (id, name, city, joined) VALUES
  (1, 'Ana Costa', 'Lisbon', '2025-01-15'),
  (2, 'Raj Patel', 'Pune', '2025-02-03'),
  (3, 'Kim Lee', 'Seoul', '2025-02-20'),
  (4, 'Zoe Berg', 'Oslo', '2025-03-11'),
  (5, 'Sam Hill', NULL, '2025-04-02'),
  (6, 'Lea Novak', 'Lisbon', '2025-05-19');
INSERT INTO products (id, name, category, price, stock) VALUES
  (1, 'Mechanical keyboard', 'hardware', 89.00, 12),
  (2, 'USB-C cable', 'hardware', 9.50, 140),
  (3, 'Monitor arm', 'hardware', 45.00, 0),
  (4, 'Linux handbook', 'books', 32.00, 25),
  (5, 'SQL cookbook', 'books', 28.50, 8),
  (6, 'Python primer', 'books', 24.00, 0),
  (7, 'Sticker pack', 'merch', 4.00, 300),
  (8, 'Hoodie', 'merch', 39.00, 15);
INSERT INTO orders (id, customer_id, ordered_on, status) VALUES
  (1, 1, '2025-06-01', 'shipped'),
  (2, 2, '2025-06-03', 'shipped'),
  (3, 1, '2025-06-10', 'shipped'),
  (4, 3, '2025-06-15', 'cancelled'),
  (5, 4, '2025-07-02', 'shipped'),
  (6, 2, '2025-07-08', 'new'),
  (7, 6, '2025-07-20', 'new'),
  (8, 1, '2025-08-01', 'new');
INSERT INTO order_items (order_id, product_id, qty) VALUES
  (1, 1, 1), (1, 2, 2),
  (2, 4, 1), (2, 7, 5),
  (3, 5, 1), (3, 6, 1),
  (4, 8, 1),
  (5, 2, 3), (5, 3, 1),
  (6, 1, 1), (6, 8, 2),
  (7, 4, 2),
  (8, 7, 10), (8, 2, 1);
`

export const SHOP = SHOP_SCHEMA + SHOP_DATA
