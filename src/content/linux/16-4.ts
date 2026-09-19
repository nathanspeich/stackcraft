import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

/** deploy and alice already exist; nginx is installed but stopped. */
const OPS_SEED: Record<string, string> = {
  ...HOME_SEED,
  '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nsshd:x:105:65534::/run/sshd:/usr/sbin/nologin\nlearner:x:1000:1000:Learner:/home/learner:/bin/bash\ndeploy:x:1001:1001:Deploy bot:/home/deploy:/bin/bash\nalice:x:1002:1002:Alice Moreau:/home/alice:/bin/bash\n',
  '/etc/group': 'root:x:0:\nsudo:x:27:learner\nlearner:x:1000:\ndeploy:x:1001:\nalice:x:1002:\nteam:x:1003:deploy,alice\n',
  '/etc/shadow': 'root:$6$rounds=5000$saltsalt$hashhashhashhash:19600:0:99999:7:::\nlearner:$6$rounds=5000$saltsalt$hashhashhashhash:19600:0:99999:7:::\ndeploy:$6$rounds=5000$saltsalt$hashhashhashhash:20700:0:99999:7:::\nalice:$6$rounds=5000$saltsalt$hashhashhashhash:20700:0:99999:7:::\n',
  '/home/deploy/': '',
  '/home/alice/': '',
}

const RULE = 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart *'

