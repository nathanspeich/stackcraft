import type { Lesson } from '../types'
import { SHOP } from './shop'
import { hasObject, sqlHas, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w10d3',
  tier: 1,
  track: 'sql',
  week: 10,
  day: 3,
  title: 'Constraints and ALTER TABLE',
  concept: `Constraints are rules the database enforces so bad data cannot get in. You have met NOT NULL, PRIMARY KEY, REFERENCES, and CHECK. UNIQUE is another: no two rows may share the value, right for an email or a coupon code. A TEXT PRIMARY KEY is unique by definition.

When a rule is broken, the statement fails and names the constraint: CHECK constraint failed, UNIQUE constraint failed. Nothing half-happens.

Tables change over time. ALTER TABLE products ADD COLUMN sku TEXT adds a column; existing rows get NULL or the DEFAULT. RENAME COLUMN and DROP COLUMN also exist.

SQLite cannot add a constraint to an existing column with ALTER. The workaround is a new table with the rules, copy the data, rename. Design constraints in from the start.`,
  example: {
    language: 'sql',
    caption: 'Evolve a table, add a rule',
    code: `ALTER TABLE products ADD COLUMN sku TEXT;
UPDATE products SET sku = 'P-' || id;

CREATE TABLE coupons (
  code TEXT PRIMARY KEY,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90)
);
INSERT INTO coupons VALUES ('WELCOME', 10);
INSERT INTO coupons VALUES ('WELCOME', 20);
-- Error: UNIQUE constraint failed: coupons.code`,
  },
  task: {
    kind: 'sql',
    instructions: '1. Add a column sku TEXT to products with ALTER TABLE, then fill it for every row as P- followed by the id (use || to concatenate).\n2. Create a table coupons with code TEXT PRIMARY KEY, percent INTEGER NOT NULL with CHECK (percent BETWEEN 1 AND 90), and expires TEXT.\n3. Insert WELCOME at 10 percent and SUMMER at 25 percent (expires can be NULL).\n4. As the last statement, insert a coupon BAD at 150 percent and watch the CHECK constraint reject it.',
    starter: '-- ALTER TABLE and constraints\n',
    setup: SHOP,
    hints: ["ALTER TABLE products ADD COLUMN sku TEXT; then UPDATE products SET sku = 'P-' || id;", 'CREATE TABLE coupons (code TEXT PRIMARY KEY, percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90), expires TEXT);', "INSERT INTO coupons (code, percent) VALUES ('WELCOME', 10), ('SUMMER', 25);", "INSERT INTO coupons (code, percent) VALUES ('BAD', 150); fails with CHECK constraint failed."],
    solution: { file: "ALTER TABLE products ADD COLUMN sku TEXT;\nUPDATE products SET sku = 'P-' || id;\nCREATE TABLE coupons (\n  code TEXT PRIMARY KEY,\n  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90),\n  expires TEXT\n);\nINSERT INTO coupons (code, percent) VALUES ('WELCOME', 10), ('SUMMER', 25);\nINSERT INTO coupons (code, percent) VALUES ('BAD', 150);\n" },
    check: (r) => {
      const products = tableRows(r, 'products')
      const coupons = tableRows(r, 'coupons')
      const schema = (r.schema?.coupons ?? '').replace(/\s+/g, ' ').toLowerCase()
      return steps([
        [sqlHas(r, /ALTER\s+TABLE\s+products\s+ADD\s+COLUMN\s+sku/) && /sku/i.test(r.schema?.products ?? ''), 'Add the column: ALTER TABLE products ADD COLUMN sku TEXT.'],
        [products.length === 8 && products.every((p) => p.sku === `P-${p.id}`), "Fill every sku as P- followed by the id: UPDATE products SET sku = 'P-' || id."],
        [hasObject(r, 'coupons') && /code text primary key/.test(schema) && /check\s*\(\s*percent between 1 and 90\s*\)/.test(schema), 'Create coupons with code TEXT PRIMARY KEY and CHECK (percent BETWEEN 1 AND 90).'],
        [coupons.length === 2 && coupons.some((c) => c.code === 'WELCOME' && c.percent === 10) && coupons.some((c) => c.code === 'SUMMER' && c.percent === 25), 'Insert WELCOME at 10 and SUMMER at 25.'],
        [sqlHas(r, /'BAD'\s*,\s*150/) && /CHECK constraint failed/.test(r.error ?? ''), 'Make the last statement insert BAD at 150. It should fail with CHECK constraint failed.'],
      ], 'Schema evolved, rules enforced.')
    },
  },
  quiz: [
    { question: 'What does UNIQUE guarantee?', options: ['The column is indexed for speed only', 'No two rows share a value in that column', 'The column is the primary key'], answer: 1, explanation: 'Duplicates are rejected. It also creates an index behind the scenes.' },
    { question: 'What do existing rows get when you ADD COLUMN?', options: ['An error', 'NULL, or the column DEFAULT if one is given', 'A copy of the first column'], answer: 1, explanation: 'The new column is empty for old rows unless a DEFAULT is defined.' },
    { question: 'Can SQLite add a CHECK to an existing column with ALTER TABLE?', options: ['Yes', 'No, you rebuild the table', 'Only for INTEGER columns'], answer: 1, explanation: 'SQLite supports a limited ALTER TABLE. New constraints mean creating a new table and copying data.' },
  ],
}

export default lesson
