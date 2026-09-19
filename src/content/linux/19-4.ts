import type { Lesson } from '../types'
import type { SystemdState } from '../../shell/sim/systemd'
import { HOME_SEED, fileContent, fileExists, ran, ranWith, steps } from '../checks'

const REPORT_SH = `#!/bin/bash
# report.sh: count the notes and write a one-line report
set -euo pipefail
if [ -z "\${REPORT_DIR:-}" ]; then
  echo "REPORT_DIR is not set" >&2
  exit 1
fi
mkdir -p "$REPORT_DIR"
count=$(ls "$HOME/notes" | wc -l)
echo "report for $(date +%F): $count notes" > "$REPORT_DIR/latest.txt"
echo "wrote $REPORT_DIR/latest.txt"
`

const BROKEN_UNIT = `[Unit]
Description=Daily notes report
After=network.target

[Service]
Type=oneshot
User=learner
EnvironmentFile=/etc/report.env
ExecStart=/usr/bin/bash /home/learner/bin/reprot.sh
`

const lesson: Lesson = {
  id: 'w19d4',
  tier: 2,
  track: 'linux',
  week: 19,
  day: 4,
  title: 'Environment files, user services, dependencies',
  concept: `Services start with almost no environment: no PATH from your shell, no variables from .bashrc. Environment=KEY=value sets one in the unit, and EnvironmentFile=/etc/app.env loads a file of KEY=value lines, which keeps secrets out of the unit. Without a leading dash a missing file makes the unit fail with result resources.

Units without root: put a file in ~/.config/systemd/user/ and use systemctl --user start NAME and journalctl --user -u NAME. No sudo, and it runs as you.

Dependencies: After=network.target only orders the start. Requires=db.service also pulls db in and fails if db fails. Wants= is the gentle version.

When a unit fails, read systemctl status for the result and status code, then journalctl -xeu NAME for the full story with explanations.`,
  example: {
    language: 'text',
    caption: 'An environment file, a dependency, and reading a failure',
    code: `# /etc/report.env
REPORT_DIR=/var/reports

[Unit]
Description=Daily report
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/report.env
ExecStart=/usr/local/bin/report.sh

systemctl status report.service
× report.service - Daily report
     Active: failed (Result: exit-code)
    Process: 2011 ExecStart=... (code=exited, status=1/FAILURE)
journalctl -xeu report.service`,
  },
  task: {
    kind: 'shell',
    instructions: 'report.service is broken. Diagnose it with status and the journal, then fix it. Its script is ~/bin/report.sh.\n1. Run sudo systemctl start report.service. It fails. Read systemctl status report.service and journalctl -xeu report.service: the first problem is the environment file it expects.\n2. Create it: echo "REPORT_DIR=/home/learner/reports" | sudo tee /etc/report.env\n3. Start it again and read the journal again. This time the command in ExecStart cannot be found: fix the typo in the editor.\n4. Run sudo systemctl daemon-reload (status warned you the file changed), then sudo systemctl start report.service.\n5. Confirm: systemctl status report.service shows status=0/SUCCESS, and cat ~/reports/latest.txt shows the report.',
    seed: { ...HOME_SEED, '/home/learner/notes/ideas.txt': 'learn systemd\nautomate the backup\n', '/home/learner/notes/todo.txt': 'fix the report service\n', '/home/learner/bin/report.sh': REPORT_SH, '/etc/systemd/system/report.service': BROKEN_UNIT },
    file: '/etc/systemd/system/report.service',
    starter: BROKEN_UNIT,
    hints: ['journalctl -xeu report.service reads bottom up: the last lines are the newest. Look for "Failed to load environment files".', 'The unit says EnvironmentFile=/etc/report.env but the file does not exist. Create it with echo "REPORT_DIR=/home/learner/reports" | sudo tee /etc/report.env', 'After the second failure the journal says bash: /home/learner/bin/reprot.sh: No such file or directory. Compare it with ls ~/bin and fix ExecStart in the editor.', 'Any edit to a unit file needs sudo systemctl daemon-reload before the next start.'],
    solution: {
      file: BROKEN_UNIT.replace('reprot.sh', 'report.sh'),
      commands: ['sudo systemctl start report.service', 'systemctl status report.service', 'journalctl -xeu report.service', 'echo "REPORT_DIR=/home/learner/reports" | sudo tee /etc/report.env', 'sudo systemctl daemon-reload', 'sudo systemctl start report.service', 'systemctl status report.service', 'cat ~/reports/latest.txt'],
    },
    check: (r) => {
      const src = fileContent(r, '/etc/systemd/system/report.service') ?? ''
      const env = fileContent(r, '/etc/report.env') ?? ''
      const sd = r.state?.sims?.systemd as SystemdState | undefined
      const unit = sd?.units['report.service']
      return steps([
        [ranWith(r, /^\s*systemctl\s+status\s+report/, /failed \(Result: resources\)/), 'Step 1: sudo systemctl start report.service, then systemctl status report.service. It should show failed (Result: resources).'],
        [ranWith(r, /^\s*(sudo\s+)?journalctl\b.*-x\w*\s*.*report/, /Failed to load environment files/), 'Step 1: read the full story with journalctl -xeu report.service.'],
        [/^REPORT_DIR=\/home\/learner\/reports\s*$/m.test(env), 'Step 2: create /etc/report.env containing REPORT_DIR=/home/learner/reports (use sudo tee).'],
        [/^ExecStart=\/usr\/bin\/bash \/home\/learner\/bin\/report\.sh\s*$/m.test(src), 'Step 3: fix the typo in ExecStart: the script is /home/learner/bin/report.sh.'],
        [ran(r, /^\s*sudo\s+systemctl\s+daemon-reload/), 'Step 4: run sudo systemctl daemon-reload after editing the unit.'],
        [unit?.result === 'success' && unit.code === 0 && fileExists(r, '/home/learner/reports/latest.txt'), 'Step 4: sudo systemctl start report.service should now succeed and write ~/reports/latest.txt.'],
        [ranWith(r, /^\s*systemctl\s+status\s+report/, /status=0\/SUCCESS/), 'Step 5: systemctl status report.service should show status=0/SUCCESS.'],
        [ranWith(r, /^\s*cat\s+~?\/?(home\/learner\/)?reports\/latest\.txt/, /report for \d{4}-\d{2}-\d{2}: \d+ notes/), 'Step 5: cat ~/reports/latest.txt to see the report.'],
      ], 'Two different failures, both found in the journal and fixed. That is exactly how it goes on a real server.')
    },
  },
  quiz: [
    { question: 'A unit has EnvironmentFile=/etc/app.env and the file is missing. What happens?', options: ['The unit runs with an empty environment', 'The unit fails with result resources', 'systemd creates the file'], answer: 1, explanation: 'Without a leading dash the file is required. EnvironmentFile=-/etc/app.env would make it optional.' },
    { question: 'Where does a user-level unit file live?', options: ['/etc/systemd/user/NAME.service', '~/.config/systemd/user/NAME.service', '~/systemd/NAME.service'], answer: 1, explanation: 'User units live under ~/.config/systemd/user and are managed with systemctl --user.' },
    { question: 'What is the difference between After=db.service and Requires=db.service?', options: ['After only orders the start, Requires also starts db and fails if db fails', 'They are the same', 'Requires only orders the start'], answer: 0, explanation: 'Ordering and dependency are separate ideas in systemd. Most units that need another use both After= and Requires= or Wants=.' },
  ],
}

export default lesson
