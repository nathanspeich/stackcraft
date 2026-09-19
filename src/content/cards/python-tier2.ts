import type { Card } from '../types'

const c = (n: number, lesson: string, front: string, back: string): Card => ({ id: `python-${n}`, track: 'python', tier: 2, lesson, front, back })

/** Tier 2 Python cards, unlocked lesson by lesson from week 14 onward. */
export const PYTHON_TIER2_CARDS: Card[] = [
  c(26, 'w14d1', '__repr__ vs __str__', '__repr__ is for developers, shown in the console and lists. __str__ is for people, used by print. Define __repr__ first.'),
  c(27, 'w14d2', '@dataclass', 'Generates __init__, __repr__, and __eq__ from the class fields. Use field(default_factory=list) for mutable defaults.'),
  c(28, 'w14d3', 'Inheritance vs composition', 'Inherit when B is a kind of A. Compose when B has an A. A plain function beats a class with one method.'),
  c(29, 'w14d4', '@property', 'Makes a method read like an attribute: item.total instead of item.total(). Good for computed values.'),
  c(30, 'w17d1', 'How pytest finds tests', 'Files named test_*.py, functions named test_*. A plain assert that fails marks the test failed.'),
  c(31, 'w17d2', '@pytest.mark.parametrize("a,b", [(1, 2), (3, 4)])', 'Runs the same test once per tuple, each shown as its own case like test_add[1-2].'),
  c(32, 'w17d3', 'with pytest.raises(ValueError):', 'Passes only if the block raises that exception. Add match= to check the message.'),
  c(33, 'w17d3', 'tmp_path fixture', 'A fresh temporary directory (a pathlib.Path) for each test, so tests never touch real files or each other.'),
  c(34, 'w20d1', 'The five logging levels', 'DEBUG, INFO, WARNING, ERROR, CRITICAL. A logger only emits records at or above its level.'),
  c(35, 'w20d2', 'Handler vs formatter', 'A handler decides where records go (console, file). A formatter decides what each line looks like.'),
  c(36, 'w20d3', 'logging.getLogger(__name__)', 'One logger per module, named after it, so output shows where a message came from and levels can be set per module.'),
  c(37, 'w20d4', 'log.exception("failed")', 'Logs at ERROR with the current traceback attached. Call it inside an except block.'),
  c(38, 'w23d1', 'requests.get(url, timeout=5)', 'Fetches a URL. Always pass a timeout; check r.status_code or call r.raise_for_status() before using r.json().'),
  c(39, 'w23d2', 'Where do API tokens belong?', 'In an environment variable read with os.environ.get, never in the code or the repository.'),
  c(40, 'w23d3', 'Retry with backoff', 'On a timeout or a 5xx, wait a little, then longer, and try again a few times. Respect Retry-After on a 429.'),
  c(41, 'w26d2', 'pyproject.toml [project.scripts]', 'Maps a command name to a function, like inventory = "inventory.cli:main". Installing the package creates the command.'),
  c(42, 'w26d3', 'pip install -e .', 'Editable install: the package points at your source folder, so edits take effect without reinstalling.'),
  c(43, 'w26d4', 'pipx install .', 'Installs a command-line tool in its own virtual environment and puts the command on your PATH.'),
  c(44, 'w28d1', 'async def and await', 'A coroutine pauses at each await and lets other coroutines run. Without await the coroutine never runs.'),
  c(45, 'w28d2', 'asyncio.gather(*coros)', 'Runs coroutines concurrently and returns their results in the same order.'),
]
