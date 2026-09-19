// Simulation module: pyenv. Virtual environments, pip, pipx, build, and twine for the
// Tier 2 packaging lessons. No package is ever really installed: a small catalog of
// well-known packages provides realistic transcripts, and local projects are read from
// their pyproject.toml. State lives in simState(sh, 'pyenv') so checkers can read it.
import type { CommandTable } from './index'
import { simState } from './index'
import type { Shell } from '../shell'
import type { CmdResult } from '../commands'
import { basename, dirname } from '../vfs'

export interface Installed {
  name: string
  version: string
  /** Console scripts this package provides. */
  scripts: string[]
  /** For local projects: the project directory, and whether it was installed with -e. */
  location?: string
  editable?: boolean
  /** Names of packages installed as dependencies of this one. */
  requires: string[]
}

export interface Venv { dir: string; packages: Record<string, Installed> }

export interface PyenvState {
  /** Virtual environments keyed by absolute directory. */
  venvs: Record<string, Venv>
  /** Packages installed into the system Python (only with --break-system-packages). */
  system: Record<string, Installed>
  /** Whether apt installed pipx. */
  pipxInstalled: boolean
  /** Packages installed with pipx, keyed by name. */
  pipx: Record<string, Installed>
  /** Distribution files produced by python3 -m build (absolute paths). */
  built: string[]
  /** Uploads twine performed: repository and file names. */
  uploads: { repository: string; files: string[] }[]
}

const ok = (out = ''): CmdResult => ({ out, err: '', code: 0 })
const fail = (err: string, code = 1): CmdResult => ({ out: '', err: err.endsWith('\n') ? err : err + '\n', code })

export function pyenvFresh(): PyenvState { return { venvs: {}, system: {}, pipxInstalled: false, pipx: {}, built: [], uploads: [] } }
const cloned = new WeakSet<Shell>()
function state(sh: Shell): PyenvState {
  if (!cloned.has(sh)) { cloned.add(sh); if (sh.state.sims.pyenv) sh.state.sims.pyenv = structuredClone(sh.state.sims.pyenv) }
  const st = simState<Partial<PyenvState>>(sh, 'pyenv', pyenvFresh)
  const d = pyenvFresh()
  for (const k of Object.keys(d) as (keyof PyenvState)[]) if (st[k] === undefined) (st as Record<string, unknown>)[k] = d[k]
  return st as PyenvState
}

const PY = '3.12.3'
const PIP = '24.0'

/* ---------- the package catalog ---------- */

interface Entry { version: string; versions: string[]; summary: string; deps?: string[]; scripts?: string[]; home: string; author: string; license: string; wheel?: string }

