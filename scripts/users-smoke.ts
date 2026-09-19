// Smoke test for the users and permissions simulation (src/shell/sim/users.ts).
import { Shell } from '../src/shell/shell'
import type { UsersState } from '../src/shell/sim/users'

const sh = new Shell()
let fails = 0
const t = (cmd: string, expect: string | RegExp, code?: number) => {
  let out: string
  let rc = -1
  try { const r = sh.run(cmd); out = r.output; rc = r.code } catch (e) { out = 'THROW ' + (e as Error).message }
  const pass = (typeof expect === 'string' ? out === expect : expect.test(out)) && (code === undefined || rc === code)
  if (!pass) { fails++; console.log(`FAIL ${JSON.stringify(cmd)}\n  got: ${JSON.stringify(out)} [${rc}]\n  want: ${expect}${code === undefined ? '' : ` [${code}]`}`) }
}
const users = () => sh.state.sims.users as UsersState

// users and groups
t('useradd bob', /Permission denied/, 1)
t('sudo groupadd team', '', 0)
t('sudo groupadd team', /already exists/, 9)
t('sudo useradd -m -s /bin/bash -G team -c "Deploy bot" deploy', '', 0)
t('id deploy', 'uid=1001(deploy) gid=1002(deploy) groups=1002(deploy),1001(team)\n')
t('id', 'uid=1000(learner) gid=1000(learner) groups=1000(learner),27(sudo)\n')
t('id -un', 'learner\n')
t('id -Gn deploy', 'deploy team\n')
t('groups', 'learner sudo\n')
t('groups deploy', 'deploy : deploy team\n')
t('getent passwd deploy', 'deploy:x:1001:1002:Deploy bot:/home/deploy:/bin/bash\n')
t('getent group team', 'team:x:1001:deploy\n')
t('getent passwd nobody; echo $?', '2\n')
t('grep deploy /etc/passwd', /^deploy:x:1001:1002/)
t('ls -ld /home/deploy', /^drwxr-x--- \d+ deploy\s+deploy/)
t('sudo useradd -m alice', '', 0)
t('sudo usermod -aG team alice', '', 0)
t('getent group team', 'team:x:1001:deploy,alice\n')
t('sudo usermod -G sudo alice; getent group team', 'team:x:1001:deploy\n')
t('sudo usermod -a alice', /-a flag is only allowed with the -G flag/, 3)
t('sudo usermod -s /bin/bash -c "Alice A" alice; getent passwd alice', 'alice:x:1002:1003:Alice A:/home/alice:/bin/bash\n')
t('sudo gpasswd -a alice team', 'Adding user alice to group team\n')
t('sudo gpasswd -d alice team', 'Removing user alice from group team\n')
t('sudo usermod -L alice; sudo passwd -S alice', /^alice L /)
t('sudo usermod -U alice', /passwordless account/, 3)
t('sudo passwd alice > /dev/null; sudo usermod -L alice; sudo passwd -S alice', /^alice L /)
t('sudo usermod -U alice; sudo passwd -S alice', /^alice P /)
t('sudo groupdel deploy', /cannot remove the primary group of user 'deploy'/, 8)
t('sudo userdel -r alice; getent passwd alice; echo $?', '2\n')
t('ls /home', 'deploy  learner\n')
t('sudo -u deploy whoami', 'deploy\n')
t('sudo -u nobody whoami', /unknown user nobody/, 1)
if (!users().users.deploy || users().groups.team?.members[0] !== 'deploy') { fails++; console.log('FAIL state.users/groups view', users().users, users().groups) }

// shared directory with setgid
t('sudo mkdir /srv/team && sudo chgrp team /srv/team && sudo chmod 2775 /srv/team; ls -ld /srv/team', /^drwxrwsr-x \d+ root\s+team/)
t('sudo -u deploy touch /srv/team/notes.txt; ls -l /srv/team/notes.txt', /^-rw-r--r-- 1 deploy\s+team/)
t('touch /srv/team/mine.txt', /Permission denied/, 1)
t('sudo gpasswd -a learner team >/dev/null; touch /srv/team/mine.txt; ls -l /srv/team/mine.txt', /^-rw-r--r-- 1 learner team/)
t('mkdir /srv/team/sub; ls -ld /srv/team/sub', /^drwxr-sr-x \d+ learner team/)
t('sudo -u deploy sh -c "echo hi > /srv/team/notes.txt"; cat /srv/team/notes.txt', 'hi\n')
t('sudo chmod g-s /srv/team; ls -ld /srv/team', /^drwxrwxr-x/)
t('sudo chmod g+s,o+t /srv/team; ls -ld /srv/team', /^drwxrwsr-t/)
t('sudo chmod 0755 /srv/team; ls -ld /srv/team', /^drwxr-sr-x/)
t('sudo chmod 00755 /srv/team; ls -ld /srv/team', /^drwxr-xr-x/)
t('sudo chmod 1777 /tmp; ls -ld /tmp', /^drwxrwxrwt/)
t('sudo chmod 4755 /usr/bin/passwd; ls -l /usr/bin/passwd', /^-rwsr-xr-x/)
t('sudo chmod u-s /usr/bin/passwd; ls -l /usr/bin/passwd', /^-rwxr-xr-x/)
t('chmod 2770 /srv/team', /Operation not permitted/, 1)
t('stat -c "%a %U:%G" /srv/team', '755 root:team\n')
t('sudo chmod 2770 /srv/team && sudo chown deploy:team /srv/team && ls -ld /srv/team', /^drwxrws--- \d+ deploy\s+team/)
t('sudo chown nosuch /srv/team', /invalid user/, 1)
t('sudo chgrp nosuch /srv/team', /invalid group/, 1)
t('chgrp team /srv/team', /Operation not permitted/, 1)
t('cd /srv/team && pwd', '/srv/team\n')
t('sudo chmod 2750 /srv/team; sudo gpasswd -d learner team > /dev/null; cd /srv/team', /Permission denied/, 1)
if ((sh.state.sims.users as UsersState).groups.team.members.includes('learner')) { fails++; console.log('FAIL learner still in team') }
t('sudo gpasswd -a learner team > /dev/null; ls /srv/team', 'mine.txt  notes.txt  sub\n')

