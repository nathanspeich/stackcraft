import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'w22d5',
  tier: 2,
  track: 'linux',
  week: 22,
  day: 5,
  title: 'Project: serve a folder behind ufw',
  concept: `Time to do it for real. On the VM you will start Python's built-in web server, open exactly one port in the firewall, and confirm the page from the Mac.

The only dangerous moment is sudo ufw enable. The VM's default policy is deny incoming, and multipass shell talks to the box over SSH. Allow OpenSSH first, every time, before the firewall goes on.

The order to remember: start the server, allow OpenSSH, allow the app port, enable, then check from three angles. sudo ufw status shows the rules, ss -tulpn shows the socket, and curl (or Safari) shows the page.

The IP you need for Safari is the VM's, not 127.0.0.1. multipass list on the Mac prints it.`,
  example: {
    language: 'bash',
    caption: 'The whole project in five commands',
    code: `cd ~ && nohup python3 -m http.server 8000 > server.log 2>&1 &
sudo ufw allow OpenSSH
sudo ufw allow 8000/tcp
sudo ufw --force enable
sudo ufw status
Status: active
To          Action    From
OpenSSH     ALLOW     Anywhere
8000/tcp    ALLOW     Anywhere`,
  },
  task: {
    kind: 'real',
    intro: `This project runs inside the VM: open Terminal on the Mac and run multipass shell stackcraft first.

You will serve your home folder on port 8000 with python3 -m http.server, then use ufw to allow that port while keeping SSH open. Finally you will confirm it from the Mac, either in Safari at http://VM-IP:8000 (multipass list shows the IP) or with curl.

Read the ufw step twice before running it. Allowing OpenSSH before ufw enable is what keeps your multipass shell alive. If you do get locked out, multipass restart stackcraft on the Mac brings the box back, and sudo ufw disable inside it turns the firewall off again.

The app never touches the VM. It only reads what you paste.`,
    steps: [
      {
        instruction: 'Inside the VM, start the web server in the background from your home directory. nohup keeps it running after you close the shell, and the log goes to server.log. Then print the first line of the log to prove it started.',
        command: "cd ~ && nohup python3 -m http.server 8000 > server.log 2>&1 &\nsleep 1 && head -1 server.log",
        pasteLabel: 'Paste the line from server.log',
        check: [{ type: 'includes', text: 'port 8000' }, { type: 'regex', pattern: 'Serving HTTP', label: 'the "Serving HTTP" line' }],
        hint: 'If the log is empty, wait a second and run head -1 server.log again. If it says "Address already in use", something else has port 8000: run ss -tulpn | grep 8000 to see what, or pick 8001 and use that number in every later step.',
        example: 'Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...\n',
      },
      {
        instruction: 'Now the firewall. Allow OpenSSH first, then port 8000, then enable. Run the four commands in this order and paste the status output.\n\nIf ufw status shows "inactive" you skipped enable. If you see a "Command may disrupt existing ssh connections" question, answer y: your OpenSSH rule is already in place.',
        command: 'sudo ufw allow OpenSSH\nsudo ufw allow 8000/tcp\nsudo ufw --force enable\nsudo ufw status',
        pasteLabel: 'Paste the output of sudo ufw status',
        check: [{ type: 'includes', text: 'Status: active' }, { type: 'includes', text: '8000' }, { type: 'includes', text: 'ALLOW' }],
        hint: 'The status must be active and list 8000 with ALLOW. If ufw says the rule already exists, that is fine. If your shell froze after enable, you enabled before allowing OpenSSH: on the Mac run multipass restart stackcraft, open a new multipass shell, run sudo ufw allow OpenSSH, and paste sudo ufw status again.',
        example: 'Status: active\n\nTo                         Action      From\n--                         ------      ----\nOpenSSH                    ALLOW       Anywhere\n8000/tcp                   ALLOW       Anywhere\nOpenSSH (v6)               ALLOW       Anywhere (v6)\n8000/tcp (v6)              ALLOW       Anywhere (v6)\n',
      },
      {
        instruction: 'Prove the server is really listening on the port you opened.',
        command: 'ss -tulpn | grep 8000',
        pasteLabel: 'Paste the output of ss -tulpn | grep 8000',
        check: [{ type: 'includes', text: 'LISTEN' }, { type: 'includes', text: '8000' }],
        hint: 'No output means nothing is listening on 8000: the server from step 1 has stopped. Start it again with the step 1 command. On the real VM the process column may be empty without sudo, and that is fine; LISTEN and :8000 are what count.',
        example: 'tcp   LISTEN 0      5                  *:8000             *:*    users:(("python3",pid=2231,fd=3))\n',
      },
      {
        instruction: 'Finally, fetch the page. Inside the VM, curl -I asks for the headers only; a 200 means the directory listing is being served.\n\nThen look at it from the Mac: run multipass list in the Mac Terminal, copy the IPv4 address of stackcraft, and open http://THAT-IP:8000 in Safari. You should see "Directory listing for /" with your home folder in it. That request crosses the firewall, which is the whole point of this week.',
        command: 'curl -I http://localhost:8000',
        pasteLabel: 'Paste the output of curl -I http://localhost:8000',
        check: [{ type: 'includes', text: '200' }, { type: 'regex', pattern: '^HTTP/', flags: 'm', label: 'an HTTP status line' }],
        hint: 'Connection refused means the server is not running (redo step 1). A 404 means you asked for a path that does not exist: use exactly http://localhost:8000 with nothing after the port. If Safari on the Mac cannot connect but curl inside the VM works, the firewall rule is missing: check sudo ufw status for 8000/tcp ALLOW.',
        example: 'HTTP/1.0 200 OK\nServer: SimpleHTTP/0.6 Python/3.12.3\nDate: Thu, 18 Sep 2026 09:41:07 GMT\nContent-type: text/html; charset=utf-8\nContent-Length: 612\n',
      },
    ],
  },
  quiz: [
    { question: 'Which command must run before sudo ufw enable on the VM?', options: ['sudo ufw allow OpenSSH', 'sudo ufw allow 8000/tcp', 'sudo ufw logging on'], answer: 0, explanation: 'Without the SSH rule the default deny policy blocks your own session the moment the firewall starts.' },
    { question: 'Safari on the Mac cannot reach http://VM-IP:8000 but curl inside the VM works. Most likely cause?', options: ['Python is too old', 'The firewall does not allow port 8000', 'Safari needs https'], answer: 1, explanation: 'Inside the VM, localhost traffic never crosses the firewall. The Mac\'s request does, so it needs the 8000/tcp rule.' },
    { question: 'Which address do you type in Safari?', options: ['http://127.0.0.1:8000', 'http://VM-IP:8000, the address from multipass list', 'http://stackcraft:8000'], answer: 1, explanation: '127.0.0.1 in Safari means the Mac itself. The VM has its own address on the Multipass network.' },
  ],
}

export default lesson
