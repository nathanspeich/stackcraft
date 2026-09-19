import type { Lesson } from '../types'
import type { SystemdState } from '../../shell/sim/systemd'
import { HOME_SEED, fileContent, hasExecBit, ranWith, steps } from '../checks'

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

const BACKUP_SERVICE = `[Unit]
Description=Nightly backup of my notes

[Service]
Type=oneshot
ExecStart=/home/learner/bin/backup.sh
User=learner

[Install]
WantedBy=multi-user.target
`

const lesson: Lesson = {
  id: 'w19d3',
  tier: 2,
  track: 'linux',
  week: 19,
  day: 3,
  title: 'Timers as the modern cron',
  concept: `A timer is a unit that starts another unit on a schedule. Compared with cron you get logging in the journal, the same status and enable commands, and Persistent=true, which runs a missed job as soon as the machine is back on.

backup.timer starts backup.service, matched by name, or by Unit= if the names differ. [Timer] holds the schedule. OnCalendar=daily is midnight, hourly, weekly, or a pattern like *-*-* 02:30:00 for 02:30 every day and Mon..Fri 08:00 for weekday mornings. OnBootSec=5min runs a while after boot. Timers are enabled with WantedBy=timers.target.

systemctl list-timers shows every timer with NEXT, LEFT, LAST, and PASSED. Test the service by hand first with systemctl start; do not wait until midnight to find a typo.`,
  example: {
    language: 'text',
    caption: 'A daily timer and how it looks once enabled',
    code: `[Unit]
Description=Run the backup every day

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target

sudo systemctl enable --now backup.timer
systemctl list-timers
NEXT                        LEFT      LAST PASSED UNIT         ACTIVATES
Fri 2026-09-18 00:00:00 UTC 14h left  -    -      backup.timer backup.service`,
  },
  task: {
    kind: 'shell',
    instructions: 'backup.service from yesterday is in place. Schedule it.\n1. Make the script executable again (each lesson starts on a fresh machine): chmod +x ~/bin/backup.sh. Then test the service by hand: sudo systemctl start backup.service and journalctl -u backup.service -n 3.\n2. In the editor, write /etc/systemd/system/backup.timer with a Description, OnCalendar=daily and Persistent=true under [Timer], and WantedBy=timers.target under [Install].\n3. Run sudo systemctl daemon-reload, then sudo systemctl enable --now backup.timer (enable and start in one go).\n4. Run systemctl list-timers and find backup.timer: NEXT is midnight.\n5. Run systemctl status backup.timer: active (waiting) and a Trigger line.',
    seed: { ...HOME_SEED, '/home/learner/notes/ideas.txt': 'learn systemd\nautomate the backup\n', '/home/learner/bin/backup.sh': BACKUP_SH, '/etc/systemd/system/backup.service': BACKUP_SERVICE, '/etc/systemd/system/backup.timer': '' },
    file: '/etc/systemd/system/backup.timer',
    starter: '[Unit]\nDescription=\n\n[Timer]\n# OnCalendar= is the schedule\n# Persistent=true catches up on missed runs\n\n[Install]\n# timers are wanted by timers.target\n',
    hints: ['chmod +x ~/bin/backup.sh, then sudo systemctl start backup.service. journalctl -u backup.service -n 3 shows the "saved to" line.', 'Under [Timer]: OnCalendar=daily and Persistent=true. Under [Install]: WantedBy=timers.target.', 'sudo systemctl daemon-reload, then sudo systemctl enable --now backup.timer.', 'systemctl list-timers lists every timer. systemctl status backup.timer shows Trigger: and Triggers:.'],
    solution: {
      file: '[Unit]\nDescription=Run the backup every day\n\n[Timer]\nOnCalendar=daily\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n',
      commands: ['chmod +x ~/bin/backup.sh', 'sudo systemctl start backup.service', 'journalctl -u backup.service -n 3', 'sudo systemctl daemon-reload', 'sudo systemctl enable --now backup.timer', 'systemctl list-timers', 'systemctl status backup.timer'],
    },
    check: (r) => {
      const src = fileContent(r, '/etc/systemd/system/backup.timer') ?? ''
      const sd = r.state?.sims?.systemd as SystemdState | undefined
      const svc = sd?.units['backup.service']
      const timer = sd?.units['backup.timer']
      return steps([
        [hasExecBit(r, '/home/learner/bin/backup.sh'), 'Step 1: chmod +x ~/bin/backup.sh.'],
        [svc?.result === 'success' && svc.code === 0, 'Step 1: test the service first: sudo systemctl start backup.service (then check its status if it fails).'],
        [ranWith(r, /^\s*(sudo\s+)?journalctl\b.*-u\s*backup/, /saved to/), 'Step 1: read the result with journalctl -u backup.service -n 3.'],
        [/^\[Unit\][\s\S]*^Description=\S/m.test(src), 'Step 2: give the timer a Description= under [Unit].'],
        [/^\[Timer\][\s\S]*^OnCalendar=daily\s*$/m.test(src), 'Step 2: under [Timer], add OnCalendar=daily.'],
        [/^Persistent=(true|yes)\s*$/m.test(src), 'Step 2: add Persistent=true so a missed run happens at the next boot.'],
        [/^\[Install\][\s\S]*^WantedBy=timers\.target\s*$/m.test(src), 'Step 2: under [Install], add WantedBy=timers.target.'],
        [timer?.active === 'active' && Boolean(sd?.enabled.includes('backup.timer')), 'Step 3: sudo systemctl daemon-reload, then sudo systemctl enable --now backup.timer.'],
        [ranWith(r, /^\s*systemctl\s+list-timers/, /backup\.timer\s+backup\.service/), 'Step 4: run systemctl list-timers and find backup.timer in it.'],
        [ranWith(r, /^\s*systemctl\s+status\s+backup\.timer/, /active \(waiting\)[\s\S]*Trigger:/), 'Step 5: systemctl status backup.timer should show active (waiting) with a Trigger line.'],
      ], 'The backup now runs itself every night, logs to the journal, and catches up if the machine was off.')
    },
  },
  quiz: [
    { question: 'What does Persistent=true do on a timer?', options: ['Keeps the service running forever', 'Runs the job at the next boot if a scheduled run was missed', 'Makes the timer survive daemon-reload'], answer: 1, explanation: 'Persistent records the last run and catches up on missed runs, which cron cannot do.' },
    { question: 'Which unit does backup.timer start by default?', options: ['backup.service', 'backup.target', 'Whatever is in [Install]'], answer: 0, explanation: 'A timer starts the unit with the same name and a .service suffix unless Unit= says otherwise.' },
    { question: 'Which OnCalendar value means 02:30 every day?', options: ['02:30 daily', '*-*-* 02:30:00', 'every 02:30'], answer: 1, explanation: 'The pattern is date then time: *-*-* is any year-month-day, 02:30:00 is the time.' },
  ],
}

export default lesson
