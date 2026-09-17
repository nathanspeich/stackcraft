import type { Lesson } from '../types'
import { HOME_SEED, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w06d4',
  tier: 1,
  track: 'linux',
  week: 6,
  day: 4,
  title: 'Networking basics: ip, ping, curl, ss',
  concept: `Every machine on a network has an IP address, and every service listens on a port: web servers on 80, SSH on 22. Four commands cover the basics.

ip addr shows your interfaces and addresses. Look for the inet line on your main interface, like 192.168.64.5. lo is loopback, the machine talking to itself as 127.0.0.1 or localhost.

ping host sends small packets and reports whether replies come back and how fast. Use -c 3 to send three and stop.

curl URL fetches a web page and prints it. curl -I fetches only the headers, a quick way to check that a server answers.

ss -tulpn lists the ports this machine is listening on and which program owns each.`,
  example: {
    language: 'bash',
    caption: 'Am I online, and what is listening?',
    code: `ip addr | grep inet
    inet 127.0.0.1/8 scope host lo
    inet 192.168.64.5/24 brd 192.168.64.255 scope global enp0s1
ping -c 2 example.com
64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=12.3 ms
curl -I example.com
HTTP/1.1 200 OK
ss -tulpn | grep LISTEN`,
  },
  task: {
    kind: 'shell',
    instructions: '1. Show your interfaces and addresses with ip.\n2. Ping example.com exactly 3 times.\n3. Fetch example.com with curl and check that the page mentions Example Domain.\n4. Fetch only the headers of example.com.\n5. List the listening ports with ss -tulpn and find which one sshd uses.',
    seed: HOME_SEED,
    hints: ['ip addr (or ip a)', 'ping -c 3 example.com', 'curl example.com prints the page. curl -I example.com prints headers only.', 'ss -tulpn | grep sshd'],
    solution: { commands: ['ip addr', 'ping -c 3 example.com', 'curl example.com', 'curl -I example.com', 'ss -tulpn | grep sshd'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*ip\s+a/, /192\.168\.64\.5/), 'Show your addresses with ip addr.'],
        [ranWith(r, /^\s*ping\s+-c\s*3\s+example\.com/, /3 packets transmitted, 3 received/), 'Ping example.com three times: ping -c 3 example.com.'],
        [ranWith(r, /^\s*curl\s+(https?:\/\/)?(www\.)?example\.com/, /Example Domain/), 'Fetch the page with curl example.com.'],
        [ranWith(r, /^\s*curl\s+-I\s+(https?:\/\/)?(www\.)?example\.com/, /HTTP\/1\.1 200 OK/), 'Fetch only the headers with curl -I example.com.'],
        [ranWith(r, /^\s*ss\s+-\w*l/, /sshd/), 'List listening ports with ss -tulpn and spot sshd on port 22.'],
      ], 'Interfaces, reachability, HTTP, and open ports. That is the whole first-response kit.'),
  },
  quiz: [
    { question: 'What is 127.0.0.1?', options: ['The router', 'This machine itself (localhost)', 'A DNS server'], answer: 1, explanation: 'The loopback address always points back to the machine you are on.' },
    { question: 'ping example.com gets no replies but ping 1.1.1.1 works. What is most likely broken?', options: ['The network cable', 'DNS name resolution', 'The firewall on port 80'], answer: 1, explanation: 'Numeric addresses work but names do not, so name lookup is failing.' },
    { question: 'Which command shows what is listening on port 22?', options: ['ss -tulpn', 'ip addr', 'curl localhost:22'], answer: 0, explanation: 'ss lists sockets. -l keeps only listening ones and -p shows the owning process.' },
  ],
}

export default lesson
