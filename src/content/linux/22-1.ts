import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w22d1',
  tier: 2,
  track: 'linux',
  week: 22,
  day: 1,
  title: 'IPs, ports, DNS, ip addr, ss',
  concept: `An IP address is a machine's street address on a network. A port is a door number on that machine: one program listens behind each door. SSH waits on 22, web servers on 80 and 443, and anything you start yourself can pick a free number like 8000.

Addresses that start with 10., 172.16. to 172.31., or 192.168. are private: they only mean something inside your own network. 127.0.0.1 always means this machine.

DNS turns names into addresses. Your box asks a resolver (see /etc/resolv.conf), which asks the internet. /etc/hosts is checked first, so a line there overrides DNS.

ip -br addr lists your addresses, ip route shows where traffic leaves, and ss -tulpn lists every door that is open and which program is behind it.`,
  example: {
    language: 'bash',
    caption: 'Where am I, and what is listening?',
    code: `ip -br addr
lo      UNKNOWN  127.0.0.1/8
enp0s1  UP       192.168.64.5/24
ip route | head -1
default via 192.168.64.1 dev enp0s1
ss -tulpn
Netid State  Local Address:Port  Process
tcp   LISTEN       0.0.0.0:22    users:(("sshd",pid=412,fd=3))`,
  },
  task: {
    kind: 'shell',
    instructions: '1. Show your addresses in the short form with ip -br addr and find the one on enp0s1.\n2. Show the routing table with ip route and spot the default gateway.\n3. Look up example.com the way programs do, with getent hosts example.com.\n4. List the listening ports with ss -tulpn and find sshd on port 22.\n5. Start a web server in the background: python3 -m http.server 8000 &\n6. Run ss -tulpn | grep 8000 to prove it is listening and see which program owns the port.',
    seed: HOME_SEED,
    hints: ['ip -br addr is the short form of ip addr. The -br flag means brief.', 'ip route (or ip r) prints one line per route. The line that starts with default is the gateway.', 'getent hosts NAME uses the same lookup order as every other program: /etc/hosts first, then DNS. It prefers the IPv6 address when the name has one; that is still a valid answer.', 'The & at the end of python3 -m http.server 8000 & puts it in the background so you get your prompt back. Then ss -tulpn | grep 8000.'],
    solution: { commands: ['ip -br addr', 'ip route', 'getent hosts example.com', 'ss -tulpn', 'python3 -m http.server 8000 &', 'ss -tulpn | grep 8000'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*ip\s+(-br|-brief|-b)\s+a/, /enp0s1\s+UP\s+192\.168\.64\.5\/24/), 'Step 1: run ip -br addr and look for the enp0s1 line.'],
        [ranWith(r, /^\s*ip\s+r/, /default via 192\.168\.64\.1/), 'Step 2: run ip route. The default line names the gateway.'],
        [ranWith(r, /^\s*getent\s+hosts\s+example\.com/, /(93\.184\.216\.34|2606:2800:21f:cb07:6820:80da:af6b:8b2c)\s+example\.com/), 'Step 3: run getent hosts example.com to resolve the name.'],
        [ranWith(r, /^\s*ss\s+-\w*l/, /sshd/), 'Step 4: run ss -tulpn and find the sshd line on port 22.'],
        [Boolean(r.state?.processes.some((p) => /http\.server\s+8000/.test(p.cmd))), 'Step 5: start the server in the background: python3 -m http.server 8000 &'],
        [ranWith(r, /^\s*ss\s+-\w*l.*\|\s*grep\s+8000/, /LISTEN.*:8000.*python3/), 'Step 6: run ss -tulpn | grep 8000. The line should say LISTEN and name python3.'],
      ], 'Address, route, name lookup, and open ports. You can now answer "what is this machine and what is it serving".'),
  },
  quiz: [
    { question: 'A friend says "connect to 192.168.64.5:8000". What are the two parts?', options: ['A DNS name and a password', 'An IP address and a port number', 'A gateway and a subnet mask'], answer: 1, explanation: 'The part before the colon is the machine, the number after it is the door that one program listens on.' },
    { question: 'Which file does the box check before asking DNS?', options: ['/etc/hosts', '/etc/resolv.conf', '/etc/services'], answer: 0, explanation: 'The hosts line in /etc/nsswitch.conf says files first, then dns. /etc/resolv.conf only says which resolver to ask.' },
    { question: 'In ss -tulpn, what does the -l flag do?', options: ['Shows only listening sockets', 'Shows only local traffic', 'Prints a long format'], answer: 0, explanation: 't tcp, u udp, l listening, p process, n numeric ports instead of names.' },
  ],
}

export default lesson