const lesson: Lesson = {
  id: 'w16d4',
  tier: 2,
  track: 'linux',
  week: 16,
  day: 4,
  title: 'sudoers, least privilege, ACLs',
  concept: `sudo decides what it allows by reading /etc/sudoers and every file in /etc/sudoers.d. A rule reads: who, on which hosts, as whom, which commands. deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart * lets deploy restart services and nothing else. That is least privilege: give an account exactly the power its job needs.

A typo in sudoers can lock everyone out, so never edit it with a plain editor. Drop a file into /etc/sudoers.d, make it mode 440, and run sudo visudo -c to check the syntax. sudo -l -U deploy shows what a user may run.

When group bits are too coarse, an ACL adds permissions for one extra user or group: setfacl -m u:alice:r file. getfacl shows the entries, and ls -l marks the file with a plus sign.`,
  example: {
    language: 'bash',
    caption: 'A narrow sudo rule, checked before it is trusted',
    code: `echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart *' \\
  | sudo tee /etc/sudoers.d/deploy
sudo chmod 440 /etc/sudoers.d/deploy
sudo visudo -c        # every file must say parsed OK
sudo -l -U deploy     # (root) NOPASSWD: /usr/bin/systemctl restart *

setfacl -m u:alice:r runbook.txt
getfacl runbook.txt   # user:alice:r--`,
  },
  task: {
    kind: 'shell',
    instructions: `The deploy account exists but has no sudo rights. nginx is installed and stopped.
1. Write the rule  ${RULE}  into /etc/sudoers.d/deploy (echo it into sudo tee), then set the file to mode 440.
2. Check the syntax with sudo visudo -c.
3. Show what deploy may run with sudo -l -U deploy.
4. Prove the rule works and stops there: sudo -u deploy sudo systemctl restart nginx should succeed, sudo -u deploy sudo systemctl stop nginx should be refused.
5. Create runbook.txt in your home with the line "restart nginx after deploy", make it 600, then let alice read it with an ACL and check with getfacl.
6. Confirm alice can read it: sudo -u alice cat /home/learner/runbook.txt.`,
    seed: OPS_SEED,
    machine: { services: { nginx: 'inactive' } },
    hints: [`Step 1: echo '${RULE}' | sudo tee /etc/sudoers.d/deploy, then sudo chmod 440 /etc/sudoers.d/deploy.`, 'visudo -c needs root: sudo visudo -c. If it reports a syntax error, rewrite the file with the exact rule text.', 'sudo -u deploy sudo systemctl stop nginx is meant to fail with "not allowed to execute". That refusal is the point of the rule.', 'setfacl -m u:alice:r runbook.txt adds a read entry for alice. getfacl runbook.txt shows it as user:alice:r--.'],
    solution: { commands: [`echo '${RULE}' | sudo tee /etc/sudoers.d/deploy`, 'sudo chmod 440 /etc/sudoers.d/deploy', 'sudo visudo -c', 'sudo -l -U deploy', 'sudo -u deploy sudo systemctl restart nginx', 'sudo -u deploy sudo systemctl stop nginx', 'echo "restart nginx after deploy" > runbook.txt', 'chmod 600 runbook.txt', 'setfacl -m u:alice:r runbook.txt', 'getfacl runbook.txt', 'sudo -u alice cat /home/learner/runbook.txt'] },
    check: (r) => {
      const users = r.state?.sims?.users as { perms?: Record<string, { mode: number; owner: string; group: string }>; acls?: Record<string, string[]> } | undefined
      const perms = users?.perms ?? {}
      const acls = users?.acls ?? {}
      const ruleFile = r.fs?.['/etc/sudoers.d/deploy'] ?? ''
      const runbook = '/home/learner/runbook.txt'
      return steps([
        [ruleFile !== '', 'Step 1: create /etc/sudoers.d/deploy. Pipe the rule into sudo tee /etc/sudoers.d/deploy.'],
        [/^deploy\s+ALL\s*=\s*\(root\)\s*NOPASSWD:\s*\/usr\/bin\/systemctl restart \*\s*$/m.test(ruleFile), `Step 1: the file should contain exactly:  ${RULE}`],
        [(perms['/etc/sudoers.d/deploy']?.mode ?? 0) === 0o440, 'Step 1: set the file to mode 440 with sudo chmod 440 /etc/sudoers.d/deploy.'],
        [ranWith(r, /sudo\s+visudo\s+-c/, /^\/etc\/sudoers\.d\/deploy: parsed OK\n(?!.*bad permissions)/m), 'Step 2: run sudo visudo -c after fixing the mode. Every file should say parsed OK with no warnings.'],
        [ranWith(r, /sudo\s+-l\s+-U\s+deploy/, /\(root\) NOPASSWD: \/usr\/bin\/systemctl restart \*/), 'Step 3: run sudo -l -U deploy. It should list the systemctl restart rule.'],
        [r.state?.services.nginx === 'active' && ranWith(r, /sudo\s+-u\s+deploy\s+sudo\s+systemctl\s+restart\s+nginx/, /^$/), 'Step 4: run sudo -u deploy sudo systemctl restart nginx. It should succeed silently and nginx should be active.'],
        [ranWith(r, /sudo\s+-u\s+deploy\s+sudo\s+systemctl\s+stop\s+nginx/, /not allowed to execute/), 'Step 4: now run sudo -u deploy sudo systemctl stop nginx. sudo should refuse it.'],
        [/restart nginx after deploy/.test(r.fs?.[runbook] ?? ''), 'Step 5: create runbook.txt in your home containing the line: restart nginx after deploy'],
        [((perms[runbook]?.mode ?? 0) & 0o707) === 0o600, 'Step 5: make the runbook private first with chmod 600 runbook.txt.'],
        [(acls[runbook] ?? []).includes('user:alice:r--'), 'Step 5: give alice read access with setfacl -m u:alice:r runbook.txt.'],
        [ranWith(r, /getfacl\s+.*runbook\.txt/, /user:alice:r--/), 'Step 5: run getfacl runbook.txt to see the new entry.'],
        [ranWith(r, /sudo\s+-u\s+alice\s+cat\s+.*runbook\.txt/, /restart nginx after deploy/), 'Step 6: confirm with sudo -u alice cat /home/learner/runbook.txt.'],
      ], 'A rule that grants one command, checked with visudo, and an ACL that opens one file to one person. That is least privilege in practice.')
    },
  },
  quiz: [
    { question: 'Why use visudo -c instead of just editing /etc/sudoers?', options: ['It is faster', 'It checks the syntax, and a broken sudoers can lock you out of sudo entirely', 'It adds the NOPASSWD tag for you'], answer: 1, explanation: 'One bad line and sudo refuses to run at all. visudo -c catches that before it bites.' },
    { question: 'What does the rule  deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart *  allow?', options: ['Any systemctl command as root', 'Only systemctl restart of any unit, as root, without a password', 'Everything, because of ALL'], answer: 1, explanation: 'ALL here is the host list. The command list is only systemctl restart with any argument.' },
    { question: 'How can you tell a file has an ACL from ls -l?', options: ['A plus sign after the mode', 'The mode shows an a', 'The group column is empty'], answer: 0, explanation: 'ls -l prints a + after the ten mode characters when extended ACL entries exist. getfacl shows them.' },
  ],
}

export default lesson
