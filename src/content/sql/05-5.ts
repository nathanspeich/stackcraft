import type { Lesson } from '../types'
import { SHOP } from './shop'
import { sqlHas, steps } from '../checks'

const lesson: Lesson = {
  id: 'w05d5',
  tier: 1,
  track: 'sql',
  week: 5,
  day: 5,
  title: 'Filtering: AND, OR, IN, BETWEEN, LIKE, NULL',
  concept: `WHERE gets expressive with a few more operators.

AND requires both conditions, OR either one. Use parentheses when you mix them: WHERE (a OR b) AND c.

IN matches any value in a list: WHERE category IN ('books', 'merch'). BETWEEN checks a range, inclusive at both ends: WHERE price BETWEEN 20 AND 40.

LIKE matches text patterns. % stands for any run of characters and _ for exactly one: WHERE name LIKE 'A%' finds names starting with A, and '%an%' finds names containing an. In SQLite, LIKE ignores case for ASCII letters.

NULL means no value at all, not zero and not an empty string. Nothing equals NULL, so WHERE city = NULL never matches. Use IS NULL and IS NOT NULL. NOT flips any condition.`,
  example: {
    language: 'sql',
    caption: 'Richer conditions',
    code: `SELECT name FROM products
WHERE category IN ('books', 'merch') AND price BETWEEN 20 AND 40;

SELECT name FROM customers WHERE name LIKE '%an%' OR city = 'Oslo';

SELECT name FROM customers WHERE city IS NULL;`,
  },
  task: {
    kind: 'sql',
    instructions: 'Write four queries, each selecting name only:\n1. Customers with no city recorded (IS NULL).\n2. Products in the books or merch categories (use IN) priced between 20 and 40 inclusive (use BETWEEN), sorted by name.\n3. Customers whose name contains "an" (LIKE) or whose city is Oslo, sorted by name.\n4. Products that are out of stock (stock = 0) and cost more than 30.',
    starter: '-- Four filters\n',
    setup: SHOP,
    hints: ['SELECT name FROM customers WHERE city IS NULL;', "SELECT name FROM products WHERE category IN ('books', 'merch') AND price BETWEEN 20 AND 40 ORDER BY name;", "SELECT name FROM customers WHERE name LIKE '%an%' OR city = 'Oslo' ORDER BY name;", 'SELECT name FROM products WHERE stock = 0 AND price > 30;'],
    solution: { file: "SELECT name FROM customers WHERE city IS NULL;\nSELECT name FROM products WHERE category IN ('books', 'merch') AND price BETWEEN 20 AND 40 ORDER BY name;\nSELECT name FROM customers WHERE name LIKE '%an%' OR city = 'Oslo' ORDER BY name;\nSELECT name FROM products WHERE stock = 0 AND price > 30;\n" },
    check: (r) => {
      const sets = r.results ?? []
      const names = (s: { values: unknown[][] }) => s.values.map((v) => v[0]).join('|')
      return steps([
        [!r.error, `Your script stopped with an error: ${r.error}`],
        [sqlHas(r, /IS\s+NULL/) && sets.some((s) => names(s) === 'Sam Hill'), 'Query 1: only Sam Hill has no city. Use WHERE city IS NULL.'],
        [sqlHas(r, /\bIN\s*\(/) && sqlHas(r, /BETWEEN/) && sets.some((s) => names(s) === 'Hoodie|Linux handbook|Python primer|SQL cookbook'), 'Query 2: Hoodie, Linux handbook, Python primer, SQL cookbook, sorted by name, using IN and BETWEEN.'],
        [sqlHas(r, /LIKE/) && sqlHas(r, /\bOR\b/) && sets.some((s) => names(s) === 'Ana Costa|Zoe Berg'), "Query 3: Ana Costa and Zoe Berg, using LIKE '%an%' OR city = 'Oslo'."],
        [sets.some((s) => names(s) === 'Monitor arm'), 'Query 4: only the Monitor arm is out of stock and over 30.'],
      ], 'AND, OR, IN, BETWEEN, LIKE, and NULL handled. Week 5 done.')
    },
  },
  quiz: [
    { question: 'Why does WHERE city = NULL return nothing?', options: ['NULL is spelled wrong', 'Nothing equals NULL; use IS NULL', 'city is text'], answer: 1, explanation: 'NULL is the absence of a value and comparisons with it are never true.' },
    { question: "What does LIKE 'S%' match?", options: ['Names ending in S', 'Names starting with S', 'Names containing S'], answer: 1, explanation: '% means any characters after the S.' },
    { question: 'Is BETWEEN 10 AND 20 inclusive?', options: ['Yes, 10 and 20 both match', 'No, only 11 to 19', 'Only 10 matches'], answer: 0, explanation: 'BETWEEN includes both endpoints.' },
  ],
}

export default lesson
