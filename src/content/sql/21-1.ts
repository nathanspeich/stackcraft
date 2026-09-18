import type { Lesson } from '../types'
import { hasObject, lastOk, sqlHas, steps, tableRows } from '../checks'

const lesson: Lesson = {
  id: 'w21d1',
  tier: 2,
  track: 'sql',
  week: 21,
  day: 1,
  title: 'Entities, attributes, relationships',
  concept: `Before CREATE TABLE, sketch. Three questions design most schemas.

What are the things? Those are entities: author, book, customer, order. Each becomes a table, named in plural or singular but consistently.

What do we know about each thing? Those are attributes: a book has a title and a year. Each becomes a column. Only facts about that one thing belong in its table.

How do the things connect? Those are relationships. One author writes many books: one-to-many, so the book row carries author_id pointing at its author. Many books have many tags: many-to-many, which needs a third table (day 3).

Draw boxes for entities, list attributes inside, and draw lines with a crow's foot on the many side. Ten minutes of sketching saves hours of ALTER TABLE.`,
  example: {
    language: 'text',
    caption: 'A sketch: one author, many books',
    code: `+-----------+        +------------+
| authors   |        | books      |
+-----------+ 1    * +------------+
| id        |--------| id         |
| name      |        | title      |
| country   |        | year       |
+-----------+        | author_id  |  -> authors.id
                     +------------+`,
  },
  task: {
    kind: 'sql',
    instructions: 'Build the sketch above. The console starts empty. Run each step as its own statement.\n1. Create authors with id INTEGER PRIMARY KEY, name TEXT NOT NULL, and country TEXT.\n2. Create books with id INTEGER PRIMARY KEY, title TEXT NOT NULL, year INTEGER, and author_id INTEGER NOT NULL REFERENCES authors(id).\n3. Insert two authors: (1, \'Ursula K. Le Guin\', \'USA\') and (2, \'Haruki Murakami\', \'Japan\').\n4. Insert three books: (1, \'A Wizard of Earthsea\', 1968, 1), (2, \'The Dispossessed\', 1974, 1), (3, \'Kafka on the Shore\', 2002, 2).\n5. List every book with its author\'s name: title and name, joined on author_id, ORDER BY title.',
    hints: ['CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT);', 'The many side holds the key: author_id INTEGER NOT NULL REFERENCES authors(id) goes in books.', 'SELECT b.title, a.name FROM books b JOIN authors a ON a.id = b.author_id ORDER BY b.title;'],
    solution: { commands: ['CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT);', 'CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, year INTEGER, author_id INTEGER NOT NULL REFERENCES authors(id));', "INSERT INTO authors VALUES (1, 'Ursula K. Le Guin', 'USA'), (2, 'Haruki Murakami', 'Japan');", "INSERT INTO books VALUES (1, 'A Wizard of Earthsea', 1968, 1), (2, 'The Dispossessed', 1974, 1), (3, 'Kafka on the Shore', 2002, 2);", 'SELECT b.title, a.name FROM books b JOIN authors a ON a.id = b.author_id ORDER BY b.title;'] },
    check: (r) => {
      const sets = r.results ?? []
      const flat = (s: { values: unknown[][] }) => s.values.map((v) => v.join(':')).join('|')
      const books = r.schema?.books ?? ''
      return steps([
        lastOk(r),
        [hasObject(r, 'authors') && /name\s+TEXT\s+NOT\s+NULL/i.test(r.schema?.authors ?? ''), 'Step 1: CREATE TABLE authors with id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT.'],
        [hasObject(r, 'books') && /author_id\s+INTEGER\s+NOT\s+NULL\s+REFERENCES\s+authors\s*\(\s*id\s*\)/i.test(books), 'Step 2: CREATE TABLE books with author_id INTEGER NOT NULL REFERENCES authors(id).'],
        [tableRows(r, 'authors').length === 2, 'Step 3: insert the two authors, Ursula K. Le Guin (1) and Haruki Murakami (2).'],
        [tableRows(r, 'books').length === 3 && tableRows(r, 'books').filter((b) => b.author_id === 1).length === 2, 'Step 4: insert the three books, two by author 1 and one by author 2.'],
        [sqlHas(r, /JOIN\s+authors/) && sets.some((s) => flat(s) === 'A Wizard of Earthsea:Ursula K. Le Guin|Kafka on the Shore:Haruki Murakami|The Dispossessed:Ursula K. Le Guin'), 'Step 5: title and author name, joined on author_id, ordered by title. A Wizard of Earthsea comes first.'],
      ], 'Sketched, built, and joined.')
    },
  },
  quiz: [
    { question: 'In a schema sketch, what does an entity become?', options: ['A column', 'A table', 'An index'], answer: 1, explanation: 'Each kind of thing gets its own table; its facts become columns.' },
    { question: 'One author writes many books. Where does the foreign key go?', options: ['In authors, as book_id', 'In books, as author_id', 'In both tables'], answer: 1, explanation: 'The many side points at the one side, so each book names its single author.' },
    { question: 'Which fact belongs in the books table?', options: ['The author\'s country', 'The book\'s year', 'The number of authors'], answer: 1, explanation: 'Only facts about that one book. The country is a fact about the author.' },
  ],
}

export default lesson
