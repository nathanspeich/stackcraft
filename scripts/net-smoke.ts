// Smoke test for the networking simulation module (src/shell/sim/net.ts):
// addresses, sockets, curl, DNS tools, ufw and nftables, sshd config, keys, and fail2ban.
import { Shell } from '../src/shell/shell'
import type { NetState } from '../src/shell/sim/net'

const sh = new Shell()
sh.seed({ '/home/learner/site/index.html': '<h1>hello from stackbox</h1>\n' })
let fails = 0
const t = (cmd: string, expect: string | RegExp, code?: number) => {
  let out: string
  let rc = -1
  try { const r = sh.run(cmd); out = r.output; rc = r.code } catch (e) { out = 'THROW ' + (e as Error).message }
  const pass = (typeof expect === 'string' ? out === expect : expect.test(out)) && (code === undefined || rc === code)
  if (!pass) { fails++; console.log(`FAIL ${JSON.stringify(cmd)}\n  got: ${JSON.stringify(out)} (exit ${rc})\n  want: ${expect}${code !== undefined ? ` (exit ${code})` : ''}`) }
}
const net = () => sh.state.sims.net as NetState

// addresses and routes
t('ip addr', /2: enp0s1: <BROADCAST,MULTICAST,UP,LOWER_UP>[\s\S]*inet 192\.168\.64\.5\/24/)
t('ip a | grep -c inet6', '3\n')
t('ip -br addr', /^lo\s+UNKNOWN\s+127\.0\.0\.1\/8[\s\S]*enp0s1\s+UP\s+192\.168\.64\.5\/24/)
t('ip addr show enp0s1', /^2: enp0s1/)
t('ip addr show eth9', /Device "eth9" does not exist/, 1)
t('ip route', /^default via 192\.168\.64\.1 dev enp0s1/)
t('ip r | wc -l', '3\n')
t('ip route get 1.1.1.1', /1\.1\.1\.1 via 192\.168\.64\.1 dev enp0s1 src 192\.168\.64\.5/)
t('ip link | grep -c UP', '2\n')
t('hostname -I', '192.168.64.5 \n')
t('hostname', 'stackbox\n')

// sockets
t('ss -tulpn', /Netid State[\s\S]*tcp\s+LISTEN\s+0\s+128\s+0\.0\.0\.0:22\s+0\.0\.0\.0:\*\s+users:\(\("sshd",pid=412,fd=3\)\)/)
t('ss -tulpn | grep -c LISTEN', '2\n')
t('ss -tlnp | grep -c udp', '0\n', 1)
t('ss -tn', /ESTAB.*192\.168\.64\.5:22\s+192\.168\.64\.1:53422/)
t('ss -tulpn | grep 8000', '', 1)
t('python3 -m http.server 8000 &', /^\[1\] \d+\n$/)
t('ss -tulpn | grep 8000', /tcp\s+LISTEN\s+0\s+5\s+0\.0\.0\.0:8000.*python3/)
t('sudo systemctl start nginx; ss -tulpn | grep -c ":80 "', '2\n')
t('sudo systemctl stop nginx; ss -tulpn | grep -c ":80 "', '0\n', 1)

// curl against local servers
t('curl -I http://localhost:8000', /^HTTP\/1\.0 200 OK\nServer: SimpleHTTP\/0\.6 Python\/3\.12/)
t('curl -s localhost:8000 | grep -c site', '1\n')
t('curl -s localhost:8000/site/', /hello from stackbox/)
t('curl -s -o /dev/null -w "%{http_code}\\n" localhost:8000/missing', '404\n')
t('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000', '200')
t('curl localhost:9999', /curl: \(7\) Failed to connect to localhost port 9999/, 7)
t('curl -s localhost:9999; echo "rc=$?"', 'rc=7\n')
t('curl -sS localhost:9999 2>&1 | grep -c "curl: (7)"', '1\n')
t('curl localhost:22', /curl: \(1\) Received HTTP\/0\.9 when not allowed/, 1)
t('curl -o page.html -s localhost:8000 && grep -c "Directory listing" page.html', '2\n')
t('cd site && curl -O -s localhost:8000/site/index.html && cat index.html && cd ..', '<h1>hello from stackbox</h1>\n')

