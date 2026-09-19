import type { Lesson } from '../types'

/** Reference test file for the week 14 inventory.py, shown in the step so a stuck learner can still finish. */
const TEST_INVENTORY_PY = `"""Tests for inventory.py. Run from the project folder with: python3 -m pytest -v"""
import json

import pytest

from inventory import Inventory, Item, main


@pytest.fixture
def inv(tmp_path):
    """An empty inventory that saves into a temporary folder."""
    return Inventory(tmp_path / "inventory.json")


def test_add_creates_item(inv):
    item = inv.add("Widget", 3)
    assert item == Item("Widget", 3)
    assert len(inv) == 1


def test_add_merges_quantity(inv):
    inv.add("Widget", 3)
    inv.add("Widget", 2)
    assert inv.items["Widget"].qty == 5


def test_add_rejects_zero(inv):
    with pytest.raises(ValueError, match="positive"):
        inv.add("Widget", 0)


def test_remove_part(inv):
    inv.add("Widget", 3)
    inv.remove("Widget", 1)
    assert inv.items["Widget"].qty == 2


def test_remove_all(inv):
    inv.add("Widget", 3)
    inv.remove("Widget")
    assert "Widget" not in inv


def test_remove_missing_raises(inv):
    with pytest.raises(KeyError):
        inv.remove("Nothing")


def test_save_then_load(tmp_path):
    path = tmp_path / "inventory.json"
    inv = Inventory(path)
    inv.add("Widget", 3)
    inv.save()
    assert json.loads(path.read_text()) == [{"name": "Widget", "qty": 3}]
    assert list(Inventory.load(path)) == [Item("Widget", 3)]


def test_cli_add_then_list(tmp_path, capsys):
    path = str(tmp_path / "inventory.json")
    assert main(["--file", path, "add", "Widget", "3"]) == 0
    assert main(["--file", path, "list"]) == 0
    out = capsys.readouterr().out
    assert "added Widget x3" in out
    assert "Widget x3" in out
    assert "1 item(s)" in out
`

