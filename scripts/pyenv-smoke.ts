// Smoke test for the Python environment simulation module (src/shell/sim/pyenv.ts).
import { Shell } from '../src/shell/shell'
import type { PyenvState } from '../src/shell/sim/pyenv'

const sh = new Shell()
const CLI = 'import argparse\nfrom .core import Inventory\n\n\ndef main():\n    parser = argparse.ArgumentParser(prog="inventory", description="Track items in a JSON file")\n    parser.add_argument("--file", default="inventory.json")\n    sub = parser.add_subparsers(dest="command", required=True)\n    p_add = sub.add_parser("add")\n    p_add.add_argument("name")\n    p_add.add_argument("quantity", type=int)\n    p_rm = sub.add_parser("remove")\n    p_rm.add_argument("name")\n    sub.add_parser("list")\n    args = parser.parse_args()\n    inv = Inventory(args.file)\n    print(inv)\n'
sh.seed({
  '/home/learner/inventory/pyproject.toml': '[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "inventory"\nversion = "0.1.0"\ndescription = "A tiny inventory tool"\nrequires-python = ">=3.11"\ndependencies = [\n  "rich>=13",\n]\n\n[project.scripts]\ninventory = "inventory.cli:main"\n',
  '/home/learner/inventory/src/inventory/__init__.py': '"""Inventory package."""\n__version__ = "0.1.0"\n',
  '/home/learner/inventory/src/inventory/cli.py': CLI,
  '/home/learner/inventory/src/inventory/core.py': 'class Inventory:\n    pass\n',
  '/home/learner/inventory/requirements.in': 'requests\nrich>=13\n',
  '/home/learner/broken/pyproject.toml': '[project]\nversion = "0.1.0"\n',
  '/home/learner/empty/README.md': 'nothing here\n',
})
let fails = 0
const t = (cmd: string, expect: string | RegExp, code?: number) => {
  let out: string
  let rc = 0
  try { const r = sh.run(cmd); out = r.output; rc = r.code } catch (e) { out = 'THROW ' + (e as Error).message + '\n' + (e as Error).stack }
  const pass = (typeof expect === 'string' ? out === expect : expect.test(out)) && (code === undefined || code === rc)
  if (!pass) { fails++; console.log(`FAIL ${JSON.stringify(cmd)}\n  got (${rc}): ${JSON.stringify(out.slice(0, 700))}\n  want: ${expect}${code !== undefined ? ' code ' + code : ''}`) }
}
const st = () => sh.state.sims.pyenv as PyenvState

