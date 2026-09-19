import type { Lesson } from '../types'
import { fileContent, ran, steps } from '../checks'
import { dockerInstalled, type DockerState } from '../../shell/sim/docker'

const lesson: Lesson = {
  id: 'w25d4',
  tier: 2,
  track: 'linux',
  week: 25,
  day: 4,
  title: 'Docker Compose with two services',
  concept: `Real apps are several containers: a web process, a database, maybe a cache. Typing docker run for each, with the right ports, volumes, and environment, gets old fast. Docker Compose reads one file, compose.yaml, and starts them all with docker compose up -d.

Each entry under services: is one container. image or build says where it comes from; ports, volumes, and environment map straight onto the run flags. depends_on orders the start. A shared network lets containers reach each other by service name: from web, the host db is the Postgres container. Named volumes under volumes: keep the database files between restarts.

Postgres is a preview of Tier 3. For now it only needs POSTGRES_PASSWORD, POSTGRES_USER, and POSTGRES_DB to start.`,
  example: {
    language: 'text',
    caption: 'compose.yaml: a web server and a database on one private network',
    code: `services:
  web:
    image: python:3.12-slim
    working_dir: /site
    command: python -m http.server 8000
    ports:
      - "8000:8000"
    volumes:
      - ./site:/site
    networks:
      - backend
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_USER: inventory
      POSTGRES_DB: inventory
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend
volumes:
  pgdata:
networks:
  backend:`,
  },
  task: {
    kind: 'shell',
    instructions: 'You are in ~/stack, which has a site/ folder with an index.html. Write compose.yaml in the editor, then drive the stack.\n1. Two services: web (image python:3.12-slim, working_dir /site, command python -m http.server 8000, port 8000:8000, volume ./site:/site, network backend, depends_on db) and db (image postgres:16, environment POSTGRES_PASSWORD, POSTGRES_USER and POSTGRES_DB, volume pgdata:/var/lib/postgresql/data, network backend). Declare pgdata under volumes: and backend under networks:.\n2. Start it: sudo docker compose up -d\n3. Check both are up: sudo docker compose ps\n4. Fetch the site: curl localhost:8000\n5. Ask the database its version: sudo docker compose exec db psql -U inventory -c "SELECT version();"\n6. Show that web can find db by name: sudo docker compose exec web getent hosts db\n7. Tear it down: sudo docker compose down',
    seed: { '/home/learner/stack/site/index.html': '<h1>Stackcraft stack</h1>\n' },
    cwd: '/home/learner/stack',
    file: '/home/learner/stack/compose.yaml',
    starter: 'services:\n  web:\n    # image, working_dir, command, ports, volumes, networks, depends_on\n\n  db:\n    # image, environment, volumes, networks\n\nvolumes:\n  # named volume for postgres\n\nnetworks:\n  # the shared network\n',
    machine: { sims: { docker: dockerInstalled() } },
    hints: ['YAML cares about indentation: two spaces per level, and list items start with a dash.', 'The example above is a complete file. Ports need quotes: - "8000:8000".', 'Step 5: -U inventory matches POSTGRES_USER. Without it psql tries the user root, which does not exist.', 'getent hosts db prints the IP Compose gave the db container; that lookup works because both services share the backend network.'],
    solution: {
      file: 'services:\n  web:\n    image: python:3.12-slim\n    working_dir: /site\n    command: python -m http.server 8000\n    ports:\n      - "8000:8000"\n    volumes:\n      - ./site:/site\n    networks:\n      - backend\n    depends_on:\n      - db\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: secret\n      POSTGRES_USER: inventory\n      POSTGRES_DB: inventory\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    networks:\n      - backend\nvolumes:\n  pgdata:\nnetworks:\n  backend:\n',
      commands: ['sudo docker compose up -d', 'sudo docker compose ps', 'curl localhost:8000', 'sudo docker compose exec db psql -U inventory -c "SELECT version();"', 'sudo docker compose exec web getent hosts db', 'sudo docker compose down'],
    },
    check: (r) => {
      const y = fileContent(r, '/home/learner/stack/compose.yaml') ?? ''
      const d = r.state?.sims?.docker as DockerState | undefined
      const h = r.history ?? []
      const o = r.outputs ?? []
      const upIdx = h.findIndex((c, i) => /docker\s+compose\s+up\b/.test(c) && /Container stack-db-1\s+Started/.test(o[i] ?? '') && /Container stack-web-1\s+Started/.test(o[i] ?? ''))
      const after = (re: RegExp, out: RegExp) => h.some((c, i) => i > upIdx && re.test(c) && out.test(o[i] ?? ''))
      const downIdx = h.findIndex((c, i) => i > upIdx && /docker\s+compose\s+down\b/.test(c) && /Removed/.test(o[i] ?? ''))
      return steps([
        [/^\s+web:\s*$/m.test(y) && /^\s+db:\s*$/m.test(y), 'Step 1: compose.yaml needs a web: and a db: service under services:.'],
        [/image:\s*python:3\.12-slim/.test(y) && /working_dir:\s*\/site/.test(y) && /command:\s*python3?\s+-m\s+http\.server\s+8000/.test(y) && /-\s*["']?8000:8000["']?/.test(y) && /-\s*\.\/site:\/site/.test(y), 'Step 1: web needs image python:3.12-slim, working_dir /site, command python -m http.server 8000, port "8000:8000", and volume ./site:/site.'],
        [/image:\s*postgres:16/.test(y) && /POSTGRES_PASSWORD/.test(y) && /POSTGRES_USER/.test(y) && /POSTGRES_DB/.test(y) && /-\s*pgdata:\/var\/lib\/postgresql\/data/.test(y), 'Step 1: db needs image postgres:16, the three POSTGRES_ variables, and volume pgdata:/var/lib/postgresql/data.'],
        [(y.match(/^\s+-\s*backend\s*$/gm) ?? []).length >= 2 && /^networks:\s*$/m.test(y) && /^\s+backend:\s*$/m.test(y) && /^volumes:\s*$/m.test(y) && /^\s+pgdata:\s*$/m.test(y) && /depends_on:\s*\n\s+-\s*db/.test(y), 'Step 1: both services join the backend network, web depends_on db, and pgdata and backend are declared at the bottom.'],
        [upIdx >= 0, 'Step 2: sudo docker compose up -d should report both containers Started. If it errors, read the message and fix the YAML.'],
        [after(/docker\s+compose\s+ps\b/, /stack-web-1[\s\S]*Up|stack-db-1[\s\S]*Up/), 'Step 3: sudo docker compose ps should show both containers Up.'],
        [after(/curl\s+.*localhost:8000/, /index\.html|Stackcraft stack/), 'Step 4: curl localhost:8000 should reach the web container.'],
        [after(/docker\s+compose\s+exec\s+db\s+psql\s+-U\s+inventory/, /PostgreSQL 16/), 'Step 5: sudo docker compose exec db psql -U inventory -c "SELECT version();"'],
        [after(/docker\s+compose\s+exec\s+web\s+getent\s+hosts\s+db/, /^\d+\.\d+\.\d+\.\d+\s+db/m), 'Step 6: sudo docker compose exec web getent hosts db should print an IP next to db.'],
        [downIdx >= 0 && !(d?.containers.some((c) => c.project === 'stack')) && ran(r, /compose\s+down/), 'Step 7: sudo docker compose down removes the containers and the network.'],
      ], 'Two services, one file, one command. In Tier 3 the db service becomes a real database for your apps.')
    },
  },
  quiz: [
    { question: 'How does the web container reach the database?', options: ['By the host name db, because both services share a network', 'By localhost:5432', 'It cannot; containers are isolated'], answer: 0, explanation: 'Compose registers each service name in an internal DNS on the shared network.' },
    { question: 'What is the difference between ./site:/site and pgdata:/var/lib/postgresql/data?', options: ['None, both are bind mounts', 'The first mounts a host folder; the second is a named volume Docker manages', 'The second is read-only'], answer: 1, explanation: 'A path source is a bind mount; a bare name is a named volume declared under volumes:.' },
    { question: 'What does docker compose down remove?', options: ['Only stopped containers', 'The project containers and network (volumes stay unless you pass -v)', 'The images too'], answer: 1, explanation: 'down is the mirror of up. Data volumes survive so a later up finds the database intact.' },
  ],
}

export default lesson
