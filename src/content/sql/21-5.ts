import type { Lesson } from '../types'

const RECIPE_SCRIPT = `PRAGMA foreign_keys = ON;

CREATE TABLE recipes (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL,
  servings INTEGER NOT NULL DEFAULT 2,
  minutes  INTEGER
);
CREATE TABLE ingredients (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE recipe_ingredients (
  recipe_id     INTEGER NOT NULL REFERENCES recipes(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  amount        TEXT    NOT NULL,
  PRIMARY KEY (recipe_id, ingredient_id)
);
CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE recipe_tags (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id),
  tag_id    INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (recipe_id, tag_id)
);

INSERT INTO recipes VALUES
  (1, 'Pancakes', 4, 20),
  (2, 'Tomato soup', 4, 35),
  (3, 'Guacamole', 2, 10);
INSERT INTO ingredients VALUES
  (1, 'flour'), (2, 'egg'), (3, 'milk'), (4, 'tomato'),
  (5, 'onion'), (6, 'avocado'), (7, 'lime'), (8, 'salt');
INSERT INTO recipe_ingredients VALUES
  (1, 1, '200 g'), (1, 2, '2'), (1, 3, '300 ml'), (1, 8, 'a pinch'),
  (2, 4, '1 kg'), (2, 5, '1'), (2, 8, '1 tsp'),
  (3, 6, '2'), (3, 7, '1'), (3, 5, '1/2'), (3, 8, 'a pinch');
INSERT INTO tags VALUES (1, 'breakfast'), (2, 'vegetarian'), (3, 'quick');
INSERT INTO recipe_tags VALUES (1, 1), (1, 2), (2, 2), (3, 2), (3, 3);
`

const JOIN_QUERY = `SELECT i.name AS ingredient, ri.amount
FROM recipes r
JOIN recipe_ingredients ri ON ri.recipe_id = r.id
JOIN ingredients i ON i.id = ri.ingredient_id
WHERE r.name = 'Pancakes'
ORDER BY i.name;`

const lesson: Lesson = {
  id: 'w21d5',
  tier: 2,
  track: 'sql',
  week: 21,
  day: 5,
  title: 'Project: a recipe app schema',
  concept: `Time to design a schema from scratch. A recipe app has recipes, ingredients, and tags. A recipe uses many ingredients and an ingredient appears in many recipes, so recipe_ingredients is a junction table, and it carries the amount because that fact belongs to the pair. Tags work the same way through recipe_tags.

One SQLite detail matters on a real machine: foreign keys are declared but not enforced unless the connection runs PRAGMA foreign_keys = ON. The app did that for you. In sqlite3 you do it yourself, at the top of your script or session, or a typo in a recipe_id slips in silently.

Build it in the VM with the sqlite3 tool, load sample data, and prove the design with one join and one rejected insert.`,
  example: {
    language: 'sql',
    caption: 'Turn enforcement on, then let the database say no',
    code: `PRAGMA foreign_keys = ON;
INSERT INTO recipe_ingredients VALUES (99, 1, '1 cup');
-- Runtime error: FOREIGN KEY constraint failed`,
  },
  task: {
    kind: 'real',
    intro: `In the VM (multipass shell stackcraft), create recipes.db with the four tables from this week's sketch plus recipe_tags, foreign keys switched on, and a few recipes.

Sketch it yourself first: recipes and ingredients are the entities, recipe_ingredients links them with an amount, tags and recipe_tags do the same for labels. Then compare with the provided script below, which you can paste as is.

Two pastes prove the design: .schema shows the tables with their REFERENCES, and a join lists the ingredients of one recipe. A third shows foreign keys really are enforced.`,
    steps: [
      {
        instruction: 'Create recipes.db from the script (or your own version of it, as long as it has recipes, ingredients, recipe_ingredients, and tags with REFERENCES between them). Then open the file and print the schema with the .schema dot command.',
        command: `cd ~\nsqlite3 recipes.db <<'EOF'\n${RECIPE_SCRIPT}EOF\nsqlite3 recipes.db ".schema"`,
        pasteLabel: 'Paste the output of .schema',
        check: [
          { type: 'includes', text: 'recipe_ingredients' },
          { type: 'includes', text: 'REFERENCES' },
          { type: 'regex', pattern: 'CREATE TABLE', count: 3, label: 'at least three CREATE TABLE statements' },
        ],
        hint: 'If .schema prints nothing, the database is empty: the here-doc probably did not run, so paste the whole block again, including the last EOF line. A "table already exists" error means it ran twice: rm recipes.db and repeat.',
        example: `CREATE TABLE recipes (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL,
  servings INTEGER NOT NULL DEFAULT 2,
  minutes  INTEGER
);
CREATE TABLE ingredients (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE recipe_ingredients (
  recipe_id     INTEGER NOT NULL REFERENCES recipes(id),
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  amount        TEXT    NOT NULL,
  PRIMARY KEY (recipe_id, ingredient_id)
);
CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE recipe_tags (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id),
  tag_id    INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (recipe_id, tag_id)
);`,
      },
      {
        instruction: 'List the ingredients of one recipe with a join through recipe_ingredients: recipes to recipe_ingredients to ingredients, filtered on the recipe name. Show the ingredient name and amount with -header -column.',
        command: `sqlite3 -header -column recipes.db "\n${JOIN_QUERY}\n"`,
        pasteLabel: 'Paste the join result',
        check: [
          { type: 'lines', atLeast: 3 },
          { type: 'regex', pattern: '^\\s*ingredient\\b', flags: 'mi', label: 'a header row starting with ingredient' },
        ],
        hint: 'Pancakes has four ingredients, so with the header and the dashes you should see six lines. If you get zero rows, check the WHERE: the name is case-sensitive, so use exactly Pancakes.',
        example: `ingredient  amount
----------  -------
egg         2
flour       200 g
milk        300 ml
salt        a pinch`,
      },
      {
        instruction: 'Prove the foreign keys are enforced. Turn them on for this session and try to insert an ingredient line for recipe 99, which does not exist. The insert must be rejected.',
        command: `sqlite3 recipes.db "PRAGMA foreign_keys = ON; INSERT INTO recipe_ingredients VALUES (99, 1, '1 cup');"`,
        pasteLabel: 'Paste the error message',
        check: [{ type: 'includes', text: 'FOREIGN KEY constraint failed' }],
        hint: 'If the insert succeeded silently, the PRAGMA was missing: it must run in the same sqlite3 call as the INSERT, since the setting belongs to the connection. Delete the bad row afterwards with DELETE FROM recipe_ingredients WHERE recipe_id = 99;',
        example: 'Runtime error near line 1: FOREIGN KEY constraint failed (19)',
      },
    ],
  },
  quiz: [
    { question: 'Why does recipe_ingredients carry the amount column?', options: ['Because every table needs three columns', 'The amount is a fact about the recipe and ingredient pair', 'To make joins faster'], answer: 1, explanation: 'Neither the recipe nor the ingredient alone knows the amount; the link does.' },
    { question: 'What does PRAGMA foreign_keys = ON do in sqlite3?', options: ['Creates the foreign keys', 'Makes this connection enforce the REFERENCES you declared', 'Speeds up joins'], answer: 1, explanation: 'SQLite declares foreign keys but only enforces them when the connection asks.' },
    { question: 'Which sqlite3 command prints the CREATE statements?', options: ['.tables', '.schema', 'SHOW TABLES;'], answer: 1, explanation: '.tables lists names only; .schema prints the full definitions.' },
  ],
}

export default lesson
