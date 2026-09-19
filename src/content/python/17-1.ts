import type { Lesson } from '../types'
import { codeHas, outHas, steps } from '../checks'

const STARTER = `import pytest


def slugify(text):
    """Turn 'Hello World' into 'hello-world' for use in a URL."""
    return "-".join(text.lower().split(" "))


# write the tests here


pytest.main()
`

const SOLUTION = `import pytest


def slugify(text):
    """Turn 'Hello World' into 'hello-world' for use in a URL."""
    cleaned = "".join(ch if ch.isalnum() else " " for ch in text.lower())
    return "-".join(cleaned.split())


def test_simple():
    assert slugify("Hello World") == "hello-world"


def test_punctuation():
    assert slugify("Hello, World!") == "hello-world"


def test_extra_spaces():
    assert slugify("  many   spaces ") == "many-spaces"


pytest.main()
`

const lesson: Lesson = {
  id: 'w17d1',
  tier: 2,
  track: 'python',
  week: 17,
  day: 1,
  title: 'Why tests, plain assert, how pytest finds tests',
  concept: `A test is a small function that calls your code and states what should come back. assert slugify("Hello World") == "hello-world" is a complete test: if the comparison is false, assert raises AssertionError and the test fails. Tests let you change code next month without breaking what works today.

pytest is the standard test runner. It finds tests by naming convention: files called test_*.py, functions called test_*, and classes called Test*. It prints one line per test, PASSED or FAILED, then explains each failure by showing the assert with the actual values.

In this app a small stand-in works the same way: import pytest and call pytest.main() at the bottom, and it collects the test functions from your file. Day 5 runs the real thing in the VM.`,
  example: {
    language: 'python',
    caption: 'A failing test, as pytest reports it',
    code: `def add(a, b):
    return a - b     # bug

def test_add():
    assert add(2, 2) == 4

# main.py::test_add FAILED
#     def test_add():
# >       assert add(2, 2) == 4
# E       assert 0 == 4
# E        +  where 0 = add(2, 2)`,
  },
  task: {
    kind: 'python',
    instructions: 'slugify has a bug. Write tests that expose it, then fix it.\n1. Write test_simple: slugify("Hello World") should be "hello-world".\n2. Write test_punctuation: slugify("Hello, World!") should be "hello-world".\n3. Write test_extra_spaces: slugify("  many   spaces ") should be "many-spaces".\n4. Run. Read the failure report: which tests fail and what did slugify return?\n5. Fix slugify so every character that is not a letter or digit becomes a space, then split() without an argument (it collapses runs of whitespace) and join with "-". Run again until you see  3 passed.',
    starter: STARTER,
    hints: [
      'def test_simple(): assert slugify("Hello World") == "hello-world"',
      'A failing test shows  E       assert \'hello,-world!\' == \'hello-world\'  so you can see exactly what came back.',
      'cleaned = "".join(ch if ch.isalnum() else " " for ch in text.lower()) turns punctuation into spaces.',
      'return "-".join(cleaned.split()) because split() with no argument drops empty pieces.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const tests = (r.input.match(/^def test_\w+\(/gm) ?? []).length
      return steps([
        [codeHas(r, /pytest\.main\(\)/), 'Keep pytest.main() as the last line so the tests run.'],
        [codeHas(r, /^def test_simple\(/m), 'Step 1: write def test_simple() with an assert on slugify("Hello World").'],
        [codeHas(r, /^def test_punctuation\(/m), 'Step 2: write def test_punctuation() for "Hello, World!".'],
        [codeHas(r, /^def test_extra_spaces\(/m), 'Step 3: write def test_extra_spaces() for "  many   spaces ".'],
        [tests >= 3 && outHas(r, /collected [3-9] items/), 'Steps 1 to 3: pytest should report  collected 3 items. Test functions must start with test_ and take no arguments.'],
        [!outHas(r, /FAILED/) && outHas(r, /\b3 passed\b/), 'Step 5: some tests still fail. Read the E lines under FAILURES: they show what slugify returned. Fix slugify, not the tests.'],
        [codeHas(r, /isalnum\(\)/) && codeHas(r, /\.split\(\)/), 'Step 5: use ch.isalnum() to replace punctuation with spaces and split() with no argument to collapse them.'],
      ], 'Red, then green. The tests now guard slugify for good.')
    },
  },
  quiz: [
    { question: 'What happens when the expression after assert is false?', options: ['Python prints a warning and continues', 'AssertionError is raised, and pytest marks the test FAILED', 'The program exits with status 0'], answer: 1, explanation: 'assert raises AssertionError, which pytest catches and reports with the actual values.' },
    { question: 'Which function would pytest collect?', options: ['def check_slug():', 'def test_slug():', 'def slug_test():'], answer: 1, explanation: 'pytest collects functions whose names start with test_ inside files named test_*.py.' },
    { question: 'Why write tests for code that already works?', options: ['They prove the code will never have bugs', 'They let you change the code later and find out immediately if something broke', 'pytest refuses to run untested code'], answer: 1, explanation: 'Tests are a safety net for change. They catch regressions the moment they happen.' },
  ],
}

export default lesson