// sticky bit
t('sudo chown root:team /srv/team; sudo chmod 3775 /srv/team; sudo -u deploy rm /srv/team/mine.txt', /rm: cannot remove '\/srv\/team\/mine.txt': Operation not permitted/, 1)
t('sudo -u deploy mv /srv/team/mine.txt /srv/team/moved.txt', /Operation not permitted/, 1)
t('rm /srv/team/mine.txt; ls /srv/team', 'notes.txt  sub\n')
t('sudo chmod 2770 /srv/team; sudo chown deploy:team /srv/team; ls -l /usr/bin/sudo', /^-rwsr-xr-x 1 root/)
if (users().perms['/srv/team']?.mode !== 0o2770 || users().perms['/srv/team'].group !== 'team') { fails++; console.log('FAIL perms view', users().perms['/srv/team']) }

// umask
t('umask', '0022\n')
t('umask -S', 'u=rwx,g=rx,o=rx\n')
t('umask 077; umask', '0077\n')
t('touch ~/secret.txt; ls -l ~/secret.txt', /^-rw------- 1 learner learner/)
t('mkdir ~/vault; ls -ld ~/vault', /^drwx------ \d+ learner learner/)
t('umask 002; echo x > ~/shared.txt; ls -l ~/shared.txt', /^-rw-rw-r--/)
t('umask u=rwx,g=rx,o=; umask', '0027\n')
t('umask 022', '')
if (users().umask !== 0o022) { fails++; console.log('FAIL umask state', users().umask) }

// sudoers
t('cat /etc/sudoers', /Permission denied/, 1)
t('sudo cat /etc/sudoers | grep -c ALL', /[1-9]/)
t('sudo -l', /User learner may run the following commands on stackbox:\n    \(ALL : ALL\) ALL\n$/)
t('sudo -l -U deploy', /User deploy is not allowed to run sudo on stackbox/, 1)
t('sudo -u deploy sudo whoami', /deploy is not in the sudoers file/, 1)
t("echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart *' | sudo tee /etc/sudoers.d/deploy > /dev/null; sudo visudo -c", /deploy: parsed OK\n.*bad permissions, should be mode 0440/, 1)
t('sudo chmod 440 /etc/sudoers.d/deploy; sudo visudo -c', /^\/etc\/sudoers: parsed OK\n\/etc\/sudoers.d\/deploy: parsed OK\n\/etc\/sudoers.d\/README: parsed OK\n$/, 0)
t('sudo -l -U deploy', /User deploy may run the following commands on stackbox:\n    \(root\) NOPASSWD: \/usr\/bin\/systemctl restart \*\n$/)
t('sudo -u deploy sudo systemctl restart nginx; systemctl is-active nginx', 'active\n')
t('sudo -u deploy sudo systemctl stop nginx', /Sorry, user deploy is not allowed to execute '\/usr\/bin\/systemctl stop nginx' as root on stackbox/, 1)
t('sudo -u deploy sudo -l', /\(root\) NOPASSWD: \/usr\/bin\/systemctl restart \*/)
t("echo 'deploy ALL=NOPASSWD /usr/bin/systemctl' | sudo tee /etc/sudoers.d/broken > /dev/null; sudo chmod 440 /etc/sudoers.d/broken; sudo visudo -c", /syntax error near line 1/, 1)
t('sudo visudo -cf /etc/sudoers.d/broken', /parse error in \/etc\/sudoers.d\/broken near line 1/, 1)
t('sudo rm /etc/sudoers.d/broken; visudo -c', /Permission denied/, 1)
t('sudo visudo', /no interactive editor/, 1)
t('sudo -u deploy sudo -u learner whoami', /not allowed to execute/, 1)

