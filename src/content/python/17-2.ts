import type { Lesson } from '../types'
import { codeHas, outHas, steps } from '../checks'

const CART = `import pytest


class Cart:
    def __init__(self):
        self.lines = {}

    def add(self, name, price, qty=1):
        if name in self.lines:
            self.lines[name]["qty"] += qty
        else:
            self.lines[name] = {"price": price, "qty": qty}

    def total(self):
        return sum(line["price"] * line["qty"] for line in self.lines.values())

    def discounted(self, pct):
        return round(self.total() * (1 - pct / 100), 2)
`

const STARTER = `${CART}

# 1. fixture: a cart with 2 pens at 1.5 and 1 book at 12.0


# 2. test_total, 3. test_add_merges, 4. parametrized test_discounted


pytest.main()
`

const SOLUTION = `${CART}

@pytest.fixture
def cart():
    c = Cart()
    c.add("pen", 1.5, 2)
    c.add("book", 12.0)
    return c


def test_total(cart):
    assert cart.total() == 15.0


def test_add_merges(cart):
    cart.add("pen", 1.5, 3)
    assert cart.lines["pen"]["qty"] == 5


@pytest.mark.parametrize("pct,expected", [(0, 15.0), (10, 13.5), (50, 7.5)])
def test_discounted(cart, pct, expected):
    assert cart.discounted(pct) == expected


pytest.main()
`

const lesson: Lesson = {
  id: 'w17d2',
  tier: 2,
  track: 'python',
  week: 17,
  day: 2,
  title: 'Fixtures and parametrize',
  concept: `Most tests need the same setup: a cart with a few lines in it, a file with known content, a connection. Copying that setup into every test is noise. A fixture is a function decorated with @pytest.fixture that builds the thing and returns it. Any test that names the fixture as a parameter receives a fresh copy, so one test cannot leak changes into another.

Parametrize solves the other kind of repetition: the same assertion with different inputs. @pytest.mark.parametrize("pct,expected", [(0, 15.0), (10, 13.5)]) runs the test once per tuple, and each run gets its own line in the report, like test_discounted[10-13.5], so you can see exactly which case broke.

Fixtures and parametrize combine freely: a parametrized test can take a fixture too.`,
  example: {
    language: 'python',
    caption: 'A fixture and a parametrized test',
    code: `import pytest

@pytest.fixture
def numbers():
    return [3, 1, 2]

def test_sorted(numbers):
    assert sorted(numbers) == [1, 2, 3]

@pytest.mark.parametrize("n,expected", [(0, 0), (3, 6), (4, 10)])
def test_triangle(n, expected):
    assert sum(range(n + 1)) == expected

# main.py::test_sorted PASSED
# main.py::test_triangle[0-0] PASSED
# main.py::test_triangle[3-6] PASSED
# main.py::test_triangle[4-10] PASSED`,
  },
  task: {
    kind: 'python',
    instructions: 'Test the Cart class with a fixture and a parametrized test.\n1. Write a fixture called cart that returns a Cart holding 2 pens at 1.5 and 1 book at 12.0 (total 15.0).\n2. Write test_total(cart) asserting cart.total() == 15.0.\n3. Write test_add_merges(cart): add 3 more pens at 1.5, then assert cart.lines["pen"]["qty"] == 5.\n4. Write test_discounted with @pytest.mark.parametrize("pct,expected", ...) over the cases (0, 15.0), (10, 13.5), (50, 7.5). It takes cart, pct, and expected and asserts cart.discounted(pct) == expected.\n5. Run and look for  5 passed  with three test_discounted[...] lines.',
    starter: STARTER,
    hints: [
      '@pytest.fixture above def cart(): build a Cart, c.add("pen", 1.5, 2), c.add("book", 12.0), return c',
      'A test receives the fixture by naming it: def test_total(cart): assert cart.total() == 15.0',
      '@pytest.mark.parametrize("pct,expected", [(0, 15.0), (10, 13.5), (50, 7.5)]) directly above def test_discounted(cart, pct, expected):',
      'Each parametrized case becomes its own test in the report, like main.py::test_discounted[10-13.5].',
    ],
    solution: { file: SOLUTION },
    check: (r) => steps([
      [codeHas(r, /pytest\.main\(\)/), 'Keep pytest.main() as the last line.'],
      [codeHas(r, /@pytest\.fixture\s*(\(\s*\))?\s*\ndef cart\(/), 'Step 1: decorate def cart() with @pytest.fixture.'],
      [codeHas(r, /def test_total\(cart\)/), 'Step 2: def test_total(cart) receives the fixture by parameter name.'],
      [outHas(r, /test_total PASSED/), 'Step 2: test_total fails. The fixture cart should hold 2 pens at 1.5 and 1 book at 12.0 so the total is 15.0.'],
      [codeHas(r, /def test_add_merges\(cart\)/) && outHas(r, /test_add_merges PASSED/), 'Step 3: test_add_merges(cart) should add 3 pens and assert the pen qty is 5.'],
      [codeHas(r, /@pytest\.mark\.parametrize\(\s*["']pct,\s*expected["']/), 'Step 4: use @pytest.mark.parametrize("pct,expected", [...]) above test_discounted.'],
      [outHas(r, /test_discounted\[0-15\.0\] PASSED/) && outHas(r, /test_discounted\[10-13\.5\] PASSED/) && outHas(r, /test_discounted\[50-7\.5\] PASSED/), 'Step 4: expected three passing cases: test_discounted[0-15.0], [10-13.5], and [50-7.5].'],
      [outHas(r, /\b5 passed\b/) && !outHas(r, /FAILED/), 'Step 5: the summary should read  5 passed  with no failures.'],
    ], 'One fixture, five tests, zero copied setup.'),
  },
  quiz: [
    { question: 'How does a test get a fixture?', options: ['By calling the fixture function directly', 'By naming the fixture as a parameter; pytest passes the value in', 'By importing it from conftest'], answer: 1, explanation: 'pytest matches parameter names to fixtures and calls the fixture for you.' },
    { question: 'Two tests both modify the cart fixture. Do they interfere?', options: ['Yes, the second test sees the first test\'s changes', 'No, each test gets a fresh cart because function-scoped fixtures run once per test', 'Only if they run in the same second'], answer: 1, explanation: 'Default fixture scope is function, so setup runs again for every test.' },
    { question: 'What does parametrize with three tuples produce in the report?', options: ['One test line', 'Three separate test lines with the values in brackets', 'A warning'], answer: 1, explanation: 'Each case is its own test, like test_discounted[10-13.5], so you see exactly which input failed.' },
  ],
}

export default lesson
