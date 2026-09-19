import type { Lesson } from '../types'
import type { SystemdState } from '../../shell/sim/systemd'
import { HOME_SEED, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w19d1',
  tier: 2,
  track: 'linux',
  week: 19,
  day: 1,
  title: 'Units, systemctl, journalctl',
  concept: `systemd is the program that starts everything else on an Ubuntu box. Each thing it manages is a unit: a service is a program it keeps running, a timer is a schedule, a target is a group of units. A unit is described by a small text file, like ssh.service.

systemctl talks to systemd. status NAME shows the whole picture: Loaded (which file, enabled or not), Active (running, inactive, or failed), the Main PID, and the last log lines. start and stop change it now. enable and disable decide whether it starts at boot, so a fresh install usually needs both. Changing anything needs sudo.

journalctl reads the log systemd keeps for every unit: -u NAME picks one unit, -n 20 the last 20 lines, --since today only today.`,
  example: {
    language: 'bash',
    caption: 'Look, start, enable, read the log',
    code: `systemctl status ssh
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Mon 2026-09-14 07:26:13 UTC; 3 days ago
   Main PID: 412 (sshd)
sudo systemctl start nginx
sudo systemctl enable nginx
Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service → /lib/systemd/system/nginx.service.
journalctl -u nginx -n 5`,
  },
  task: {
    kind: 'shell',
    instructions: 'A small web app called stackapp is installed but not running.\n1. Look at it with systemctl status stackapp. Note the Loaded line and the Active line.\n2. Start it with sudo, then confirm with systemctl is-active stackapp.\n3. Make it start at every boot with sudo systemctl enable stackapp, then check systemctl is-enabled stackapp.\n4. Read its log with journalctl -u stackapp.\n5. Restart it with sudo systemctl restart stackapp and look at the status again: a new Main PID and fresh log lines.',
    seed: {
      ...HOME_SEED,
      '/opt/stackapp/run.sh': '#!/bin/bash\n# A stand-in for a small web app.\necho "stackapp 1.2.0 starting"\necho "stackapp listening on port 8080"\n',
      '/lib/systemd/system/stackapp.service': '[Unit]\nDescription=Stackapp demo web app\nAfter=network.target\n\n[Service]\nExecStart=/usr/bin/bash /opt/stackapp/run.sh\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n',
    },
    hints: ['systemctl status stackapp works without sudo. Reading is free, changing needs root.', 'sudo systemctl start stackapp, then systemctl is-active stackapp prints one word.', 'sudo systemctl enable stackapp prints a Created symlink line. journalctl -u stackapp shows what the app printed.', 'sudo systemctl restart stackapp, then systemctl status stackapp again.'],
    solution: { commands: ['systemctl status stackapp', 'sudo systemctl start stackapp', 'systemctl is-active stackapp', 'sudo systemctl enable stackapp', 'systemctl is-enabled stackapp', 'journalctl -u stackapp', 'sudo systemctl restart stackapp', 'systemctl status stackapp'] },
    check: (r) => {
      const sd = r.state?.sims?.systemd as SystemdState | undefined
      const unit = sd?.units['stackapp.service']
      const h = r.history ?? []
      const restartIdx = h.findIndex((c) => /^\s*sudo\s+systemctl\s+restart\s+stackapp/.test(c))
      const statusAfter = restartIdx >= 0 && h.slice(restartIdx + 1).some((c, k) => /^\s*systemctl\s+status\s+stackapp/.test(c) && /active \(running\)/.test(r.outputs?.[restartIdx + 1 + k] ?? ''))
      return steps([
        [ranWith(r, /^\s*systemctl\s+status\s+stackapp/, /inactive \(dead\)/), 'Step 1: run systemctl status stackapp while it is still stopped.'],
        [ran(r, /^\s*sudo\s+systemctl\s+start\s+stackapp/) && unit?.active === 'active', 'Step 2: start it with sudo systemctl start stackapp.'],
        [ranWith(r, /^\s*systemctl\s+is-active\s+stackapp/, /^active\n$/), 'Step 2: confirm with systemctl is-active stackapp.'],
        [Boolean(sd?.enabled.includes('stackapp.service')), 'Step 3: enable it at boot with sudo systemctl enable stackapp.'],
        [ranWith(r, /^\s*systemctl\s+is-enabled\s+stackapp/, /^enabled\n$/), 'Step 3: check it with systemctl is-enabled stackapp.'],
        [ranWith(r, /^\s*(sudo\s+)?journalctl\b.*-u\s*stackapp/, /listening on port 8080/), 'Step 4: read the log with journalctl -u stackapp.'],
        [restartIdx >= 0 && unit?.active === 'active', 'Step 5: restart it with sudo systemctl restart stackapp.'],
        [statusAfter, 'Step 5: after the restart, run systemctl status stackapp again.'],
      ], 'You can read, start, enable, and restart a service, and read its log. That is most of what an admin does with systemd.')
    },
  },
  quiz: [
    { question: 'What is the difference between systemctl start and systemctl enable?', options: ['start runs it now, enable makes it start at boot', 'They are the same', 'enable runs it now, start makes it start at boot'], answer: 0, explanation: 'start affects right now, enable affects future boots. A new service usually needs both.' },
    { question: 'Which command shows the last 20 log lines of backup.service?', options: ['systemctl log backup 20', 'journalctl -u backup.service -n 20', 'cat /var/log/backup.service'], answer: 1, explanation: 'journalctl reads the journal, -u picks the unit, -n limits the number of lines.' },
    { question: 'In systemctl status, what does Active: failed (Result: exit-code) mean?', options: ['The unit file has a typo', 'The program ran and exited with a non-zero code', 'The unit is not enabled'], answer: 1, explanation: 'exit-code means the main process ended with a failure status. Read the log lines below it for the reason.' },
  ],
}

export default lesson
