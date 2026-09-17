import type { Lesson } from '../types'
import { HOME_SEED, ran, ranWith, steps } from '../checks'

const SYSLOG = `Sep 17 06:00:01 stackbox CRON[1811]: (root) CMD (test -x /usr/sbin/anacron || run-parts /etc/cron.daily)
Sep 17 06:25:12 stackbox systemd[1]: Started Session 42 of user learner.
Sep 17 06:25:13 stackbox sshd[1902]: Accepted publickey for learner from 192.168.64.1 port 51234
Sep 17 07:10:44 stackbox kernel: [184.556677] Out of memory: Killed process 2211 (python3) total-vm:3812000kB
Sep 17 07:10:45 stackbox systemd[1]: app.service: Main process exited, code=killed, status=9/KILL
Sep 17 07:30:00 stackbox nginx[1450]: 2026/09/17 07:30:00 [notice] 1450#1450: signal process started
Sep 17 07:30:01 stackbox nginx[1450]: 2026/09/17 07:30:01 [error] 1450#1450: *12 open() "/var/www/html/favicon.ico" failed (2: No such file or directory)
Sep 17 07:45:10 stackbox sshd[2044]: Failed password for invalid user admin from 203.0.113.9 port 40022
Sep 17 07:45:14 stackbox sshd[2044]: Failed password for invalid user admin from 203.0.113.9 port 40022
Sep 17 08:00:01 stackbox CRON[2101]: (learner) CMD (/home/learner/backup.sh)
Sep 17 08:12:30 stackbox nginx[1450]: 2026/09/17 08:12:30 [emerg] 1450#1450: bind() to 0.0.0.0:80 failed (98: Address already in use)
Sep 17 08:12:30 stackbox systemd[1]: nginx.service: Failed with result 'exit-code'.
Sep 17 08:12:31 stackbox systemd[1]: Failed to start A high performance web server and a reverse proxy server.
Sep 17 08:20:00 stackbox systemd[1]: Started Daily apt download activities.
`

const lesson: Lesson = {
  id: 'w11d5',
  tier: 1,
  track: 'linux',
  week: 11,
  day: 5,
  title: 'Logs and troubleshooting',
  concept: `When something breaks, the machine has usually already written down why. Logs live in /var/log. syslog (or messages) collects general system events, auth.log records logins, and each service often has its own file.

Reading logs is mostly tail and grep. tail -n 20 /var/log/syslog shows the most recent lines. tail -f follows new lines live. grep -i error narrows to problems, and grep -c counts them.

For systemd services, journalctl -u name shows that service's log, and systemctl status name shows the last few lines plus whether it is running or failed.

A simple method: notice the symptom, read the newest log lines around that time, form a guess, test it with one change, and write down what fixed it. Most reading of logs needs sudo, because they belong to root.`,
  example: {
    language: 'bash',
    caption: 'From symptom to fix',
    code: `systemctl status nginx
× nginx.service - A high performance web server
     Active: failed (Result: exit-code)
sudo grep -i nginx /var/log/syslog | tail -n 3
... [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)
sudo systemctl restart nginx
systemctl is-active nginx
active`,
  },
  task: {
    kind: 'shell',
    instructions: 'The web server is down.\n1. Check the status of nginx.\n2. Show the last 5 lines of /var/log/syslog (it needs sudo).\n3. Search the syslog for lines mentioning error, ignoring case, and count them with grep -c.\n4. Read the nginx entries with journalctl -u nginx.\n5. Restart nginx with sudo and confirm it is active.',
    seed: { ...HOME_SEED, '/var/log/syslog': SYSLOG },
    machine: { services: { nginx: 'failed' } },
    hints: ['systemctl status nginx shows failed and a hint about why.', 'sudo tail -n 5 /var/log/syslog, then sudo grep -ic error /var/log/syslog', 'journalctl -u nginx', 'sudo systemctl restart nginx, then systemctl is-active nginx'],
    solution: { commands: ['systemctl status nginx', 'sudo tail -n 5 /var/log/syslog', 'sudo grep -ic error /var/log/syslog', 'journalctl -u nginx', 'sudo systemctl restart nginx', 'systemctl is-active nginx'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*systemctl\s+status\s+nginx/, /failed/), 'Start with systemctl status nginx.'],
        [ranWith(r, /^\s*sudo\s+tail\b.*syslog/, /Daily apt download/), 'Show the newest lines: sudo tail -n 5 /var/log/syslog.'],
        [ranWith(r, /^\s*sudo\s+grep\b.*-\w*[ic]\w*[ic].*error.*syslog/i, /^[1-9]\d*\n$/), 'Count the error lines with sudo grep -ic error /var/log/syslog.'],
        [ranWith(r, /^\s*(sudo\s+)?journalctl\b.*-u\s+nginx/, /nginx/), 'Read the service log with journalctl -u nginx.'],
        [ran(r, /^\s*sudo\s+systemctl\s+(restart|start)\s+nginx/) && r.state?.services.nginx === 'active', 'Bring it back with sudo systemctl restart nginx.'],
        [ranWith(r, /^\s*systemctl\s+(is-active|status)\s+nginx/, /^active\n$|active \(running\)/), 'Confirm with systemctl is-active nginx.'],
      ], 'Symptom, logs, cause, fix, confirm. That is troubleshooting.'),
  },
  quiz: [
    { question: 'Where do most system logs live?', options: ['/etc/log', '/var/log', '/home/log'], answer: 1, explanation: '/var/log holds syslog, auth.log, and per-service logs.' },
    { question: 'Which command shows only the log of the ssh service?', options: ['journalctl -u ssh', 'tail /var/log', 'systemctl log ssh'], answer: 0, explanation: 'journalctl -u filters the journal by unit name.' },
    { question: 'nginx fails with "Address already in use". What does that mean?', options: ['The disk is full', 'Another program is already listening on that port', 'The config file is missing'], answer: 1, explanation: 'Only one process can bind a port. ss -tulpn shows who has it.' },
  ],
}

export default lesson
