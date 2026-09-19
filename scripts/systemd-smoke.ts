// Smoke test for the systemd simulation (src/shell/sim/systemd.ts): unit files,
// systemctl, journalctl, timers, user scope, and systemd-analyze verify.
import { Shell } from '../src/shell/shell'
import type { SystemdState } from '../src/shell/sim/systemd'
import { nextCalendar, parseSpan, fmtSpan, CLOCK_START } from '../src/shell/sim/systemd'

const sh = new Shell()
sh.seed({
  '/home/learner/notes/a.txt': 'hello\n',
  '/home/learner/bin/backup.sh': '#!/bin/bash\nset -euo pipefail\nsrc="$HOME/notes"\ndest="$HOME/backups"\nif [ $# -ge 1 ]; then src="$1"; fi\nmkdir -p "$dest"\ncp -r "$src" "$dest/backup-$(date +%F)"\necho "backup of $src saved to $dest"\n',
  '/etc/systemd/system/backup.service': '[Unit]\nDescription=Nightly backup of notes\n\n[Service]\nType=oneshot\nUser=learner\nExecStart=/home/learner/bin/backup.sh\nRestart=on-failure\nRestartSec=30\n\n[Install]\nWantedBy=multi-user.target\n',
  '/etc/systemd/system/backup.timer': '[Unit]\nDescription=Run backup daily\n\n[Timer]\nOnCalendar=daily\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n',
  '/opt/stackapp/run.sh': '#!/bin/bash\necho "stackapp listening on port 8080"\n',
  '/lib/systemd/system/stackapp.service': '[Unit]\nDescription=Stackapp demo web app\nAfter=network.target\n\n[Service]\nExecStart=/usr/bin/bash /opt/stackapp/run.sh\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n',
  '/etc/systemd/system/report.service': '[Unit]\nDescription=Daily report\n\n[Service]\nType=oneshot\nUser=learner\nEnvironmentFile=/etc/report.env\nExecStart=/usr/bin/bash /home/learner/bin/report.sh\n',
  '/home/learner/bin/report.sh': '#!/bin/bash\nif [ -z "${REPORT_DIR:-}" ]; then\n  echo "REPORT_DIR is not set" >&2\n  exit 1\nfi\nmkdir -p "$REPORT_DIR"\necho "report" > "$REPORT_DIR/latest.txt"\necho "wrote $REPORT_DIR/latest.txt"\n',
  '/etc/systemd/system/bad.service': '[Unt]\nDescription=x\n\n[Service]\nExecStart=bin/x.sh\nRestrat=always\n',
  '/etc/systemd/system/noexec.service': '[Unit]\nDescription=No ExecStart\n\n[Service]\nType=simple\n',
  '/etc/systemd/system/flaky.service': '[Unit]\nDescription=Always fails\n\n[Service]\nExecStart=/usr/bin/false\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n',
})

let fails = 0
const t = (cmd: string, expect: string | RegExp, code?: number) => {
  let out: string
  let rc = 0
  try { const r = sh.run(cmd); out = r.output; rc = r.code } catch (e) { out = 'THROW ' + (e as Error).message }
  const pass = (typeof expect === 'string' ? out === expect : expect.test(out)) && (code === undefined || rc === code)
  if (!pass) { fails++; console.log(`FAIL ${JSON.stringify(cmd)}\n  got (rc=${rc}): ${JSON.stringify(out)}\n  want: ${expect}${code === undefined ? '' : ` rc=${code}`}`) }
}
const check = (label: string, cond: boolean) => { if (!cond) { fails++; console.log(`FAIL ${label}`) } }
const sim = () => sh.state.sims.systemd as SystemdState

// Missing units and permissions.
t('systemctl status nope', 'Unit nope.service could not be found.\n', 4)
t('systemctl start backup.service', /Failed to start backup\.service: Access denied/, 1)
t('systemctl enable backup.service', /Failed to enable unit: Access denied/, 1)
t('systemctl daemon-reload', /Failed to reload daemon: Access denied/, 1)
t('sudo systemctl start missing.service', /Unit missing\.service not found/, 5)

