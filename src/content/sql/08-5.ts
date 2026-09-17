import type { Lesson } from '../types'
import { SHOP } from './shop'
import { sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w08d5',
  tier: 1,
  track: 'sql',
  week: 8,
  day: 5,
  title: 'LEFT JOIN and multi-table joins',
  concept: `A LEFT JOIN keeps every row from the left table even when nothing matches on the right. The missing side comes back as NULL. customers LEFT JOIN orders lists every customer, and those with no orders have NULL in the order columns.

That NULL is useful. WHERE o.id IS NULL after a LEFT JOIN finds customers who never ordered, a question an inner join cannot answer.

Joins chain. To go from a customer to the products they bought you walk customers to orders to order_items to products, one JOIN and ON per step. Aliases keep it readable.

Aggregates work across the chain: SUM(oi.qty * p.price) per customer is total spending. With LEFT JOINs, customers who bought nothing get NULL instead of disappearing.`,
  example: {
    language: 'sql',
    caption: 'Who never ordered, and a four-table walk',
    code: `SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;

SELECT c.name, p.name AS product, oi.qty
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = oi.product_id
WHERE o.id = 1;`,
  },
  task: {
    kind: 'sql',
    instructions: '1. Using a LEFT JOIN, find the name of every customer who has never placed an order.\n2. For order 1, list the customer name, the product name (as product), and qty, joining order_items, orders, customers, and products.\n3. Total spending per customer: name and spent (SUM of qty times price, rounded to 2 decimals), using LEFT JOINs so every customer appears, sorted by spent from highest to lowest. Sam Hill should show NULL.',
    starter: '-- LEFT JOIN, and a chain of joins\n',
    setup: SHOP,
    hints: ['SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;', 'FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN customers c ON c.id = o.customer_id JOIN products p ON p.id = oi.product_id WHERE o.id = 1', 'SELECT c.name, ROUND(SUM(oi.qty * p.price), 2) AS spent FROM customers c LEFT JOIN orders o ON o.customer_id = c.id LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN products p ON p.id = oi.product_id GROUP BY c.id ORDER BY spent DESC;'],
    solution: { file: 'SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;\nSELECT c.name, p.name AS product, oi.qty FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN customers c ON c.id = o.customer_id JOIN products p ON p.id = oi.product_id WHERE o.id = 1;\nSELECT c.name, ROUND(SUM(oi.qty * p.price), 2) AS spent FROM customers c LEFT JOIN orders o ON o.customer_id = c.id LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN products p ON p.id = oi.product_id GROUP BY c.id ORDER BY spent DESC;\n' },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.map((x) => (x === null ? 'NULL' : x)).join(':')).join('|')
      return steps([
        [!r.error, `Your script stopped with an error: ${r.error}`],
        [sqlHas(r, /LEFT\s+JOIN/) && sqlHas(r, /IS\s+NULL/) && sets.some((s) => flat(s) === 'Sam Hill'), 'Query 1: only Sam Hill, found with LEFT JOIN plus WHERE o.id IS NULL.'],
        [sets.some((s) => flat(s) === 'Ana Costa:Mechanical keyboard:1|Ana Costa:USB-C cable:2'), 'Query 2: Ana Costa bought a Mechanical keyboard (1) and a USB-C cable (2) in order 1.'],
        [sets.some((s) => flat(s) === 'Raj Patel:219|Ana Costa:210|Zoe Berg:73.5|Lea Novak:64|Kim Lee:39|Sam Hill:NULL'), 'Query 3: Raj Patel 219, Ana Costa 210, Zoe Berg 73.5, Lea Novak 64, Kim Lee 39, Sam Hill NULL. All six customers, spent DESC.'],
      ], 'Left joins, a four-table chain, and totals per customer. Week 8 done.')
    },
  },
  quiz: [
    { question: 'What does a LEFT JOIN add over an INNER JOIN?', options: ['Rows from the left table that have no match, with NULLs on the right', 'Faster results', 'Sorting'], answer: 0, explanation: 'Unmatched left rows survive. Inner joins drop them.' },
    { question: 'How do you find customers with no orders?', options: ['JOIN orders WHERE orders.id = 0', 'LEFT JOIN orders and keep rows WHERE orders.id IS NULL', 'SELECT * FROM customers WHERE orders IS NULL'], answer: 1, explanation: 'The NULL from a missing match is the signal you filter on.' },
    { question: 'To join four tables, how many ON clauses do you need?', options: ['One', 'Three', 'Four'], answer: 1, explanation: 'Each JOIN after the first table needs its own ON: three joins, three conditions.' },
  ],
}

export default lesson
