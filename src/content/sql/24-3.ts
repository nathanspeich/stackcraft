import type { Lesson } from '../types'
import { SALES } from './sales'
import { hasObject, lastCols, lastOk, lastRows, sqlFailed, sqlHas, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w24d3',
  tier: 2,
  track: 'sql',
  week: 24,
  day: 3,
  title: 'Updatable views and their limits',
  concept: `Can you UPDATE a view? Some databases allow it for simple one-table views. SQLite does not: every view is read-only, and an UPDATE, INSERT, or DELETE on one fails with "cannot modify ... because it is a view".

The way through is an INSTEAD OF trigger. It says: instead of writing to the view, run these statements on the real table. Inside it, NEW.price and NEW.id are the values from the attempted write. The app keeps talking to the tidy view while the trigger handles the real tables.

Views cannot be altered either. To change one, DROP VIEW and CREATE VIEW again. Dropping a view also drops its triggers, so recreate those too. And since a view stores query text, renaming a column underneath it breaks the view.`,
  example: {
    language: 'sql',
    caption: 'Read-only, until a trigger says otherwise',
    code: `CREATE VIEW cheap_products AS
SELECT id, name, price FROM products
WHERE price < 20;

UPDATE cheap_products SET price = 5 WHERE id = 1;
-- Error: cannot modify cheap_products because it is a view

CREATE TRIGGER cheap_price_update
INSTEAD OF UPDATE OF price ON cheap_products
BEGIN
  UPDATE products SET price = NEW.price
  WHERE id = NEW.id;
END;

UPDATE cheap_products SET price = 5 WHERE id = 1;
-- works now`,
  },
  task: {
    kind: 'sql',
    instructions: 'Run each step as its own statement, pressing Run after each.\n1. Create the view cheap_products: id, name, price FROM products WHERE price < 20.\n2. Try UPDATE cheap_products SET price = 5 WHERE id = 1. Read the error.\n3. Create the INSTEAD OF UPDATE trigger from the example, named cheap_price_update. Type the whole thing, BEGIN to END, in one Run.\n4. Run the same UPDATE again. It works this time.\n5. Check with SELECT price FROM products WHERE id = 1 (expect 5).\n6. You now want stock in the view. Views cannot be altered, so DROP VIEW cheap_products.\n7. Recreate cheap_products with id, name, price, stock FROM products WHERE price < 20.\n8. SELECT * FROM cheap_products ORDER BY price. Four rows, Notebook first at 5.',
    setup: SALES,
    hints: [
      'CREATE VIEW cheap_products AS SELECT id, name, price FROM products WHERE price < 20;',
      'The trigger: CREATE TRIGGER cheap_price_update INSTEAD OF UPDATE OF price ON cheap_products BEGIN UPDATE products SET price = NEW.price WHERE id = NEW.id; END;',
      'Steps 6 and 7: DROP VIEW cheap_products; then CREATE VIEW cheap_products AS SELECT id, name, price, stock FROM products WHERE price < 20;',
      'SELECT * FROM cheap_products ORDER BY price;',
    ],
    solution: {
      commands: [
        'CREATE VIEW cheap_products AS SELECT id, name, price FROM products WHERE price < 20;',
        'UPDATE cheap_products SET price = 5 WHERE id = 1;',
        'CREATE TRIGGER cheap_price_update INSTEAD OF UPDATE OF price ON cheap_products BEGIN UPDATE products SET price = NEW.price WHERE id = NEW.id; END;',
        'UPDATE cheap_products SET price = 5 WHERE id = 1;',
        'SELECT price FROM products WHERE id = 1;',
        'DROP VIEW cheap_products;',
        'CREATE VIEW cheap_products AS SELECT id, name, price, stock FROM products WHERE price < 20;',
        'SELECT * FROM cheap_products ORDER BY price;',
      ],
    },
    check: (r) => {
      const notebook = tableRows(r, 'products').find((p) => p.id === 1)
      const viewSql = r.schema?.cheap_products ?? ''
      const last = lastRows(r)
      const h = r.history ?? []
      const iDrop = h.findIndex((s) => /DROP\s+VIEW\s+cheap_products/i.test(s))
      const recreated = iDrop >= 0 && h.some((s, i) => i > iDrop && /CREATE\s+VIEW\s+cheap_products/i.test(s))
      return steps([
        lastOk(r),
        [sqlHas(r, /CREATE\s+VIEW\s+cheap_products\s+AS\s+SELECT[\s\S]*price\s*<\s*20/), 'Step 1: CREATE VIEW cheap_products AS SELECT id, name, price FROM products WHERE price < 20.'],
        [sqlFailed(r, /UPDATE\s+cheap_products/, /because it is a view/), 'Step 2: run UPDATE cheap_products SET price = 5 WHERE id = 1 and let it fail. That error is the point.'],
        [sqlHas(r, /CREATE\s+TRIGGER\s+cheap_price_update\s+INSTEAD\s+OF\s+UPDATE[\s\S]*ON\s+cheap_products[\s\S]*UPDATE\s+products\s+SET\s+price\s*=\s*NEW\.price[\s\S]*END/), 'Step 3: create the INSTEAD OF UPDATE trigger cheap_price_update on cheap_products. It should UPDATE products SET price = NEW.price WHERE id = NEW.id.'],
        [Number(notebook?.price) === 5, 'Step 4: run the UPDATE on cheap_products again. With the trigger in place it should change product 1 to 5.'],
        [(r.results ?? []).some((s) => s.values.length === 1 && s.values[0].length === 1 && Number(s.values[0][0]) === 5), 'Step 5: SELECT price FROM products WHERE id = 1 should return 5.'],
        [iDrop >= 0, 'Step 6: DROP VIEW cheap_products.'],
        [recreated && hasObject(r, 'cheap_products') && /stock/i.test(viewSql), 'Step 7: recreate cheap_products with id, name, price, stock FROM products WHERE price < 20.'],
        [lastCols(r).includes('stock') && last.length === 4 && String(last[0]?.name) === 'Notebook' && Number(last[0]?.price) === 5, 'Step 8: finish with SELECT * FROM cheap_products ORDER BY price. Four rows, Notebook first at price 5.'],
      ], 'Read-only view, INSTEAD OF trigger, drop and recreate. You have seen the whole lifecycle.')
    },
  },
  quiz: [
    { question: 'What happens when you UPDATE a view in SQLite with no trigger?', options: ['The underlying table changes', 'An error: cannot modify because it is a view', 'The view is silently deleted'], answer: 1, explanation: 'SQLite views are read-only unless an INSTEAD OF trigger handles the write.' },
    { question: 'Inside an INSTEAD OF UPDATE trigger, what is NEW.price?', options: ['The price column of the first row', 'The value the UPDATE tried to set', 'The old price'], answer: 1, explanation: 'NEW holds the attempted new row. OLD holds the row as it was.' },
    { question: 'How do you add a column to an existing view?', options: ['ALTER VIEW ... ADD COLUMN', 'DROP VIEW then CREATE VIEW again', 'UPDATE sqlite_master'], answer: 1, explanation: 'There is no ALTER VIEW. Drop it, recreate it, and recreate any triggers that were attached.' },
  ],
}

export default lesson
