import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w11d4',
  tier: 1,
  track: 'linux',
  week: 11,
  day: 4,
  title: 'cron and systemd',
  concept: `Two systems run things when you are not there.

cron runs commands on a schedule. Each user has a crontab, a list of lines with five time fields and a command: minute, hour, day of month, month, day of week. 30 2 * * * /home/learner/backup.sh means 02:30 every day. A star means every. crontab -l shows your schedule and crontab file installs one from a file.

systemd manages services: long running programs like a web server or sshd. systemctl status nginx shows whether it is running and its last log lines. start, stop, and restart change its state right now, and enable makes it start at boot. Changing a service needs sudo. journalctl -u nginx shows its full log.

Rule of thumb: a recurring task is a cron job, an always-on program is a service.`,
  example: {
    language: 'bash',
    caption: 'Schedule a job, check a service',
    code: `cat mycron
30 2 * * * /home/learner/backup.sh
crontab mycron
crontab -l
30 2 * * * /home/learner/backup.sh
systemctl status cron
● cron.service - Regular background program processing daemon
     Active: active (running)
sudo systemctl start nginx`,
  },
  task: {
    kind: 'shell',
    instructions: '1. In the editor, write a crontab line in mycron that runs /home/learner/backup.sh at 02:30 every day.\n2. Install it with crontab mycron and list it with crontab -l.\n3. Check the status of the cron service.\n4. nginx is installed but stopped. Start it with sudo systemctl start nginx and confirm it is active.',
    seed: { ...HOME_SEED, '/home/learner/backup.sh': '#!/bin/bash\ntar -czf /tmp/home-backup.tar.gz /home/learner\n' },
    file: '/home/learner/mycron',
    starter: '# minute hour day-of-month month day-of-week command\n',
    hints: ['The five fields for 02:30 daily are: 30 2 * * *', 'crontab mycron installs the file. crontab -l prints what is installed.', 'systemctl status cron, then sudo systemctl start nginx and systemctl status nginx.'],
    solution: { file: '30 2 * * * /home/learner/backup.sh\n', commands: ['crontab mycron', 'crontab -l', 'systemctl status cron', 'sudo systemctl start nginx', 'systemctl status nginx'] },
    check: (r) =>
      steps([
        [/^30\s+2\s+\*\s+\*\s+\*\s+\/home\/learner\/backup\.sh\s*$/m.test(r.state?.crontab ?? ''), 'Write the line 30 2 * * * /home/learner/backup.sh in mycron and install it with crontab mycron.'],
        [ranWith(r, /^\s*crontab\s+-l/, /30 2 \* \* \* \/home\/learner\/backup\.sh/), 'List the installed schedule with crontab -l.'],
        [ranWith(r, /^\s*systemctl\s+status\s+cron/, /active \(running\)/), 'Check the cron service with systemctl status cron.'],
        [r.state?.services.nginx === 'active', 'Start nginx with sudo systemctl start nginx.'],
        [ranWith(r, /^\s*systemctl\s+(status|is-active)\s+nginx/, /active \(running\)|^active\n$/), 'Confirm with systemctl status nginx.'],
      ], 'A scheduled job and a managed service, both under control.'),
  },
  quiz: [
    { question: 'What does 0 9 * * 1 mean in a crontab?', options: ['9:00 every day', '9:00 every Monday', 'Every 9 minutes'], answer: 1, explanation: 'Minute 0, hour 9, any day of month, any month, weekday 1 which is Monday.' },
    { question: 'What does systemctl enable nginx do?', options: ['Starts nginx now', 'Makes nginx start automatically at boot', 'Installs nginx'], answer: 1, explanation: 'enable affects boot. start affects right now. You often want both.' },
    { question: 'Where do you read the logs of a systemd service?', options: ['journalctl -u service', 'crontab -l', 'cat /etc/systemd'], answer: 0, explanation: 'journalctl reads the systemd journal, and -u filters to one unit.' },
  ],
}

export default lesson
