import type { Lesson } from '../types'
import { codeHas, outHas, steps } from '../checks'

const CODE = `import os
from pathlib import Path

import pytest


def parse_qty(text):
    """Turn '3' into 3. Anything that is not a whole number is an error."""
    if not text.strip().isdigit():
        raise ValueError(f"not a whole number: {text}")
    return int(text)


def save_notes(path, notes):
    """Write one note per line."""
    Path(path).write_text("\\n".join(notes) + "\\n")


def data_dir():
    """Where the inventory lives: an environment variable, or a default."""
    return os.environ.get("INVENTORY_HOME", "/var/lib/inventory")
`

const STARTER = `${CODE}

def test_parse_qty_ok():
    assert parse_qty(" 3 ") == 3


# 1. test_parse_qty_rejects_text  2. test_save_notes  3. and 4. data_dir tests


pytest.main()
`

const SOLUTION = `${CODE}

def test_parse_qty_ok():
    assert parse_qty(" 3 ") == 3


def test_parse_qty_rejects_text():
    with pytest.raises(ValueError, match="not a whole number"):
        parse_qty("three")


def test_save_notes(tmp_path):
    target = tmp_path / "notes.txt"
    save_notes(target, ["buy cable", "count widgets"])
    assert target.read_text() == "buy cable\\ncount widgets\\n"


def test_data_dir_from_env(monkeypatch):
    monkeypatch.setenv("INVENTORY_HOME", "/tmp/inv")
    assert data_dir() == "/tmp/inv"


def test_data_dir_default(monkeypatch):
    monkeypatch.delenv("INVENTORY_HOME", raising=False)
    assert data_dir() == "/var/lib/inventory"


pytest.main()
`

const lesson: Lesson = {
  id: 'w17d3',
  tier: 2,
  track: 'python',
  week: 17,
  day: 3,
  title: 'pytest.raises, tmp_path, monkeypatch',
  concept: `Good code raises errors on bad input, and that behavior deserves a test. with pytest.raises(ValueError, match="not a whole number"): wraps the call that should fail. The test passes only if that exception type is raised inside the block, and match checks the message with a regular expression. If nothing is raised, pytest reports DID NOT RAISE.

Tests that write files should never touch your real folders. The built-in tmp_path fixture hands each test a fresh, empty directory as a pathlib.Path. Write there, read it back, and forget about cleanup.

monkeypatch temporarily changes things the code under test depends on: an environment variable with setenv or delenv, an attribute with setattr, a dictionary entry with setitem. Every change is undone when the test ends, so tests stay independent.`,
  example: {
    language: 'python',
    caption: 'Three built-in tools in three short tests',
    code: `import os
import pytest

def test_bad_input():
    with pytest.raises(ValueError, match="empty"):
        int_or_raise("")

def test_writes_file(tmp_path):
    out = tmp_path / "out.txt"
    out.write_text("hi")
    assert out.read_text() == "hi"

def test_env(monkeypatch):
    monkeypatch.setenv("MODE", "test")
    assert os.environ["MODE"] == "test"`,
  },
  task: {
    kind: 'python',
    instructions: 'Test the error path, a file write, and an environment lookup.\n1. Write test_parse_qty_rejects_text: inside  with pytest.raises(ValueError, match="not a whole number"):  call parse_qty("three").\n2. Write test_save_notes(tmp_path): target = tmp_path / "notes.txt", call save_notes(target, ["buy cable", "count widgets"]), then assert target.read_text() equals the two lines each ending with a newline.\n3. Write test_data_dir_from_env(monkeypatch): monkeypatch.setenv("INVENTORY_HOME", "/tmp/inv") then assert data_dir() == "/tmp/inv".\n4. Write test_data_dir_default(monkeypatch): monkeypatch.delenv("INVENTORY_HOME", raising=False) then assert data_dir() == "/var/lib/inventory".\n5. Run and look for  5 passed.',
    starter: STARTER,
    hints: [
      'with pytest.raises(ValueError, match="not a whole number"):\n    parse_qty("three")',
      'tmp_path is a pathlib.Path, so tmp_path / "notes.txt" builds the file path and .read_text() reads it back.',
      'The expected file content is "buy cable\\ncount widgets\\n" (a newline after each note).',
      'delenv(..., raising=False) means: remove it if present, do not complain if absent.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const wrote = Object.keys(r.fs ?? {}).some((p) => /^tmp\/.*notes\.txt$/.test(p))
      return steps([
        [codeHas(r, /pytest\.main\(\)/), 'Keep pytest.main() as the last line.'],
        [codeHas(r, /with pytest\.raises\(ValueError,\s*match=/) && outHas(r, /test_parse_qty_rejects_text PASSED/), 'Step 1: test_parse_qty_rejects_text should use  with pytest.raises(ValueError, match="not a whole number"):  around parse_qty("three").'],
        [codeHas(r, /def test_save_notes\(tmp_path\)/) && wrote, 'Step 2: test_save_notes(tmp_path) should write notes.txt inside tmp_path.'],
        [outHas(r, /test_save_notes PASSED/), 'Step 2: test_save_notes fails. Compare against "buy cable\\ncount widgets\\n".'],
        [codeHas(r, /monkeypatch\.setenv\(\s*["']INVENTORY_HOME["']/) && outHas(r, /test_data_dir_from_env PASSED/), 'Step 3: test_data_dir_from_env(monkeypatch) should setenv INVENTORY_HOME and check data_dir().'],
        [codeHas(r, /monkeypatch\.delenv\(\s*["']INVENTORY_HOME["']/) && outHas(r, /test_data_dir_default PASSED/), 'Step 4: test_data_dir_default(monkeypatch) should delenv INVENTORY_HOME with raising=False and expect the default.'],
        [outHas(r, /\b5 passed\b/) && !outHas(r, /FAILED/), 'Step 5: the summary should read  5 passed.'],
      ], 'Errors, files, and environment: the three things that make tests flaky, tamed.')
    },
  },
  quiz: [
    { question: 'What does pytest report if the code inside pytest.raises does not raise?', options: ['PASSED, since no error happened', 'FAILED with DID NOT RAISE', 'SKIPPED'], answer: 1, explanation: 'The block exists to demand an exception; its absence is a failure.' },
    { question: 'Why use tmp_path instead of writing to notes.txt in the current folder?', options: ['Current-folder writes are slower', 'Each test gets a fresh empty directory, so tests cannot see each other\'s files or litter your project', 'Python forbids writing to the current folder in tests'], answer: 1, explanation: 'Isolation is the point: no leftovers, no order dependence.' },
    { question: 'When does a monkeypatch.setenv change get undone?', options: ['Never, you must call delenv yourself', 'At the end of the test that used it', 'When Python exits'], answer: 1, explanation: 'monkeypatch records every change and reverts it during teardown of that test.' },
  ],
}

export default lesson
