import type { Lesson } from '../types'
import { fileContent, ranWith, steps } from '../checks'
import type { PyenvState } from '../../shell/sim/pyenv'
import { PACKAGE_SEED } from './26-2'

const PYPROJECT = '[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "inventory"\nversion = "0.1.0"\ndescription = "Keep a small inventory in a JSON file"\nrequires-python = ">=3.11"\ndependencies = []\n\n[project.scripts]\ninventory = "inventory.cli:main"\n'

const lesson: Lesson = {
  id: 'w26d4',
  tier: 2,
  track: 'python',
  week: 26,
  day: 4,
  title: 'pipx, versioning, TestPyPI',
  concept: `A venv is for developing a project. For using a command-line tool, pipx is better: pipx install NAME builds a private venv for that one tool and links its command into ~/.local/bin, so inventory works from any folder with no activate. pipx ensurepath adds that folder to PATH for new shells; in the current one, export PATH="$HOME/.local/bin:$PATH".

Versions follow semantic versioning: MAJOR.MINOR.PATCH. A bug fix bumps PATCH (0.1.0 to 0.1.1), a new feature bumps MINOR, a breaking change bumps MAJOR. The version lives once, in pyproject.toml.

TestPyPI is a sandbox copy of the Python Package Index. twine upload --repository testpypi dist/* pushes your wheel there with an API token in TWINE_USERNAME and TWINE_PASSWORD. Names are global, so on the real site pick one nobody has taken.`,
  example: {
    language: 'bash',
    caption: 'Install with pipx, bump, rebuild, publish',
    code: `sudo apt install pipx
pipx install .                    # from the project folder
export PATH="$HOME/.local/bin:$PATH"
inventory --version               # 0.1.0
# edit version = "0.1.1" in pyproject.toml
pipx upgrade inventory
pipx run build                    # dist/inventory-0.1.1-*
export TWINE_USERNAME=__token__
export TWINE_PASSWORD=pypi-AgENdGVzdC5weXBpLm9yZw...
pipx run twine upload --repository testpypi dist/*`,
  },
  task: {
    kind: 'shell',
    instructions: 'You are in ~/inventory with a working package at version 0.1.0. pyproject.toml is open in the editor.\n1. Install pipx: sudo apt install pipx\n2. Install the project as a tool: pipx install .  then put ~/.local/bin on PATH with export PATH="$HOME/.local/bin:$PATH"\n3. Check it works from elsewhere: cd /tmp && inventory --version, then cd back to ~/inventory.\n4. Bump the version in pyproject.toml to 0.1.1, then pipx upgrade inventory and check inventory --version again.\n5. Build the release without polluting anything: pipx run build (the wheel in dist/ should say 0.1.1).\n6. Publish to TestPyPI: export TWINE_USERNAME=__token__ and TWINE_PASSWORD=pypi-test-token, then pipx run twine upload --repository testpypi dist/*',
    seed: { ...PACKAGE_SEED, '/home/learner/inventory/pyproject.toml': PYPROJECT },
    cwd: '/home/learner/inventory',
    file: '/home/learner/inventory/pyproject.toml',
    starter: PYPROJECT,
    hints: ['pipx warns that ~/.local/bin is not on PATH: that is what the export in step 2 fixes for this shell. pipx ensurepath fixes it for future shells.', 'Step 4: change only the version line in the editor, then pipx upgrade inventory re-reads the project.', 'pipx run build downloads the build tool into a temporary environment, runs it, and throws the environment away.', 'twine needs both variables exported before it runs. Without them it asks for a token, which this terminal cannot type.'],
    solution: {
      file: PYPROJECT.replace('version = "0.1.0"', 'version = "0.1.1"'),
      commands: ['sudo apt install pipx', 'pipx install .', 'export PATH="$HOME/.local/bin:$PATH"', 'cd /tmp && inventory --version', 'cd ~/inventory', 'pipx upgrade inventory', 'inventory --version', 'pipx run build', 'export TWINE_USERNAME=__token__', 'export TWINE_PASSWORD=pypi-test-token', 'pipx run twine upload --repository testpypi dist/*'],
    },
    check: (r) => {
      const p = r.state?.sims?.pyenv as PyenvState | undefined
      const t = fileContent(r, '/home/learner/inventory/pyproject.toml') ?? ''
      const onPath = (r.env?.PATH ?? '').split(':').includes('/home/learner/.local/bin')
      return steps([
        [Boolean(p?.pipxInstalled), 'Step 1: sudo apt install pipx'],
        [Boolean(p?.pipx.inventory), 'Step 2: pipx install . from ~/inventory.'],
        [onPath, 'Step 2: export PATH="$HOME/.local/bin:$PATH" so the shell finds the inventory command.'],
        [ranWith(r, /inventory\s+--version/, /inventory 0\.1\.\d/), 'Step 3: inventory --version should print the installed version (try it from /tmp to prove it works anywhere).'],
        [/^version\s*=\s*"0\.1\.1"\s*$/m.test(t), 'Step 4: change the version in pyproject.toml to 0.1.1.'],
        [p?.pipx.inventory?.version === '0.1.1' && ranWith(r, /inventory\s+--version/, /inventory 0\.1\.1/), 'Step 4: pipx upgrade inventory, then inventory --version should say 0.1.1.'],
        [Boolean(p?.built.includes('/home/learner/inventory/dist/inventory-0.1.1-py3-none-any.whl')), 'Step 5: pipx run build should produce dist/inventory-0.1.1-py3-none-any.whl.'],
        [Boolean(p?.uploads.some((u) => /test\.pypi\.org/.test(u.repository) && u.files.some((f) => /0\.1\.1/.test(f)))), 'Step 6: export TWINE_USERNAME=__token__ and TWINE_PASSWORD=pypi-test-token, then pipx run twine upload --repository testpypi dist/*'],
      ], 'Installed as a tool, versioned, built, and published to the test index. Tomorrow you do it for real on the VM.')
    },
  },
  quiz: [
    { question: 'When should you use pipx instead of pip in a venv?', options: ['For a library you import in code', 'For a command-line tool you want available from any folder', 'Never; pipx is deprecated'], answer: 1, explanation: 'pipx isolates each tool in its own venv and exposes only its commands.' },
    { question: 'You fixed a bug in 1.4.2 with no new features. What is the next version?', options: ['1.4.3', '1.5.0', '2.0.0'], answer: 0, explanation: 'Patch releases are for fixes; minor for features; major for breaking changes.' },
    { question: 'Why upload to TestPyPI first?', options: ['It is faster', 'It is a sandbox: you can practice the flow and check the page without claiming a name on the real index', 'Real PyPI requires it'], answer: 1, explanation: 'TestPyPI is wiped periodically and nothing there is trusted for installs, which is exactly what you want while learning.' },
  ],
}

export default lesson
