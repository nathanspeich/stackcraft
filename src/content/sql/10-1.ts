import type { Lesson } from '../types'
import { SHOP } from './shop'
import { sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w10d1',
  tier: 1,
  track: 'sql',
  week: 10,
  day: 1,
  title: 'Subqueries',
  concept: `A subquery is a SELECT inside another statement, in parentheses. It lets one question feed another.

In WHERE, a subquery that returns one value works like a number: WHERE price > (SELECT AVG(price) FROM products) finds products above the average, without you knowing the average.

A subquery that returns a list works with IN: WHERE id IN (SELECT customer_id FROM orders) finds customers who have ordered. NOT IN finds the rest.

In SELECT, a subquery can compute one value per row: (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS n_orders. This is a correlated subquery, because it refers to the outer row.

Subqueries and joins often solve the same problem. Use whichever reads more clearly.`,
  example: {
    language: 'sql',
    caption: 'Three places a subquery can live',
    code: `SELECT name, price FROM products
WHERE price > (SELECT AVG(price) FROM products);

SELECT name FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE status = 'new');

SELECT name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS n_orders
FROM customers c;`,
  },
  task: {
    kind: 'sql',
    instructions: '1. Products with a price above the average price: name and price, most expensive first.\n2. Names of customers who have bought the Hoodie (product 8), using IN with a subquery over orders joined to order_items, sorted by name.\n3. Every customer\'s name with n_orders from a correlated subquery, sorted by n_orders descending then name.',
    starter: '-- Subqueries\n',
    setup: SHOP,
    hints: ['WHERE price > (SELECT AVG(price) FROM products) ORDER BY price DESC', 'WHERE id IN (SELECT o.customer_id FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.product_id = 8)', 'SELECT name, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS n_orders FROM customers c ORDER BY n_orders DESC, name;'],
    solution: { file: 'SELECT name, price FROM products WHERE price > (SELECT AVG(price) FROM products) ORDER BY price DESC;\nSELECT name FROM customers WHERE id IN (SELECT o.customer_id FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.product_id = 8) ORDER BY name;\nSELECT name, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS n_orders FROM customers c ORDER BY n_orders DESC, name;\n' },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        [!r.error, `Your script stopped with an error: ${r.error}`],
        [sqlHas(r, /\(\s*SELECT\s+AVG\(price\)/) && sets.some((s) => flat(s) === 'Mechanical keyboard:89|Monitor arm:45|Hoodie:39'), 'Query 1: Mechanical keyboard 89, Monitor arm 45, Hoodie 39, using (SELECT AVG(price) FROM products).'],
        [sqlHas(r, /\bIN\s*\(\s*SELECT/) && sets.some((s) => flat(s) === 'Kim Lee|Raj Patel'), 'Query 2: Kim Lee and Raj Patel bought the Hoodie. Use IN (SELECT ...).'],
        [sqlHas(r, /\(\s*SELECT\s+COUNT\(\*\)[^)]*customer_id\s*=\s*c\.id/) && sets.some((s) => flat(s) === 'Ana Costa:3|Raj Patel:2|Kim Lee:1|Lea Novak:1|Zoe Berg:1|Sam Hill:0'), 'Query 3: Ana Costa 3, Raj Patel 2, Kim Lee 1, Lea Novak 1, Zoe Berg 1, Sam Hill 0, from a correlated subquery.'],
      ], 'Questions feeding questions.')
    },
  },
  quiz: [
    { question: 'What must a subquery used with > return?', options: ['Exactly one value', 'A list', 'A table'], answer: 0, explanation: 'Comparison operators need a single value. IN is for lists.' },
    { question: 'What makes a subquery correlated?', options: ['It uses JOIN', 'It refers to a column of the outer query', 'It returns many rows'], answer: 1, explanation: 'It is re-evaluated for each outer row, using that row\'s values.' },
    { question: 'Which finds customers who never ordered?', options: ['WHERE id NOT IN (SELECT customer_id FROM orders)', 'WHERE orders = 0', 'WHERE id IN (SELECT id FROM orders)'], answer: 0, explanation: 'NOT IN against the list of customer ids that appear in orders.' },
  ],
}

export default lesson
