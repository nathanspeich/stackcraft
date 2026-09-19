import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ran, ranWith, steps } from '../checks'
import type { NetState } from '../../shell/sim/net'

const AUTH_LOG = [
  'Sep 18 09:12:01 stackbox sshd[3011]: Failed password for root from 203.0.113.9 port 51022 ssh2',
  'Sep 18 09:12:04 stackbox sshd[3011]: Failed password for root from 203.0.113.9 port 51022 ssh2',
  'Sep 18 09:12:07 stackbox sshd[3013]: Invalid user admin from 203.0.113.9 port 51030',
  'Sep 18 09:12:09 stackbox sshd[3013]: Failed password for invalid user admin from 203.0.113.9 port 51030 ssh2',
  'Sep 18 09:12:12 stackbox sshd[3015]: Failed password for invalid user oracle from 203.0.113.9 port 51041 ssh2',
  'Sep 18 09:12:15 stackbox sshd[3017]: Failed password for invalid user test from 203.0.113.9 port 51050 ssh2',
  'Sep 18 09:12:18 stackbox sshd[3019]: Failed password for invalid user ubuntu from 203.0.113.9 port 51058 ssh2',
  'Sep 18 09:13:44 stackbox sshd[3020]: Accepted publickey for learner from 192.168.64.1 port 53410 ssh2: ED25519 SHA256:kq4c1zP7Vb8Ln2xR',
  'Sep 18 09:13:44 stackbox sshd[3020]: pam_unix(sshd:session): session opened for user learner(uid=1000) by (uid=0)',
].join('\n') + '\n'