// Built-in services still go through the base command.
t('systemctl status nginx', /inactive \(dead\)/, 3)
t('sudo systemctl start nginx && systemctl is-active nginx', 'active\n')
t('journalctl -u nginx', '-- No entries --\n')
t('journalctl -u ssh', /Started ssh\.service - OpenBSD Secure Shell server/)

// A oneshot service whose script lacks the execute bit: status=203/EXEC, then Restart=on-failure with a long RestartSec.
t('sudo systemctl start backup.service', /Job for backup\.service failed/, 1)
t('systemctl status backup.service', /activating \(auto-restart\)[\s\S]*status=203\/EXEC[\s\S]*Failed to execute \/home\/learner\/bin\/backup\.sh: Permission denied[\s\S]*Scheduled restart job, restart counter is at 1/, 3)
t('chmod +x ~/bin/backup.sh && sudo systemctl start backup.service', '', 0)
t('systemctl status backup', /○ backup\.service - Nightly backup of notes\n     Loaded: loaded \(\/etc\/systemd\/system\/backup\.service; disabled; preset: enabled\)\n     Active: inactive \(dead\) since Thu 2026-09-17 09:41:\d\d UTC; \ds ago\n    Process: \d+ ExecStart=\/home\/learner\/bin\/backup\.sh \(code=exited, status=0\/SUCCESS\)/, 3)
t('systemctl status backup', /backup\.sh\[\d+\]: backup of \/home\/learner\/notes saved to \/home\/learner\/backups\n.*Deactivated successfully\.\n.*Finished backup\.service - Nightly backup of notes\.\n$/)
t('ls ~/backups | grep -c backup-', '1\n')
t('systemctl is-active backup.service', 'inactive\n', 3)
t('systemctl is-failed backup.service', 'inactive\n', 1)
t('systemctl show -p ActiveState -p Result -p User backup.service', 'ActiveState=inactive\nResult=success\nUser=learner\n')
t('systemctl show -p Restart --value backup.service', 'on-failure\n')
check('unit state recorded', sim().units['backup.service']?.result === 'success' && sim().units['backup.service']?.code === 0)
check('journal has the script output', sim().journal.some((l) => l.unit === 'backup.service' && l.ident === 'backup.sh' && l.msg.includes('saved to')))

// Enable and disable print the symlink lines and remember the state.
t('systemctl is-enabled backup.service', 'disabled\n', 1)
t('sudo systemctl enable backup.service', 'Created symlink /etc/systemd/system/multi-user.target.wants/backup.service → /etc/systemd/system/backup.service.\n')
t('sudo systemctl enable backup.service', '')
t('systemctl is-enabled backup.service', 'enabled\n', 0)
t('ls /etc/systemd/system/multi-user.target.wants', 'backup.service\n')
check('enabled set', sim().enabled.includes('backup.service'))
t('sudo systemctl disable backup.service', 'Removed "/etc/systemd/system/multi-user.target.wants/backup.service".\n')
t('systemctl is-enabled backup.service', 'disabled\n', 1)
t('sudo systemctl enable report.service', /no installation config/, 1)
t('systemctl is-enabled report.service', 'static\n', 0)

// A simple service stays running with a Main PID that ps can see.
t('systemctl status stackapp', /○ stackapp\.service - Stackapp demo web app\n     Loaded: loaded \(\/lib\/systemd\/system\/stackapp\.service; disabled; preset: enabled\)\n     Active: inactive \(dead\)\n/, 3)
t('sudo systemctl start stackapp && systemctl is-active stackapp', 'active\n', 0)
t('systemctl status stackapp', /active \(running\) since[\s\S]*Main PID: \d+ \(bash\)[\s\S]*CGroup: \/system\.slice\/stackapp\.service[\s\S]*Started stackapp\.service - Stackapp demo web app\.\n.*bash\[\d+\]: stackapp listening on port 8080\n$/, 0)
t('ps aux | grep -c "opt/stackapp/run.sh"', '1\n')
t('sudo systemctl restart stackapp && journalctl -u stackapp -n 3', /Stopped stackapp\.service[\s\S]*Started stackapp\.service[\s\S]*listening on port 8080/)
t('sudo systemctl stop stackapp; systemctl is-active stackapp', 'inactive\n', 3)
t('ps aux | grep -c "opt/stackapp/run.sh"', '0\n')
t('systemctl list-units --type=service', /  UNIT +LOAD +ACTIVE +SUB +DESCRIPTION\n(?![\s\S]*stackapp)[\s\S]*cron\.service +loaded +active +running +Regular[\s\S]*ssh\.service[\s\S]*loaded units listed/)
t('systemctl list-units --type=service --all | grep -c stackapp', '1\n')
t('systemctl list-unit-files --type=service | grep backup', /backup\.service +disabled +enabled/)

