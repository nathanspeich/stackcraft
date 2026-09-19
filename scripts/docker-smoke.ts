// Smoke test for the Docker simulation module (src/shell/sim/docker.ts).
import { Shell } from '../src/shell/shell'
import type { DockerState } from '../src/shell/sim/docker'

const sh = new Shell()
const INVENTORY = 'import argparse, json, os\nfrom dataclasses import dataclass, asdict\nfrom pathlib import Path\n\n@dataclass\nclass Item:\n    name: str\n    quantity: int\n\nclass Inventory:\n    def __init__(self, path):\n        self.path = Path(path)\n        self.items = []\n        if self.path.exists():\n            self.items = [Item(**d) for d in json.loads(self.path.read_text())]\n\n    def save(self):\n        self.path.write_text(json.dumps([asdict(i) for i in self.items], indent=2))\n\ndef main():\n    parser = argparse.ArgumentParser(description="Tiny inventory tool")\n    parser.add_argument("--file", default=os.environ.get("INVENTORY_FILE", "inventory.json"))\n    sub = parser.add_subparsers(dest="command", required=True)\n    p_add = sub.add_parser("add"); p_add.add_argument("name"); p_add.add_argument("quantity", type=int)\n    sub.add_parser("list")\n    args = parser.parse_args()\n\nif __name__ == "__main__":\n    main()\n'
sh.seed({
  '/home/learner/inventory/inventory.py': INVENTORY,
  '/home/learner/inventory/Dockerfile': 'FROM python:3.12-slim\nWORKDIR /app\nCOPY inventory.py .\nENTRYPOINT ["python", "inventory.py", "--file", "/data/inventory.json"]\nCMD ["list"]\n',
  '/home/learner/inventory/bad/Dockerfile': 'FROM python:3.12-slim\nWORKDIR /app\nCOPY missing.py .\nCMD ["python", "missing.py"]\n',
  '/home/learner/inventory/nofrom/Dockerfile': 'WORKDIR /app\nCOPY inventory.py .\n',
  '/home/learner/stack/compose.yaml': 'services:\n  web:\n    image: python:3.12-slim\n    working_dir: /site\n    command: python -m http.server 8000\n    ports:\n      - "8000:8000"\n    volumes:\n      - ./site:/site\n    networks:\n      - backend\n    depends_on:\n      - db\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: secret\n      POSTGRES_USER: inventory\n      POSTGRES_DB: inventory\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    networks:\n      - backend\nvolumes:\n  pgdata:\nnetworks:\n  backend:\n',
  '/home/learner/stack/site/index.html': '<h1>hi</h1>\n',
})
let fails = 0
const t = (cmd: string, expect: string | RegExp, code?: number) => {
  let out: string
  let rc = 0
  try { const r = sh.run(cmd); out = r.output; rc = r.code } catch (e) { out = 'THROW ' + (e as Error).message + '\n' + (e as Error).stack }
  const pass = (typeof expect === 'string' ? out === expect : expect.test(out)) && (code === undefined || code === rc)
  if (!pass) { fails++; console.log(`FAIL ${JSON.stringify(cmd)}\n  got (${rc}): ${JSON.stringify(out.slice(0, 600))}\n  want: ${expect}${code !== undefined ? ' code ' + code : ''}`) }
}
const docker = () => sh.state.sims.docker as DockerState

