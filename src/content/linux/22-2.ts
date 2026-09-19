import type { Lesson } from '../types'
import { HOME_SEED, fileContent, ran, ranWith, steps } from '../checks'

const lesson: Lesson = {
  id: 'w22d2',
  tier: 2,
  track: 'linux',
  week: 22,
  day: 2,
  title: 'curl in depth, /etc/hosts, dig, traceroute',
  concept: `curl is the Swiss army knife for talking to web servers. The flags you will use most: -I fetches only the headers, -i prints headers and body, -s hides the progress bar, -S shows errors even when silent, -L follows redirects, -o FILE saves the body, and -w '%{http_code}' prints the status code at the end. curl -s -o /dev/null -w '%{http_code}' URL is the classic "is it up" check.

Before any request the name must become an address. /etc/hosts is consulted first, handy for testing: point a name at 127.0.0.1 and curl talks to your own machine.

dig asks DNS directly and shows the answer with record type and TTL. traceroute lists every router between you and a host, so you can see where a slow path stops.`,
  example: {
    language: 'bash',
    caption: 'Status codes, redirects, and a name lookup',
    code: `curl -s -o /dev/null -w '%{http_code}\\n' example.com
200
curl -sI httpbin.org/redirect/1 | head -1
HTTP/1.1 302 Found
curl -sL -o /dev/null -w '%{http_code}\\n' httpbin.org/redirect/1
200
dig +short example.com
93.184.216.34`,
  },
  task: {
    kind: 'shell',
    instructions: 'A web server is already running on port 8080 (check with ss -tulpn if you like).\n1. Fetch only the headers of example.com with curl -I.\n2. Print just the status code of httpbin.org/status/404 using -s, -o /dev/null and -w \'%{http_code}\\n\'.\n3. httpbin.org/redirect/1 answers with a redirect. Fetch it again with -L added so curl follows it and prints 200.\n4. Add the line 127.0.0.1 myapp.local to /etc/hosts (echo with sudo tee -a), then run curl -I myapp.local:8080 and check you get 200 OK from the local server.\n5. Ask DNS directly with dig example.com and read the ANSWER SECTION.\n6. traceroute is not installed. Install it with sudo apt install traceroute, then run traceroute example.com.',
    seed: HOME_SEED,
    machine: { processes: [{ pid: 2210, user: 'learner', cmd: 'python3 -m http.server 8080', cpu: 0, mem: 0.4 }] },
    hints: ['curl -I example.com prints the status line and headers, nothing else.', 'curl -s -o /dev/null -w \'%{http_code}\\n\' httpbin.org/status/404 throws the body away and prints only 404. Add -L in step 3.', 'echo "127.0.0.1 myapp.local" | sudo tee -a /etc/hosts appends the line as root. Then curl -I myapp.local:8080.', 'dig example.com prints a lot; the ANSWER SECTION has the A record. For traceroute: sudo apt install traceroute, then traceroute example.com.'],
    solution: { commands: ['curl -I example.com', "curl -s -o /dev/null -w '%{http_code}\\n' httpbin.org/status/404", "curl -sL -o /dev/null -w '%{http_code}\\n' httpbin.org/redirect/1", 'echo "127.0.0.1 myapp.local" | sudo tee -a /etc/hosts', 'curl -I myapp.local:8080', 'dig example.com', 'sudo apt install traceroute', 'traceroute example.com'] },
    check: (r) =>
      steps([
        [ranWith(r, /^\s*curl\s+.*-\w*I.*example\.com/, /HTTP\/1\.1 200 OK/), 'Step 1: run curl -I example.com and look for HTTP/1.1 200 OK.'],
        [ranWith(r, /^\s*curl\s+.*-w.*http_code.*httpbin\.org\/status\/404|^\s*curl\s+.*httpbin\.org\/status\/404.*-w.*http_code/, /^404\s*$/m), "Step 2: curl -s -o /dev/null -w '%{http_code}\\n' httpbin.org/status/404 should print just 404."],
        [ranWith(r, /^\s*curl\s+.*-\w*L.*httpbin\.org\/redirect\/1|^\s*curl\s+.*httpbin\.org\/redirect\/1.*-\w*L/, /^200\s*$/m), 'Step 3: fetch httpbin.org/redirect/1 with -L (and -s -o /dev/null -w for the code) so the answer is 200.'],
        [/^\s*127\.0\.0\.1\s+myapp\.local\s*$/m.test(fileContent(r, '/etc/hosts') ?? ''), 'Step 4: /etc/hosts needs the line 127.0.0.1 myapp.local. Use echo "127.0.0.1 myapp.local" | sudo tee -a /etc/hosts.'],
        [ranWith(r, /^\s*curl\s+.*myapp\.local:8080/, /HTTP\/1\.0 200 OK/), 'Step 4: now curl -I myapp.local:8080 should answer HTTP/1.0 200 OK from the local server.'],
        [ranWith(r, /^\s*dig\s+.*example\.com/, /ANSWER SECTION:\nexample\.com\.\s+\d+\s+IN\s+A\s+93\.184\.216\.34/), 'Step 5: run dig example.com and find the A record in the ANSWER SECTION.'],
        [Boolean(r.state?.packages.includes('traceroute')), 'Step 6: install it first: sudo apt install traceroute.'],
        [ran(r, /^\s*traceroute\s+/) && ranWith(r, /^\s*traceroute\s+.*example\.com/, /hops max/), 'Step 6: run traceroute example.com and watch the hops go by.'],
      ], 'Headers, status codes, redirects, a local override, DNS, and the path packets take. That is most of web debugging.'),
  },
  quiz: [
    { question: 'Which curl flags print only the HTTP status code and nothing else?', options: ["-s -o /dev/null -w '%{http_code}'", '-I -v', '-i -L'], answer: 0, explanation: '-s hides the progress bar, -o /dev/null discards the body, and -w prints the code after the transfer.' },
    { question: 'curl example.com prints a 301 page instead of the site. What do you add?', options: ['-L to follow the redirect', '-I to fetch headers', '-o to save it'], answer: 0, explanation: 'A 3xx status carries a Location header. -L makes curl request that new address.' },
    { question: 'You add "127.0.0.1 shop.test" to /etc/hosts. What does dig +short shop.test print?', options: ['127.0.0.1', 'Nothing, because dig asks DNS and skips /etc/hosts', 'An error about a missing zone'], answer: 1, explanation: 'dig talks straight to the DNS server. Only programs using the normal resolver (curl, ping, getent) see /etc/hosts.' },
  ],
}

export default lesson