// Timers.
t('sudo systemctl enable --now backup.timer', 'Created symlink /etc/systemd/system/timers.target.wants/backup.timer → /etc/systemd/system/backup.timer.\n')
t('systemctl status backup.timer', /● backup\.timer - Run backup daily\n     Loaded: loaded \(\/etc\/systemd\/system\/backup\.timer; enabled; preset: enabled\)\n     Active: active \(waiting\) since[\s\S]*Trigger: Fri 2026-09-18 00:00:00 UTC; 14h \d+min left\n   Triggers: ○ backup\.service\n/, 0)
t('systemctl list-timers', /^NEXT +LEFT +LAST +PASSED +UNIT +ACTIVATES\n[\s\S]*Fri 2026-09-18 00:00:00 UTC +14h \d+min left +- +- +backup\.timer +backup\.service\n[\s\S]*apt-daily-upgrade\.timer[\s\S]*\d+ timers listed\./)
t('systemctl list-timers --all | grep -c timer', /[6-9]/)
t('systemctl show -p NextElapseUSecRealtime -p Unit backup.timer', 'NextElapseUSecRealtime=Fri 2026-09-18 00:00:00 UTC\nUnit=backup.service\n')
t('systemctl cat backup.timer', '# /etc/systemd/system/backup.timer\n[Unit]\nDescription=Run backup daily\n\n[Timer]\nOnCalendar=daily\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n')
check('timer state', sim().units['backup.timer']?.active === 'active' && sim().enabled.includes('backup.timer'))
t('sudo systemctl stop backup.timer; systemctl is-active backup.timer', 'inactive\n', 3)
t('printf "[Unit]\\nDescription=Weekday report\\n\\n[Timer]\\nOnCalendar=Mon..Fri *-*-* 02:30:00\\nUnit=report.service\\n\\n[Install]\\nWantedBy=timers.target\\n" > /tmp/report.timer && sudo cp /tmp/report.timer /etc/systemd/system/ && sudo systemctl start report.timer && systemctl list-timers | grep report', /Fri 2026-09-18 02:30:00 UTC +16h \d+min left +- +- +report\.timer +report\.service/)
t('printf "[Unit]\\nDescription=Orphan\\n\\n[Timer]\\nOnCalendar=hourly\\n" > /tmp/orphan.timer && sudo cp /tmp/orphan.timer /etc/systemd/system/ && sudo systemctl start orphan.timer', /Failed to start orphan\.timer: Unit orphan\.service not found\./, 5)

// Calendar expressions and spans.
const cal = (spec: string) => { const n = nextCalendar(spec, CLOCK_START); return n === null ? null : new Date(n).toISOString().slice(0, 19) }
check('daily', cal('daily') === '2026-09-18T00:00:00')
check('hourly', cal('hourly') === '2026-09-17T10:00:00')
check('weekly', cal('weekly') === '2026-09-21T00:00:00')
check('monthly', cal('monthly') === '2026-10-01T00:00:00')
check('*-*-* HH:MM:SS', cal('*-*-* 02:00:00') === '2026-09-18T02:00:00')
check('HH:MM today', cal('*-*-* 12:30') === '2026-09-17T12:30:00')
check('Sat', cal('Sat *-*-* 09:00:00') === '2026-09-19T09:00:00')
check('Mon..Fri', cal('Mon..Fri 08:00') === '2026-09-18T08:00:00')
check('Sat,Sun', cal('Sat,Sun') === '2026-09-19T00:00:00')
check('hour list', cal('*-*-* 6,18:00') === '2026-09-17T18:00:00')
check('fixed date', cal('2026-12-24 18:00:00') === '2026-12-24T18:00:00')
check('bad calendar', cal('every day at noon') === null)
check('span 5min', parseSpan('5min') === 300000 && parseSpan('1h 30min') === 5400000 && parseSpan('30') === 30000 && parseSpan('2 days') === 172800000 && parseSpan('soon') === null)
check('fmtSpan', fmtSpan(5400000) === '1h 30min' && fmtSpan(90000) === '1min 30s' && fmtSpan(3 * 86400e3 + 7200e3) === '3 days 2h')
t('systemd-analyze calendar daily', /Next elapse: Fri 2026-09-18 00:00:00 UTC/)

