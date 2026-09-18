import type { Lesson } from '../types'
import { hasObject, lastOk, sqlFailed, sqlHas, steps, tableRows } from '../checks'

const BLOG = `
CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
INSERT INTO posts VALUES (1, 'Backing up with tar'), (2, 'My first pytest'), (3, 'CTEs explained');
INSERT INTO tags VALUES (1, 'linux'), (2, 'python'), (3, 'sql'), (4, 'beginner');
`

const lesson: Lesson = {
  id: 'w21d3',
  tier: 2,
  track: 'sql',
  week: 21,
  day: 3,
  title: 'Many-to-many with junction tables',
  concept: `A post can have many tags, and a tag belongs to many posts. Neither side can hold the other's id: one tag_id column allows one tag, and a comma-separated list breaks first normal form.

The answer is a third table, a junction table, with one row per link: post_tags (post_id, tag_id). Both columns are foreign keys, and together they form the primary key, so the same link cannot be stored twice.

Name it after both sides: post_tags, recipe_ingredients. The junction can carry facts about the link itself, such as the amount of an ingredient in a recipe.

To list a post's tags, join through the middle: posts to post_tags to tags. GROUP_CONCAT folds the tags into one cell for display, fine in a query though wrong in a table.`,
  example: {
    language: 'sql',
    caption: 'The link table and a join through it',
    code: `CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  tag_id  INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);

SELECT p.title, t.name
FROM posts p
JOIN post_tags pt ON pt.post_id = p.id
JOIN tags t ON t.id = pt.tag_id;`,
  },
  task: {
    kind: 'sql',
    instructions: 'The database has posts (1 to 3) and tags (1 linux, 2 python, 3 sql, 4 beginner). Run each step as its own statement.\n1. Create post_tags as in the example: post_id and tag_id, both NOT NULL with REFERENCES, and PRIMARY KEY (post_id, tag_id).\n2. Insert the links: post 1 gets tags 1 and 4, post 2 gets tags 2 and 4, post 3 gets tag 3.\n3. Try to insert the link (1, 1) a second time. It should fail. That error is the primary key doing its job.\n4. List each post with its tags in one cell: title and GROUP_CONCAT(t.name, \', \') AS tags, joined through post_tags, GROUP BY p.id, ORDER BY p.id.',
    setup: BLOG,
    hints: ['CREATE TABLE post_tags (post_id INTEGER NOT NULL REFERENCES posts(id), tag_id INTEGER NOT NULL REFERENCES tags(id), PRIMARY KEY (post_id, tag_id));', 'INSERT INTO post_tags VALUES (1, 1), (1, 4), (2, 2), (2, 4), (3, 3);', 'The duplicate insert should answer with UNIQUE constraint failed. That is the expected result of step 3.', "SELECT p.title, GROUP_CONCAT(t.name, ', ') AS tags FROM posts p JOIN post_tags pt ON pt.post_id = p.id JOIN tags t ON t.id = pt.tag_id GROUP BY p.id ORDER BY p.id;"],
    solution: { commands: ['CREATE TABLE post_tags (post_id INTEGER NOT NULL REFERENCES posts(id), tag_id INTEGER NOT NULL REFERENCES tags(id), PRIMARY KEY (post_id, tag_id));', 'INSERT INTO post_tags VALUES (1, 1), (1, 4), (2, 2), (2, 4), (3, 3);', 'INSERT INTO post_tags VALUES (1, 1);', "SELECT p.title, GROUP_CONCAT(t.name, ', ') AS tags FROM posts p JOIN post_tags pt ON pt.post_id = p.id JOIN tags t ON t.id = pt.tag_id GROUP BY p.id ORDER BY p.id;"] },
    check: (r) => {
      const sets = r.results ?? []
      const schema = r.schema?.post_tags ?? ''
      // Tags inside a GROUP_CONCAT cell may come in any order, so compare them sorted.
      const norm = (s: { values: unknown[][] }) => s.values.map((v) => `${v[0]}:${String(v[1] ?? '').split(',').map((t) => t.trim()).sort().join(',')}`).join('|')
      return steps([
        lastOk(r),
        [hasObject(r, 'post_tags') && /REFERENCES\s+posts/i.test(schema) && /REFERENCES\s+tags/i.test(schema) && /PRIMARY\s+KEY\s*\(\s*post_id\s*,\s*tag_id\s*\)/i.test(schema), 'Step 1: CREATE TABLE post_tags with both foreign keys and PRIMARY KEY (post_id, tag_id).'],
        [tableRows(r, 'post_tags').length === 5, 'Step 2: insert five links: (1, 1), (1, 4), (2, 2), (2, 4), (3, 3).'],
        [sqlFailed(r, /INSERT\s+INTO\s+post_tags/, /UNIQUE constraint failed/), 'Step 3: insert (1, 1) again and let it fail with UNIQUE constraint failed.'],
        [sqlHas(r, /GROUP_CONCAT\s*\(/) && sets.some((s) => norm(s) === 'Backing up with tar:beginner,linux|My first pytest:beginner,python|CTEs explained:sql'), "Step 4: title and GROUP_CONCAT(t.name, ', ') AS tags through post_tags, GROUP BY p.id, ORDER BY p.id."],
      ], 'Two sides, one link table, no duplicates.')
    },
  },
  quiz: [
    { question: 'How do you model posts that have many tags and tags on many posts?', options: ['A tag_id column on posts', 'A junction table with post_id and tag_id', 'A comma-separated tags column'], answer: 1, explanation: 'One row per link keeps every value single and every fact stored once.' },
    { question: 'Why make (post_id, tag_id) the primary key?', options: ['Faster inserts', 'So the same link cannot be stored twice', 'SQLite requires a primary key'], answer: 1, explanation: 'The composite key rejects duplicate links automatically.' },
    { question: 'Can a junction table have extra columns?', options: ['No, only the two ids', 'Yes, for facts about the link, like an amount', 'Only text columns'], answer: 1, explanation: 'recipe_ingredients can hold the amount, because that fact belongs to the pair.' },
  ],
}

export default lesson