// ACLs
t('cd ~; umask 077; echo report > report.txt; ls -l report.txt', /^-rw------- 1 learner learner/)
t('sudo -u deploy cat /home/learner/report.txt', /Permission denied/, 1)
t('setfacl -m u:deploy:r report.txt; ls -l report.txt', /^-rw-r-----\+ 1 learner learner/)
t('getfacl report.txt', '# file: report.txt\n# owner: learner\n# group: learner\nuser::rw-\nuser:deploy:r--\ngroup::---\nmask::r--\nother::---\n\n')
t('chmod o+x ~; sudo -u deploy cat /home/learner/report.txt', 'report\n')
t('sudo -u deploy sh -c "echo more >> /home/learner/report.txt"', /Permission denied/, 1)
t('setfacl -m u:deploy:rw,g:team:rx report.txt; getfacl report.txt | grep -c "^[ugmo]"', '6\n')
t('getfacl /home/learner/report.txt', /^getfacl: Removing leading '\/' from absolute path names\n# file: home\/learner\/report.txt\n/)
t('sudo -u deploy sh -c "echo more >> /home/learner/report.txt"; cat ~/report.txt', 'report\nmore\n')
t('setfacl -m u:nosuch:r ~/report.txt', /Invalid argument/, 2)
t('setfacl -x u:deploy report.txt; getfacl report.txt | grep deploy; echo $?', '1\n')
t('setfacl -b report.txt; ls -l report.txt', /^-rw------- 1 learner learner/)
t('sudo -u deploy setfacl -m u:deploy:r /home/learner/report.txt', /Operation not permitted/, 1)
t('sudo setfacl -R -m g:team:rwx /srv/team; ls -ld /srv/team /srv/team/sub', /^drwxrws---\+.*\n.*drwxrwsr-x\+/)
if (!users().acls['/srv/team']?.includes('group:team:rwx')) { fails++; console.log('FAIL acl state', users().acls) }
t('sudo setfacl -b /srv/team', '')
if (users().acls['/srv/team']) { fails++; console.log('FAIL acl state not cleared', users().acls) }
t('sudo -u deploy setfacl -m u:learner:rwx /srv/team/notes.txt; sudo -u deploy sh -c "umask 077; touch /srv/team/locked.txt"; ls -l /srv/team/locked.txt', /^-rw------- 1 deploy\s+team/)
if (users().umask !== 0o077) { fails++; console.log('FAIL umask should be 077 after the sub-shell (one shared umask)', users().umask) }

// a lesson seed: /etc files placed by the task, home directories adopted
const sh2 = new Shell()
sh2.seed({
  '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nlearner:x:1000:1000:Learner:/home/learner:/bin/bash\nalice:x:1001:1001:Alice:/home/alice:/bin/bash\n',
  '/etc/group': 'root:x:0:\nsudo:x:27:learner\nlearner:x:1000:\nalice:x:1001:\nteam:x:1002:alice,learner\n',
  '/home/alice/': '',
})
const r2 = sh2.run('ls -ld /home/alice; id alice; sudo -u alice touch /home/alice/hi; ls -l /home/alice; sudo ls -l /home/alice')
if (!/^drwxr-x--- \d+ alice\s+alice.*\nuid=1001\(alice\) gid=1001\(alice\) groups=1001\(alice\),1002\(team\)\nls: cannot open directory '\/home\/alice': Permission denied\n[\s\S]*-rw-r--r-- 1 alice\s+alice\s+0 .* hi\n$/.test(r2.output)) { fails++; console.log('FAIL seeded users', JSON.stringify(r2.output)) }
const snap = sh2.snapshotForChecker()
const st2 = snap.state.sims.users as UsersState
if (st2.groups.team?.members.join() !== 'alice,learner' || !st2.users.alice) { fails++; console.log('FAIL snapshot users view', st2) }
if (snap.state.fileModes['/home/alice'] !== 0o750) { fails++; console.log('FAIL fileModes', snap.state.fileModes['/home/alice']) }
sh2.run('sudo mkdir -p /srv/shared && sudo chgrp team /srv/shared && sudo chmod 2770 /srv/shared')
if (sh2.vfs.get('/srv/shared')?.mode !== 0o2770) { fails++; console.log('FAIL 2770 mode', sh2.vfs.get('/srv/shared')?.mode.toString(8)) }
if (sh2.run('sudo -u alice sh -c "echo a > /srv/shared/a.txt"; ls -l /srv/shared/a.txt').output.indexOf(' alice   team ') < 0) { fails++; console.log('FAIL setgid inheritance on seeded shell') }

// the plain shell still behaves
const sh3 = new Shell()
for (const [cmd, want] of [['touch a; ls -l a', /^-rw-r--r-- 1 learner learner/], ['mkdir d; ls -ld d', /^drwxr-xr-x \d+ learner learner/], ['cat /etc/shadow', /Permission denied/], ['ls -l /etc/sudoers', /^-r--r----- 1 root\s+root/]] as [string, RegExp][]) {
  const out = sh3.run(cmd).output
  if (!want.test(out)) { fails++; console.log(`FAIL fresh ${JSON.stringify(cmd)}\n  got: ${JSON.stringify(out)}`) }
}

console.log(fails ? `${fails} FAILURES` : 'ALL USERS SMOKE TESTS PASSED')
process.exit(fails ? 1 : 0)