const CATALOG: Record<string, Entry> = {
  requests: { version: '2.32.3', versions: ['2.28.2', '2.31.0', '2.32.3'], summary: 'Python HTTP for Humans.', deps: ['charset-normalizer', 'idna', 'urllib3', 'certifi'], home: 'https://requests.readthedocs.io', author: 'Kenneth Reitz', license: 'Apache-2.0' },
  'charset-normalizer': { version: '3.4.0', versions: ['3.3.2', '3.4.0'], summary: 'The Real First Universal Charset Detector.', home: 'https://github.com/Ousret/charset_normalizer', author: 'Ahmed TAHRI', license: 'MIT', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  idna: { version: '3.10', versions: ['3.7', '3.10'], summary: 'Internationalized Domain Names in Applications (IDNA)', home: 'https://github.com/kjd/idna', author: 'Kim Davies', license: 'BSD-3-Clause' },
  urllib3: { version: '2.2.3', versions: ['2.2.2', '2.2.3'], summary: 'HTTP library with thread-safe connection pooling, file post, and more.', home: 'https://urllib3.readthedocs.io', author: 'Andrey Petrov', license: 'MIT' },
  certifi: { version: '2024.8.30', versions: ['2024.7.4', '2024.8.30'], summary: 'Python package for providing Mozilla\'s CA Bundle.', home: 'https://github.com/certifi/python-certifi', author: 'Kenneth Reitz', license: 'MPL-2.0' },
  rich: { version: '13.9.4', versions: ['13.7.1', '13.9.4'], summary: 'Render rich text, tables, progress bars, syntax highlighting, markdown and more to the terminal', deps: ['markdown-it-py', 'pygments'], home: 'https://github.com/Textualize/rich', author: 'Will McGugan', license: 'MIT' },
  'markdown-it-py': { version: '3.0.0', versions: ['3.0.0'], summary: 'Python port of markdown-it. Markdown parsing, done right!', deps: ['mdurl'], home: 'https://github.com/executablebooks/markdown-it-py', author: 'Chris Sewell', license: 'MIT' },
  mdurl: { version: '0.1.2', versions: ['0.1.2'], summary: 'Markdown URL utilities', home: 'https://github.com/executablebooks/mdurl', author: 'Taneli Hukkinen', license: 'MIT' },
  pygments: { version: '2.18.0', versions: ['2.17.2', '2.18.0'], summary: 'Pygments is a syntax highlighting package written in Python.', scripts: ['pygmentize'], home: 'https://pygments.org', author: 'Georg Brandl', license: 'BSD-2-Clause' },
  pytest: { version: '8.3.3', versions: ['7.4.4', '8.2.2', '8.3.3'], summary: 'pytest: simple powerful testing with Python', deps: ['iniconfig', 'packaging', 'pluggy'], scripts: ['pytest', 'py.test'], home: 'https://docs.pytest.org/en/latest/', author: 'Holger Krekel', license: 'MIT' },
  iniconfig: { version: '2.0.0', versions: ['2.0.0'], summary: 'brain-dead simple config-ini parsing', home: 'https://github.com/pytest-dev/iniconfig', author: 'Ronny Pfannschmidt', license: 'MIT' },
  packaging: { version: '24.1', versions: ['23.2', '24.0', '24.1'], summary: 'Core utilities for Python packages', home: 'https://github.com/pypa/packaging', author: 'Donald Stufft', license: 'Apache-2.0 OR BSD-2-Clause' },
  pluggy: { version: '1.5.0', versions: ['1.4.0', '1.5.0'], summary: 'plugin and hook calling mechanisms for python', home: 'https://github.com/pytest-dev/pluggy', author: 'Holger Krekel', license: 'MIT' },
  build: { version: '1.2.2', versions: ['1.0.3', '1.2.1', '1.2.2'], summary: 'A simple, correct Python build frontend', deps: ['packaging', 'pyproject-hooks'], scripts: ['pyproject-build'], home: 'https://build.pypa.io', author: 'Filipe Laíns', license: 'MIT' },
  'pyproject-hooks': { version: '1.2.0', versions: ['1.1.0', '1.2.0'], summary: 'Wrappers to call pyproject.toml-based build backend hooks.', home: 'https://github.com/pypa/pyproject-hooks', author: 'Thomas Kluyver', license: 'MIT' },
  twine: { version: '5.1.1', versions: ['4.0.2', '5.0.0', '5.1.1'], summary: 'Collection of utilities for publishing packages on PyPI', deps: ['pkginfo', 'readme-renderer', 'requests', 'requests-toolbelt', 'urllib3', 'importlib-metadata', 'keyring', 'rfc3986', 'rich'], scripts: ['twine'], home: 'https://twine.readthedocs.io/', author: 'Donald Stufft and individual contributors', license: 'Apache-2.0' },
  pkginfo: { version: '1.10.0', versions: ['1.10.0'], summary: 'Query metadata from sdists / bdists / installed packages.', home: 'https://code.launchpad.net/~tseaver/pkginfo/trunk', author: 'Tres Seaver', license: 'MIT' },
  'readme-renderer': { version: '44.0', versions: ['43.0', '44.0'], summary: 'readme_renderer is a library for rendering readme descriptions for Warehouse', deps: ['nh3', 'docutils', 'pygments'], home: 'https://github.com/pypa/readme_renderer', author: 'The Python Packaging Authority', license: 'Apache-2.0' },
  nh3: { version: '0.2.18', versions: ['0.2.18'], summary: 'Python bindings to the ammonia HTML sanitization library.', home: 'https://github.com/messense/nh3', author: 'messense', license: 'MIT', wheel: 'cp37-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  docutils: { version: '0.21.2', versions: ['0.20.1', '0.21.2'], summary: 'Docutils -- Python Documentation Utilities', home: 'https://docutils.sourceforge.io', author: 'David Goodger', license: 'public domain, Python, 2-Clause BSD, GPL 3' },
  'requests-toolbelt': { version: '1.0.0', versions: ['1.0.0'], summary: 'A utility belt for advanced users of python-requests', deps: ['requests'], home: 'https://toolbelt.readthedocs.io/', author: 'Ian Cordasco, Cory Benfield', license: 'Apache 2.0' },
  'importlib-metadata': { version: '8.5.0', versions: ['8.4.0', '8.5.0'], summary: 'Read metadata from Python packages', deps: ['zipp'], home: 'https://github.com/python/importlib_metadata', author: 'Jason R. Coombs', license: 'Apache-2.0' },
  zipp: { version: '3.20.2', versions: ['3.20.2'], summary: 'Backport of pathlib-compatible object wrapper for zip files', home: 'https://github.com/jaraco/zipp', author: 'Jason R. Coombs', license: 'MIT' },
  keyring: { version: '25.4.1', versions: ['25.4.1'], summary: 'Store and access your passwords safely.', deps: ['jaraco.classes', 'jaraco.functools', 'jaraco.context', 'importlib-metadata', 'SecretStorage', 'jeepney'], scripts: ['keyring'], home: 'https://github.com/jaraco/keyring', author: 'Kang Zhang', license: 'MIT' },
  'jaraco.classes': { version: '3.4.0', versions: ['3.4.0'], summary: 'Utility functions for Python class constructs', deps: ['more-itertools'], home: 'https://github.com/jaraco/jaraco.classes', author: 'Jason R. Coombs', license: 'MIT' },
  'jaraco.functools': { version: '4.1.0', versions: ['4.1.0'], summary: 'Functools like those found in stdlib', deps: ['more-itertools'], home: 'https://github.com/jaraco/jaraco.functools', author: 'Jason R. Coombs', license: 'MIT' },
  'jaraco.context': { version: '6.0.1', versions: ['6.0.1'], summary: 'Useful decorators and context managers', home: 'https://github.com/jaraco/jaraco.context', author: 'Jason R. Coombs', license: 'MIT' },
  'more-itertools': { version: '10.5.0', versions: ['10.5.0'], summary: 'More routines for operating on iterables, beyond itertools', home: 'https://github.com/more-itertools/more-itertools', author: 'Erik Rose', license: 'MIT' },
  secretstorage: { version: '3.3.3', versions: ['3.3.3'], summary: 'Python bindings to FreeDesktop.org Secret Service API', deps: ['cryptography', 'jeepney'], home: 'https://github.com/mitya57/secretstorage', author: 'Dmitry Shachnev', license: 'BSD-3-Clause' },
  jeepney: { version: '0.8.0', versions: ['0.8.0'], summary: 'Low-level, pure Python DBus protocol wrapper.', home: 'https://gitlab.com/takluyver/jeepney', author: 'Thomas Kluyver', license: 'MIT' },
  cryptography: { version: '43.0.1', versions: ['43.0.1'], summary: 'cryptography is a package which provides cryptographic recipes and primitives to Python developers.', deps: ['cffi'], home: 'https://github.com/pyca/cryptography', author: 'The Python Cryptographic Authority and individual contributors', license: 'Apache-2.0 OR BSD-3-Clause', wheel: 'cp39-abi3-manylinux_2_28_x86_64' },
  cffi: { version: '1.17.1', versions: ['1.17.1'], summary: 'Foreign Function Interface for Python calling C code.', deps: ['pycparser'], home: 'http://cffi.readthedocs.org', author: 'Armin Rigo, Maciej Fijalkowski', license: 'MIT', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  pycparser: { version: '2.22', versions: ['2.22'], summary: 'C parser in Python', home: 'https://github.com/eliben/pycparser', author: 'Eli Bendersky', license: 'BSD-3-Clause' },
  rfc3986: { version: '2.0.0', versions: ['2.0.0'], summary: 'Validating URI References per RFC 3986', home: 'http://rfc3986.readthedocs.io', author: 'Ian Stapleton Cordasco', license: 'Apache 2.0' },
  click: { version: '8.1.7', versions: ['8.1.3', '8.1.7'], summary: 'Composable command line interface toolkit', home: 'https://palletsprojects.com/p/click/', author: 'Pallets', license: 'BSD-3-Clause' },
  flask: { version: '3.0.3', versions: ['2.3.3', '3.0.3'], summary: 'A simple framework for building complex web applications.', deps: ['werkzeug', 'jinja2', 'itsdangerous', 'click', 'blinker'], scripts: ['flask'], home: 'https://flask.palletsprojects.com/', author: 'Pallets', license: 'BSD-3-Clause' },
  werkzeug: { version: '3.0.4', versions: ['3.0.4'], summary: 'The comprehensive WSGI web application library.', deps: ['markupsafe'], home: 'https://werkzeug.palletsprojects.com/', author: 'Pallets', license: 'BSD-3-Clause' },
  jinja2: { version: '3.1.4', versions: ['3.1.4'], summary: 'A very fast and expressive template engine.', deps: ['markupsafe'], home: 'https://jinja.palletsprojects.com/', author: 'Pallets', license: 'BSD-3-Clause' },
  markupsafe: { version: '2.1.5', versions: ['2.1.5'], summary: 'Safely add untrusted strings to HTML/XML markup.', home: 'https://palletsprojects.com/p/markupsafe/', author: 'Pallets', license: 'BSD-3-Clause', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  itsdangerous: { version: '2.2.0', versions: ['2.2.0'], summary: 'Safely pass data to untrusted environments and back.', home: 'https://itsdangerous.palletsprojects.com/', author: 'Pallets', license: 'BSD-3-Clause' },
  blinker: { version: '1.8.2', versions: ['1.8.2'], summary: 'Fast, simple object-to-object and broadcast signaling', home: 'https://github.com/pallets-eco/blinker/', author: 'Jason Kirtland', license: 'MIT' },
  black: { version: '24.8.0', versions: ['23.12.1', '24.8.0'], summary: 'The uncompromising code formatter.', deps: ['click', 'mypy-extensions', 'packaging', 'pathspec', 'platformdirs'], scripts: ['black', 'blackd'], home: 'https://github.com/psf/black', author: 'Łukasz Langa', license: 'MIT' },
  'mypy-extensions': { version: '1.0.0', versions: ['1.0.0'], summary: 'Type system extensions for programs checked with the mypy type checker.', home: 'https://github.com/python/mypy_extensions', author: 'The mypy developers', license: 'MIT' },
  pathspec: { version: '0.12.1', versions: ['0.12.1'], summary: 'Utility library for gitignore style pattern matching of file paths.', home: 'https://github.com/cpburnz/python-pathspec', author: 'Caleb P. Burns', license: 'MPL-2.0' },
  platformdirs: { version: '4.3.6', versions: ['4.3.6'], summary: 'A small Python package for determining appropriate platform-specific dirs, e.g. a `user data dir`.', home: 'https://github.com/platformdirs/platformdirs', author: 'Ronny Pfannschmidt', license: 'MIT' },
  ruff: { version: '0.6.9', versions: ['0.5.7', '0.6.9'], summary: 'An extremely fast Python linter and code formatter, written in Rust.', scripts: ['ruff'], home: 'https://docs.astral.sh/ruff', author: 'Astral Software Inc.', license: 'MIT', wheel: 'py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  httpx: { version: '0.27.2', versions: ['0.26.0', '0.27.2'], summary: 'The next generation HTTP client.', deps: ['anyio', 'certifi', 'httpcore', 'idna', 'sniffio'], scripts: ['httpx'], home: 'https://github.com/encode/httpx', author: 'Tom Christie', license: 'BSD-3-Clause' },
  anyio: { version: '4.6.0', versions: ['4.6.0'], summary: 'High level compatibility layer for multiple asynchronous event loop implementations', deps: ['idna', 'sniffio'], home: 'https://anyio.readthedocs.io/', author: 'Alex Grönholm', license: 'MIT' },
  httpcore: { version: '1.0.6', versions: ['1.0.6'], summary: 'A minimal low-level HTTP client.', deps: ['certifi', 'h11'], home: 'https://github.com/encode/httpcore', author: 'Tom Christie', license: 'BSD-3-Clause' },
  h11: { version: '0.14.0', versions: ['0.14.0'], summary: 'A pure-Python, bring-your-own-I/O implementation of HTTP/1.1', home: 'https://github.com/python-hyper/h11', author: 'Nathaniel J. Smith', license: 'MIT' },
  sniffio: { version: '1.3.1', versions: ['1.3.1'], summary: 'Sniff out which async library your code is running under', home: 'https://github.com/python-trio/sniffio', author: 'Nathaniel J. Smith', license: 'MIT OR Apache-2.0' },
  tabulate: { version: '0.9.0', versions: ['0.8.10', '0.9.0'], summary: 'Pretty-print tabular data', scripts: ['tabulate'], home: 'https://github.com/astanin/python-tabulate', author: 'Sergey Astanin', license: 'MIT' },
  pyyaml: { version: '6.0.2', versions: ['6.0.1', '6.0.2'], summary: 'YAML parser and emitter for Python', home: 'https://pyyaml.org/', author: 'Kirill Simonov', license: 'MIT', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  'python-dotenv': { version: '1.0.1', versions: ['1.0.0', '1.0.1'], summary: 'Read key-value pairs from a .env file and set them as environment variables', scripts: ['dotenv'], home: 'https://github.com/theskumar/python-dotenv', author: 'Saurabh Kumar', license: 'BSD-3-Clause' },
  'psycopg2-binary': { version: '2.9.9', versions: ['2.9.9'], summary: 'psycopg2 - Python-PostgreSQL Database Adapter', home: 'https://psycopg.org/', author: 'Federico Di Gregorio', license: 'LGPL with exceptions', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  psycopg: { version: '3.2.3', versions: ['3.2.3'], summary: 'PostgreSQL database adapter for Python', deps: ['typing-extensions'], home: 'https://psycopg.org/psycopg3/', author: 'Daniele Varrazzo', license: 'LGPL-3.0' },
  'typing-extensions': { version: '4.12.2', versions: ['4.12.2'], summary: 'Backported and Experimental Type Hints for Python 3.8+', home: 'https://github.com/python/typing_extensions', author: 'Guido van Rossum, Jukka Lehtosalo, Łukasz Langa, Michael Lee', license: 'PSF-2.0' },
  sqlalchemy: { version: '2.0.35', versions: ['2.0.35'], summary: 'Database Abstraction Library', deps: ['typing-extensions'], home: 'https://www.sqlalchemy.org', author: 'Mike Bayer', license: 'MIT' },
  fastapi: { version: '0.115.0', versions: ['0.115.0'], summary: 'FastAPI framework, high performance, easy to learn, fast to code, ready for production', deps: ['starlette', 'pydantic', 'typing-extensions'], scripts: ['fastapi'], home: 'https://github.com/fastapi/fastapi', author: 'Sebastián Ramírez', license: 'MIT' },
  starlette: { version: '0.38.6', versions: ['0.38.6'], summary: 'The little ASGI library that shines.', deps: ['anyio'], home: 'https://github.com/encode/starlette', author: 'Tom Christie', license: 'BSD-3-Clause' },
  pydantic: { version: '2.9.2', versions: ['2.9.2'], summary: 'Data validation using Python type hints', deps: ['annotated-types', 'pydantic-core', 'typing-extensions'], home: 'https://github.com/pydantic/pydantic', author: 'Samuel Colvin', license: 'MIT' },
  'annotated-types': { version: '0.7.0', versions: ['0.7.0'], summary: 'Reusable constraint types to use with typing.Annotated', home: 'https://github.com/annotated-types/annotated-types', author: 'Adrian Garcia Badaracco', license: 'MIT' },
  'pydantic-core': { version: '2.23.4', versions: ['2.23.4'], summary: 'Core functionality for Pydantic validation and serialization', deps: ['typing-extensions'], home: 'https://github.com/pydantic/pydantic-core', author: 'Samuel Colvin', license: 'MIT', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  uvicorn: { version: '0.31.0', versions: ['0.31.0'], summary: 'The lightning-fast ASGI server.', deps: ['click', 'h11'], scripts: ['uvicorn'], home: 'https://www.uvicorn.org/', author: 'Tom Christie', license: 'BSD-3-Clause' },
  numpy: { version: '2.1.2', versions: ['1.26.4', '2.1.2'], summary: 'Fundamental package for array computing in Python', scripts: ['f2py', 'numpy-config'], home: 'https://numpy.org', author: 'Travis E. Oliphant et al.', license: 'BSD-3-Clause', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  pandas: { version: '2.2.3', versions: ['2.2.2', '2.2.3'], summary: 'Powerful data structures for data analysis, time series, and statistics', deps: ['numpy', 'python-dateutil', 'pytz', 'tzdata'], home: 'https://pandas.pydata.org', author: 'The Pandas Development Team', license: 'BSD-3-Clause', wheel: 'cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64' },
  'python-dateutil': { version: '2.9.0.post0', versions: ['2.9.0.post0'], summary: 'Extensions to the standard Python datetime module', deps: ['six'], home: 'https://github.com/dateutil/dateutil', author: 'Gustavo Niemeyer', license: 'Dual License', wheel: 'py2.py3-none-any' },
  six: { version: '1.16.0', versions: ['1.16.0'], summary: 'Python 2 and 3 compatibility utilities', home: 'https://github.com/benjaminp/six', author: 'Benjamin Peterson', license: 'MIT', wheel: 'py2.py3-none-any' },
  pytz: { version: '2024.2', versions: ['2024.2'], summary: 'World timezone definitions, modern and historical', home: 'http://pythonhosted.org/pytz', author: 'Stuart Bishop', license: 'MIT', wheel: 'py2.py3-none-any' },
  tzdata: { version: '2024.2', versions: ['2024.2'], summary: 'Provider of IANA time zone data', home: 'https://github.com/python/tzdata', author: 'Python Software Foundation', license: 'Apache-2.0', wheel: 'py2.py3-none-any' },
  typer: { version: '0.12.5', versions: ['0.12.5'], summary: 'Typer, build great CLIs. Easy to code. Based on Python type hints.', deps: ['click', 'typing-extensions', 'shellingham', 'rich'], scripts: ['typer'], home: 'https://github.com/fastapi/typer', author: 'Sebastián Ramírez', license: 'MIT' },
  shellingham: { version: '1.5.4', versions: ['1.5.4'], summary: 'Tool to Detect Surrounding Shell', home: 'https://github.com/sarugaku/shellingham', author: 'Tzu-ping Chung', license: 'ISC' },
  cowsay: { version: '6.1', versions: ['5.0', '6.1'], summary: 'The famous cowsay for GNU/Linux is now available for python', scripts: ['cowsay'], home: 'https://github.com/VaasuDevanS/cowsay-python', author: 'Vaasudevan Srinivasan', license: 'GPL-3.0' },
  'pip-tools': { version: '7.4.1', versions: ['7.3.0', '7.4.1'], summary: 'pip-tools keeps your pinned dependencies fresh.', deps: ['build', 'click', 'pip', 'pyproject-hooks', 'setuptools', 'wheel'], scripts: ['pip-compile', 'pip-sync'], home: 'https://github.com/jazzband/pip-tools/', author: 'Vincent Driessen', license: 'BSD-3-Clause' },
  pipx: { version: '1.7.1', versions: ['1.4.3', '1.7.1'], summary: 'Install and Run Python Applications in Isolated Environments', deps: ['argcomplete', 'packaging', 'platformdirs', 'userpath'], scripts: ['pipx'], home: 'https://pipx.pypa.io', author: 'Chad Smith', license: 'MIT' },
  argcomplete: { version: '3.5.1', versions: ['3.5.1'], summary: 'Bash tab completion for argparse', home: 'https://github.com/kislyuk/argcomplete', author: 'Andrey Kislyuk', license: 'Apache-2.0' },
  userpath: { version: '1.9.2', versions: ['1.9.2'], summary: 'Cross-platform tool for adding locations to the user PATH', deps: ['click'], scripts: ['userpath'], home: 'https://github.com/ofek/userpath', author: 'Ofek Lev', license: 'MIT' },
  setuptools: { version: '75.1.0', versions: ['68.1.2', '69.5.1', '75.1.0'], summary: 'Easily download, build, install, upgrade, and uninstall Python packages', home: 'https://github.com/pypa/setuptools', author: 'Python Packaging Authority', license: 'MIT' },
  wheel: { version: '0.44.0', versions: ['0.42.0', '0.44.0'], summary: 'A built-package format for Python', scripts: ['wheel'], home: 'https://github.com/pypa/wheel', author: 'Daniel Holth', license: 'MIT' },
  pip: { version: '24.2', versions: ['23.3.2', '24.0', '24.2'], summary: 'The PyPA recommended tool for installing Python packages.', scripts: ['pip', 'pip3'], home: 'https://pip.pypa.io/', author: 'The pip developers', license: 'MIT' },
  'python-json-logger': { version: '2.0.7', versions: ['2.0.7'], summary: 'A python library adding a json log formatter', home: 'http://github.com/madzak/python-json-logger', author: 'Zakaria Zajac', license: 'BSD' },
  tomli: { version: '2.0.2', versions: ['2.0.2'], summary: "A lil' TOML parser", home: 'https://github.com/hukkin/tomli', author: 'Taneli Hukkinen', license: 'MIT' },
  hatchling: { version: '1.25.0', versions: ['1.25.0'], summary: 'Modern, extensible Python build backend', deps: ['packaging', 'pathspec', 'pluggy', 'trove-classifiers'], scripts: ['hatchling'], home: 'https://hatch.pypa.io/latest/', author: 'Ofek Lev', license: 'MIT' },
  'trove-classifiers': { version: '2024.9.12', versions: ['2024.9.12'], summary: 'Canonical source for classifiers on PyPI (pypi.org).', home: 'https://github.com/pypa/trove-classifiers', author: 'Dustin Ingram', license: 'Apache-2.0' },
}

/** PyPI normalized name: lower case, runs of -_. become a single dash. */
const norm = (name: string) => name.toLowerCase().replace(/[-_.]+/g, '-')
const DISPLAY: Record<string, string> = { pyyaml: 'PyYAML', sqlalchemy: 'SQLAlchemy', jinja2: 'Jinja2', werkzeug: 'Werkzeug', markupsafe: 'MarkupSafe', secretstorage: 'SecretStorage', pygments: 'Pygments' }
const display = (name: string) => DISPLAY[norm(name)] ?? norm(name)
const catalog = (name: string): Entry | null => CATALOG[norm(name)] ?? CATALOG[name.toLowerCase()] ?? null
const wheelName = (name: string, version: string, entry?: Entry | null) => `${display(name).replace(/-/g, '_')}-${version}-${entry?.wheel ?? 'py3-none-any'}.whl`
const fakeSize = (name: string) => { let h = 7; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 900; return `${h + 40} kB` }

/* ---------- pyproject.toml ---------- */

export interface Project { dir: string; name: string; version: string; deps: string[]; scripts: Record<string, string>; backend: string | null; description: string }

/** A small TOML reader: sections, dotted sections, strings, arrays (also multi-line), numbers, booleans, inline tables. */
export function parseToml(text: string): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { '': {} }
  let section = ''
  const src = text.split('\n')
  for (let i = 0; i < src.length; i++) {
    let line = src[i].replace(/^\s*#.*$/, '').trim()
    if (!line) continue
    const sec = line.match(/^\[\s*([^\]]+?)\s*\]$/)
    if (sec) { section = sec[1].replace(/"/g, ''); out[section] ??= {}; continue }
    const kv = line.match(/^("[^"]*"|[\w.-]+)\s*=\s*(.*)$/)
    if (!kv) continue
    const key = kv[1].replace(/^"(.*)"$/, '$1')
    let raw = kv[2]
    // Multi-line arrays and inline tables.
    const openers = (s: string) => (s.match(/[[{]/g) ?? []).length - (s.match(/[\]}]/g) ?? []).length
    while (openers(raw.replace(/"[^"]*"/g, '')) > 0 && i + 1 < src.length) { raw += ' ' + src[++i].replace(/^\s*#.*$/, '').trim() }
    out[section][key] = tomlValue(raw.replace(/\s+#.*$/, '').trim())
    line = ''
  }
  return out
}

function tomlValue(raw: string): unknown {
  if (/^"""/.test(raw)) return raw.replace(/^"""|"""$/g, '')
  if (/^"/.test(raw)) return raw.slice(1, raw.lastIndexOf('"')).replace(/\\"/g, '"')
  if (/^'/.test(raw)) return raw.slice(1, raw.lastIndexOf("'"))
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  if (raw.startsWith('[')) {
    const inner = raw.slice(1, raw.lastIndexOf(']'))
    const items: unknown[] = []
    for (const m of inner.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|\{[^}]*\}|[^,\s]+/g)) { const v = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : tomlValue(m[0]); if (v !== '' && v !== undefined) items.push(v) }
    return items
  }
  if (raw.startsWith('{')) {
    const obj: Record<string, unknown> = {}
    for (const m of raw.slice(1, raw.lastIndexOf('}')).matchAll(/([\w.-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|[^,]+)/g)) obj[m[1]] = tomlValue(m[2].trim())
    return obj
  }
  return raw
}

function readProject(sh: Shell, dir: string): Project | string {
  const abs = sh.path(dir)
  const node = sh.vfs.get(abs)
  if (!node) return `ERROR: ${abs} does not exist`
  if (node.type !== 'dir') return abs.endsWith('.whl') || abs.endsWith('.tar.gz') ? '' : `ERROR: ${abs} is not a directory`
  const pp = sh.vfs.get(abs + '/pyproject.toml')
  const setup = sh.vfs.get(abs + '/setup.py')
  if (!pp && !setup) return `ERROR: file://${abs} does not appear to be a Python project: neither 'setup.py' nor 'pyproject.toml' found.`
  if (!pp || pp.type !== 'file') return `ERROR: file://${abs} does not appear to be a Python project: only setup.py found, and legacy setup.py projects are not simulated here. Add a pyproject.toml.`
  const toml = parseToml(pp.content)
  const project = toml.project
  if (!project) return `ERROR: Invalid pyproject.toml in ${abs}: the [project] table is missing (see PEP 621).`
  const name = project.name
  if (typeof name !== 'string' || !name) return `ERROR: Invalid pyproject.toml in ${abs}: the [project] table needs a name = "..." entry.`
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return `ERROR: Invalid pyproject.toml in ${abs}: project.name "${name}" is not a valid package name.`
  let version = typeof project.version === 'string' ? project.version : typeof project.version === 'number' ? String(project.version) : ''
  if (!version) {
    const dyn = Array.isArray(project.dynamic) && project.dynamic.includes('version')
    if (!dyn) return `ERROR: Invalid pyproject.toml in ${abs}: [project] needs version = "..." (or list "version" under dynamic).`
    version = '0.0.0'
  }
  if (!/^\d+(\.\d+)*((a|b|rc)\d+)?(\.post\d+)?(\.dev\d+)?$/.test(version)) return `ERROR: Invalid version "${version}" in ${abs}/pyproject.toml: use something like 0.1.0 (PEP 440).`
  const deps = Array.isArray(project.dependencies) ? project.dependencies.map(String) : []
  const scripts: Record<string, string> = {}
  for (const [k, v] of Object.entries(toml['project.scripts'] ?? {})) scripts[k] = String(v)
  const backend = typeof toml['build-system']?.['build-backend'] === 'string' ? (toml['build-system']['build-backend'] as string) : null
  return { dir: abs, name, version, deps, scripts, backend, description: typeof project.description === 'string' ? project.description : '' }
}

/** Sketch a usage line for a console script by reading its argparse code, when the module can be found. */
function usageFor(sh: Shell, project: Project, script: string, target: string): { usage: string; help: string } {
  const mod = target.split(':')[0]
  const rel = mod.replace(/\./g, '/')
  const candidates = [`${project.dir}/src/${rel}.py`, `${project.dir}/${rel}.py`, `${project.dir}/src/${rel}/__init__.py`, `${project.dir}/${rel}/__init__.py`, `${project.dir}/src/${rel}/__main__.py`]
  let code = ''
  for (const c of candidates) { const n = sh.vfs.get(c); if (n?.type === 'file') { code = n.content; break } }
  const subs = [...code.matchAll(/add_parser\(\s*["'](\w+)["']/g)].map((m) => m[1])
  const opts = [...code.matchAll(/add_argument\(\s*["'](--?[\w-]+)["']/g)].map((m) => m[1]).filter((o) => o !== '-h')
  const positional = [...code.matchAll(/add_argument\(\s*["']([a-z_]\w*)["']/g)].map((m) => m[1])
  const desc = code.match(/ArgumentParser\([^)]*description\s*=\s*["']([^"']*)["']/)?.[1] ?? project.description
  const parts = [`usage: ${script} [-h]`]
  for (const o of opts) parts.push(`[${o}${o.startsWith('--') ? ' ' + o.replace(/^--/, '').toUpperCase() : ''}]`)
  if (subs.length) parts.push(`{${subs.join(',')}} ...`)
  else for (const p of positional) parts.push(p)
  const usage = parts.join(' ')
  let help = usage + '\n'
  if (desc) help += `\n${desc}\n`
  if (subs.length) help += `\npositional arguments:\n  {${subs.join(',')}}\n` + subs.map((s) => `    ${s.padEnd(12)}${s} command`).join('\n') + '\n'
  else if (positional.length) help += `\npositional arguments:\n` + positional.map((p) => `  ${p}`).join('\n') + '\n'
  help += '\noptions:\n  -h, --help  show this help message and exit\n' + opts.map((o) => `  ${o}${o.startsWith('--') ? ' ' + o.replace(/^--/, '').toUpperCase() : ''}`).join('\n') + (opts.length ? '\n' : '')
  return { usage, help }
}

/** Console-script launcher written into a bin directory. A bash script so the base shell can run it. */
function launcher(sh: Shell, script: string, target: string, project: Project | null, pkg: string, version: string, envDir: string): string {
  const { help } = project ? usageFor(sh, project, script, target) : { help: `usage: ${script} [-h] ...\n\noptions:\n  -h, --help  show this help message and exit\n` }
  const helpLines = help.replace(/\n$/, '').split('\n').map((l) => `  echo ${JSON.stringify(l)}`).join('\n')
  const catalogScript = catalog(pkg)?.scripts?.includes(script) && ['twine', 'pip-compile', 'pyproject-build', 'cowsay'].includes(script)
  if (catalogScript) return `#!/bin/bash\n# ${script} launcher installed into ${envDir} (package ${pkg} ${version})\nVIRTUAL_ENV=${envDir} exec /usr/bin/${script} "$@"\n`
  return `#!/bin/bash\n# Console script "${script}" from package ${pkg} ${version}\n# entry point: ${target}\n# (generated by the Stackcraft simulator; a real launcher is a tiny Python file)\nif [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ "$1" = "" ]; then\n${helpLines}\n  exit 0\nfi\nif [ "$1" = "--version" ]; then\n  echo "${script} ${version}"\n  exit 0\nfi\necho "${script} $*: (${target} would run here; the package's Python code runs for real on your VM)"\n`
}

/* ---------- environments ---------- */

function activeVenv(sh: Shell, st: PyenvState): Venv | null {
  const dir = sh.env.VIRTUAL_ENV
  if (!dir) return null
  return (st.venvs[dir] ??= { dir, packages: basePackages() })
}
const basePackages = (): Record<string, Installed> => ({ pip: { name: 'pip', version: PIP, scripts: ['pip', 'pip3'], requires: [] } })

function createVenv(sh: Shell, st: PyenvState, dirArg: string, withPip: boolean): CmdResult {
  const dir = sh.path(dirArg)
  const parent = sh.vfs.get(dirname(dir))
  if (!parent || parent.type !== 'dir') return fail(`Error: [Errno 2] No such file or directory: '${dir}'`)
  if (!sh.canWrite(parent)) return fail(`Error: [Errno 13] Permission denied: '${dir}'`)
  for (const d of [dir, `${dir}/bin`, `${dir}/include`, `${dir}/lib`, `${dir}/lib/python3.12`, `${dir}/lib/python3.12/site-packages`]) sh.vfs.mkdir(d, { parents: true, owner: sh.user })
  const name = basename(dir)
  sh.vfs.writeFile(`${dir}/pyvenv.cfg`, `home = /usr/bin\ninclude-system-site-packages = false\nversion = ${PY}\nexecutable = /usr/bin/python3.12\ncommand = /usr/bin/python3 -m venv ${dir}\n`, { owner: sh.user })
  sh.vfs.writeFile(`${dir}/bin/activate`, `# This file must be used with "source bin/activate" *from bash*\n# You cannot run it directly\n\ndeactivate () {\n    # reset old environment variables\n    if [ -n "\${_OLD_VIRTUAL_PATH:-}" ] ; then\n        PATH="\${_OLD_VIRTUAL_PATH:-}"\n        export PATH\n        unset _OLD_VIRTUAL_PATH\n    fi\n\n    unset VIRTUAL_ENV\n    unset VIRTUAL_ENV_PROMPT\n    if [ ! "\${1:-}" = "nondestructive" ] ; then\n    # Self destruct!\n        unset -f deactivate\n    fi\n}\n\n# unset irrelevant variables\ndeactivate nondestructive\n\nVIRTUAL_ENV=${dir}\nexport VIRTUAL_ENV\n\n_OLD_VIRTUAL_PATH="$PATH"\nPATH="$VIRTUAL_ENV/bin:$PATH"\nexport PATH\n\nVIRTUAL_ENV_PROMPT="${name}"\nexport VIRTUAL_ENV_PROMPT\n`, { owner: sh.user })
  for (const py of ['python', 'python3', 'python3.12']) sh.vfs.writeFile(`${dir}/bin/${py}`, `#!/bin/bash\n# ${py} of the virtual environment ${dir} (a symlink to /usr/bin/python3.12 on a real machine)\nVIRTUAL_ENV=${dir} exec /usr/bin/python3 "$@"\n`, { owner: sh.user, mode: 0o755 })
  if (withPip) for (const pip of ['pip', 'pip3', 'pip3.12']) sh.vfs.writeFile(`${dir}/bin/${pip}`, `#!/bin/bash\n# pip of the virtual environment ${dir}\nVIRTUAL_ENV=${dir} exec /usr/bin/pip "$@"\n`, { owner: sh.user, mode: 0o755 })
  st.venvs[dir] = { dir, packages: withPip ? basePackages() : {} }
  return ok()
}

/** Resolve where pip installs: the active venv, or the system Python. */
function target(sh: Shell, st: PyenvState): { kind: 'venv'; venv: Venv } | { kind: 'system' } {
  const v = activeVenv(sh, st)
  return v ? { kind: 'venv', venv: v } : { kind: 'system' }
}
const sitePackages = (sh: Shell, st: PyenvState) => { const t = target(sh, st); return t.kind === 'venv' ? `${t.venv.dir}/lib/python3.12/site-packages` : '/usr/lib/python3/dist-packages' }
const binDir = (sh: Shell, st: PyenvState) => { const t = target(sh, st); return t.kind === 'venv' ? `${t.venv.dir}/bin` : '/usr/local/bin' }
const packagesOf = (sh: Shell, st: PyenvState) => { const t = target(sh, st); return t.kind === 'venv' ? t.venv.packages : st.system }

const EXTERNALLY_MANAGED = 'error: externally-managed-environment\n\n× This environment is externally managed\n╰─> To install Python packages system-wide, try apt install\n    python3-xyz, where xyz is the package you are trying to\n    install.\n    \n    If you wish to install a non-Debian-packaged Python package,\n    create a virtual environment using python3 -m venv path/to/venv.\n    Then use path/to/venv/bin/python and path/to/venv/bin/pip. Make\n    sure you have python3-full installed.\n    \n    If you wish to install a non-Debian packaged Python application,\n    it may be easiest to use pipx install xyz, which will manage a\n    virtual environment for you. Make sure you have pipx installed.\n    \n    See /usr/share/doc/python3.12/README.venv for more information.\n\nnote: If you believe this is a mistake, please contact your Python installation or OS distribution provider. You can override this, at the risk of breaking your Python installation or OS, by passing --break-system-packages.\nhint: See PEP 668 for the detailed specification.\n'

/* ---------- pip ---------- */

interface Req { name: string; spec: string; version: string | null; local?: string; editable?: boolean; file?: string }

function parseReq(raw: string): Req | string {
  const s = raw.trim()
  const m = s.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*(?:(==|>=|<=|~=|!=|>|<)\s*([\w.*]+))?(?:\s*,.*)?$/)
  if (!m) return `ERROR: Invalid requirement: '${s}'`
  return { name: m[1], spec: m[3] ?? '', version: m[3] === '==' || m[3] === '~=' ? m[4].replace(/\.\*$/, '') : null }
}

/** Collect the install set for one requirement: the package plus catalog dependencies not yet installed. */
interface Plan { name: string; version: string; entry: Entry | null; dep: boolean; via?: string }

function resolve(req: Req, installed: Record<string, Installed>, upgrade: boolean): { plan: Plan[]; error?: string; satisfied?: string } {
  const entry = catalog(req.name)
  const key = norm(req.name)
  if (!entry) return { plan: [], error: `ERROR: Could not find a version that satisfies the requirement ${req.name}${req.spec}${req.version ?? ''} (from versions: none)\nERROR: No matching distribution found for ${req.name}${req.spec}${req.version ?? ''}` }
  let version = entry.version
  if (req.version) {
    if (!entry.versions.includes(req.version)) return { plan: [], error: `ERROR: Could not find a version that satisfies the requirement ${req.name}==${req.version} (from versions: ${entry.versions.join(', ')})\nERROR: No matching distribution found for ${req.name}==${req.version}` }
    version = req.version
  }
  const have = installed[key]
  if (have && have.version === version && !upgrade) return { plan: [], satisfied: `Requirement already satisfied: ${req.name}${req.spec}${req.version ?? ''} in SITE (${have.version})` }
  if (have && !req.version && !upgrade) return { plan: [], satisfied: `Requirement already satisfied: ${req.name} in SITE (${have.version})` }
  const plan: Plan[] = [{ name: key, version, entry, dep: false }]
  const visit = (name: string) => {
    for (const d of catalog(name)?.deps ?? []) {
      const dk = norm(d)
      if (installed[dk] || plan.some((p) => p.name === dk)) continue
      const de = catalog(d)
      plan.push({ name: dk, version: de?.version ?? '1.0.0', entry: de, dep: true, via: norm(name) })
      visit(d)
    }
  }
  visit(key)
  return { plan }
}

function installPlan(sh: Shell, st: PyenvState, plan: Plan[], transcriptCollect: string[], installed: Record<string, Installed>, parentName: string) {
  for (const p of plan) {
    const disp = display(p.name)
    transcriptCollect.push(`Collecting ${disp}${p.dep ? ` (from ${display(p.via ?? parentName)})` : ''}\n  Downloading ${wheelName(p.name, p.version, p.entry)}.metadata (${fakeSize(p.name + 'm')})`)
  }
  for (const p of plan) transcriptCollect.push(`Downloading ${wheelName(p.name, p.version, p.entry)} (${fakeSize(p.name)})`)
  for (const p of plan) {
    const scripts = p.entry?.scripts ?? []
    const prev = installed[p.name]
    installed[p.name] = { name: p.name, version: p.version, scripts, requires: (p.entry?.deps ?? []).map(norm) }
    for (const s of scripts) sh.vfs.writeFile(`${binDir(sh, st)}/${s}`, launcher(sh, s, `${p.name}:main`, null, p.name, p.version, binDir(sh, st).replace(/\/bin$/, '')), { owner: sh.user, mode: 0o755 })
    if (prev) transcriptCollect.push(`  Attempting uninstall: ${display(p.name)}\n    Found existing installation: ${display(p.name)} ${prev.version}\n    Uninstalling ${display(p.name)}-${prev.version}:\n      Successfully uninstalled ${display(p.name)}-${prev.version}`)
  }
}

function installLocal(sh: Shell, st: PyenvState, path: string, editable: boolean, out: string[], installed: Record<string, Installed>, upgrade: boolean): string | null {
  const abs = sh.path(path)
  // A wheel or sdist built earlier.
  if (/\.whl$/.test(abs) || /\.tar\.gz$/.test(abs)) {
    if (!sh.vfs.get(abs)) return `WARNING: Requirement '${path}' looks like a filename, but the file does not exist\nERROR: ${path.endsWith('.whl') ? `${display(basename(abs).split('-')[0])} from file://${abs} does not appear to be a Python project: ` : ''}file://${abs} does not exist`
    const m = basename(abs).match(/^([A-Za-z0-9_.]+)-(\d[\w.]*?)(?:-py3-none-any\.whl|\.tar\.gz)$/)
    if (!m) return `ERROR: ${basename(abs)} is not a valid wheel filename.`
    const name = norm(m[1])
    out.push(`Processing ${path.startsWith('/') ? path : './' + path.replace(/^\.\//, '')}`)
    const project = readProject(sh, dirname(dirname(abs)))
    const proj = typeof project === 'string' ? null : project
    installed[name] = { name, version: m[2], scripts: Object.keys(proj?.scripts ?? {}), location: dirname(dirname(abs)), requires: [] }
    for (const [s, t] of Object.entries(proj?.scripts ?? {})) sh.vfs.writeFile(`${binDir(sh, st)}/${s}`, launcher(sh, s, t, proj, name, m[2], binDir(sh, st).replace(/\/bin$/, '')), { owner: sh.user, mode: 0o755 })
    out.push(`Installing collected packages: ${display(name)}`, `Successfully installed ${display(name)}-${m[2]}`)
    return null
  }
  const project = readProject(sh, abs)
  if (typeof project === 'string') return project
  const name = norm(project.name)
  const deps: string[] = []
  const depPlan: Plan[] = []
  for (const d of project.deps) {
    const req = parseReq(d)
    if (typeof req === 'string') return req
    const r = resolve(req, installed, false)
    if (r.error) return r.error.replace(/\(from versions: none\)/, `(from versions: none)\nERROR: No matching distribution found for ${req.name} (listed in [project] dependencies of ${project.name})`).split('\n').slice(0, 2).join('\n')
    if (r.satisfied) { out.push(r.satisfied.replace('SITE', sitePackages(sh, st))); continue }
    depPlan.push(...r.plan.map((p) => ({ ...p, dep: true, via: p.via ?? name })))
    deps.push(req.name)
  }
  out.push(`${editable ? 'Obtaining' : 'Processing'} file://${abs}`, '  Installing build dependencies ... done', editable ? '  Checking if build backend supports build_editable ... done' : '  Getting requirements to build wheel ... done', editable ? '  Getting requirements to build editable ... done' : '  Preparing metadata (pyproject.toml) ... done')
  if (editable) out.push('  Preparing editable metadata (pyproject.toml) ... done')
  const collect: string[] = []
  installPlan(sh, st, depPlan, collect, installed, name)
  out.push(...collect)
  const wheel = editable ? `${project.name.replace(/-/g, '_')}-${project.version}-0.editable-py3-none-any.whl` : `${project.name.replace(/-/g, '_')}-${project.version}-py3-none-any.whl`
  out.push(`Building wheels for collected packages: ${project.name}`, `  Building ${editable ? 'editable' : 'wheel'} for ${project.name} (pyproject.toml) ... done`, `  Created wheel for ${project.name}: filename=${wheel} size=${2800 + project.name.length * 17} sha256=${hash(project.name + project.version)}`, `  Stored in directory: /tmp/pip-ephem-wheel-cache-${hash(abs).slice(0, 8)}/wheels/${hash(abs).slice(8, 10)}/${hash(abs).slice(10, 12)}/${hash(abs).slice(12, 40)}`, `Successfully built ${project.name}`)
  const prev = installed[name]
  const installedNames = [...depPlan.map((p) => display(p.name)), display(name)]
  out.push(`Installing collected packages: ${installedNames.join(', ')}`)
  if (prev) out.push(`  Attempting uninstall: ${display(name)}\n    Found existing installation: ${display(name)} ${prev.version}\n    Uninstalling ${display(name)}-${prev.version}:\n      Successfully uninstalled ${display(name)}-${prev.version}`)
  installed[name] = { name, version: project.version, scripts: Object.keys(project.scripts), location: abs, editable, requires: deps.map(norm) }
  for (const [s, t] of Object.entries(project.scripts)) sh.vfs.writeFile(`${binDir(sh, st)}/${s}`, launcher(sh, s, t, project, name, project.version, binDir(sh, st).replace(/\/bin$/, '')), { owner: sh.user, mode: 0o755 })
  out.push(`Successfully installed ${[...depPlan.map((p) => `${display(p.name)}-${p.version}`), `${display(name)}-${project.version}`].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join(' ')}`)
  void upgrade
  return null
}

function hash(s: string): string { let h1 = 0x811c9dc5, h2 = 0x1b873593; for (const c of s) { h1 = Math.imul(h1 ^ c.charCodeAt(0), 16777619) >>> 0; h2 = Math.imul(h2 + c.charCodeAt(0), 2654435761) >>> 0 } let out = ''; let x = h1 ^ h2; for (let i = 0; i < 8; i++) { x = Math.imul(x ^ (x >>> 15), 2246822507) >>> 0; x = Math.imul(x ^ (x >>> 13), 3266489909) >>> 0; out += x.toString(16).padStart(8, '0') } return out }

function pip(sh: Shell, st: PyenvState, args: string[]): CmdResult {
  const t = target(sh, st)
  const site = sitePackages(sh, st)
  const pipVersion = t.kind === 'venv' ? (t.venv.packages.pip?.version ?? PIP) : PIP
  const from = t.kind === 'venv' ? `${site}/pip` : '/usr/lib/python3/dist-packages/pip'
  const [sub, ...rest] = args
  if (!sub || sub === '--version' || sub === '-V') return ok(`pip ${pipVersion} from ${from} (python 3.12)\n`)
  if (sub === '--help' || sub === '-h' || sub === 'help') return ok('\nUsage:\n  pip <command> [options]\n\nCommands:\n  install                     Install packages.\n  download                    Download packages.\n  uninstall                   Uninstall packages.\n  freeze                      Output installed packages in requirements format.\n  inspect                     Inspect the python environment.\n  list                        List installed packages.\n  show                        Show information about installed packages.\n  check                       Verify installed packages have compatible dependencies.\n  config                      Manage local and global configuration.\n  search                      Search PyPI for packages.\n  cache                       Inspect and manage pip\'s wheel cache.\n  index                       Inspect information available from package indexes.\n  wheel                       Build wheels from your requirements.\n  hash                        Compute hashes of package archives.\n  completion                  A helper command used for command completion.\n  debug                       Show information useful for debugging.\n  help                        Show help for commands.\n')
  const installed = packagesOf(sh, st)
  if (sub === 'install') {
    const flags = new Set<string>()
    const reqs: Req[] = []
    let indexUrl: string | null = null
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i]
      if (a === '-r' || a === '--requirement') {
        const f = rest[++i]
        let text: string
        try { text = sh.readFile(f ?? '') } catch { return fail(`ERROR: Could not open requirements file: [Errno 2] No such file or directory: '${f ?? ''}'`) }
        for (const line of text.split('\n')) {
          const l = line.replace(/\s+#.*$/, '').replace(/^#.*$/, '').trim()
          if (!l) continue
          if (l.startsWith('-e ') || l.startsWith('--editable ')) { reqs.push({ name: '', spec: '', version: null, local: l.split(/\s+/)[1], editable: true }); continue }
          if (l.startsWith('-')) continue
          const r = parseReq(l)
          if (typeof r === 'string') return fail(r.replace(/'$/, `' (from line in ${f})`))
          reqs.push(r)
        }
        continue
      }
      if (a === '-e' || a === '--editable') { reqs.push({ name: '', spec: '', version: null, local: rest[++i] ?? '.', editable: true }); continue }
      if (a === '-i' || a === '--index-url' || a === '--extra-index-url') { indexUrl = rest[++i] ?? null; continue }
      if (a === '--index-url=' || a.startsWith('--index-url=')) { indexUrl = a.split('=')[1]; continue }
      if (a.startsWith('-')) { flags.add(a); continue }
      if (a === '.' || a.startsWith('./') || a.startsWith('/') || a.startsWith('~') || a.endsWith('.whl') || a.endsWith('.tar.gz') || (a.includes('/') && !a.includes('=='))) { reqs.push({ name: '', spec: '', version: null, local: a }); continue }
      const r = parseReq(a)
      if (typeof r === 'string') return fail(r)
      reqs.push(r)
    }
    const upgrade = flags.has('-U') || flags.has('--upgrade')
    if (!reqs.length) return fail('ERROR: You must give at least one requirement to install (see "pip help install")')
    if (t.kind === 'system' && !flags.has('--break-system-packages')) return fail(EXTERNALLY_MANAGED)
    if (t.kind === 'system' && sh.user !== 'root' && !flags.has('--user')) { /* pip falls back to --user on a real machine; nothing to simulate */ }
    const out: string[] = []
    if (indexUrl && /test\.pypi\.org/.test(indexUrl)) out.push(`Looking in indexes: ${indexUrl}`)
    for (const req of reqs) {
      if (req.local !== undefined) {
        const err = installLocal(sh, st, req.local, Boolean(req.editable), out, installed, upgrade)
        if (err) return { out: out.join('\n') + (out.length ? '\n' : ''), err: err + '\n', code: 1 }
        continue
      }
      // A package published to TestPyPI earlier in this terminal is installable from there.
      const uploaded = indexUrl && /test\.pypi\.org/.test(indexUrl) ? st.uploads.flatMap((u) => u.files).map((f) => basename(f).match(/^([A-Za-z0-9_.]+)-(\d[\w.]*?)(?:-py3-none-any\.whl|\.tar\.gz)$/)).find((m) => m && norm(m[1]) === norm(req.name)) : null
      if (uploaded) {
        const name = norm(req.name)
        out.push(`Collecting ${req.name}`, `  Downloading ${indexUrl!.replace(/\/simple\/?$/, '')}/packages/${uploaded[1]}-${uploaded[2]}-py3-none-any.whl (${fakeSize(name)})`, `Installing collected packages: ${req.name}`, `Successfully installed ${req.name}-${uploaded[2]}`)
        installed[name] = { name, version: uploaded[2], scripts: [], requires: [] }
        continue
      }
      const r = resolve(req, installed, upgrade)
      if (r.error) return { out: out.join('\n') + (out.length ? '\n' : ''), err: r.error + '\n', code: 1 }
      if (r.satisfied) { out.push(r.satisfied.replace('SITE', site)); continue }
      const collect: string[] = []
      installPlan(sh, st, r.plan, collect, installed, req.name)
      out.push(...collect.filter((l) => !l.startsWith('  Attempting')))
      out.push(`Installing collected packages: ${[...r.plan].reverse().map((p) => display(p.name)).join(', ')}`)
      out.push(...collect.filter((l) => l.startsWith('  Attempting')))
      out.push(`Successfully installed ${r.plan.map((p) => `${display(p.name)}-${p.version}`).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join(' ')}`)
    }
    if (t.kind === 'venv' && (installed.pip?.version ?? PIP) === PIP && !reqs.some((r) => norm(r.name) === 'pip')) out.push('', `[notice] A new release of pip is available: ${PIP} -> 24.2`, '[notice] To update, run: pip install --upgrade pip')
    return ok(out.join('\n') + '\n')
  }
  if (sub === 'uninstall') {
    const names = rest.filter((a) => !a.startsWith('-'))
    if (!names.length) return fail('ERROR: You must give at least one requirement to uninstall (see "pip help uninstall")')
    if (t.kind === 'system' && !rest.includes('--break-system-packages')) return fail(EXTERNALLY_MANAGED)
    let out = ''
    for (const n of names) {
      const p = installed[norm(n)]
      if (!p) { out += `WARNING: Skipping ${n} as it is not installed.\n`; continue }
      if (!rest.includes('-y') && !rest.includes('--yes')) return { out: out + `Found existing installation: ${display(p.name)} ${p.version}\nUninstalling ${display(p.name)}-${p.version}:\n  Would remove:\n    ${site}/${p.name.replace(/-/g, '_')}-${p.version}.dist-info/*\n    ${site}/${p.name.replace(/-/g, '_')}/*\nProceed (Y/n)? `, err: '\nERROR: this terminal cannot answer prompts. Run pip uninstall -y NAME instead.\n', code: 2 }
      delete installed[norm(n)]
      for (const s of p.scripts) { try { sh.vfs.remove(`${binDir(sh, st)}/${s}`) } catch { /* already gone */ } }
      out += `Found existing installation: ${display(p.name)} ${p.version}\nUninstalling ${display(p.name)}-${p.version}:\n  Successfully uninstalled ${display(p.name)}-${p.version}\n`
    }
    return ok(out)
  }
  if (sub === 'list') {
    const all = Object.values(installed).sort((a, b) => a.name.localeCompare(b.name))
    if (rest.includes('--format=json')) return ok(JSON.stringify(all.map((p) => ({ name: display(p.name), version: p.version }))) + '\n')
    const rows = all.map((p) => [display(p.name), p.version, p.editable ? p.location ?? '' : ''])
    const editable = rows.some((r) => r[2])
    const w0 = Math.max(7, ...rows.map((r) => r[0].length))
    const w1 = Math.max(7, ...rows.map((r) => r[1].length))
    const w2 = Math.max(24, ...rows.map((r) => r[2].length))
    const head = `${'Package'.padEnd(w0)} ${editable ? 'Version'.padEnd(w1) + ' Editable project location' : 'Version'}\n${'-'.repeat(w0)} ${'-'.repeat(w1)}${editable ? ' ' + '-'.repeat(w2 + 1) : ''}\n`
    return ok(head + rows.map((r) => `${r[0].padEnd(w0)} ${r[1].padEnd(w1)}${editable ? ' ' + r[2] : ''}`.replace(/\s+$/, '')).join('\n') + (rows.length ? '\n' : '') + (t.kind === 'venv' && (installed.pip?.version ?? PIP) === PIP ? `\n[notice] A new release of pip is available: ${PIP} -> 24.2\n[notice] To update, run: pip install --upgrade pip\n` : ''))
  }
  if (sub === 'freeze') {
    const all = Object.values(installed).filter((p) => !['pip', 'setuptools', 'wheel'].includes(p.name)).sort((a, b) => a.name.localeCompare(b.name))
    return ok(all.map((p) => (p.editable ? `-e ${p.location}` : `${display(p.name)}==${p.version}`)).join('\n') + (all.length ? '\n' : ''))
  }
  if (sub === 'show') {
    const names = rest.filter((a) => !a.startsWith('-'))
    if (!names.length) return fail('ERROR: Please provide a package name or names.')
    let out = ''
    let err = ''
    for (const n of names) {
      const p = installed[norm(n)]
      if (!p) { err += `WARNING: Package(s) not found: ${n}\n`; continue }
      const entry = catalog(p.name)
      const proj = p.location ? readProject(sh, p.location) : null
      const desc = typeof proj === 'object' && proj ? proj.description : entry?.summary ?? ''
      const requiredBy = Object.values(installed).filter((o) => o.requires.includes(p.name)).map((o) => display(o.name)).join(', ')
      out += `Name: ${display(p.name)}\nVersion: ${p.version}\nSummary: ${desc}\nHome-page: ${entry?.home ?? ''}\nAuthor: ${entry?.author ?? ''}\nAuthor-email: \nLicense: ${entry?.license ?? ''}\nLocation: ${site}\n${p.editable ? `Editable project location: ${p.location}\n` : ''}Requires: ${[...p.requires].sort().map(display).join(', ')}\nRequired-by: ${requiredBy}\n`
      if (names.indexOf(n) < names.length - 1) out += '---\n'
    }
    return { out, err, code: err && !out ? 1 : 0 }
  }
  if (sub === 'check') return ok('No broken requirements found.\n')
  if (sub === 'index') {
    const n = rest.filter((a) => !a.startsWith('-'))[1]
    if (rest[0] !== 'versions' || !n) return fail('ERROR: Missing command. Usage: pip index versions PKG')
    const e = catalog(n)
    if (!e) return fail(`ERROR: No matching distribution found for ${n}`)
    const have = installed[norm(n)]
    return ok(`WARNING: pip index is currently an experimental command. It may be removed/changed in a future release without prior warning.\n${display(n)} (${e.version})\nAvailable versions: ${[...e.versions].reverse().join(', ')}\n${have ? `  INSTALLED: ${have.version}\n  LATEST:    ${e.version}\n` : ''}`)
  }
  if (sub === 'download') return fail('pip download: not simulated here. Use pip install inside a virtual environment.')
  if (sub === 'search') return fail('ERROR: XMLRPC request failed [code: -32500]\nRuntimeError: PyPI no longer supports \'pip search\' (or XML-RPC search). Please use https://pypi.org/search (via a browser) instead. See https://warehouse.pypa.io/api-reference/xml-rpc.html#deprecated-methods for more information.')
  if (sub === 'config' || sub === 'cache' || sub === 'debug' || sub === 'wheel' || sub === 'inspect' || sub === 'hash' || sub === 'completion') return ok(`(pip ${sub} is accepted but has nothing to simulate here)\n`)
  return fail(`ERROR: unknown command "${sub}"`)
}

/* ---------- build ---------- */

function buildProject(sh: Shell, st: PyenvState, args: string[]): CmdResult {
  const t = target(sh, st)
  const has = packagesOf(sh, st).build || (st.pipx.build && args.includes('--via-pipx'))
  if (!has && !args.includes('--via-pipx')) return fail(`${t.kind === 'venv' ? `${t.venv.dir}/bin/python3` : '/usr/bin/python3'}: No module named build`)
  const dirArg = args.filter((a) => !a.startsWith('-') && a !== '--via-pipx').pop() ?? '.'
  const abs = sh.path(dirArg)
  const proj = readProject(sh, abs)
  if (typeof proj === 'string') return fail(proj.replace(/^ERROR: file:\/\/(\S+) does not appear to be a Python project: neither 'setup.py' nor 'pyproject.toml' found\./, 'ERROR Source $1 does not appear to be a Python project: no pyproject.toml or setup.py'))
  const backend = proj.backend ?? 'setuptools.build_meta:__legacy__'
  const req = backend.startsWith('hatchling') ? 'hatchling' : backend.startsWith('flit') ? 'flit_core >=3.2,<4' : backend.startsWith('poetry') ? 'poetry-core' : 'setuptools >= 61.0'
  const wheelBase = proj.name.replace(/-/g, '_')
  const sdist = `${wheelBase}-${proj.version}.tar.gz`
  const wheel = `${wheelBase}-${proj.version}-py3-none-any.whl`
  const dist = `${abs}/dist`
  sh.vfs.mkdir(dist, { parents: true, owner: sh.user })
  const pkgFiles: string[] = []
  sh.vfs.walk(abs, (p, n) => { if (n.type === 'file' && !p.includes('/dist/') && !p.includes('/.venv/') && !p.includes('/__pycache__/') && !p.includes('.egg-info')) pkgFiles.push(p.slice(abs.length + 1)) })
  const stamp = `(simulated archive built by python -m build)\n${proj.name} ${proj.version}\n` + pkgFiles.map((f) => `${wheelBase}-${proj.version}/${f}`).join('\n') + '\n'
  sh.vfs.writeFile(`${dist}/${sdist}`, stamp, { owner: sh.user })
  sh.vfs.writeFile(`${dist}/${wheel}`, stamp + `${wheelBase}-${proj.version}.dist-info/METADATA\n${wheelBase}-${proj.version}.dist-info/entry_points.txt\n`, { owner: sh.user })
  for (const f of [`${dist}/${sdist}`, `${dist}/${wheel}`]) if (!st.built.includes(f)) st.built.push(f)
  const isolated = !args.includes('--no-isolation') && !args.includes('-n')
  const only = args.includes('--wheel') || args.includes('-w') ? 'wheel' : args.includes('--sdist') || args.includes('-s') ? 'sdist' : 'both'
  const stepsSdist = `${isolated ? `* Creating isolated environment: venv+pip...\n* Installing packages in isolated environment:\n  - ${req}\n` : ''}* Getting build dependencies for sdist...\n${backend.startsWith('setuptools') ? 'running egg_info\ncreating ' + wheelBase + '.egg-info\nwriting ' + wheelBase + '.egg-info/PKG-INFO\nwriting dependency_links to ' + wheelBase + '.egg-info/dependency_links.txt\n' + (Object.keys(proj.scripts).length ? 'writing entry points to ' + wheelBase + '.egg-info/entry_points.txt\n' : '') + (proj.deps.length ? 'writing requirements to ' + wheelBase + '.egg-info/requires.txt\n' : '') + 'writing top-level names to ' + wheelBase + '.egg-info/top_level.txt\n' : ''}* Building sdist...\n${backend.startsWith('setuptools') ? 'running sdist\nrunning egg_info\nrunning check\ncreating ' + wheelBase + '-' + proj.version + '\n' + pkgFiles.slice(0, 6).map((f) => 'copying ' + f + ' -> ' + wheelBase + '-' + proj.version + '/' + dirname(f).replace(/^\.$/, '')).join('\n').replace(/\/$/, '') + '\nWriting ' + wheelBase + '-' + proj.version + '/setup.cfg\nCreating tar archive\nremoving \'' + wheelBase + '-' + proj.version + '\' (and everything under it)\n' : ''}`
  const stepsWheel = `* Building wheel from sdist\n${isolated ? `* Creating isolated environment: venv+pip...\n* Installing packages in isolated environment:\n  - ${req}\n` : ''}* Getting build dependencies for wheel...\n* Building wheel...\n${backend.startsWith('setuptools') ? 'running bdist_wheel\nrunning build\nrunning build_py\ninstalling to build/bdist.linux-x86_64/wheel\nrunning install\nrunning install_lib\nrunning install_egg_info\nCopying ' + wheelBase + '.egg-info to build/bdist.linux-x86_64/wheel/./' + wheelBase + '-' + proj.version + '.dist-info\nrunning install_scripts\ncreating build/bdist.linux-x86_64/wheel/' + wheelBase + '-' + proj.version + '.dist-info/WHEEL\ncreating \'' + dist + '/' + wheel + '\' and adding \'build/bdist.linux-x86_64/wheel\' to it\nadding \'' + wheelBase + '-' + proj.version + '.dist-info/METADATA\'\n' + (Object.keys(proj.scripts).length ? 'adding \'' + wheelBase + '-' + proj.version + '.dist-info/entry_points.txt\'\n' : '') + 'adding \'' + wheelBase + '-' + proj.version + '.dist-info/RECORD\'\nremoving build/bdist.linux-x86_64/wheel\n' : ''}`
  const out = (only === 'wheel' ? stepsWheel.replace('* Building wheel from sdist\n', '') : only === 'sdist' ? stepsSdist : stepsSdist + stepsWheel) + `Successfully built ${only === 'wheel' ? wheel : only === 'sdist' ? sdist : `${sdist} and ${wheel}`}\n`
  if (only === 'wheel') { try { sh.vfs.remove(`${dist}/${sdist}`) } catch { /* fine */ } st.built = st.built.filter((f) => f !== `${dist}/${sdist}`) }
  if (only === 'sdist') { try { sh.vfs.remove(`${dist}/${wheel}`) } catch { /* fine */ } st.built = st.built.filter((f) => f !== `${dist}/${wheel}`) }
  return ok(out)
}

/* ---------- pipx ---------- */

const PIPX_HOME = '/home/learner/.local/share/pipx'
const PIPX_BIN = '/home/learner/.local/bin'

function pipx(sh: Shell, st: PyenvState, args: string[]): CmdResult {
  if (!st.pipxInstalled) return fail('pipx: command not found', 127)
  const [sub, ...rest] = args
  const flags = rest.filter((a) => a.startsWith('-'))
  const names = rest.filter((a) => !a.startsWith('-'))
  if (!sub || sub === '--help' || sub === '-h') return ok('usage: pipx [-h] [--quiet] [--verbose] [--global] [--version]\n            {install,install-all,uninject,inject,pin,unpin,upgrade,upgrade-all,upgrade-shared,uninstall,uninstall-all,reinstall,reinstall-all,list,interpreter,run,runpip,ensurepath,environment,completions}\n            ...\n\nInstall and execute apps from Python packages.\n\nBinaries can either be installed globally into isolated Virtual Environments\nor run directly in a temporary Virtual Environment.\n\nVirtual Environment location is /home/learner/.local/share/pipx/venvs.\nSymlinks to apps are placed in /home/learner/.local/bin.\n\noptional arguments:\n  -h, --help            show this help message and exit\n  --version             Print version and exit\n\nsubcommands:\n  Get help for commands with pipx COMMAND --help\n\n    install             Install a package\n    uninstall           Uninstall a package\n    upgrade             Upgrade a package\n    list                List installed packages\n    run                 Download the latest version of a package to a temporary virtual environment, then run an app from it.\n    ensurepath          Ensure directories necessary for pipx operation are in your PATH environment variable.\n')
  if (sub === '--version') return ok('1.4.3\n')
  const onPath = (sh.env.PATH ?? '').split(':').includes(PIPX_BIN)
  const pathNote = onPath ? '' : `\n⚠️  Note: '${PIPX_BIN}' is not on your PATH environment variable. These apps will not be globally accessible until your PATH is updated. Run \`pipx ensurepath\` to automatically add it, or manually modify your PATH in your shell's config file (e.g. ~/.bashrc).\n`
  const exposeScripts = (name: string, version: string, scripts: Record<string, string>, proj: Project | null) => {
    sh.vfs.mkdir(PIPX_BIN, { parents: true, owner: 'learner' })
    sh.vfs.mkdir(`${PIPX_HOME}/venvs/${name}/bin`, { parents: true, owner: 'learner' })
    sh.vfs.writeFile(`${PIPX_HOME}/venvs/${name}/pyvenv.cfg`, `home = /usr/bin\ninclude-system-site-packages = false\nversion = ${PY}\n`, { owner: 'learner' })
    for (const [s, tgt] of Object.entries(scripts)) {
      const body = launcher(sh, s, tgt, proj, name, version, `${PIPX_HOME}/venvs/${name}`)
      sh.vfs.writeFile(`${PIPX_HOME}/venvs/${name}/bin/${s}`, body, { owner: 'learner', mode: 0o755 })
      sh.vfs.writeFile(`${PIPX_BIN}/${s}`, body, { owner: 'learner', mode: 0o755 })
    }
  }
  if (sub === 'install') {
    const spec = names[0]
    if (!spec) return fail('usage: pipx install [-h] [--include-deps] [--verbose] [--force] [--python PYTHON] [-e] package_spec\npipx install: error: the following arguments are required: package_spec', 2)
    const force = flags.includes('--force') || flags.includes('-f')
    const editable = flags.includes('-e') || flags.includes('--editable')
    const isLocal = spec === '.' || spec.startsWith('./') || spec.startsWith('/') || spec.startsWith('~') || spec.endsWith('.whl') || spec.endsWith('.tar.gz')
    if (isLocal) {
      const abs = sh.path(spec)
      let proj: Project | null = null
      let name = ''
      let version = ''
      let scripts: Record<string, string> = {}
      if (/\.whl$/.test(abs) || /\.tar\.gz$/.test(abs)) {
        if (!sh.vfs.get(abs)) return fail(`Error: ${spec} does not exist`)
        const m = basename(abs).match(/^([A-Za-z0-9_.]+)-(\d[\w.]*?)(?:-py3-none-any\.whl|\.tar\.gz)$/)
        if (!m) return fail(`Error: ${spec} is not a valid distribution file name`)
        name = norm(m[1]); version = m[2]
        const p = readProject(sh, dirname(dirname(abs)))
        if (typeof p === 'object') { proj = p; scripts = p.scripts }
      } else {
        const p = readProject(sh, abs)
        if (typeof p === 'string') return fail(p.replace(/^ERROR: /, 'Error: pip failed to build package: ') + `\n\nError installing ${spec}.`)
        proj = p; name = norm(p.name); version = p.version; scripts = p.scripts
      }
      if (st.pipx[name] && !force) return ok(`'${display(name)}' already seems to be installed. Not modifying existing installation in '${PIPX_HOME}/venvs/${name}'. Pass '--force' to force installation.\n`)
      if (!Object.keys(scripts).length) return fail(`No apps associated with package ${display(name)}. Try again with '--include-deps' to include apps of dependent packages, which are listed above. If you are attempting to install a library, pipx should not be used. Consider using pip or a similar tool instead.`)
      st.pipx[name] = { name, version, scripts: Object.keys(scripts), location: proj?.dir, editable, requires: (proj?.deps ?? []).map((d) => norm(d.split(/[=<>~![; ]/)[0])) }
      exposeScripts(name, version, scripts, proj)
      return ok(`  installed package ${display(name)} ${version}, installed using Python ${PY}\n  These apps are now globally available\n${Object.keys(scripts).map((s) => `    - ${s}`).join('\n')}\n${pathNote}done! ✨ 🌟 ✨\n`)
    }
    const req = parseReq(spec)
    if (typeof req === 'string') return fail(req.replace(/^ERROR: /, 'Error: '))
    const entry = catalog(req.name)
    if (!entry) return fail(`Fatal error from pip prevented installation. Full pip output in file:\n    ${PIPX_HOME}/logs/cmd_2026-09-18_09.41.07_pip_errors.log\n\npip failed to build package:\n    ${req.name}\n\nSome possibly relevant errors from pip install:\n    ERROR: Could not find a version that satisfies the requirement ${req.name} (from versions: none)\n    ERROR: No matching distribution found for ${req.name}\n\nError installing ${req.name}.`)
    const name = norm(req.name)
    const version = req.version ?? entry.version
    if (req.version && !entry.versions.includes(req.version)) return fail(`Fatal error from pip prevented installation. Full pip output in file:\n    ${PIPX_HOME}/logs/cmd_2026-09-18_09.41.07_pip_errors.log\n\nSome possibly relevant errors from pip install:\n    ERROR: Could not find a version that satisfies the requirement ${spec} (from versions: ${entry.versions.join(', ')})\n\nError installing ${spec}.`)
    if (st.pipx[name] && !force) return ok(`'${display(name)}' already seems to be installed. Not modifying existing installation in '${PIPX_HOME}/venvs/${name}'. Pass '--force' to force installation.\n`)
    if (!entry.scripts?.length) return fail(`No apps associated with package ${display(name)}. Try again with '--include-deps' to include apps of dependent packages, which are listed above. If you are attempting to install a library, pipx should not be used. Consider using pip or a similar tool instead.`)
    st.pipx[name] = { name, version, scripts: entry.scripts, requires: (entry.deps ?? []).map(norm) }
    exposeScripts(name, version, Object.fromEntries(entry.scripts.map((s) => [s, `${name}:main`])), null)
    return ok(`  installed package ${display(name)} ${version}, installed using Python ${PY}\n  These apps are now globally available\n${entry.scripts.map((s) => `    - ${s}`).join('\n')}\n${pathNote}done! ✨ 🌟 ✨\n`)
  }
  if (sub === 'uninstall') {
    const n = names[0]
    if (!n) return fail('usage: pipx uninstall [-h] [--verbose] package\npipx uninstall: error: the following arguments are required: package', 2)
    const p = st.pipx[norm(n)]
    if (!p) return fail(`Nothing to uninstall for ${n} 🙈`)
    for (const s of p.scripts) { try { sh.vfs.remove(`${PIPX_BIN}/${s}`) } catch { /* gone */ } }
    try { sh.vfs.remove(`${PIPX_HOME}/venvs/${p.name}`, { recursive: true }) } catch { /* gone */ }
    delete st.pipx[norm(n)]
    return ok(`uninstalled ${display(p.name)}! ✨ 🌟 ✨\n`)
  }
  if (sub === 'uninstall-all') { for (const n of Object.keys(st.pipx)) pipx(sh, st, ['uninstall', n]); return ok('') }
  if (sub === 'list') {
    const all = Object.values(st.pipx).sort((a, b) => a.name.localeCompare(b.name))
    if (flags.includes('--short')) return ok(all.map((p) => `${display(p.name)} ${p.version}`).join('\n') + (all.length ? '\n' : ''))
    if (!all.length) return ok('nothing has been installed with pipx 😳\n')
    return ok(`venvs are in ${PIPX_HOME}/venvs\napps are exposed on your $PATH at ${PIPX_BIN}\nmanual pages are exposed at /home/learner/.local/share/man\n` + all.map((p) => `   package ${display(p.name)} ${p.version}, installed using Python ${PY}\n` + p.scripts.map((s) => `    - ${s}`).join('\n')).join('\n') + '\n')
  }
  if (sub === 'ensurepath') {
    const line = `\n# Created by \`pipx\` on ${new Date().toISOString().slice(0, 10)}\nexport PATH="$PATH:${PIPX_BIN}"\n`
    let rc = ''
    try { rc = sh.vfs.readFile('/home/learner/.bashrc') } catch { /* fresh */ }
    if (!rc.includes(PIPX_BIN)) sh.vfs.writeFile('/home/learner/.bashrc', rc + line, { owner: 'learner' })
    if (onPath) return ok(`${PIPX_BIN} is already in PATH.\n\nAll pipx binary directories have been added to PATH. If you are sure you want to proceed, try again with the '--force' flag.\n\nOtherwise pipx is ready to go! ✨ 🌟 ✨\n`)
    return ok(`Success! Added ${PIPX_BIN} to the PATH environment variable.\n\nConsider adding shell completions for pipx. Run 'pipx completions' for instructions.\n\nYou will need to open a new terminal or re-login for the PATH changes to take effect.\n\nOtherwise pipx is ready to go! ✨ 🌟 ✨\n(In this terminal, run: export PATH="$HOME/.local/bin:$PATH")\n`)
  }
  if (sub === 'upgrade' || sub === 'reinstall') {
    const p = names[0] ? st.pipx[norm(names[0])] : null
    if (!p) return fail(`Package ${names[0] ?? ''} is not installed`)
    const entry = catalog(p.name)
    if (p.location) { const proj = readProject(sh, p.location); if (typeof proj === 'object') { const old = p.version; p.version = proj.version; exposeScripts(p.name, p.version, proj.scripts, proj); return ok(old === p.version ? `${display(p.name)} is already at latest version ${p.version} (location: ${PIPX_HOME}/venvs/${p.name})\n` : `upgraded package ${display(p.name)} from ${old} to ${p.version} (location: ${PIPX_HOME}/venvs/${p.name})\n`) } }
    if (entry && entry.version !== p.version) { const old = p.version; p.version = entry.version; return ok(`upgraded package ${display(p.name)} from ${old} to ${p.version} (location: ${PIPX_HOME}/venvs/${p.name})\n`) }
    return ok(`${display(p.name)} is already at latest version ${p.version} (location: ${PIPX_HOME}/venvs/${p.name})\n`)
  }
  if (sub === 'run') {
    const appIdx = rest.findIndex((a) => !a.startsWith('-'))
    const spec = appIdx >= 0 ? rest[appIdx] : undefined
    const runArgs = appIdx >= 0 ? rest.slice(appIdx + 1) : []
    if (!spec) return fail('usage: pipx run [-h] [--no-cache] [--pypackages] [--spec SPEC] [--verbose] [--python PYTHON] app ...\npipx run: error: the following arguments are required: app', 2)
    const app = spec.split('==')[0]
    const entry = catalog(app)
    const pkgWithScript = Object.entries(CATALOG).find(([, e]) => e.scripts?.includes(app))
    if (!entry && !pkgWithScript) return fail(`Fatal error from pip prevented installation. Full pip output in file:\n    ${PIPX_HOME}/logs/cmd_2026-09-18_09.41.07_pip_errors.log\n\nERROR: Could not find a version that satisfies the requirement ${app} (from versions: none)\nERROR: No matching distribution found for ${app}\n\nError installing ${app}.`)
    const script = entry?.scripts?.includes(app) ? app : entry?.scripts?.[0] ?? app
    if (script === 'pyproject-build' || app === 'build') return buildProject(sh, st, [...runArgs, '--via-pipx'])
    if (script === 'cowsay') return cowsay(runArgs)
    if (script === 'twine') return twine(sh, st, runArgs, true)
    return ok(`(pipx run ${app}: ${script} ${runArgs.join(' ')} would run here in a temporary environment; only build, cowsay, and twine are simulated)\n`)
  }
  if (sub === 'environment') return ok(`PIPX_HOME=${PIPX_HOME}\nPIPX_BIN_DIR=${PIPX_BIN}\nPIPX_MAN_DIR=/home/learner/.local/share/man\nPIPX_SHARED_LIBS=${PIPX_HOME}/shared\nPIPX_LOCAL_VENVS=${PIPX_HOME}/venvs\nPIPX_LOG_DIR=${PIPX_HOME}/logs\nPIPX_TRASH_DIR=${PIPX_HOME}/.trash\nPIPX_VENV_CACHEDIR=/home/learner/.cache/pipx\nPIPX_DEFAULT_PYTHON=/usr/bin/python3\nUSE_EMOJI=true\n`)
  return fail(`usage: pipx [-h] ... {install,uninstall,upgrade,list,run,ensurepath} ...\npipx: error: argument command: invalid choice: '${sub}'`, 2)
}

function cowsay(args: string[]): CmdResult {
  const text = args.filter((a) => a !== '-t' && a !== '--text').join(' ') || 'Moo!'
  const bar = '_'.repeat(text.length + 2)
  return ok(`  ${bar}\n| ${text} |\n  ${'='.repeat(text.length + 2)}\n                        \\\n                         \\\n                           ^__^\n                           (oo)\\_______\n                           (__)\\       )\\/\\\n                               ||----w |\n                               ||     ||\n`)
}

/* ---------- twine ---------- */

function twine(sh: Shell, st: PyenvState, args: string[], viaPipx = false): CmdResult {
  const t = target(sh, st)
  const available = viaPipx || packagesOf(sh, st).twine || st.pipx.twine || sh.env.VIRTUAL_ENV?.startsWith(PIPX_HOME)
  if (!available) return fail(t.kind === 'venv' ? 'twine: command not found' : 'twine: command not found', 127)
  const [sub, ...rest] = args
  if (!sub || sub === '--help' || sub === '-h') return ok('usage: twine [-h] [--version] [--no-color] {register,check,upload}\n\npositional arguments:\n  {register,check,upload}\n\noptions:\n  -h, --help            show this help message and exit\n  --version             show program\'s version number and exit\n  --no-color            disable colored output\n')
  if (sub === '--version') return ok('twine version 5.1.1 (importlib-metadata: 8.5.0, keyring: 25.4.1, pkginfo: 1.10.0, requests: 2.32.3, requests-toolbelt: 1.0.0, urllib3: 2.2.3)\n')
  let repository = 'pypi'
  let repoUrl: string | null = null
  const files: string[] = []
  let username = sh.env.TWINE_USERNAME ?? ''
  let password = sh.env.TWINE_PASSWORD ?? ''
  let nonInteractive = false
  let skipExisting = false
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '-r' || a === '--repository') repository = rest[++i] ?? ''
    else if (a === '--repository-url') repoUrl = rest[++i] ?? null
    else if (a === '-u' || a === '--username') username = rest[++i] ?? ''
    else if (a === '-p' || a === '--password') password = rest[++i] ?? ''
    else if (a === '--non-interactive') nonInteractive = true
    else if (a === '--skip-existing') skipExisting = true
    else if (a === '--verbose' || a === '--disable-progress-bar') { /* fine */ }
    else if (a.startsWith('-')) return fail(`usage: twine ${sub} [-h] ...\ntwine ${sub}: error: unrecognized arguments: ${a}`, 2)
    else files.push(a)
  }
  if (!files.length) return fail(`usage: twine ${sub} [-h] ... dist [dist ...]\ntwine ${sub}: error: the following arguments are required: dist`, 2)
  const resolved: string[] = []
  for (const f of files) {
    if (/[*?]/.test(f)) return fail(`InvalidDistribution: Cannot find file (or expand pattern): '${f}'`)
    const abs = sh.path(f)
    if (!sh.vfs.get(abs)) return fail(`InvalidDistribution: Cannot find file (or expand pattern): '${f}'`)
    if (!/\.(whl|tar\.gz|zip)$/.test(abs)) return fail(`InvalidDistribution: Unknown distribution format: '${basename(abs)}'`)
    resolved.push(abs)
  }
  if (sub === 'check') return ok(resolved.map((f) => `Checking ${f.startsWith(sh.cwd + '/') ? f.slice(sh.cwd.length + 1) : f}: PASSED`).join('\n') + '\n')
  if (sub !== 'upload' && sub !== 'register') return fail(`usage: twine [-h] [--version] [--no-color] {register,check,upload} ...\ntwine: error: argument command: invalid choice: '${sub}' (choose from 'register', 'check', 'upload')`, 2)
  const url = repoUrl ?? (repository === 'testpypi' ? 'https://test.pypi.org/legacy/' : repository === 'pypi' ? 'https://upload.pypi.org/legacy/' : null)
  if (!url) return fail(`InvalidConfiguration: Missing 'https://upload.pypi.org/legacy/' section from /home/learner/.pypirc.\nMore info: https://packaging.python.org/specifications/pypirc/ `)
  const rel = (f: string) => (f.startsWith(sh.cwd + '/') ? f.slice(sh.cwd.length + 1) : f)
  if (!username && !password) {
    return { out: `Uploading distributions to ${url}\n`, err: nonInteractive ? 'ERROR    InvalidConfiguration: Missing credentials: please provide a token via TWINE_USERNAME=__token__ and TWINE_PASSWORD, or with --username and --password.\n' : `Enter your API token: \nERROR    this terminal cannot type a token at the prompt. Set the token in the environment first, then run twine again:\n           export TWINE_USERNAME=__token__\n           export TWINE_PASSWORD=pypi-AgENdGVzdC5weXBpLm9yZw...   (your TestPyPI token)\n`, code: 1 }
  }
  if (!username) username = '__token__'
  if (!password) return { out: `Uploading distributions to ${url}\n`, err: 'Enter your password: \nERROR    this terminal cannot type a password at the prompt. Set TWINE_PASSWORD in the environment and run twine again.\n', code: 1 }
  if (username === '__token__' && !password.startsWith('pypi-')) return { out: `Uploading distributions to ${url}\n`, err: `ERROR    HTTPError: 403 Forbidden from ${url}\n         Invalid or non-existent authentication information. See https://${repository === 'testpypi' ? 'test.pypi.org' : 'pypi.org'}/help/#invalid-auth for more information.\n         (an API token starts with pypi-)\n`, code: 1 }
  const already = st.uploads.find((u) => u.repository === url && u.files.some((f) => resolved.map(basename).includes(basename(f))))
  if (already && !skipExisting) return { out: `Uploading distributions to ${url}\nUploading ${basename(resolved[0])}\n`, err: `ERROR    HTTPError: 400 Bad Request from ${url}\n         File already exists ('${basename(resolved[0])}', with blake2_256 hash '${hash(resolved[0]).slice(0, 64)}'). See https://${repository === 'testpypi' ? 'test.pypi.org' : 'pypi.org'}/help/#file-name-reuse for more information.\n         (bump the version in pyproject.toml, rebuild, and upload again)\n`, code: 1 }
  const first = basename(resolved[0]).match(/^([A-Za-z0-9_.]+)-(\d[\w.]*?)(?:-py3-none-any\.whl|\.tar\.gz)$/)
  let out = `Uploading distributions to ${url}\n`
  for (const f of resolved) {
    if (already?.files.some((u) => basename(u) === basename(f))) { out += `Skipping ${basename(f)} because it appears to already exist\n`; continue }
    const size = ((sh.vfs.get(f) as { content?: string } | undefined)?.content?.length ?? 0) / 1000 + 6.2
    out += `Uploading ${basename(f)}\n100% ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ${size.toFixed(1)}/${size.toFixed(1)} kB • 00:00 • ${(size * 1.7).toFixed(1)} MB/s\n`
  }
  if (already) already.files.push(...resolved.filter((f) => !already.files.some((u) => basename(u) === basename(f))))
  else st.uploads.push({ repository: url, files: [...resolved] })
  if (first) out += `\nView at:\nhttps://${repository === 'testpypi' || /test\.pypi/.test(url) ? 'test.pypi.org' : 'pypi.org'}/project/${first[1].replace(/_/g, '-')}/${first[2]}/\n`
  out += `(simulated: nothing left this terminal. On your VM the same command really uploads ${resolved.map(rel).join(' and ')}.)\n`
  return ok(out)
}

/* ---------- pip-compile ---------- */

function pipCompile(sh: Shell, st: PyenvState, args: string[]): CmdResult {
  if (!packagesOf(sh, st)['pip-tools'] && !st.pipx['pip-tools']) return fail('pip-compile: command not found', 127)
  const inputs = args.filter((a) => !a.startsWith('-'))
  const oi = args.findIndex((a) => a === '-o' || a === '--output-file')
  const src = inputs[0] ?? (sh.vfs.get(sh.path('requirements.in')) ? 'requirements.in' : sh.vfs.get(sh.path('pyproject.toml')) ? 'pyproject.toml' : null)
  if (!src) return fail('Usage: pip-compile [OPTIONS] [SRC_FILES]...\n\nError: If you do not specify an input file, the default is one of: requirements.in, setup.py, pyproject.toml, setup.cfg', 2)
  let reqs: string[] = []
  if (src.endsWith('pyproject.toml')) { const p = readProject(sh, dirname(sh.path(src))); if (typeof p === 'string') return fail(p); reqs = p.deps }
  else { let text: string; try { text = sh.readFile(src) } catch { return fail(`Usage: pip-compile [OPTIONS] [SRC_FILES]...\nTry 'pip-compile -h' for help.\n\nError: Invalid value for '[SRC_FILES]...': Path '${src}' does not exist.`, 2) } reqs = text.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean) }
  const outFile = oi >= 0 ? args[oi + 1] : src.endsWith('.in') ? src.replace(/\.in$/, '.txt') : 'requirements.txt'
  const pinned: Record<string, { version: string; via: string[] }> = {}
  const add = (name: string, version: string, via: string) => { const k = norm(name); pinned[k] ??= { version, via: [] }; if (!pinned[k].via.includes(via)) pinned[k].via.push(via) }
  for (const r of reqs) {
    const req = parseReq(r)
    if (typeof req === 'string') return fail(req)
    const e = catalog(req.name)
    if (!e) return fail(`Could not find a version that matches ${r}\nNo versions found`)
    if (req.version && !e.versions.includes(req.version)) return fail(`Could not find a version that matches ${r}\nTried: ${e.versions.join(', ')}`)
    add(req.name, req.version ?? e.version, `-r ${src}`)
    const visit = (n: string) => { for (const d of catalog(n)?.deps ?? []) { add(d, catalog(d)?.version ?? '1.0.0', norm(n)); visit(d) } }
    visit(req.name)
  }
  const cmdLine = `pip-compile ${args.join(' ')}`.trim()
  const body = `#\n# This file is autogenerated by pip-compile with Python 3.12\n# by the following command:\n#\n#    ${cmdLine}\n#\n` + Object.keys(pinned).sort().map((k) => `${display(k)}==${pinned[k].version}\n${pinned[k].via.length === 1 ? `    # via ${pinned[k].via[0]}` : '    # via\n' + pinned[k].via.sort().map((v) => `    #   ${v}`).join('\n')}`).join('\n') + '\n'
  sh.writeFile(outFile, body)
  return { out: '', err: body + `${args.includes('--dry-run') ? 'Dry-run, so nothing updated.\n' : ''}`, code: 0, seq: body }
}

/* ---------- install ---------- */

export function install(base: CommandTable) {
  const basePython = base.python3
  const ordered = (r: CmdResult): CmdResult => (r.seq === undefined && r.out && r.err ? { ...r, seq: r.out + r.err } : r)
  const baseApt = base.apt
  const baseWhich = base.which

  const PY_PKGS = ['pipx', 'python3-venv', 'python3.12-venv', 'python3-full', 'python3-build', 'python3-pip', 'twine']
  base.apt = (sh, args, stdin) => {
    const sub = args.find((a) => !a.startsWith('-'))
    const pkgs = args.filter((a) => a !== sub && !a.startsWith('-'))
    const mine = pkgs.filter((p) => PY_PKGS.includes(p))
    if (sub !== 'install' || !mine.length) return baseApt(sh, args, stdin)
    if (sh.user !== 'root') return fail('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?', 100)
    const st = state(sh)
    let out = ''
    for (const p of mine) {
      const already = sh.state.packages.includes(p)
      if (!already) sh.state.packages.push(p)
      if (p === 'pipx') { st.pipxInstalled = true; if (!sh.vfs.get('/usr/bin/pipx')) sh.vfs.writeFile('/usr/bin/pipx', '#!builtin\n', { owner: 'root', mode: 0o755 }) }
      if (p === 'python3-build') st.system.build = { name: 'build', version: '1.0.3', scripts: ['pyproject-build'], requires: [] }
      if (p === 'twine') st.system.twine = { name: 'twine', version: '4.0.2', scripts: ['twine'], requires: [] }
      const ver: Record<string, string> = { pipx: '1.4.3-1', 'python3-venv': '3.12.3-0ubuntu2', 'python3.12-venv': '3.12.3-1ubuntu0.3', 'python3-full': '3.12.3-0ubuntu2', 'python3-build': '1.0.3-2', 'python3-pip': '24.0+dfsg-1ubuntu1.1', twine: '4.0.2-2' }
      if (already) { out += `${p} is already the newest version (${ver[p]}).\n`; continue }
      out += `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n${p === 'pipx' ? 'The following additional packages will be installed:\n  python3-argcomplete python3-packaging python3-platformdirs python3-psutil python3-userpath\n' : ''}The following NEW packages will be installed:\n  ${p}\n0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.\nGet:1 http://archive.ubuntu.com/ubuntu noble/universe amd64 ${p} all ${ver[p]} [${p === 'pipx' ? '57.9' : '88.4'} kB]\nFetched ${p === 'pipx' ? '57.9' : '88.4'} kB in 0s (312 kB/s)\nSelecting previously unselected package ${p}.\nUnpacking ${p} (${ver[p]}) ...\nSetting up ${p} (${ver[p]}) ...\n`
    }
    const others = pkgs.filter((p) => !PY_PKGS.includes(p))
    if (others.length) { const r = baseApt(sh, [sub, ...others], stdin); out += r.out; if (r.code !== 0) return { out, err: r.err, code: r.code } }
    return ok(out)
  }

  base.python3 = (sh, args, stdin) => {
    const st = state(sh)
    if (args[0] === '-m') {
      const mod = args[1]
      if (mod === 'venv') {
        const opts = args.slice(2)
        const dir = opts.filter((a) => !a.startsWith('-'))[0]
        if (!dir) return fail('usage: venv [-h] [--system-site-packages] [--symlinks | --copies] [--clear] [--upgrade] [--without-pip] [--prompt PROMPT] [--upgrade-deps] ENV_DIR [ENV_DIR ...]\nvenv: error: the following arguments are required: ENV_DIR', 2)
        return createVenv(sh, st, dir, !opts.includes('--without-pip'))
      }
      if (mod === 'pip') return ordered(pip(sh, st, args.slice(2)))
      if (mod === 'build') return ordered(buildProject(sh, st, args.slice(2)))
      if (mod === 'twine') return ordered(twine(sh, st, args.slice(2)))
      if (mod === 'pipx') return ordered(pipx(sh, st, args.slice(2)))
      if (mod === 'ensurepip') return ok(`Looking in links: /tmp/tmp9x8y7z\nRequirement already satisfied: pip in ${sitePackages(sh, st)} (${PIP})\n`)
      if (mod === 'site') return ok(`sys.path = [\n    '${sh.cwd}',\n    '/usr/lib/python312.zip',\n    '/usr/lib/python3.12',\n    '/usr/lib/python3.12/lib-dynload',\n    '${sitePackages(sh, st)}',\n]\nUSER_BASE: '/home/learner/.local' (exists)\nUSER_SITE: '/home/learner/.local/lib/python3.12/site-packages' (doesn't exist)\nENABLE_USER_SITE: ${sh.env.VIRTUAL_ENV ? 'False' : 'True'}\n`)
      if (mod && !mod.startsWith('-')) {
        // python -m PACKAGE for a package installed with -e: run its launcher if it has one.
        const pkg = packagesOf(sh, st)[norm(mod.split('.')[0])]
        if (pkg?.location) { const script = pkg.scripts[0]; if (script) return sh.execFile(`${binDir(sh, st)}/${script}`, args.slice(2), stdin); return ok(`(python -m ${mod} would run ${pkg.location}; its code runs for real on your VM)\n`) }
        const local = sh.vfs.get(sh.path(mod.replace(/\./g, '/') + '/__main__.py')) ?? sh.vfs.get(sh.path(mod.replace(/\./g, '/') + '.py'))
        if (local) return ok(`(python -m ${mod} runs in the Python lessons, where a real interpreter is loaded.)\n`)
        return fail(`/usr/bin/python3: No module named ${mod}`)
      }
    }
    if (args[0] === '-c' && /import\s+(\w+)/.test(args[1] ?? '')) {
      const mod = args[1].match(/import\s+(\w+)/)![1]
      const stdlib = ['sys', 'os', 'json', 'pathlib', 'argparse', 'math', 'random', 'datetime', 'collections', 'tomllib', 'sqlite3', 'logging', 'subprocess', 're', 'time', 'itertools', 'functools', 'dataclasses', 'typing', 'unittest', 'csv', 'shutil', 'tempfile', 'asyncio', 'importlib', 'venv', 'site', 'platform']
      const installed = packagesOf(sh, st)
      const known = installed[norm(mod)] || Object.values(installed).some((p) => p.name.replace(/-/g, '_') === mod) || stdlib.includes(mod) || sh.vfs.get(sh.path(mod + '.py')) || sh.vfs.get(sh.path(mod + '/__init__.py')) || sh.vfs.get(sh.path('src/' + mod + '/__init__.py')) && installed[norm(mod)]
      if (!known) return fail(`Traceback (most recent call last):\n  File "<string>", line 1, in <module>\nModuleNotFoundError: No module named '${mod}'`)
      const ver = installed[norm(mod)]?.version
      if (/__version__|\.version/.test(args[1]) && ver) return ok(ver + '\n')
      if (/print\(\s*(\w+)\.__file__\s*\)/.test(args[1])) return ok(`${installed[norm(mod)]?.location ? installed[norm(mod)].location + '/src/' + mod + '/__init__.py' : sitePackages(sh, st) + '/' + mod + '/__init__.py'}\n`)
      if (/print\(\s*sys\.prefix\s*\)/.test(args[1])) return ok((sh.env.VIRTUAL_ENV ?? '/usr') + '\n')
      if (/print\(\s*sys\.executable\s*\)/.test(args[1])) return ok((sh.env.VIRTUAL_ENV ? sh.env.VIRTUAL_ENV + '/bin/python3' : '/usr/bin/python3') + '\n')
      if (/print\(\s*sys\.path\s*\)/.test(args[1])) return ok(`['', '/usr/lib/python312.zip', '/usr/lib/python3.12', '/usr/lib/python3.12/lib-dynload', '${sitePackages(sh, st)}']\n`)
      return ok(`(import ${mod} works here: ${stdlib.includes(mod) ? 'it is in the standard library' : `it is installed in ${sitePackages(sh, st)}`}. The rest of the code runs in the Python lessons.)\n`)
    }
    return basePython(sh, args, stdin)
  }
  base.python = (sh, args, stdin) => base.python3(sh, args, stdin)

  base.pip = (sh, args) => ordered(pip(sh, state(sh), args))
  base.pip3 = (sh, args) => ordered(pip(sh, state(sh), args))
  base.pipx = (sh, args) => ordered(pipx(sh, state(sh), args))
  base.twine = (sh, args) => ordered(twine(sh, state(sh), args))
  base['pip-compile'] = (sh, args) => pipCompile(sh, state(sh), args)
  base['pyproject-build'] = (sh, args) => buildProject(sh, state(sh), args)
  base.cowsay = (sh, args) => { const st = state(sh); if (!packagesOf(sh, st).cowsay && !st.pipx.cowsay && !sh.state.packages.includes('cowsay')) return fail('cowsay: command not found', 127); return cowsay(args) }
  base.deactivate = (sh) => (sh.env.VIRTUAL_ENV ? (delete sh.env.VIRTUAL_ENV, ok()) : fail('bash: deactivate: command not found', 127))

  // which: hide the launcher-backed builtins until something installs them.
  base.which = (sh, args, stdin) => {
    const st = state(sh)
    const hidden = (name: string) => (name === 'pipx' && !st.pipxInstalled) || (name === 'twine' && !packagesOf(sh, st).twine && !st.pipx.twine) || (name === 'pip-compile' && !packagesOf(sh, st)['pip-tools']) || (name === 'cowsay' && !packagesOf(sh, st).cowsay && !st.pipx.cowsay) || (name === 'docker' && !(sh.state.sims.docker as { installed?: boolean } | undefined)?.installed) || name === 'deactivate' || (name === 'pyproject-build' && !packagesOf(sh, st).build)
    const r = baseWhich(sh, args, stdin)
    const lines = r.out.split('\n').filter(Boolean).filter((l) => !(l.startsWith('/usr/bin/') && hidden(basename(l))))
    return { out: lines.length ? lines.join('\n') + '\n' : '', err: r.err, code: lines.length === args.length ? 0 : 1 }
  }
}