// daemon-reload and the changed-on-disk warning.
t('sudo sed -i "s/Nightly backup of notes/Nightly notes backup/" /etc/systemd/system/backup.service && systemctl status backup.service | head -2', /^Warning: The unit file, source configuration file or drop-ins of backup\.service changed on disk\. Run 'systemctl daemon-reload' to reload units\.\n○ backup\.service - Nightly backup of notes\n$/)
t('sudo systemctl daemon-reload && systemctl status backup.service | head -1', '○ backup.service - Nightly notes backup\n')
t('systemctl status backup.service | grep -c Warning', '0\n')

// A missing EnvironmentFile fails with result resources; once it exists the environment reaches the script.
t('sudo systemctl start report.service', /Job for report\.service failed/, 1)
t('journalctl -xeu report.service -n 4', /Failed to load environment files: No such file or directory[\s\S]*Failed with result 'resources'\.\n░░ Subject: Unit failed[\s\S]*Failed to start report\.service - Daily report\.\n░░ Subject: A start job for unit report\.service has failed/)
t('systemctl status report.service | head -3', /× report\.service - Daily report\n.*\n     Active: failed \(Result: resources\)/)
t('systemctl is-failed report.service', 'failed\n', 0)
t('systemctl list-units --failed', /● report\.service +loaded +failed +failed +Daily report/)
t('echo "REPORT_DIR=/home/learner/reports" | sudo tee /etc/report.env > /dev/null && sudo systemctl start report.service && cat ~/reports/latest.txt', 'report\n', 0)
t('journalctl -u report.service -n 2 -o cat', 'report.service: Deactivated successfully.\nFinished report.service - Daily report.\n')
t('journalctl -u report.service -r -n 1', /Finished report\.service/)
t('journalctl -u report.service -p err', /Failed to start report\.service - Daily report\.\n$/)
t('journalctl -u report.service -p err | grep -c wrote', '0\n')
t('journalctl -u report.service -g "wrote"', /bash\[\d+\]: wrote \/home\/learner\/reports\/latest\.txt\n$/)
t('journalctl --since today -u report.service | head -1', /Starting report\.service/)
t('journalctl --since "2026-09-18 00:00" -u report.service', '-- No entries --\n')
t('journalctl --since yesterday -b -u report.service --no-pager | head -1', /Starting report\.service/)
t('journalctl --since noonish', /Failed to parse timestamp: noonish/, 1)
t('journalctl -f', /follows the journal live/, 1)
t('journalctl -k | head -1', /kernel\[0\]: Linux version/)
t('journalctl | head -1', /Sep 14 07:26:11 stackbox kernel\[0\]: Linux version/)
t('sudo systemctl reset-failed report.service; systemctl is-failed report.service', 'inactive\n', 1)

// A service that keeps failing hits the start limit.
t('sudo systemctl start flaky.service; systemctl status flaky.service', /× flaky\.service - Always fails\n[\s\S]*Active: failed \(Result: exit-code\)[\s\S]*Start request repeated too quickly\.[\s\S]*Failed with result 'exit-code'\./, 3)
check('restart counter', sim().units['flaky.service']?.restarts === 2)
t('systemctl show -p NRestarts --value flaky.service', '2\n')

