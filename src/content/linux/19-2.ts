import type { Lesson } from '../types'
import type { SystemdState } from '../../shell/sim/systemd'
import { HOME_SEED, fileContent, hasExecBit, ran, ranWith, steps } from '../checks'

const BACKUP_SH = `#!/bin/bash
# backup.sh: copy the notes folder into ~/backups under today's date
set -euo pipefail
src="$HOME/notes"
dest="$HOME/backups"
if [ $# -ge 1 ]; then src="$1"; fi
if [ $# -ge 2 ]; then dest="$2"; fi
mkdir -p "$dest"
stamp=$(date +%F)
cp -r "$src" "$dest/backup-$stamp"
echo "backup of $src saved to $dest/backup-$stamp"
`

const lesson: Lesson = {
  id: 'w19d2',
  tier: 2,
  track: 'linux',
  week: 19,
  day: 2,
  title: 'Writing a unit file',
  concept: `Your own scripts can be services too. A unit file is a short INI-style text file in /etc/systemd/system with three sections.

[Unit] describes it: Description= is what status shows. [Service] says how to run it: ExecStart= is the command, with an absolute path. Type=oneshot means run once and finish, the default simple means a program that keeps running. User= runs it as that user instead of root. Restart=on-failure with RestartSec=30 retries after a crash. [Install] says when it belongs: WantedBy=multi-user.target is normal boot, and it is what enable uses.

After writing or changing a file, run sudo systemctl daemon-reload so systemd reads it. A oneshot that worked shows inactive (dead) with status=0/SUCCESS. That is success, not a problem.`,
  example: {
    language: 'text',
    caption: 'A complete unit for a script, then the commands to use it',
    code: `[Unit]
Description=Clean the temp folder

[Service]
Type=oneshot
ExecStart=/usr/local/bin/clean-tmp.sh
User=learner
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target

sudo systemctl daemon-reload
sudo systemctl start clean-tmp.service
systemctl status clean-tmp.service`,
  },
  task: {
    kind: 'shell',
    instructions: 'The script ~/bin/backup.sh copies ~/notes into ~/backups. Turn it into backup.service.\n1. Make the script executable: chmod +x ~/bin/backup.sh. systemd refuses a file without the execute bit (status=203/EXEC).\n2. In the editor, complete /etc/systemd/system/backup.service: a Description, Type=oneshot, ExecStart=/home/learner/bin/backup.sh, User=learner, Restart=on-failure, RestartSec=30, and WantedBy=multi-user.target under [Install].\n3. Run sudo systemctl daemon-reload, then sudo systemctl start backup.service.\n4. Check systemctl status backup.service. A finished oneshot shows inactive (dead) with status=0/SUCCESS and the line the script printed.\n5. Enable it with sudo systemctl enable backup.service.',
    seed: { ...HOME_SEED, '/home/learner/notes/ideas.txt': 'learn systemd\nautomate the backup\n', '/home/learner/notes/todo.txt': 'write the unit file\n', '/home/learner/bin/backup.sh': BACKUP_SH, '/etc/systemd/system/backup.service': '' },
    file: '/etc/systemd/system/backup.service',
    starter: '[Unit]\nDescription=\n\n[Service]\n# Type=oneshot runs the script once and finishes\n# ExecStart= needs an absolute path\n# User=\n# Restart= and RestartSec=\n\n[Install]\n# WantedBy=\n',
    hints: ['Every line is Key=Value with no spaces around the =. Comments start with #.', 'Under [Service]: Type=oneshot, ExecStart=/home/learner/bin/backup.sh, User=learner, Restart=on-failure, RestartSec=30.', 'Under [Install]: WantedBy=multi-user.target. Then sudo systemctl daemon-reload and sudo systemctl start backup.service.', 'If status shows status=203/EXEC, the script is not executable or the path is wrong. If it shows Warning: ... changed on disk, run daemon-reload again.'],
    solution: {
      file: '[Unit]\nDescription=Nightly backup of my notes\n\n[Service]\nType=oneshot\nExecStart=/home/learner/bin/backup.sh\nUser=learner\nRestart=on-failure\nRestartSec=30\n\n[Install]\nWantedBy=multi-user.target\n',
      commands: ['chmod +x ~/bin/backup.sh', 'sudo systemctl daemon-reload', 'sudo systemctl start backup.service', 'systemctl status backup.service', 'sudo systemctl enable backup.service'],
    },
    check: (r) => {
      const src = fileContent(r, '/etc/systemd/system/backup.service') ?? ''
      const sd = r.state?.sims?.systemd as SystemdState | undefined
      const unit = sd?.units['backup.service']
      const printed = Boolean(sd?.journal.some((l) => l.unit === 'backup.service' && l.ident === 'backup.sh' && /saved to/.test(l.msg)))
      return steps([
        [hasExecBit(r, '/home/learner/bin/backup.sh'), 'Step 1: chmod +x ~/bin/backup.sh so systemd is allowed to run it.'],
        [/^\[Unit\][\s\S]*^Description=\S/m.test(src), 'Step 2: give the unit a Description= under [Unit].'],
        [/^Type=oneshot\s*$/m.test(src), 'Step 2: add Type=oneshot under [Service]. The script runs and finishes.'],
        [/^ExecStart=\/home\/learner\/bin\/backup\.sh\s*$/m.test(src), 'Step 2: ExecStart=/home/learner/bin/backup.sh (absolute path, no ~).'],
        [/^User=learner\s*$/m.test(src), 'Step 2: add User=learner so the backup is not made as root.'],
        [/^Restart=on-failure\s*$/m.test(src) && /^RestartSec=30\s*$/m.test(src), 'Step 2: add Restart=on-failure and RestartSec=30.'],
        [/^\[Install\][\s\S]*^WantedBy=multi-user\.target\s*$/m.test(src), 'Step 2: under [Install], add WantedBy=multi-user.target.'],
        [ran(r, /^\s*sudo\s+systemctl\s+daemon-reload/), 'Step 3: run sudo systemctl daemon-reload so systemd reads your file.'],
        [unit?.result === 'success' && unit.code === 0 && printed, 'Step 3: sudo systemctl start backup.service, and make sure it succeeds (check the status if it fails).'],
        [ranWith(r, /^\s*systemctl\s+status\s+backup/, /status=0\/SUCCESS/), 'Step 4: systemctl status backup.service should show status=0/SUCCESS.'],
        [Boolean(sd?.enabled.includes('backup.service')), 'Step 5: sudo systemctl enable backup.service.'],
      ], 'Your script is now a real service: described, owned by a user, restartable, and enabled.')
    },
  },
  quiz: [
    { question: 'Why does ExecStart=backup.sh fail while ExecStart=/home/learner/bin/backup.sh works?', options: ['Scripts must live in /usr/bin', 'systemd wants an absolute path, it does not search your folders', 'The name is too short'], answer: 1, explanation: 'systemd runs units with a minimal PATH and no current directory, so give the full path.' },
    { question: 'You edited a unit file and status shows a warning about changes on disk. What next?', options: ['sudo systemctl daemon-reload', 'Reboot', 'Delete the journal'], answer: 0, explanation: 'daemon-reload makes systemd re-read unit files. Until then it keeps the old version in memory.' },
    { question: 'Which section does WantedBy= belong in?', options: ['[Unit]', '[Service]', '[Install]'], answer: 2, explanation: '[Install] is only read by enable and disable, and WantedBy says which target pulls the unit in at boot.' },
  ],
}

export default lesson
