import type { CheckResult, InAppTask } from '../content/types'
import { Shell } from './shell'

/** Build a fresh simulated machine for a task. */
export function shellForTask(task: InAppTask): Shell {
  const sh = new Shell()
  if (task.seed) sh.seed(task.seed)
  if (task.machine) {
    if (task.machine.processes) sh.state.processes.push(...task.machine.processes)
    if (task.machine.packages) sh.state.packages.push(...task.machine.packages)
    if (task.machine.services) Object.assign(sh.state.services, task.machine.services)
    if (task.machine.crontab) sh.state.crontab = task.machine.crontab
    if (task.machine.sims) Object.assign(sh.state.sims, task.machine.sims)
  }
  if (task.file && task.starter !== undefined) sh.writeFile(task.file, task.starter)
  if (task.cwd) sh.cwd = sh.path(task.cwd)
  return sh
}

export function runCheck(task: InAppTask, sh: Shell, input: string, output: string): CheckResult {
  try {
    return task.check({ input, output, ...sh.snapshotForChecker() })
  } catch (e) {
    return { pass: false, message: `Checker error: ${(e as Error).message}` }
  }
}
