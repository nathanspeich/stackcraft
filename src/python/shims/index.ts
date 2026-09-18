// Extra pure-Python stand-in modules written into Pyodide before each run.
// Each file exports one Python source string. Modules are popped from sys.modules
// before every run so edits to the learner's code always see a fresh import.
import { PYTEST_SHIM } from './pytest'
import { HTTPX_SHIM } from './httpx'

export const EXTRA_SHIMS: Record<string, string> = {
  'pytest.py': PYTEST_SHIM,
  'httpx.py': HTTPX_SHIM,
}