// System pip is externally managed
t('pip --version', /^pip 24\.0 from \/usr\/lib\/python3\/dist-packages\/pip \(python 3\.12\)\n$/)
t('pip install requests', /error: externally-managed-environment[\s\S]*python3 -m venv path\/to\/venv[\s\S]*--break-system-packages/, 1)
t('pip install --break-system-packages requests', /Collecting requests[\s\S]*Successfully installed certifi-[\d.]+ charset-normalizer-[\d.]+ idna-[\d.]+ requests-2\.32\.3 urllib3-[\d.]+/)
t('pip uninstall -y --break-system-packages requests', /Successfully uninstalled requests-2\.32\.3/)
t('pip list', /^Package\s+Version\n-+ -+\n(certifi|charset-normalizer)/)
// venv
t('cd inventory && python3 -m venv .venv && ls .venv', 'bin  include  lib  pyvenv.cfg\n')
t('ls .venv/bin', 'activate  pip  pip3  pip3.12  python  python3  python3.12\n')
t('cat .venv/pyvenv.cfg | head -1', 'home = /usr/bin\n')
t('grep -c _OLD_VIRTUAL_PATH .venv/bin/activate', '4\n')
t('which python3', '/usr/bin/python3\n')
t('source .venv/bin/activate && echo $VIRTUAL_ENV', '/home/learner/inventory/.venv\n')
t('which python3', '/home/learner/inventory/.venv/bin/python3\n')
t('which pip', '/home/learner/inventory/.venv/bin/pip\n')
t('pip --version', /^pip 24\.0 from \/home\/learner\/inventory\/\.venv\/lib\/python3\.12\/site-packages\/pip \(python 3\.12\)\n$/)
t('pip list', 'Package Version\n------- -------\npip     24.0\n\n[notice] A new release of pip is available: 24.0 -> 24.2\n[notice] To update, run: pip install --upgrade pip\n')
t('pip install requests', /^Collecting requests\n  Downloading requests-2\.32\.3-py3-none-any\.whl\.metadata \(\d+ kB\)\nCollecting charset-normalizer \(from requests\)[\s\S]*Installing collected packages: certifi, urllib3, idna, charset-normalizer, requests\nSuccessfully installed certifi-2024\.8\.30 charset-normalizer-3\.4\.0 idna-3\.10 requests-2\.32\.3 urllib3-2\.2\.3\n/)
t('pip install requests', /^Requirement already satisfied: requests in \/home\/learner\/inventory\/\.venv\/lib\/python3\.12\/site-packages \(2\.32\.3\)\n/)
t('pip install requests==2.31.0', /Successfully installed requests-2\.31\.0/)
t('pip install requests==9.9.9', /No matching distribution found for requests==9\.9\.9/, 1)
t('pip install nosuchpackage', /ERROR: Could not find a version that satisfies the requirement nosuchpackage \(from versions: none\)\nERROR: No matching distribution found for nosuchpackage/, 1)
t('pip install --upgrade requests', /Attempting uninstall: requests[\s\S]*Successfully installed requests-2\.32\.3/)
t('pip install --upgrade pip', /Successfully installed pip-24\.2/)
t('pip freeze', 'certifi==2024.8.30\ncharset-normalizer==3.4.0\nidna==3.10\nrequests==2.32.3\nurllib3==2.2.3\n')
t('pip freeze > requirements.txt; wc -l < requirements.txt', '5\n')
t('pip show requests', /^Name: requests\nVersion: 2\.32\.3\nSummary: Python HTTP for Humans\.\n[\s\S]*Location: \/home\/learner\/inventory\/\.venv\/lib\/python3\.12\/site-packages\nRequires: certifi, charset-normalizer, idna, urllib3\nRequired-by: \n$/)
t('pip show nothere', /WARNING: Package\(s\) not found: nothere/, 1)
t('pip index versions requests', /Available versions: 2\.32\.3, 2\.31\.0, 2\.28\.2\n  INSTALLED: 2\.32\.3\n  LATEST:    2\.32\.3/)
t('pip uninstall requests', /Proceed \(Y\/n\)\?[\s\S]*pip uninstall -y NAME/, 2)
t('pip uninstall -y requests', /Successfully uninstalled requests-2\.32\.3/)
t('pip install -r requirements.txt', /Collecting requests\n[\s\S]*Successfully installed requests-2\.32\.3\n/)
t('pip install -r nothere.txt', /Could not open requirements file: \[Errno 2\] No such file or directory: 'nothere\.txt'/, 1)
// editable install of the local project
t('pip install -e .', /^Obtaining file:\/\/\/home\/learner\/inventory\n  Installing build dependencies \.\.\. done\n[\s\S]*Collecting rich \(from inventory\)[\s\S]*Building editable for inventory \(pyproject\.toml\) \.\.\. done\n[\s\S]*Successfully installed inventory-0\.1\.0 markdown-it-py-3\.0\.0 mdurl-0\.1\.2 Pygments-2\.18\.0 rich-13\.9\.4\n/)
t('which inventory', '/home/learner/inventory/.venv/bin/inventory\n')
t('inventory --help', /^usage: inventory \[-h\] \[--file FILE\] \{add,remove,list\} \.\.\.\n\nTrack items in a JSON file\n\npositional arguments:\n  \{add,remove,list\}/)
t('inventory --version', 'inventory 0.1.0\n')
t('inventory list', /inventory list: \(inventory\.cli:main would run here/)
t('pip show inventory', /^Name: inventory\nVersion: 0\.1\.0\nSummary: A tiny inventory tool\n[\s\S]*Editable project location: \/home\/learner\/inventory\nRequires: rich\n/)
t('pip list | grep inventory', /^inventory\s+0\.1\.0\s+\/home\/learner\/inventory\n$/)
t('pip freeze | grep -c "^-e /home/learner/inventory$"', '1\n')
t('python3 -c "import inventory; print(inventory.__version__)"', '0.1.0\n')
t('python3 -c "import nothere"', /ModuleNotFoundError: No module named 'nothere'/, 1)
t('cd ~/broken && pip install -e .', /the \[project\] table needs a name/, 1)
t('cd ~/empty && pip install -e .', /neither 'setup\.py' nor 'pyproject\.toml' found/, 1)
t('cd ~/inventory && pip install .', /Processing file:\/\/\/home\/learner\/inventory[\s\S]*Successfully installed inventory-0\.1\.0/)
// build
t('python3 -m build', /No module named build/, 1)
t('pip install build', /Successfully installed build-1\.2\.2 packaging-24\.1 pyproject-hooks-1\.2\.0/)
t('python3 -m build', /^\* Creating isolated environment: venv\+pip\.\.\.\n\* Installing packages in isolated environment:\n  - setuptools >= 61\.0\n\* Getting build dependencies for sdist\.\.\.[\s\S]*\* Building sdist\.\.\.[\s\S]*\* Building wheel from sdist[\s\S]*\* Building wheel\.\.\.[\s\S]*Successfully built inventory-0\.1\.0\.tar\.gz and inventory-0\.1\.0-py3-none-any\.whl\n$/)
t('ls dist', 'inventory-0.1.0-py3-none-any.whl  inventory-0.1.0.tar.gz\n')
t('cd ~/empty && python3 -m build', /ERROR Source \/home\/learner\/empty does not appear to be a Python project: no pyproject\.toml or setup\.py/, 1)
t('cd ~/inventory && pip install dist/inventory-0.1.0-py3-none-any.whl', /Processing \.\/dist\/inventory-0\.1\.0-py3-none-any\.whl\nInstalling collected packages: inventory\nSuccessfully installed inventory-0\.1\.0/)
// requirements vs lock files
t('pip install pip-tools && pip-compile requirements.in', /autogenerated by pip-compile with Python 3\.12[\s\S]*certifi==2024\.8\.30\n    # via requests\n[\s\S]*requests==2\.32\.3\n    # via -r requirements\.in\n[\s\S]*rich==13\.9\.4\n    # via -r requirements\.in\n/)
t('grep -c "==" requirements.txt', '9\n')
// twine
t('twine --version', /command not found/, 127)
t('pip install twine > ~/pip.log; twine check dist/*', 'Checking dist/inventory-0.1.0-py3-none-any.whl: PASSED\nChecking dist/inventory-0.1.0.tar.gz: PASSED\n')
t('twine upload --repository testpypi dist/*', /Uploading distributions to https:\/\/test\.pypi\.org\/legacy\/\nEnter your API token: [\s\S]*TWINE_PASSWORD/, 1)
t('TWINE_USERNAME=__token__ TWINE_PASSWORD=wrong twine upload --repository testpypi dist/*', /403 Forbidden/, 1)
t('export TWINE_USERNAME=__token__ TWINE_PASSWORD=pypi-AgENdGVzdC5weXBpLm9yZwIkabc; twine upload --repository testpypi dist/*', /^Uploading distributions to https:\/\/test\.pypi\.org\/legacy\/\nUploading inventory-0\.1\.0-py3-none-any\.whl\n100%[\s\S]*Uploading inventory-0\.1\.0\.tar\.gz\n[\s\S]*View at:\nhttps:\/\/test\.pypi\.org\/project\/inventory\/0\.1\.0\/\n\(simulated: nothing left this terminal/)
t('twine upload --repository testpypi dist/*', /400 Bad Request[\s\S]*File already exists/, 1)
t('twine upload --repository testpypi --skip-existing dist/*', /Skipping inventory-0\.1\.0-py3-none-any\.whl because it appears to already exist/)
t('twine upload dist/nothing.whl', /Cannot find file \(or expand pattern\): 'dist\/nothing\.whl'/, 1)
// deactivate
t('deactivate; echo "[$VIRTUAL_ENV]"; which python3', '[]\n/usr/bin/python3\n')
t('pip install -i https://test.pypi.org/simple/ inventory', /externally-managed-environment/, 1)
t('python3 -m venv ~/tryit && source ~/tryit/bin/activate && pip install -i https://test.pypi.org/simple/ inventory', /Looking in indexes: https:\/\/test\.pypi\.org\/simple\/\nCollecting inventory\n[\s\S]*Successfully installed inventory-0\.1\.0/)
t('deactivate', '')
// pipx
t('pipx list', /command not found/, 127)
t('which pipx', '', 1)
t('sudo apt install pipx', /Setting up pipx/)
t('which pipx', '/usr/bin/pipx\n')
t('pipx list', 'nothing has been installed with pipx \ud83d\ude33\n')
t('cd ~/inventory && pipx install .', /^  installed package inventory 0\.1\.0, installed using Python 3\.12\.3\n  These apps are now globally available\n    - inventory\n\n\u26a0\ufe0f  Note: '\/home\/learner\/\.local\/bin' is not on your PATH environment variable[\s\S]*done!/)
t('which inventory', '', 1)
t('inventory --help', /command not found/, 127)
t('export PATH="$HOME/.local/bin:$PATH" && which inventory', '/home/learner/.local/bin/inventory\n')
t('cd /tmp && inventory --help | head -1', 'usage: inventory [-h] [--file FILE] {add,remove,list} ...\n')
t('pipx list', /venvs are in \/home\/learner\/\.local\/share\/pipx\/venvs\napps are exposed on your \$PATH at \/home\/learner\/\.local\/bin\n[\s\S]*   package inventory 0\.1\.0, installed using Python 3\.12\.3\n    - inventory\n/)
t('cd ~/inventory && pipx install .', /already seems to be installed[\s\S]*--force/)
t('pipx install requests', /No apps associated with package requests/, 1)
t('pipx install cowsay && cowsay -t moo | head -2', /installed package cowsay 6\.1[\s\S]*- cowsay[\s\S]*\| moo \|/)
t('pipx run cowsay hello | grep -c hello', '1\n')
t('pipx install nosuch', /No matching distribution found for nosuch/, 1)
t('pipx uninstall inventory', 'uninstalled inventory! \u2728 \ud83c\udf1f \u2728\n')
t('which inventory', '', 1)
t('pipx ensurepath', /already in PATH/)
t('pipx uninstall inventory', /Nothing to uninstall for inventory/, 1)
t('pipx install ~/inventory/dist/inventory-0.1.0-py3-none-any.whl && inventory --version', /installed package inventory 0\.1\.0[\s\S]*\ninventory 0\.1\.0\n$/)
// state for checkers
const s = st()
if (!s.pipxInstalled || !s.pipx.inventory || !s.venvs['/home/learner/inventory/.venv']?.packages.inventory || !s.built.length || !s.uploads.length) { fails++; console.log('FAIL state', JSON.stringify({ pipx: Object.keys(s.pipx), venvs: Object.keys(s.venvs), built: s.built, uploads: s.uploads })) }
const snap = sh.snapshotForChecker()
if (!(snap.state.sims.pyenv as PyenvState).pipxInstalled) { fails++; console.log('FAIL snapshot state') }

console.log(fails ? `${fails} FAILURES` : 'ALL PYENV SMOKE TESTS PASSED')
process.exit(fails ? 1 : 0)
