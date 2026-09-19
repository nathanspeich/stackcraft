import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'
import type { NetState } from '../../shell/sim/net'

const lesson: Lesson = {
  id: 'w22d3',
  tier: 2,
  track: 'linux',
  week: 22,
  day: 3,
  title: 'Firewalls with ufw and nftables',
  concept: `A firewall decides which incoming connections a machine accepts. The Linux kernel filters through nftables, and ufw (uncomplicated firewall) is the friendly front end that writes nftables rules for you.

The safe recipe is always the same order: set the defaults (deny incoming, allow outgoing), allow what you need, then enable. sudo ufw allow OpenSSH must come before sudo ufw enable: the moment the firewall turns on with SSH blocked, your remote session dies and you cannot log back in.

sudo ufw status verbose shows the policy and rules. Each rule appears twice, for IPv4 and IPv6. sudo ufw delete N removes rule N from ufw status numbered.

sudo nft list ruleset prints what is really loaded. The ufw-user-input chain holds your rules, one line per port and protocol.`,
  example: {
    language: 'bash',
    caption: 'The safe order: defaults, allow SSH, allow the app, enable',
    code: `sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 8000/tcp
sudo ufw enable
sudo ufw status verbose
Status: active
Default: deny (incoming), allow (outgoing)
To         Action    From
OpenSSH    ALLOW IN  Anywhere
8000/tcp   ALLOW IN  Anywhere`,
  },
  task: {
    kind: 'shell',
    instructions: 'A web server is already listening on port 8000. Lock the box down without locking yourself out.\n1. Check the firewall state with sudo ufw status (it should be inactive).\n2. Set the defaults: sudo ufw default deny incoming, then sudo ufw default allow outgoing.\n3. Allow SSH first: sudo ufw allow OpenSSH.\n4. Allow the web server: sudo ufw allow 8000/tcp.\n5. Turn it on with sudo ufw enable, then read sudo ufw status verbose.\n6. Test from the network side: curl -sI http://192.168.64.5:8000 | head -1 should answer 200 OK (the firewall would drop that connection without your rule).\n7. Look underneath with sudo nft list ruleset | grep dport and find your two ports.',
    seed: HOME_SEED,
    machine: { processes: [{ pid: 2210, user: 'learner', cmd: 'python3 -m http.server 8000', cpu: 0, mem: 0.4 }] },
    hints: ['ufw needs root for everything, even status: sudo ufw status.', 'sudo ufw default deny incoming and sudo ufw default allow outgoing. Then sudo ufw allow OpenSSH (the app profile) or sudo ufw allow 22/tcp.', 'sudo ufw allow 8000/tcp, then sudo ufw enable. If you enabled too early, sudo ufw disable, add the SSH rule, and enable again.', 'curl -sI http://192.168.64.5:8000 | head -1 uses the box\'s network address, so the firewall applies. Finish with sudo nft list ruleset | grep dport.'],
    solution: { commands: ['sudo ufw status', 'sudo ufw default deny incoming', 'sudo ufw default allow outgoing', 'sudo ufw allow OpenSSH', 'sudo ufw allow 8000/tcp', 'sudo ufw enable', 'sudo ufw status verbose', 'curl -sI http://192.168.64.5:8000 | head -1', 'sudo nft list ruleset | grep dport'] },
    check: (r) => {
      const net = r.state?.sims?.net as Partial<NetState> | undefined
      const fw = net?.firewall
      const rules = fw?.rules ?? []
      const sshRule = rules.find((x) => x.action === 'allow' && x.direction === 'in' && (x.app === 'OpenSSH' || x.port === '22'))
      const webRule = rules.find((x) => x.action === 'allow' && x.direction === 'in' && x.port === '8000' && x.proto === 'tcp')
      const h = r.history ?? []
      const lastEnable = h.map((c, i) => (/^\s*sudo\s+ufw\s+(--force\s+)?enable/.test(c) ? i : -1)).filter((i) => i >= 0).pop() ?? -1
      const firstSsh = h.findIndex((c) => /^\s*sudo\s+ufw\s+allow\s+(OpenSSH|ssh|22(\/tcp)?)\b/.test(c))
      return steps([
        [ranWith(r, /^\s*sudo\s+ufw\s+status/, /Status: (in)?active/), 'Step 1: run sudo ufw status.'],
        [fw?.defaultIn === 'deny', 'Step 2: run sudo ufw default deny incoming.'],
        [fw?.defaultOut === 'allow' && ranWith(r, /^\s*sudo\s+ufw\s+default\s+allow\s+outgoing/, /outgoing policy changed/), 'Step 2: run sudo ufw default allow outgoing.'],
        [Boolean(sshRule), 'Step 3: allow SSH with sudo ufw allow OpenSSH.'],
        [Boolean(webRule), 'Step 4: allow the web server with sudo ufw allow 8000/tcp.'],
        [fw?.enabled === true, 'Step 5: turn the firewall on with sudo ufw enable.'],
        [lastEnable > firstSsh && firstSsh >= 0, 'Step 5: the SSH rule must exist before you enable. Run sudo ufw disable, then sudo ufw enable again now that OpenSSH is allowed.'],
        [ranWith(r, /^\s*sudo\s+ufw\s+status\s+verbose/, /Default: deny \(incoming\), allow \(outgoing\)[\s\S]*8000\/tcp\s+ALLOW IN/), 'Step 5: read sudo ufw status verbose. It should show the defaults and both rules.'],
        [ranWith(r, /^\s*curl\s+.*192\.168\.64\.5:8000/, /HTTP\/1\.0 200 OK/), 'Step 6: curl -sI http://192.168.64.5:8000 | head -1 should print HTTP/1.0 200 OK.'],
        [ranWith(r, /^\s*sudo\s+nft\s+list\s+ruleset/, /tcp dport 22 .*accept[\s\S]*tcp dport 8000 .*accept/), 'Step 7: run sudo nft list ruleset | grep dport and find the accept lines for ports 22 and 8000.'],
      ], 'Defaults, SSH first, the app, then enable. You looked under the hood too: ufw is just writing nftables rules.')
    },
  },
  quiz: [
    { question: 'Why allow OpenSSH before running ufw enable on a remote box?', options: ['ufw refuses to start otherwise', 'The default deny policy would cut your SSH session and lock you out', 'SSH needs to be restarted after enabling'], answer: 1, explanation: 'Once the firewall is active, anything not allowed is dropped, including the connection you are typing on.' },
    { question: 'What does ufw actually use to filter packets?', options: ['nftables rules in the kernel', 'A user-space proxy', 'The sshd service'], answer: 0, explanation: 'ufw is a front end. The real work is in nftables chains such as ufw-user-input, which nft list ruleset shows.' },
    { question: 'ufw status shows the same rule twice, once with (v6). Why?', options: ['It is a bug', 'One copy is for IPv4 and one for IPv6', 'One is for tcp and one for udp'], answer: 1, explanation: 'ufw writes every rule for both address families unless the rule names an IPv4 address.' },
  ],
}

export default lesson
