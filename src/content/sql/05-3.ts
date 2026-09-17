import type { Lesson } from '../types'
import { SHOP } from './shop'
import { sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w05d3',
  tier: 1,
  track: 'sql',
  week: 5,
  day: 3,
  title: 'SELECT, WHERE, ORDER BY, LIMIT',
  concept: `A SELECT has clauses that always come in the same order, and each one narrows or shapes the result.

WHERE keeps only rows that match a condition: WHERE category = 'books'. Comparisons are = (a single one), <>, <, >, <=, >=. Text is case sensitive and needs single quotes.

ORDER BY sorts. ORDER BY price sorts ascending; add DESC for descending. You can sort by several columns: ORDER BY category, price DESC.

LIMIT cuts the result to the first N rows, which combined with ORDER BY gives you a top list: the three newest customers, the two cheapest products.

Rename a column in the output with AS: SELECT price * stock AS value. The order is always SELECT, FROM, WHERE, ORDER BY, LIMIT.`,
  example: {
    language: 'sql',
    caption: 'Narrow, sort, cut',
    code: `SELECT name, price
FROM products
WHERE category = 'hardware'
ORDER BY price DESC
LIMIT 2;

SELECT name, price * stock AS stock_value
FROM products
WHERE stock > 0
ORDER BY stock_value DESC;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Write three queries:\n1. The name and price of the two most expensive books (category = \'books\'), most expensive first.\n2. The names of the three customers who joined most recently (sort by joined, newest first).\n3. The name, stock, and a computed column value (price times stock, named value with AS) for products that have stock, sorted by value from highest to lowest.',
    starter: '-- Three queries with WHERE, ORDER BY, LIMIT\n',
    setup: SHOP,
    hints: ["SELECT name, price FROM products WHERE category = 'books' ORDER BY price DESC LIMIT 2;", 'SELECT name FROM customers ORDER BY joined DESC LIMIT 3;', 'SELECT name, stock, price * stock AS value FROM products WHERE stock > 0 ORDER BY value DESC;'],
    solution: { file: "SELECT name, price FROM products WHERE category = 'books' ORDER BY price DESC LIMIT 2;\nSELECT name FROM customers ORDER BY joined DESC LIMIT 3;\nSELECT name, stock, price * stock AS value FROM products WHERE stock > 0 ORDER BY value DESC;\n" },
    check: (r) => {
      const sets = r.results ?? []
      const first = (s: { values: unknown[][] }) => s.values.map((v) => v[0]).join('|')
      return steps([
        [!r.error, `Your script stopped with an error: ${r.error}`],
        [sets.some((s) => s.values.length === 2 && first(s) === 'Linux handbook|SQL cookbook' && s.columns.length === 2), 'Query 1: two rows, Linux handbook then SQL cookbook, with name and price. Use WHERE, ORDER BY price DESC, LIMIT 2.'],
        [sets.some((s) => first(s) === 'Lea Novak|Sam Hill|Zoe Berg'), 'Query 2: Lea Novak, Sam Hill, Zoe Berg in that order (ORDER BY joined DESC LIMIT 3).'],
        [sqlHas(r, /\bAS\s+value\b/) && sets.some((s) => s.columns.map((c) => c.toLowerCase()).includes('value') && s.values.length === 6 && first(s) === 'USB-C cable|Sticker pack|Mechanical keyboard|Linux handbook|Hoodie|SQL cookbook'), 'Query 3: six in-stock products with a value column, USB-C cable first (1330) and SQL cookbook last (228).'],
      ], 'Filtered, sorted, limited, and computed.')
    },
  },
  quiz: [
    { question: 'Which clause order is valid?', options: ['SELECT FROM ORDER BY WHERE', 'SELECT FROM WHERE ORDER BY LIMIT', 'SELECT WHERE FROM LIMIT'], answer: 1, explanation: 'The clause order is fixed: SELECT, FROM, WHERE, ORDER BY, LIMIT.' },
    { question: 'How do you get the most expensive product?', options: ['ORDER BY price DESC LIMIT 1', 'WHERE price = MAX', 'LIMIT price'], answer: 0, explanation: 'Sort descending and keep the first row.' },
    { question: 'What does AS do?', options: ['Filters rows', 'Gives a column or expression a name in the output', 'Joins tables'], answer: 1, explanation: 'AS sets an alias, which you can also use in ORDER BY.' },
  ],
}

export default lesson