// Before installation
t('docker --version', 'docker: command not found\n', 127)
t('docker ps', /command not found/, 127)
// Install through apt
t('sudo apt install docker.io', /Setting up docker\.io[\s\S]*Adding group `docker'/)
t('grep docker /etc/group', /^docker:x:999:/)
t('systemctl is-active docker', 'active\n')
t('docker --version', /^Docker version \d+\.\d+\.\d+, build [0-9a-f]+\n$/)
t('docker ps', /permission denied while trying to connect to the Docker daemon socket/, 1)
t('sudo docker ps', 'CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES\n')
t('sudo docker version', /Client:[\s\S]*Server: Docker Engine - Community/)
// hello-world
t('sudo docker run hello-world', /Unable to find image 'hello-world:latest' locally\nlatest: Pulling from library\/hello-world\n[0-9a-f]{12}: Pull complete\nDigest: sha256:[0-9a-f]{64}\nStatus: Downloaded newer image for hello-world:latest\n\nHello from Docker!\nThis message shows that your installation appears to be working correctly\./)
t('sudo docker images', /REPOSITORY    TAG       IMAGE ID       CREATED[ ]+SIZE\nhello-world   latest    [0-9a-f]{12}   \d+ months ago   13\.3kB\n/)
t('sudo docker ps -a', /hello-world   "\/hello"   \d+ seconds? ago   Exited \(0\) \d+ seconds? ago             \w+_\w+\n/)
t('sudo docker run hello-world | head -1', 'Hello from Docker!\n')
// foreground runs of known images
t('sudo docker run alpine echo hi', /Unable to find image 'alpine:latest' locally[\s\S]*Status: Downloaded newer image for alpine:latest\n\nhi\n$/)
t('sudo docker run --rm alpine echo hi', 'hi\n')
t('sudo docker run --rm python:3.12-slim python --version', /Status: Downloaded newer image for python:3\.12-slim\n\nPython 3\.12\.\d+\n$/)
t('sudo docker run --rm ubuntu cat /etc/os-release | head -1', /PRETTY_NAME="Ubuntu 24\.04/)
t('sudo docker run --rm alpine sh -c "echo one && echo two"', 'one\ntwo\n')
t('sudo docker run --rm -v "$PWD/notes:/notes" alpine sh -c "echo hello > /notes/hi.txt" && cat notes/hi.txt', 'hello\n')
t('sudo docker run --rm alpine ls /', /bin  dev  etc  home  lib/)
t('sudo docker run --rm alpine uname -a', /^Linux [0-9a-f]{12} 6\.8/)
t('sudo docker run --rm alpine nope', /executable file not found in \$PATH/, 125)
t('sudo docker run --rm -e GREETING=hello alpine env', /GREETING=hello/)
t('sudo docker run --rm nosuchimage', /pull access denied for nosuchimage/, 125)
t('sudo docker run --rm python:3.99 python', /manifest for python:3\.99 not found/, 125)
t('sudo docker pull nginx', /latest: Pulling from library\/nginx\n[\s\S]*Status: Downloaded newer image for nginx:latest\ndocker\.io\/library\/nginx:latest\n$/)
t('sudo docker pull nginx', /Status: Image is up to date for nginx:latest/)
// detached run, ports, exec, logs, stop, rm
t('sudo docker run -d -p 8080:80 --name web nginx', /^[0-9a-f]{64}\n$/)
t('sudo docker ps', /[0-9a-f]{12}   nginx     "\/docker-entrypoint\.…"   \d+ seconds? ago   Up \d+ seconds?   0\.0\.0\.0:8080->80\/tcp, \[::\]:8080->80\/tcp   web\n/)
t('sudo docker run -d -p 8080:80 --name web2 nginx', /Bind for 0\.0\.0\.0:8080 failed: port is already allocated/, 125)
t('sudo docker run -d --name web nginx', /The container name "\/web" is already in use/, 125)
t('curl localhost:8080 | grep -c nginx', /[1-9]/)
t('curl -I localhost:8080 | head -1', 'HTTP/1.1 200 OK\n')
t('sudo docker logs web | tail -1', /GET \/ HTTP\/1\.1" 200/)
t('sudo docker logs web | head -1', '/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration\n')
t('sudo docker exec web nginx -v', 'nginx version: nginx/1.27.2\n')
t('sudo docker exec web cat /usr/share/nginx/html/index.html | grep -c Welcome', '2\n')
t('sudo docker exec web ls /etc/nginx', 'conf.d  nginx.conf\n')
t('sudo docker exec web nope', /executable file not found/, 127)
t('sudo docker exec -it web bash', /root@[0-9a-f]{12}:\/# exit/)
t('sudo docker inspect -f "{{.State.Status}}" web', 'running\n')
t('sudo docker inspect web | grep -c \'"Name": "/web"\'', '1\n')
t('sudo docker port web', '80/tcp -> 0.0.0.0:8080\n80/tcp -> [::]:8080\n')
t('sudo docker rm web', /container is running: stop the container before removing/, 1)
t('sudo docker stop web', 'web\n')
t('sudo docker ps', 'CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES\n')
t('sudo docker ps -a | grep web', /Exited \(0\)/)
t('curl localhost:8080', /Failed to connect to localhost port 8080/, 7)
t('sudo docker start web && sudo docker inspect -f "{{.State.Running}}" web', 'web\ntrue\n')
t('sudo docker restart web', 'web\n')
t('sudo docker rm -f web', 'web\n')
t('sudo docker ps -a | grep -c web', '0\n', 1)
t('sudo docker rmi nginx', /^Untagged: nginx:latest\nDeleted: sha256:[0-9a-f]{64}\n$/)
t('sudo docker rmi nginx', /No such image: nginx:latest/, 1)
// postgres needs a password
t('sudo docker run -d --name db postgres:16', /Status: Downloaded newer image for postgres:16\n\n[0-9a-f]{64}\n$/)
t('sudo docker ps -a | grep db', /Exited \(1\)/)
t('sudo docker logs db | head -1', 'Error: Database is uninitialized and superuser password is not specified.\n')
t('sudo docker rm db', 'db\n')
t('sudo docker run -d --name db -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data postgres:16', /^[0-9a-f]{64}\n$/)
t('sudo docker ps | grep db', /Up \d+ seconds?   5432\/tcp   db/)
t('sudo docker logs db | tail -1', /database system is ready to accept connections/)
t('sudo docker exec db psql -U postgres -c "SELECT version();"', /PostgreSQL 16\.4[\s\S]*\(1 row\)/)
t('sudo docker volume ls', 'DRIVER    VOLUME NAME\nlocal     pgdata\n')
t('sudo docker volume rm pgdata', /volume is in use/, 1)
t('sudo docker rm -f db && sudo docker volume rm pgdata', 'db\npgdata\n')
t('sudo docker volume create appdata', 'appdata\n')
t('sudo docker network ls', /NETWORK ID     NAME      DRIVER    SCOPE\n[0-9a-f]{12}   bridge    bridge    local\n[0-9a-f]{12}   host      host      local\n[0-9a-f]{12}   none      null      local\n/)
t('sudo docker network create appnet', /^[0-9a-f]{64}\n$/)
t('sudo docker network ls | grep -c appnet', '1\n')
// build
t('cd inventory && sudo docker build -t inventory .', /\[\+\] Building [\d.]+s \(\d+\/\d+\) FINISHED[\s\S]* => \[1\/3\] FROM docker\.io\/library\/python:3\.12-slim[\s\S]* => \[2\/3\] WORKDIR \/app[\s\S]* => \[3\/3\] COPY inventory\.py \.[\s\S]* => => naming to docker\.io\/library\/inventory:latest/)
t('sudo docker images | grep inventory', /^inventory     latest      [0-9a-f]{12}   \d+ seconds? ago\s+1\d\dMB\n$/)
t('sudo docker build -t bad bad', /ERROR \[3\/3\] COPY missing\.py \.[\s\S]*3 \| >>> COPY missing\.py \.[\s\S]*"\/missing\.py": not found/, 1)
t('sudo docker build -t nofrom nofrom', /no build stage in current context/, 1)
t('sudo docker build -t nodir nodir', /path "nodir" not found/, 1)
t('mkdir empty && sudo docker build -t empty empty', /failed to read dockerfile: open Dockerfile: no such file or directory/, 1)
t('sudo docker build -t Bad .', /repository name must be lowercase/, 1)
t('sudo docker history inventory | grep -c COPY', '1\n')
// run the built image with a volume
t('sudo docker run --rm inventory', '0 item(s)\n')
t('sudo docker run --rm -v "$PWD/data:/data" inventory add Widget 3', 'added Widget x3\n')
t('sudo docker run --rm -v "$PWD/data:/data" inventory add Gadget 5', 'added Gadget x5\n')
t('sudo docker run --rm -v "$PWD/data:/data" inventory', 'Gadget x5\nWidget x3\n2 item(s)\n')
t('sudo docker run --rm -v "$PWD/data:/data" inventory list', 'Gadget x5\nWidget x3\n2 item(s)\n')
t('cat data/inventory.json', '[\n  {\n    "name": "Gadget",\n    "qty": 5\n  },\n  {\n    "name": "Widget",\n    "qty": 3\n  }\n]\n')
t('sudo docker run --rm -v "$PWD/data:/data" inventory remove Widget && cat data/inventory.json | grep -c Widget', 'removed Widget\n0\n', 1)
t('sudo docker run --rm inventory bogus', /invalid choice: 'bogus'/, 2)
t('sudo docker run --rm --entrypoint ls inventory /app', 'inventory.py\n')
t('sudo docker run --rm -v appdata:/data inventory add Bolt 9 && sudo docker run --rm -v appdata:/data inventory', 'added Bolt x9\nBolt x9\n1 item(s)\n')
t('sudo docker run --rm inventory python -c "print(1)"', /invalid choice: 'python'/, 2)
t('sudo docker run --rm python:3.12-slim python missing.py', /can't open file '\/missing\.py': \[Errno 2\]/, 2)
t('sudo docker run --rm -v "$PWD:/app" -w /app python:3.12-slim python inventory.py --file /app/data/inventory.json list', 'Gadget x5\n1 item(s)\n')
// compose
t('cd ~/stack && sudo docker compose up -d', /^\[\+\] Running 4\/4\n \u2714 Network stack_backend\s+Created[\s\S]*\u2714 Volume "stack_pgdata"\s+Created[\s\S]*\u2714 Container stack-db-1\s+Started[\s\S]*\u2714 Container stack-web-1\s+Started/)
t('sudo docker compose ps', /NAME          IMAGE              COMMAND                  SERVICE   CREATED[ ]+STATUS[ ]+PORTS\nstack-db-1    postgres:16        "docker-entrypoint.s…"   db        \d+ seconds? ago   Up \d+ seconds?   5432\/tcp\nstack-web-1   python:3\.12-slim   "python -m http\.serv…"   web       \d+ seconds? ago   Up \d+ seconds?   0\.0\.0\.0:8000->8000\/tcp, \[::\]:8000->8000\/tcp\n/)
t('curl -s localhost:8000 | grep index', '<li><a href="index.html">index.html</a></li>\n')
t('sudo docker compose exec web getent hosts db', /^172\.\d+\.0\.\d+\s+db\n$/)
t('sudo docker compose exec db psql -U inventory -c "SELECT 1 AS ok;"', / ok\n----\n  1\n\(1 row\)\n/)
t('sudo docker compose exec db pg_isready', '/var/run/postgresql:5432 - accepting connections\n')
t('sudo docker compose logs db | tail -1', /^db-1  \| .*ready to accept connections\n$/)
t('sudo docker compose logs web', /^web-1  \| Serving HTTP on 0\.0\.0\.0 port 8000/)
t('sudo docker network ls | grep -c stack_backend', '1\n')
t('sudo docker volume ls | grep -c stack_pgdata', '1\n')
t('sudo docker compose up -d', /Container stack-db-1\s+Running[\s\S]*Container stack-web-1\s+Running/)
t('sudo docker compose stop', /Container stack-web-1\s+Stopped[\s\S]*Container stack-db-1\s+Stopped/)
t('sudo docker compose ps', /^NAME      IMAGE     COMMAND   SERVICE   CREATED   STATUS    PORTS\n$/)
t('sudo docker compose ps -a | grep -c Exited', '2\n')
t('sudo docker compose start', /Started/)
t('sudo docker compose down', /Container stack-web-1\s+Removed[\s\S]*Container stack-db-1\s+Removed[\s\S]*Network stack_backend\s+Removed/)
t('sudo docker compose down -v', /Volume stack_pgdata\s+Removed/)
t('sudo docker ps -a | grep -c stack', '0\n', 1)
t('cd ~ && sudo docker compose up', 'no configuration file provided: not found\n', 1)
t('cd ~/inventory && printf "services:\\n  app:\\n    build: .\\n    volumes:\\n      - ./data:/data\\n" > compose.yaml && sudo docker compose up', /naming to docker\.io\/library\/inventory-app[\s\S]*Container inventory-app-1  Started[\s\S]*Attaching to app-1\napp-1  \| Gadget x5/)
t('sudo docker compose ps -a | grep app', /inventory-app-1   inventory-app.*Exited \(0\)/)
t('sudo docker compose down >/dev/null 2>&1; sudo docker ps -a | grep -c inventory-app', /0/)
// get.docker.com route on a fresh machine
const sh2 = new Shell()
const t2 = (cmd: string, expect: RegExp) => { const out = sh2.run(cmd).output; if (!expect.test(out)) { fails++; console.log(`FAIL ${JSON.stringify(cmd)}\n  got: ${JSON.stringify(out.slice(0, 400))}\n  want: ${expect}`) } }
t2('docker ps', /command not found/)
t2('curl -fsSL https://get.docker.com | sh', /# Executing docker install script[\s\S]*apt-get -y -qq install docker-ce[\s\S]*Server: Docker Engine - Community[\s\S]*rootless mode/)
t2('sudo docker run --rm hello-world | head -1', /Hello from Docker!/)
t2('curl -fsSL https://get.docker.com -o get-docker.sh && head -1 get-docker.sh', /#!\/bin\/sh/)
// state is visible to checkers
const st = docker()
if (!st.installed || !st.images.some((i) => i.repo === 'inventory')) { fails++; console.log('FAIL state', JSON.stringify({ installed: st.installed, images: st.images.map((i) => i.repo) })) }
const snap = sh.snapshotForChecker()
if (!(snap.state.sims.docker as DockerState).installed) { fails++; console.log('FAIL snapshot state') }

console.log(fails ? `${fails} FAILURES` : 'ALL DOCKER SMOKE TESTS PASSED')
process.exit(fails ? 1 : 0)