const lesson: Lesson = {
  id: 'w17d5',
  tier: 2,
  track: 'python',
  week: 17,
  day: 5,
  title: 'Project: tests for inventory.py',
  badge: 'test-pilot',
  concept: `Time to run the real pytest against the real inventory.py from week 14. The tool lives in ~/inventory on the VM, so the tests go in ~/inventory/tests/test_inventory.py and import from inventory.

Two habits from this week apply directly. A fixture builds an Inventory whose path is inside tmp_path, so no test ever touches the real inventory.json. And main(argv) accepts a list, so the command-line behavior can be tested too, with capsys reading what it printed.

Install pytest into a virtual environment rather than system Python: Ubuntu protects its own packages, and a venv keeps project tools together. Run tests as python3 -m pytest so the current folder is on the import path. pytest-cov adds the --cov flag for the coverage table.`,
  example: {
    language: 'bash',
    caption: 'A venv, then pytest, then coverage',
    code: `cd ~/inventory
python3 -m venv .venv
source .venv/bin/activate
pip install pytest pytest-cov
python3 -m pytest -v
python3 -m pytest --cov=inventory tests/`,
  },
  task: {
    kind: 'real',
    intro: `You will test the inventory.py you built in week 14, in the VM, with the real pytest. The tests cover add, remove, saving to a temporary file, and the command line, then you measure coverage.

Open the box with  multipass shell stackcraft  and go to ~/inventory. If inventory.py is missing, redo week 14 day 5 first: its step 1 writes the reference file.

Write the tests yourself if you can, using what you did on day 4. Step 2 contains a complete reference test file you can paste instead. Either way, run pytest, read every line it prints, and paste the output here. The app only checks the text you paste; it never touches the VM.`,
    steps: [
      {
        instruction: 'Create a virtual environment inside ~/inventory, activate it, and install pytest and pytest-cov. Ubuntu needs the python3-venv package first. Then paste the version line.',
        command: `cd ~/inventory
sudo apt install -y python3-venv
python3 -m venv .venv
source .venv/bin/activate
pip install pytest pytest-cov
python3 -m pytest --version`,
        pasteLabel: 'Paste the output of python3 -m pytest --version',
        check: [
          { type: 'regex', pattern: 'pytest \\d+\\.\\d+', label: 'a line like pytest 8.3.3' },
        ],
        hint: 'If you see "No module named pytest", the venv is not active: run  source .venv/bin/activate  and the prompt gains a (.venv) prefix. If python3 -m venv fails with "ensurepip is not available", run the apt install line first.',
        example: `pytest 8.3.3`,
      },
      {
        instruction: 'Create tests/test_inventory.py. The command writes the reference tests; replace them with your own if you prefer, but keep at least tests for add, remove, and saving to a temporary file. Then run pytest in verbose mode and paste everything it prints.',
        command: `cd ~/inventory
mkdir -p tests
cat > tests/test_inventory.py <<'EOF'
${TEST_INVENTORY_PY}EOF
python3 -m pytest -v`,
        pasteLabel: 'Paste the output of python3 -m pytest -v',
        check: [
          { type: 'regex', pattern: '\\d+ passed', label: 'a summary like 8 passed' },
          { type: 'not', pattern: '\\bfailed\\b|FAILED|\\berror\\b', label: 'no failed tests or errors' },
          { type: 'includes', text: 'test_inventory.py' },
        ],
        hint: 'A failing test prints the assert with real values under FAILURES: read it, then fix inventory.py (not the test) if the tool behaves differently from week 14. "ModuleNotFoundError: No module named inventory" means you ran plain pytest from another folder: use  python3 -m pytest  from ~/inventory so the folder is on the import path.',
        example: `============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-8.3.3, pluggy-1.5.0 -- /home/ubuntu/inventory/.venv/bin/python3
cachedir: .pytest_cache
rootdir: /home/ubuntu/inventory
plugins: cov-5.0.0
collected 8 items

tests/test_inventory.py::test_add_creates_item PASSED                    [ 12%]
tests/test_inventory.py::test_add_merges_quantity PASSED                 [ 25%]
tests/test_inventory.py::test_add_rejects_zero PASSED                    [ 37%]
tests/test_inventory.py::test_remove_part PASSED                         [ 50%]
tests/test_inventory.py::test_remove_all PASSED                          [ 62%]
tests/test_inventory.py::test_remove_missing_raises PASSED               [ 75%]
tests/test_inventory.py::test_save_then_load PASSED                      [ 87%]
tests/test_inventory.py::test_cli_add_then_list PASSED                   [100%]

============================== 8 passed in 0.03s ===============================`,
      },
      {
        instruction: 'Run the tests again with coverage measurement for the inventory module and paste the table. Look at the Miss column: those are lines no test ran.',
        command: `cd ~/inventory
python3 -m pytest --cov=inventory tests/`,
        pasteLabel: 'Paste the output of python3 -m pytest --cov=inventory tests/',
        check: [
          { type: 'includes', text: 'TOTAL' },
          { type: 'regex', pattern: '\\d+%', label: 'a coverage percentage' },
        ],
        hint: 'No coverage table means pytest-cov is not installed in the active venv: run  pip install pytest-cov  with the venv active. "--cov=inventory" names the module, not the file, so leave off the .py.',
        example: `============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-8.3.3, pluggy-1.5.0
rootdir: /home/ubuntu/inventory
plugins: cov-5.0.0
collected 8 items

tests/test_inventory.py ........                                         [100%]

---------- coverage: platform linux, python 3.12.3-final-0 -----------
Name           Stmts   Miss  Cover
----------------------------------
inventory.py      67      9    87%
----------------------------------
TOTAL             67      9    87%


============================== 8 passed in 0.06s ===============================`,
      },
    ],
  },
  quiz: [
    { question: 'Why run  python3 -m pytest  instead of plain  pytest?', options: ['Plain pytest is slower', 'The -m form puts the current folder on sys.path, so tests can import inventory', 'Plain pytest cannot run verbose mode'], answer: 1, explanation: 'Running a module with -m adds the working directory to the import path, which makes  from inventory import ...  work.' },
    { question: 'Why does the fixture build Inventory(tmp_path / "inventory.json")?', options: ['So the tests never read or overwrite the real inventory.json', 'Because Inventory requires an absolute path', 'To make the tests slower and more realistic'], answer: 0, explanation: 'Each test gets a private empty folder; your real data stays untouched.' },
    { question: 'Coverage reports inventory.py at 87%. What does the missing 13% mean?', options: ['13% of the tests failed', 'Some lines were never executed by any test, for example an error branch', 'The file has syntax errors'], answer: 1, explanation: 'Coverage lists lines no test reached. Reading the Miss column tells you what to test next.' },
  ],
}

export default lesson