// curl against the pretend internet
t('curl -I example.com | head -1', 'HTTP/1.1 200 OK\n')
t('curl -sI https://example.com | head -1', 'HTTP/2 200 \n')
t('curl -s example.com | grep -c "Example Domain"', '2\n')
t('curl -i -s example.com | head -1', 'HTTP/1.1 200 OK\n')
t('curl -s http://github.com | wc -c', '0\n')
t('curl -sI http://github.com | grep -i location', /Location: https:\/\/github\.com\//)
t('curl -sL http://github.com | grep -c GitHub', '1\n')
t('curl -s -o /dev/null -w "%{http_code} %{num_redirects}\\n" -L httpbin.org/redirect/2', '200 2\n')
t('curl -s httpbin.org/get', /"url": "http:\/\/httpbin\.org\/get"/)
t('curl -s "httpbin.org/get?name=ann&n=2"', /"name": "ann"[\s\S]*"n": "2"/)
t('curl -s -H "Authorization: Bearer abc123" httpbin.org/headers', /"Authorization": "Bearer abc123"/)
t('curl -s -X POST -d "user=ann" httpbin.org/post', /"form": \{\n\s+"user": "ann"/)
t('curl -s -X PUT -H "Content-Type: application/json" -d \'{"a":1}\' httpbin.org/anything', /"json": \{\n\s+"a": 1\n\s+\}[\s\S]*"method": "PUT"/)
t('curl -sI httpbin.org/status/503 | head -1', 'HTTP/1.1 503 Service Unavailable\n')
t('curl -s -o /dev/null -w "%{http_code}" httpbin.org/status/418', '418')
t('curl -f -s httpbin.org/status/404; echo "rc=$?"', 'rc=22\n')
t('curl -fsS httpbin.org/status/404', /curl: \(22\) The requested URL returned error: 404/, 22)
t('curl --max-time 2 -s httpbin.org/delay/5; echo "rc=$?"', 'rc=28\n')
t('curl -s --max-time 10 httpbin.org/delay/1 | grep -c origin', '1\n')
t('curl nope.invalid', /curl: \(6\) Could not resolve host: nope\.invalid/, 6)
t('curl -v example.com 2>&1 | grep -c "^> "', '4\n')
t('curl -v example.com 2>&1 | grep "^< HTTP"', '< HTTP/1.1 200 OK\n')
t('curl -sv https://example.com 2>&1 | grep -c "SSL connection"', '1\n')
t('curl -w "%{http_code}\\n" -s -o /dev/null api.github.com/zen', '200\n')
t('curl -s api.github.com/zen', 'Keep it logically awesome.')
t('curl', /try 'curl --help'/, 2)
t('curl --bogus example.com', /option --bogus: is unknown/, 2)
t('curl --version | head -1', /^curl 8\.5\.0/)

// /etc/hosts wins over DNS
t('echo "127.0.0.1 myapp.local" | sudo tee -a /etc/hosts > /dev/null; curl -sI myapp.local:8000 | head -1', 'HTTP/1.0 200 OK\n')
t('getent hosts myapp.local', '127.0.0.1       myapp.local\n')
t('getent hosts example.com', /example\.com/)
t('getent hosts nope.invalid; echo "rc=$?"', 'rc=2\n')
t('ping -c 2 myapp.local', /PING myapp\.local \(127\.0\.0\.1\)[\s\S]*2 packets transmitted, 2 received/)
t('echo "93.184.216.34 fake.example" | sudo tee -a /etc/hosts > /dev/null; curl -sI fake.example | head -1', 'HTTP/1.1 200 OK\n')
t('echo "10.9.9.9 dead.example" | sudo tee -a /etc/hosts > /dev/null; curl -sS --max-time 1 dead.example', /curl: \(28\)/, 28)

// ping
t('ping -c 3 example.com', /3 packets transmitted, 3 received, 0% packet loss/)
t('ping -c 1 192.168.64.1', /64 bytes from _gateway \(192\.168\.64\.1\): icmp_seq=1 ttl=64/)
t('ping -c 2 10.9.9.9', /2 packets transmitted, 0 received, 100% packet loss/, 1)
t('ping nope.invalid', /ping: nope\.invalid: Name or service not known/, 2)
t('ping -c 1 localhost | head -2 | tail -1', /64 bytes from localhost \(127\.0\.0\.1\)/)

// dns tools
t('dig +short example.com', '93.184.216.34\n')
t('dig example.com', /;; ANSWER SECTION:\nexample\.com\.\t\t3600\tIN\tA\t93\.184\.216\.34\n[\s\S]*;; SERVER: 127\.0\.0\.53#53/)
t('dig example.com | grep status', /status: NOERROR/)
t('dig nope.invalid | grep status', /status: NXDOMAIN/)
t('dig +short nope.invalid', '')
t('dig +short example.com MX', '0 .\n')
t('dig +short google.com MX', '10 smtp.google.com.\n')
t('dig example.com AAAA +short', '2606:2800:21f:cb07:6820:80da:af6b:8b2c\n')
t('dig +short example.com TXT | head -1', '"v=spf1 -all"\n')
t('dig +short example.com NS | wc -l', '2\n')
t('dig @1.1.1.1 example.com | grep SERVER', /SERVER: 1\.1\.1\.1#53/)
t('dig -x 8.8.8.8 +short', 'dns.google.\n')
t('dig +short myapp.local', '')
t('nslookup example.com', /Server:\t\t127\.0\.0\.53[\s\S]*Name:\texample\.com\nAddress: 93\.184\.216\.34/)
t('nslookup nope.invalid', /server can't find nope\.invalid: NXDOMAIN/, 1)
t('nslookup 8.8.8.8', /name = dns\.google\./)
t('host example.com', /example\.com has address 93\.184\.216\.34\nexample\.com has IPv6 address/)
t('host -t MX github.com | wc -l', '3\n')
t('host nope.invalid', /Host nope\.invalid not found: 3\(NXDOMAIN\)/, 1)
t('cat /etc/resolv.conf | grep nameserver', 'nameserver 127.0.0.53\n')
t('grep ^hosts /etc/nsswitch.conf', /^hosts:\s+files/)
t('resolvectl status | grep "DNS Servers"', /192\.168\.64\.1/)

// traceroute and mtr
t('traceroute example.com', /not found, but can be installed with:\nsudo apt install traceroute/, 127)
t('sudo apt install traceroute | grep -c "Setting up traceroute"', '1\n')
t('traceroute example.com', /^traceroute to example\.com \(93\.184\.216\.34\), 30 hops max, 60 byte packets\n 1  _gateway \(192\.168\.64\.1\)  0\.600 ms[\s\S]* 3  \* \* \*\n[\s\S]* 6  93\.184\.216\.34  12\.300 ms/)
t('traceroute -n example.com | tail -1', /^ 6  93\.184\.216\.34  /)
t('traceroute localhost', /^traceroute to localhost \(127\.0\.0\.1\)[\s\S]* 1  localhost \(127\.0\.0\.1\)/)
t('traceroute nope.invalid', /Name or service not known/, 2)
t('traceroute 10.9.9.9 | grep -c "\\* \\* \\*"', /[3-9]/)
t('mtr -r example.com', /not found, but can be installed/, 127)
t('sudo apt install mtr-tiny > /dev/null; mtr -r -c 5 example.com', /^Start: [\s\S]*HOST: stackbox\s+Loss%\s+Snt\s+Last[\s\S]*1\.\|-- _gateway\s+0\.0%\s+5[\s\S]*3\.\|-- \?\?\?\s+100\.0/)
t('mtr example.com', /mtr -r HOST/, 1)

// nc
t('nc -zv localhost 8000', /Connection to localhost \(127\.0\.0\.1\) 8000 port \[tcp\/\*\] succeeded!/)
t('nc -zv localhost 8001', /Connection refused/, 1)
t('nc -zv example.com 80', /succeeded/)

// ufw
t('ufw status', 'ERROR: You need to be root to run this script\n', 1)
t('sudo ufw status', 'Status: inactive\n')
t('sudo ufw status verbose', 'Status: inactive\n')
t('sudo ufw allow 8000', 'Rules updated\nRules updated (v6)\n')
t('sudo ufw allow 8000', 'Skipping adding existing rule\nSkipping adding existing rule (v6)\n')
t('sudo ufw enable', /Command may disrupt existing ssh connections\. Proceed with operation \(y\|n\)\? y\nFirewall is active and enabled on system startup\nWARNING: no rule allows port 22/)
t('sudo ufw status', 'Status: active\n\nTo                         Action      From\n--                         ------      ----\n8000                       ALLOW       Anywhere\n8000 (v6)                  ALLOW       Anywhere (v6)\n')
t('ssh learner@192.168.64.5', /ssh: connect to host 192\.168\.64\.5 port 22: Connection timed out/, 255)
t('sudo ufw allow OpenSSH', 'Rule added\nRule added (v6)\n')
t('sudo ufw allow ssh', 'Rule added\nRule added (v6)\n')
t('sudo ufw allow 80/tcp', 'Rule added\nRule added (v6)\n')
t('sudo ufw deny 23', 'Rule added\nRule added (v6)\n')
t('sudo ufw allow from 192.168.64.1 to any port 5432', 'Rule added\n')
t('sudo ufw allow from 10.0.0.0/8', 'Rule added\n')
t('sudo ufw limit 22/tcp', 'Rule added\nRule added (v6)\n')
t('sudo ufw allow 6000:6007', /Must specify 'tcp' or 'udp' with multiple ports/, 1)
t('sudo ufw allow 6000:6007/tcp', 'Rule added\nRule added (v6)\n')
t('sudo ufw allow 99999', /ERROR: Bad port/, 1)
t('sudo ufw allow "Nginx Full"', /Could not find a profile matching 'Nginx Full'/, 1)
t('sudo ufw allow 443/tcp comment "https"', 'Rule added\nRule added (v6)\n')
t('sudo ufw status | grep 443', /443\/tcp\s+ALLOW\s+Anywhere\s+# https/)
t('sudo ufw status numbered', /^Status: active\n\n     To                         Action      From\n     --                         ------      ----\n\[ 1\] 8000                       ALLOW IN    Anywhere\n\[ 2\] OpenSSH                    ALLOW IN    Anywhere\n\[ 3\] 22\/tcp                     ALLOW IN    Anywhere\n\[ 4\] 80\/tcp                     ALLOW IN    Anywhere\n\[ 5\] 23                         DENY IN     Anywhere\n\[ 6\] 5432                       ALLOW IN    192\.168\.64\.1\n\[ 7\] Anywhere                   ALLOW IN    10\.0\.0\.0\/8\n\[ 8\] 22\/tcp                     LIMIT IN    Anywhere\n/)
t('sudo ufw status verbose', /^Status: active\nLogging: on \(low\)\nDefault: deny \(incoming\), allow \(outgoing\), disabled \(routed\)\nNew profiles: skip\n\nTo                         Action      From\n--                         ------      ----\n8000                       ALLOW IN    Anywhere\n/)
t('sudo ufw delete 5', 'Deleting:\n deny 23\nProceed with operation (y|n)? y\nRule deleted\n')
t('sudo ufw status | grep -c "^23  "', '0\n', 1)
t('sudo ufw status | grep -c "^23 (v6)"', '1\n')
t('sudo ufw delete allow 6000:6007/tcp', 'Rule deleted\nRule deleted (v6)\n')
t('sudo ufw delete allow 7777', /Could not delete non-existent rule\nCould not delete non-existent rule \(v6\)/, 1)
t('sudo ufw --force delete 1', 'Rule deleted\n')
t('sudo ufw status | grep -c "^8000  "', '0\n', 1)
t('sudo ufw status | grep -c "8000 (v6)"', '1\n')
t('sudo ufw default deny incoming', "Default incoming policy changed to 'deny'\n(be sure to update your rules accordingly)\n")
t('sudo ufw default allow outgoing', "Default outgoing policy changed to 'allow'\n(be sure to update your rules accordingly)\n")
t('sudo ufw default bogus', /Unsupported policy/, 1)
t('sudo ufw logging on', 'Logging enabled\n')
t('sudo ufw logging off', 'Logging disabled\n')
t('sudo ufw status verbose | grep Logging', 'Logging: off\n')
t('sudo ufw app list', 'Available applications:\n  OpenSSH\n')
t('sudo ufw show added | grep -c "^ufw allow"', /[5-9]/)
t('sudo ufw insert 1 deny from 203.0.113.9', 'Rule added\n')
t('sudo ufw status numbered | head -5 | tail -1', /\[ 1\] Anywhere\s+DENY IN\s+203\.0\.113\.9/)
t('sudo ufw reload', 'Firewall reloaded\n')
t('sudo ufw disable', 'Firewall stopped and disabled on system startup\n')
t('sudo ufw status', 'Status: inactive\n')
t('sudo ufw --force enable', 'Firewall is active and enabled on system startup\n')
t('grep ENABLED /etc/ufw/ufw.conf', 'ENABLED=yes\n')
t('sudo ufw version | head -1', 'ufw 0.36.2\n')
if (!net().firewall.enabled || !net().firewall.rules.some((r) => r.app === 'OpenSSH' && r.action === 'allow')) { fails++; console.log('FAIL net state does not reflect the firewall') }

// firewall verdicts seen from the LAN (the VM's own IP) versus loopback
t('curl -s -o /dev/null -w "%{http_code}\\n" http://192.168.64.5:8000', '000\n', 28)
t('curl -sS --max-time 2 http://192.168.64.5:8000', /curl: \(28\) Failed to connect to 192\.168\.64\.5 port 8000 after 2001 ms: Timeout was reached/, 28)
t('curl -sI http://localhost:8000 | head -1', 'HTTP/1.0 200 OK\n')
t('sudo ufw allow 8000/tcp > /dev/null; curl -sI http://192.168.64.5:8000 | head -1', 'HTTP/1.0 200 OK\n')
t('nc -zv 192.168.64.5 8080', /Connection timed out/, 1)
t('sudo ufw reject 8000/tcp > /dev/null; sudo ufw --force delete allow 8000/tcp > /dev/null; curl -sS http://192.168.64.5:8000', /curl: \(7\) Failed to connect to 192\.168\.64\.5 port 8000 after 0 ms/, 7)
t('sudo ufw --force reset > /dev/null; sudo ufw status', 'Status: inactive\n')
t('curl -sI http://192.168.64.5:8000 | head -1', 'HTTP/1.0 200 OK\n')

// nftables underneath
t('nft list ruleset', /Operation not permitted/, 1)
t('sudo nft list ruleset', '')
t('sudo ufw allow 22/tcp > /dev/null; sudo ufw allow 8000 > /dev/null; sudo ufw allow from 192.168.64.1 to any port 5432 proto tcp > /dev/null; sudo ufw deny 23/tcp > /dev/null; sudo ufw --force enable > /dev/null; sudo nft list ruleset | grep dport', '\t\tudp sport 67 udp dport 68 counter packets 0 bytes 0 accept\n\t\ttcp dport 22 counter packets 0 bytes 0 accept\n\t\ttcp dport 8000 counter packets 0 bytes 0 accept\n\t\tudp dport 8000 counter packets 0 bytes 0 accept\n\t\tip saddr 192.168.64.1 tcp dport 5432 counter packets 0 bytes 0 accept\n\t\ttcp dport 23 counter packets 0 bytes 0 drop\n\t\tudp dport 137 counter packets 0 bytes 0 drop\n\t\tudp dport 138 counter packets 0 bytes 0 drop\n\t\ttcp dport 139 counter packets 0 bytes 0 drop\n\t\ttcp dport 445 counter packets 0 bytes 0 drop\n')
t('sudo nft list ruleset | grep "hook input"', /type filter hook input priority filter; policy drop;/)
t('sudo nft list ruleset | grep -c "iifname \\"lo\\""', '1\n')
t('sudo nft list tables', 'table ip filter\ntable ip6 filter\n')
t('sudo nft list chain ip filter ufw-user-input | grep -c dport', '5\n')
t('sudo ufw default allow incoming > /dev/null; sudo nft list ruleset | grep "hook input"', /policy accept;/)
t('sudo ufw --force reset > /dev/null; sudo nft list ruleset | wc -c', '0\n')

// sshd config
t('grep -n "^#PasswordAuthentication" /etc/ssh/sshd_config', '38:#PasswordAuthentication yes\n')
t('cat /etc/ssh/sshd_config.d/50-cloud-init.conf', 'PasswordAuthentication no\n')
t('ls -l /etc/ssh/sshd_config | cut -c1-10', '-rw-r--r--\n')
t('sshd -T', /sshd: no hostkeys available -- exiting\./, 1)
t('sudo sshd -T | grep -E "^(port|passwordauthentication|permitrootlogin|pubkeyauthentication) "', 'port 22\npermitrootlogin prohibit-password\npubkeyauthentication yes\npasswordauthentication no\n')
t('sudo sshd -t; echo "rc=$?"', 'rc=0\n')
t('printf "PermitRootLogin no\\nMaxAuthTries 3\\nPasswordAuthentication yes\\n" | sudo tee /etc/ssh/sshd_config.d/60-hardening.conf > /dev/null; sudo sshd -T | grep -E "^(permitrootlogin|maxauthtries|passwordauthentication) "', 'permitrootlogin no\nmaxauthtries 3\npasswordauthentication no\n')
t('sudo sed -i "s/^#Port 22/Port 2222/" /etc/ssh/sshd_config; sudo sshd -T | grep ^port', 'port 2222\n')
t('sudo sed -i "s/^Port 2222/Port 22/" /etc/ssh/sshd_config; sudo sshd -T | grep ^listenaddress | head -1', 'listenaddress [::]:22\n')
t('echo "PermitRootLogin maybe" | sudo tee -a /etc/ssh/sshd_config.d/60-hardening.conf > /dev/null; sudo sshd -t', /60-hardening\.conf line 4: Bad PermitRootLogin argument: maybe\n\/etc\/ssh\/sshd_config: terminating, 1 bad configuration option/, 255)
t('sudo sed -i "/maybe/d" /etc/ssh/sshd_config.d/60-hardening.conf; echo "Bogus yes" | sudo tee -a /etc/ssh/sshd_config > /dev/null; sudo sshd -t', /\/etc\/ssh\/sshd_config: line \d+: Bad configuration option: Bogus/, 255)
t('sudo sed -i "/^Bogus/d" /etc/ssh/sshd_config; sudo sshd -t; echo "rc=$?"', 'rc=0\n')
t('sudo sshd -T | grep -c .', /^(3[0-9])\n$/)

// keys, ssh-copy-id, ssh
t('cat ~/.ssh/authorized_keys', /No such file or directory/, 1)
t('ssh-copy-id learner@localhost', /ERROR: No identities found/, 1)
t('ssh-keygen -t ed25519', /^Generating public\/private ed25519 key pair\.\n[\s\S]*Your public key has been saved in \/home\/learner\/\.ssh\/id_ed25519\.pub\nThe key fingerprint is:\nSHA256:[A-Za-z0-9+/]{43} learner@stackbox\nThe key's randomart image is:\n\+--\[ED25519 256\]--\+\n(\|.{17}\|\n){9}\+----\[SHA256\]-----\+\n$/)
t('ssh-keygen -t ed25519', /already exists\.\nOverwrite \(y\/n\)\? n/, 1)
t('cat ~/.ssh/id_ed25519.pub', /^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/]{43} learner@stackbox\n$/)
t('ls -l ~/.ssh/id_ed25519 | cut -c1-10', '-rw-------\n')
t('ls -ld ~/.ssh | cut -c1-10', 'drwx------\n')
t('head -1 ~/.ssh/id_ed25519', '-----BEGIN OPENSSH PRIVATE KEY-----\n')
t('ssh-keygen -l -f ~/.ssh/id_ed25519.pub', /^256 SHA256:[A-Za-z0-9+/]{43} learner@stackbox \(ED25519\)\n$/)
t('ssh-keygen -t rsa -f ~/.ssh/deploy -C deploy@stackbox -N "" | grep saved', /deploy\.pub/)
t('cut -d" " -f1,3 ~/.ssh/deploy.pub', 'ssh-rsa deploy@stackbox\n')
t('ssh learner@localhost', /^The authenticity of host 'localhost \(127\.0\.0\.1\)' can't be established\.[\s\S]*Permanently added 'localhost'[\s\S]*learner@localhost: Permission denied \(publickey\)\.\n$/, 255)
t('ssh-copy-id learner@localhost', /Permission denied \(publickey\)[\s\S]*cat \/home\/learner\/\.ssh\/id_ed25519\.pub >> ~\/\.ssh\/authorized_keys/, 1)
t('cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys; ssh learner@localhost', /^Welcome to Ubuntu 24\.04 LTS[\s\S]*Logged in to stackbox as learner with your ED25519 key ~\/\.ssh\/id_ed25519\./)
t('ssh localhost', /Logged in to stackbox as learner/)
t('ssh localhost uname -r', '6.8.0-45-generic\n')
t('ssh -i ~/.ssh/deploy learner@127.0.0.1', /Permission denied \(publickey\)/, 255)
t('ssh-copy-id learner@localhost', /All keys were skipped because they already exist/)
t('ssh root@localhost', 'root@localhost: Permission denied (publickey).\n', 255)
t('sudo sed -i "s/^PermitRootLogin no/PermitRootLogin yes/" /etc/ssh/sshd_config.d/60-hardening.conf; sudo mkdir -p /root/.ssh; cat ~/.ssh/id_ed25519.pub | sudo tee /root/.ssh/authorized_keys > /dev/null; ssh root@localhost | grep Logged', /Logged in to stackbox as root/)
t('ssh learner@example.com', /this terminal cannot open real network connections/, 255)
t('ssh learner@nope.invalid', /Could not resolve hostname nope\.invalid/, 255)
t('ssh-copy-id learner@192.168.64.9', /simulated[\s\S]*Number of key\(s\) added: 1/)
t('ssh', /^usage: ssh/, 255)
t('grep -c localhost ~/.ssh/known_hosts', '1\n')
if (!net().sshLogins.includes('learner@localhost') || !net().keyCopiedTo.includes('learner@192.168.64.9')) { fails++; console.log('FAIL ssh state not recorded', net().sshLogins, net().keyCopiedTo) }
// password logins once sshd allows them (drop-in order: 50-cloud-init still wins)
t('sudo rm /etc/ssh/sshd_config.d/50-cloud-init.conf; sudo sshd -T | grep ^passwordauthentication', 'passwordauthentication yes\n')
t('rm ~/.ssh/authorized_keys; ssh learner@localhost', /learner@localhost's password: \n[\s\S]*with your password \(simulated\)/)
t('ssh-copy-id learner@localhost', /Number of key\(s\) added: 1/)
t('cat ~/.ssh/authorized_keys | cut -d" " -f1', 'ssh-ed25519\n')

// fail2ban
t('fail2ban-client status', /not found, but can be installed with:\nsudo apt install fail2ban/, 127)
sh.vfs.writeFile('/var/log/auth.log', [
  'Sep 18 09:12:01 stackbox sshd[3011]: Failed password for root from 203.0.113.9 port 51022 ssh2',
  'Sep 18 09:12:04 stackbox sshd[3011]: Failed password for root from 203.0.113.9 port 51022 ssh2',
  'Sep 18 09:12:07 stackbox sshd[3013]: Invalid user admin from 203.0.113.9 port 51030',
  'Sep 18 09:12:09 stackbox sshd[3013]: Failed password for invalid user admin from 203.0.113.9 port 51030 ssh2',
  'Sep 18 09:12:12 stackbox sshd[3015]: Failed password for invalid user oracle from 203.0.113.9 port 51041 ssh2',
  'Sep 18 09:12:15 stackbox sshd[3017]: Failed password for invalid user test from 203.0.113.9 port 51050 ssh2',
  'Sep 18 09:13:40 stackbox sshd[3020]: Failed password for learner from 192.168.64.1 port 53410 ssh2',
  'Sep 18 09:13:44 stackbox sshd[3020]: Accepted publickey for learner from 192.168.64.1 port 53410 ssh2: ED25519 SHA256:abc',
].join('\n') + '\n', { owner: 'root', mode: 0o640 })
t('sudo apt install fail2ban | grep -c "Setting up fail2ban"', '1\n')
t('systemctl is-active fail2ban', 'active\n')
t('ls /etc/fail2ban | tr "\\n" " "', 'filter.d jail.conf jail.d ')
t('cat /etc/fail2ban/jail.d/defaults-debian.conf', '[sshd]\nenabled = true\n')
t('grep -E "^(bantime|maxretry|findtime)" /etc/fail2ban/jail.conf', 'bantime  = 10m\nfindtime  = 10m\nmaxretry = 5\n')
t('fail2ban-client status', /Permission denied to socket[\s\S]*you must be root/, 255)
t('sudo fail2ban-client status', 'Status\n|- Number of jail:\t1\n`- Jail list:\tsshd\n')
t('sudo fail2ban-client status sshd', 'Status for the jail: sshd\n|- Filter\n|  |- Currently failed:\t1\n|  |- Total failed:\t7\n|  `- File list:\t/var/log/auth.log\n`- Actions\n   |- Currently banned:\t1\n   |- Total banned:\t1\n   `- Banned IP list:\t203.0.113.9\n')
t('sudo fail2ban-client get sshd maxretry', '5\n')
t('printf "[DEFAULT]\\nbantime = 1h\\nmaxretry = 3\\n\\n[sshd]\\nenabled = true\\n" | sudo tee /etc/fail2ban/jail.local > /dev/null; sudo fail2ban-client reload', 'OK\n')
t('sudo fail2ban-client get sshd maxretry', '3\n')
t('sudo fail2ban-client get sshd bantime', '3600\n')
t('cat /etc/fail2ban/jail.local | grep -c enabled', '1\n')
t('sudo fail2ban-client set sshd banip 198.51.100.7', '1\n')
t('sudo fail2ban-client status sshd | tail -1', '   `- Banned IP list:\t203.0.113.9 198.51.100.7\n')
t('sudo fail2ban-client set sshd unbanip 203.0.113.9', '1\n')
t('sudo fail2ban-client get sshd banned', "['198.51.100.7']\n")
t('sudo fail2ban-client status nginx-http-auth', /does not exist/, 255)
t('printf "[nginx-http-auth]\\nenabled = true\\n" | sudo tee -a /etc/fail2ban/jail.local > /dev/null; sudo fail2ban-client status', 'Status\n|- Number of jail:\t2\n`- Jail list:\tsshd, nginx-http-auth\n')
t('sudo systemctl stop fail2ban; sudo fail2ban-client status', /Is fail2ban running\?/, 255)
t('sudo systemctl start fail2ban; sudo fail2ban-client ping', 'Server replied: pong\n')
t('fail2ban-client --version', '1.0.2\n')
if (!net().manualBans.includes('198.51.100.7')) { fails++; console.log('FAIL manual bans not in state') }

// apt knows the extra packages and the preinstalled ones
t('sudo apt install ufw | grep already', /ufw is already the newest version/)
t('sudo apt install traceroute | grep already', /traceroute is already the newest version \(1:2\.1\.3-1\)/)
t('sudo apt install dnsutils | grep -c "Setting up dnsutils"', '1\n')

// seeded net state from a task
const seeded = new Shell()
seeded.state.sims.net = { listening: [{ port: 5432, proto: 'tcp', proc: 'postgres', pid: 1520 }], firewall: { enabled: true, rules: [{ action: 'allow', direction: 'in', app: 'OpenSSH', v4: true, v6: true }] } }
const r1 = seeded.run('ss -tulpn | grep 5432').output
if (!/postgres/.test(r1)) { fails++; console.log('FAIL seeded listening socket', r1) }
const r2 = seeded.run('sudo ufw status').output
if (!/Status: active[\s\S]*OpenSSH\s+ALLOW\s+Anywhere/.test(r2)) { fails++; console.log('FAIL seeded firewall', r2) }
const r3 = seeded.run('curl -sS --max-time 1 http://192.168.64.5:5432').output
if (!/Timeout was reached/.test(r3)) { fails++; console.log('FAIL seeded firewall blocks 5432', r3) }
const r4 = seeded.run('curl -s http://localhost:5432').output
if (!/Hello from postgres/.test(r4)) { fails++; console.log('FAIL seeded local socket answers', r4) }

// unrelated lessons keep a lean machine: no /etc/ssh until something looks at /etc
const fresh = new Shell()
if (fresh.vfs.get('/etc/ssh')) { fails++; console.log('FAIL /etc/ssh seeded too early') }
fresh.run('ls -a')
if (fresh.vfs.get('/etc/ssh') || fresh.vfs.get('/home/learner/.ssh')) { fails++; console.log('FAIL ls seeded files it should not') }
fresh.run('ls /etc/ssh')
if (!fresh.vfs.get('/etc/ssh/sshd_config')) { fails++; console.log('FAIL /etc/ssh not seeded on demand') }

console.log(fails ? `${fails} FAILURES` : 'ALL NET SMOKE TESTS PASSED')
process.exit(fails ? 1 : 0)