const lesson: Lesson = {
  id: 'w22d4',
  tier: 2,
  track: 'linux',
  week: 22,
  day: 4,
  title: 'SSH server settings and fail2ban',
  concept: `The SSH server reads /etc/ssh/sshd_config plus every file under /etc/ssh/sshd_config.d/. The first value sshd sees wins, and the Include line sits at the top, so a drop-in beats the main file. On a Multipass VM the drop-in 50-cloud-init.conf already sets PasswordAuthentication no.

Put your changes in a new drop-in, check with sudo sshd -t (silent means fine), read the effective values with sudo sshd -T, then sudo systemctl restart ssh. Sensible hardening: PermitRootLogin no, MaxAuthTries 3, keys instead of passwords.

Key login works when your public key line is in the target user's ~/.ssh/authorized_keys. ssh-copy-id puts it there, but needs a password login to do so.

fail2ban watches /var/log/auth.log and bans addresses that keep failing. sudo fail2ban-client status sshd shows who is banned.`,
  example: {
    language: 'bash',
    caption: 'Harden sshd with a drop-in, then confirm',
    code: `sudo tee /etc/ssh/sshd_config.d/60-hardening.conf <<'EOF'
PermitRootLogin no
MaxAuthTries 3
EOF
sudo sshd -t && sudo sshd -T | grep -E 'permitrootlogin|maxauthtries'
permitrootlogin no
maxauthtries 3
sudo systemctl restart ssh`,
  },
  task: {
    kind: 'shell',
    instructions: 'The editor holds 60-hardening.conf, a drop-in you will install for sshd.\n1. See what sshd is doing now: sudo sshd -T | grep -E \'passwordauthentication|permitrootlogin\'.\n2. In the editor, set PermitRootLogin no and MaxAuthTries 3.\n3. Install it: sudo cp 60-hardening.conf /etc/ssh/sshd_config.d/ and check the config with sudo sshd -t.\n4. Confirm with sudo sshd -T | grep permitrootlogin, then sudo systemctl restart ssh.\n5. Make a key with ssh-keygen -t ed25519, install it for yourself with cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys, and log in with ssh localhost.\n6. Someone has been guessing passwords. Count the failures with sudo grep -c "Failed password" /var/log/auth.log.\n7. Install the guard with sudo apt install fail2ban, then run sudo fail2ban-client status sshd and find the banned address.',
    seed: { ...HOME_SEED, '/var/log/auth.log': AUTH_LOG },
    file: '/home/learner/60-hardening.conf',
    starter: '# Extra sshd settings for stackbox.\n# Installed into /etc/ssh/sshd_config.d/ so upgrades never overwrite it.\n\n',
    hints: ['sshd -T prints every effective setting in lower case, which is why the grep patterns are lower case too. It needs sudo to read the host keys.', 'Two lines in the editor: PermitRootLogin no and MaxAuthTries 3. Then sudo cp 60-hardening.conf /etc/ssh/sshd_config.d/ and sudo sshd -t (no output means no errors).', 'ssh-keygen -t ed25519 makes ~/.ssh/id_ed25519 and .pub. Appending the .pub line to ~/.ssh/authorized_keys is exactly what ssh-copy-id would do; it cannot do it here because password logins are off.', 'sudo grep -c "Failed password" /var/log/auth.log, then sudo apt install fail2ban and sudo fail2ban-client status sshd.'],
    solution: { file: '# Extra sshd settings for stackbox.\nPermitRootLogin no\nMaxAuthTries 3\n', commands: ["sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'", 'sudo cp 60-hardening.conf /etc/ssh/sshd_config.d/', 'sudo sshd -t', 'sudo sshd -T | grep permitrootlogin', 'sudo systemctl restart ssh', 'ssh-keygen -t ed25519', 'cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys', 'ssh localhost', 'sudo grep -c "Failed password" /var/log/auth.log', 'sudo apt install fail2ban', 'sudo fail2ban-client status sshd'] },
    check: (r) => {
      const src = fileContent(r, '/home/learner/60-hardening.conf') ?? ''
      const installed = fileContent(r, '/etc/ssh/sshd_config.d/60-hardening.conf') ?? ''
      const net = r.state?.sims?.net as Partial<NetState> | undefined
      const h = r.history ?? []
      const cpIdx = h.findIndex((c) => /^\s*sudo\s+(cp|tee|mv)\b.*60-hardening\.conf/.test(c))
      const testAfter = h.slice(cpIdx + 1).some((c, i) => /^\s*sudo\s+sshd\s+-t\b/.test(c) && (r.outputs?.[cpIdx + 1 + i] ?? 'x') === '')
      return steps([
        [ranWith(r, /^\s*sudo\s+sshd\s+-T/, /passwordauthentication no/), "Step 1: run sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin' and notice password logins are already off."],
        [/^\s*PermitRootLogin\s+no\s*$/im.test(src), 'Step 2: add the line PermitRootLogin no to the editor.'],
        [/^\s*MaxAuthTries\s+3\s*$/im.test(src), 'Step 2: add the line MaxAuthTries 3 to the editor.'],
        [/^\s*PermitRootLogin\s+no\s*$/im.test(installed) && /^\s*MaxAuthTries\s+3\s*$/im.test(installed), 'Step 3: copy the file into place: sudo cp 60-hardening.conf /etc/ssh/sshd_config.d/'],
        [cpIdx >= 0 && testAfter, 'Step 3: after copying, run sudo sshd -t. No output means the config is valid.'],
        [ranWith(r, /^\s*sudo\s+sshd\s+-T.*permitrootlogin/, /permitrootlogin no/), 'Step 4: confirm with sudo sshd -T | grep permitrootlogin. It should print permitrootlogin no.'],
        [ran(r, /^\s*sudo\s+systemctl\s+(restart|reload)\s+ssh(d)?(\.service)?\b/), 'Step 4: apply it with sudo systemctl restart ssh.'],
        [Boolean(r.fs && '/home/learner/.ssh/id_ed25519.pub' in r.fs), 'Step 5: create a key with ssh-keygen -t ed25519 (press Enter for the defaults).'],
        [(fileContent(r, '/home/learner/.ssh/authorized_keys') ?? '').includes((fileContent(r, '/home/learner/.ssh/id_ed25519.pub') ?? 'none').trim()), 'Step 5: install the public key: cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys'],
        [Boolean(net?.sshLogins?.includes('learner@localhost')), 'Step 5: log in with your key: ssh localhost'],
        [ranWith(r, /^\s*sudo\s+grep\s+-c\s+.Failed password.\s+\/var\/log\/auth\.log/, /^6\n/), 'Step 6: sudo grep -c "Failed password" /var/log/auth.log should count 6 failures.'],
        [Boolean(r.state?.packages.includes('fail2ban')), 'Step 7: sudo apt install fail2ban'],
        [ranWith(r, /^\s*sudo\s+fail2ban-client\s+status\s+sshd/, /Banned IP list:\s+203\.0\.113\.9/), 'Step 7: sudo fail2ban-client status sshd should list 203.0.113.9 as banned.'],
      ], 'Root login off, key login on, and a guard that bans password guessers. Your SSH door is in good shape.')
    },
  },
  quiz: [
    { question: 'You set PasswordAuthentication yes in /etc/ssh/sshd_config on the VM, but sshd -T still says no. Why?', options: ['sshd needs a reboot', 'A drop-in under sshd_config.d says no, and the first value sshd reads wins', 'sshd -T shows the defaults, not your config'], answer: 1, explanation: 'Include is at the top of sshd_config, so 50-cloud-init.conf is read first and its value sticks.' },
    { question: 'What does sudo sshd -t do?', options: ['Tests the config and prints nothing when it is valid', 'Starts sshd in test mode on port 2222', 'Shows the current connections'], answer: 0, explanation: 'Always run it before restarting ssh. A typo that stops sshd from starting could lock you out of a remote box.' },
    { question: 'What does fail2ban do when an address fails too many logins?', options: ['Deletes the user account', 'Adds a temporary firewall rule that blocks the address', 'Emails the attacker'], answer: 1, explanation: 'It watches the log, and after maxretry failures within findtime it bans the address for bantime.' },
  ],
}

export default lesson