// Bad unit files: systemd-analyze verify and bad-setting on start.
t('systemd-analyze verify /etc/systemd/system/backup.service', '', 0)
t('systemd-analyze verify /etc/systemd/system/bad.service', "/etc/systemd/system/bad.service:1: Unknown section 'Unt'. Ignoring.\n/etc/systemd/system/bad.service:6: Unknown key name 'Restrat' in section 'Service', ignoring.\nbad.service: Neither a valid executable name nor an absolute path: bin/x.sh\n", 1)
t('systemd-analyze verify noexec.service', 'noexec.service: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.\n', 1)
t('sudo systemctl start noexec.service', /Failed to start noexec\.service: Unit noexec\.service has a bad unit file setting\./, 1)
t('systemctl status noexec.service', /Loaded: bad-setting \(Reason: Unit noexec\.service has a bad unit file setting\.\)[\s\S]*Service has no ExecStart=/, 3)
t('printf "[Unit]\\nDescription=Ghost\\n\\n[Service]\\nExecStart=/home/learner/bin/ghost.sh\\nWantedBy=multi-user.target\\n" > /tmp/ghost.service && systemd-analyze verify /tmp/ghost.service', /^\/tmp\/ghost\.service:6: Unknown key name 'WantedBy' in section 'Service', ignoring\. \(WantedBy= belongs in the \[Install\] section\.\)\nghost\.service: Command \/home\/learner\/bin\/ghost\.sh is not executable: No such file or directory\n$/, 1)
t('printf "[Unit]\\nDescription=Nobody\\n\\n[Service]\\nExecStart=/usr/bin/true\\nUser=nobody2\\n" > /tmp/nouser.service && systemd-analyze verify /tmp/nouser.service', /^nouser\.service: User nobody2 does not exist/, 1)
t('sudo cp /tmp/nouser.service /etc/systemd/system/ && sudo systemctl start nouser.service; journalctl -u nouser.service -n 3 -o cat', /Failed at step USER spawning \/usr\/bin\/true: No such process\n.*status=217\/USER\n/)
t('sudo cp /tmp/ghost.service /etc/systemd/system/ && sudo systemctl start ghost.service; journalctl -u ghost.service -n 4', /Unable to locate executable '\/home\/learner\/bin\/ghost\.sh': No such file or directory\n.*Failed at step EXEC spawning \/home\/learner\/bin\/ghost\.sh: No such file or directory\n.*Main process exited, code=exited, status=203\/EXEC\n.*Failed with result 'exit-code'/)

// User scope: no sudo needed, units in ~/.config/systemd/user.
t('systemctl --user status hello.service', 'Unit hello.service could not be found.\n', 4)
t('mkdir -p ~/.config/systemd/user && printf "[Unit]\\nDescription=Hello from my user\\n\\n[Service]\\nExecStart=/usr/bin/echo hi there\\nEnvironment=GREETING=hello\\n\\n[Install]\\nWantedBy=default.target\\n" > ~/.config/systemd/user/hello.service && systemctl --user daemon-reload && systemctl --user start hello.service && systemctl --user status hello', /● hello\.service - Hello from my user\n     Loaded: loaded \(\/home\/learner\/\.config\/systemd\/user\/hello\.service; disabled[\s\S]*systemd\[1190\]: Started hello\.service[\s\S]*echo\[\d+\]: hi there\n$/, 0)
t('systemctl --user enable hello.service', 'Created symlink /home/learner/.config/systemd/user/default.target.wants/hello.service → /home/learner/.config/systemd/user/hello.service.\n')
t('journalctl --user -u hello -o cat', 'Started hello.service - Hello from my user.\nhi there\n')
t('journalctl -u hello', '-- No entries --\n')
t('systemctl --user show -p Environment hello', 'Environment=GREETING=hello\n')
check('user scope state', sim().user.units['hello.service']?.active === 'active' && sim().user.enabled.includes('hello.service'))

// Misc verbs.
t('systemctl list-dependencies backup.service', /^backup\.service\n. ├─system\.slice\n. └─sysinit\.target\n$/)
t('systemctl edit backup.service', /systemctl edit opens an editor/, 1)
t('systemctl status | head -2', /● stackbox\n    State: (running|degraded)/)
t('systemctl bogus backup.service', /Unknown command verb bogus\./, 1)

console.log(fails ? `${fails} FAILURES` : 'ALL SYSTEMD SMOKE TESTS PASSED')
process.exit(fails ? 1 : 0)
