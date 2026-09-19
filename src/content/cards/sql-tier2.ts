import type { Card } from '../types'

const c = (n: number, lesson: string, front: string, back: string): Card => ({ id: `sql-${n}`, track: 'sql', tier: 2, lesson, front, back })

/** Tier 2 SQL cards, unlocked lesson by lesson from week 15 onward. */
export const SQL_TIER2_CARDS: Card[] = [
  c(26, 'w15d1', 'WITH recent AS (SELECT ...) SELECT ... FROM recent', 'A CTE names a subquery so the query reads top to bottom. It exists only for that statement.'),
  c(27, 'w15d2', 'Chaining CTEs', 'WITH a AS (...), b AS (SELECT ... FROM a) SELECT ... FROM b. Each CTE can use the ones before it.'),
  c(28, 'w15d3', 'WITH RECURSIVE', 'A CTE that refers to itself: a base row UNION ALL a step that builds on the previous rows. Walks trees and number ranges.'),
  c(29, 'w15d4', 'CTE vs view', 'A CTE lives inside one query. A view is saved in the database and can be reused by any query.'),
  c(30, 'w18d1', 'ROW_NUMBER() OVER (ORDER BY amount DESC)', 'Numbers rows 1, 2, 3 in that order without collapsing them. RANK leaves gaps after ties, DENSE_RANK does not.'),
  c(31, 'w18d2', 'PARTITION BY', 'Restarts a window function for each group, like numbering products within each month.'),
  c(32, 'w18d3', 'SUM(x) OVER (ORDER BY day ROWS UNBOUNDED PRECEDING)', 'A running total: each row sums itself and every row before it.'),
  c(33, 'w18d4', 'LAG(revenue) OVER (ORDER BY month)', 'The previous row value. Subtract it from the current row for month-over-month change. LEAD looks forward.'),
  c(34, 'w21d1', 'Entity, attribute, relationship', 'A table, its columns, and how tables link through keys. Sketch these before writing CREATE TABLE.'),
  c(35, 'w21d2', 'Third normal form in plain words', 'Every column depends on the key, the whole key, and nothing but the key. No repeated groups, no facts stored twice.'),
  c(36, 'w21d3', 'Junction table', 'A table with two foreign keys that turns a many-to-many relationship into two one-to-many ones.'),
  c(37, 'w21d4', 'When is denormalizing okay?', 'When a read is hot and the copied value rarely changes, like a cached total. Do it on purpose and document it.'),
  c(38, 'w24d1', 'CREATE VIEW name AS SELECT ...', 'Saves a query under a name. Querying the view runs the query fresh each time.'),
  c(39, 'w24d3', 'Are views updatable in SQLite?', 'No, not directly. An INSTEAD OF trigger can translate an UPDATE on the view into changes on the base table.'),
  c(40, 'w24d4', 'CREATE TRIGGER ... AFTER INSERT ON sales', 'Runs statements automatically after each insert, for example lowering stock or writing an audit row.'),
  c(41, 'w27d1', 'EXPLAIN QUERY PLAN', 'Shows how SQLite will run a query. SCAN reads the whole table; SEARCH ... USING INDEX uses an index.'),
  c(42, 'w27d2', 'Composite index column order', 'An index on (a, b) helps WHERE a = ? and WHERE a = ? AND b = ?, but not WHERE b = ? alone.'),
  c(43, 'w27d3', 'When do indexes hurt?', 'Every insert and update must maintain them, and an index on a column with few distinct values rarely helps.'),
  c(44, 'w27d4', 'Why avoid strftime(col) in WHERE?', 'A function on an indexed column hides the index. Compare against a range instead: col >= start AND col < end.'),
  c(45, 'w27d4', 'The N+1 pattern', 'One query for a list, then one query per row. Replace it with a single JOIN or an IN list.'),
]
