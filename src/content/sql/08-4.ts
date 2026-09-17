import type { Lesson } from '../types'
import { SHOP } from './shop'
import { lastOk, sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w08d4',
  tier: 1,
  track: 'sql',
  week: 8,
  day: 4,
  title: 'INNER JOIN',
  badge: 'first-join',
  concept: `Orders hold a customer_id, not a name. To see names next to orders you join the tables.

SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id. The ON clause says which rows pair up: an order matches the customer whose id equals its customer_id. Each matching pair becomes one output row.

o and c are aliases, short names for the tables, so you can write c.name. When both tables have a column called id or name, the prefix is required.

An INNER JOIN (JOIN for short) returns only rows with a match on both sides. A customer with no orders does not appear. Tomorrow's LEFT JOIN changes that.

Joined rows can be filtered, sorted, and aggregated like any others.`,
  example: {
    language: 'sql',
    caption: 'Orders with the names of who placed them',
    code: `SELECT o.id, c.name, o.ordered_on
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;

SELECT p.name, oi.qty
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE oi.order_id = 5;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each:\n1. List every order as id, the customer\'s name, and ordered_on, by joining orders to customers, sorted by order id.\n2. Show what is in order 5: product name and qty, by joining order_items to products.\n3. Count how many orders each customer has placed: name and n, joining customers to orders, grouped by customer, sorted by n descending then name. Customers with no orders will be missing, which is expected for an inner join.',
    setup: SHOP,
    hints: ['SELECT o.id, c.name, o.ordered_on FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id;', 'SELECT p.name, oi.qty FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = 5;', 'SELECT c.name, COUNT(*) AS n FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY n DESC, c.name;'],
    solution: { commands: ['SELECT o.id, c.name, o.ordered_on FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id;', 'SELECT p.name, oi.qty FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = 5;', 'SELECT c.name, COUNT(*) AS n FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY n DESC, c.name;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      return steps([
        lastOk(r),
        [sqlHas(r, /JOIN\s+customers/) && sqlHas(r, /\bON\b/) && sets.some((s) => s.values.length === 8 && flat(s).startsWith('1:Ana Costa:2025-06-01|2:Raj Patel') && flat(s).endsWith('8:Ana Costa:2025-08-01')), 'Step 1: 8 rows starting with 1 Ana Costa 2025-06-01, joined with ON c.id = o.customer_id, sorted by order id.'],
        [sets.some((s) => flat(s) === 'USB-C cable:3|Monitor arm:1'), 'Step 2: order 5 holds USB-C cable 3 and Monitor arm 1.'],
        [sets.some((s) => flat(s) === 'Ana Costa:3|Raj Patel:2|Kim Lee:1|Lea Novak:1|Zoe Berg:1'), 'Step 3: Ana Costa 3, Raj Patel 2, then Kim Lee, Lea Novak, Zoe Berg with 1 each. Sam Hill has no orders and does not appear.'],
      ], 'Your first JOIN. Tables are talking to each other.')
    },
  },
  quiz: [
    { question: 'What does ON specify in a JOIN?', options: ['Which table comes first', 'How rows from the two tables match up', 'The sort order'], answer: 1, explanation: 'ON holds the matching condition, usually foreign key equals primary key.' },
    { question: 'A customer has no orders. Does an INNER JOIN of customers to orders show them?', options: ['Yes, with NULL order columns', 'No', 'Only with GROUP BY'], answer: 1, explanation: 'Inner joins keep only rows with a match on both sides.' },
    { question: 'Why write c.name instead of name?', options: ['It is faster', 'Both tables may have a name column, so the prefix says which', 'It is required for all columns'], answer: 1, explanation: 'Ambiguous column names are an error. Prefixes remove the ambiguity.' },
  ],
}

export default lesson
