import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'w19d5',
  tier: 2,
  track: 'linux',
  week: 19,
  day: 5,
  title: 'Project: backup.service and backup.timer',
  badge: 'service-manager',
  concept: `Time to put the week together on the real box. The backup.sh from week 13 becomes backup.service, a oneshot unit that runs it as your user with the source and destination folders as arguments. backup.timer runs that service every day with OnCalendar=daily and Persistent=true, so a night the VM was off is caught up next boot.

The order matters: write the files, daemon-reload, start the service by hand once and read its journal, and only then enable the timer. A timer only hides mistakes until midnight.

Everything below happens inside the VM (multipass shell stackcraft). Your VM user is ubuntu, so paths say /home/ubuntu. The app only reads what you paste.`,
  example: {
    language: 'bash',
    caption: 'The check sequence you will run in the VM',
    code: `sudo systemctl daemon-reload
sudo systemctl start backup.service
journalctl -u backup.service -n 5
sudo systemctl enable --now backup.timer
systemctl status backup.timer
systemctl list-timers`,
  },
  task: {
    kind: 'real',
    intro: 'In week 13 you wrote backup.sh: it takes a source folder and a destination, makes a dated tar.gz, and keeps the last five. This week you make the VM run it every night without you.\n\nYou will copy the script to ~/bin/backup.sh, write backup.service and backup.timer in /etc/systemd/system, test the service by hand, then enable the timer. If your week 13 script is missing, the first step includes a complete one.\n\nDo everything inside the VM: open it with multipass shell stackcraft from the Mac Terminal. Paste the output of each check below; the app never connects to the VM, it only reads what you paste.',
    steps: [
      {
        instruction: 'Put the script in place and write both unit files. The block below has a complete reference script (skip that part if your week 13 backup.sh works), then the two units. Your source folder is ~/notes (create it if it is empty) and the destination is ~/backups.\n\nWhen the files are in, check what systemd sees with systemctl cat backup.service and paste it.',
        command: `mkdir -p ~/bin ~/notes ~/backups
# Reuse your week 13 script: cp ~/backup.sh ~/bin/backup.sh
# Or use this reference version:
cat > ~/bin/backup.sh <<'EOF'
#!/bin/bash
# backup.sh SOURCE DEST: dated tar.gz of SOURCE in DEST, keep the last 5
set -euo pipefail
usage() { echo "Usage: $0 SOURCE DEST" >&2; exit 1; }
[ $# -eq 2 ] || usage
src=$1
dest=$2
[ -d "$src" ] || usage
mkdir -p "$dest"
name="backup-$(date +%F).tar.gz"
tar -czf "$dest/$name" -C "$(dirname "$src")" "$(basename "$src")"
echo "wrote $dest/$name"
ls -1t "$dest"/backup-*.tar.gz | tail -n +6 | xargs -r rm -f
EOF
chmod +x ~/bin/backup.sh

sudo tee /etc/systemd/system/backup.service > /dev/null <<'EOF'
[Unit]
Description=Nightly backup of my notes

[Service]
Type=oneshot
User=ubuntu
ExecStart=/home/ubuntu/bin/backup.sh /home/ubuntu/notes /home/ubuntu/backups

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/backup.timer > /dev/null <<'EOF'
[Unit]
Description=Run the backup every day

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl cat backup.service`,
        pasteLabel: 'Paste the output of systemctl cat backup.service',
        check: [
          { type: 'includes', text: 'ExecStart=' },
          { type: 'regex', pattern: 'backup\\.sh', label: 'an ExecStart line that runs backup.sh' },
          { type: 'includes', text: '[Service]' },
        ],
        hint: 'No files found for backup.service means the tee command did not write the file: check for a typo in the path and that you used sudo. If the ExecStart line is missing, open the file with sudo nano /etc/systemd/system/backup.service and add it.',
        example: `# /etc/systemd/system/backup.service
[Unit]
Description=Nightly backup of my notes

[Service]
Type=oneshot
User=ubuntu
ExecStart=/home/ubuntu/bin/backup.sh /home/ubuntu/notes /home/ubuntu/backups

[Install]
WantedBy=multi-user.target
`,
      },
      {
        instruction: 'Tell systemd about the new files, run the service once by hand so you know it works, then enable and start the timer. Paste the status of the timer: it should be active (waiting) with a Trigger line for the next midnight.',
        command: `sudo systemctl daemon-reload
sudo systemctl start backup.service
sudo systemctl enable --now backup.timer
systemctl status backup.timer --no-pager`,
        pasteLabel: 'Paste the output of systemctl status backup.timer',
        check: [{ type: 'includes', text: 'active' }],
        hint: 'If the timer shows inactive, run sudo systemctl start backup.timer. If start says the unit was not found, systemd has not read the file yet: sudo systemctl daemon-reload and try again. If backup.service itself failed, read journalctl -xeu backup.service first: the usual causes are a missing execute bit (chmod +x ~/bin/backup.sh) or a wrong path in ExecStart.',
        example: `● backup.timer - Run the backup every day
     Loaded: loaded (/etc/systemd/system/backup.timer; enabled; preset: enabled)
     Active: active (waiting) since Thu 2026-09-17 19:02:41 UTC; 6s ago
    Trigger: Fri 2026-09-18 00:00:00 UTC; 4h 57min left
   Triggers: ● backup.service

Sep 17 19:02:41 stackcraft systemd[1]: Started backup.timer - Run the backup every day.
`,
      },
      {
        instruction: 'List every timer on the VM and find yours in the table. NEXT is the next run, LEFT is how long until then, and ACTIVATES names the service it starts.',
        command: 'systemctl list-timers --no-pager',
        pasteLabel: 'Paste the output of systemctl list-timers',
        check: [{ type: 'includes', text: 'backup.timer' }],
        hint: 'backup.timer only appears here once it is active. Run sudo systemctl enable --now backup.timer, then list again. If it is still missing, systemctl status backup.timer will say why.',
        example: `NEXT                        LEFT          LAST                        PASSED       UNIT                         ACTIVATES
Fri 2026-09-18 00:00:00 UTC 4h 56min left -                           -            backup.timer                 backup.service
Fri 2026-09-18 00:00:00 UTC 4h 56min left Thu 2026-09-17 00:00:12 UTC 19h ago      logrotate.timer              logrotate.service
Fri 2026-09-18 06:42:11 UTC 11h left      Thu 2026-09-17 06:19:03 UTC 12h ago      apt-daily-upgrade.timer      apt-daily-upgrade.service
Fri 2026-09-18 13:07:55 UTC 18h left      Thu 2026-09-17 12:44:19 UTC 6h ago       apt-daily.timer              apt-daily.service
Mon 2026-09-21 00:00:00 UTC 3 days left   Mon 2026-09-14 00:00:09 UTC 3 days ago   fstrim.timer                 fstrim.service

5 timers listed.
Pass --all to see loaded but inactive timers, too.
`,
      },
      {
        instruction: 'Read the last five journal lines of the service. You should see the "wrote" line from your script and Finished backup.service from systemd. This is where you will look whenever you wonder whether last night\'s backup ran.',
        command: 'journalctl -u backup.service -n 5 --no-pager',
        pasteLabel: 'Paste the output of journalctl -u backup.service -n 5',
        check: [
          { type: 'lines', atLeast: 1 },
          { type: 'regex', pattern: 'backup', flags: 'i', label: 'at least one line mentioning backup' },
        ],
        hint: 'If the output is "-- No entries --", the service has not run yet: sudo systemctl start backup.service, then read the journal again. If the lines say failed, the message right above tells you why (a missing folder, a wrong path, or a script that exits 1).',
        example: `Sep 17 19:02:33 stackcraft systemd[1]: Starting backup.service - Nightly backup of my notes...
Sep 17 19:02:33 stackcraft backup.sh[3121]: wrote /home/ubuntu/backups/backup-2026-09-17.tar.gz
Sep 17 19:02:33 stackcraft systemd[1]: backup.service: Deactivated successfully.
Sep 17 19:02:33 stackcraft systemd[1]: Finished backup.service - Nightly backup of my notes.
`,
      },
    ],
  },
  quiz: [
    { question: 'Why start backup.service by hand before enabling the timer?', options: ['Timers cannot start a service that never ran', 'To find mistakes now instead of at midnight', 'systemd requires it'], answer: 1, explanation: 'A timer just calls systemctl start on a schedule. Testing the service first shows errors while you are watching.' },
    { question: 'Where would you look tomorrow to see whether the backup ran overnight?', options: ['journalctl -u backup.service', 'cat /etc/systemd/system/backup.timer', 'systemctl enable backup.timer'], answer: 0, explanation: 'The journal keeps every run of the service with timestamps. list-timers also shows LAST and PASSED.' },
    { question: 'The VM was off at midnight. With Persistent=true, when does the backup run?', options: ['Never, that run is skipped', 'Shortly after the next boot', 'At the next midnight only'], answer: 1, explanation: 'Persistent remembers the last run and triggers a missed one as soon as the timer is active again.' },
  ],
}

export default lesson
