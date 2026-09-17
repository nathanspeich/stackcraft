import type { Tier, Track } from './types'

export interface WeekPlan {
  week: number
  tier: Tier
  track: Track
  title: string
  /** Five day titles. In Tiers 2 and 3, day 5 is a real-machine project. */
  days: [string, string, string, string, string]
}

export const TRACK_LABEL: Record<Track, string> = {
  linux: 'Linux',
  python: 'Python',
  sql: 'SQL',
  capstone: 'Capstone',
}

export const TIER_LABEL: Record<Tier, string> = {
  1: 'Foundations',
  2: 'Intermediate',
  3: 'Advanced',
}

export const TIER_WEEKS: Record<Tier, [number, number]> = {
  1: [1, 12],
  2: [13, 28],
  3: [29, 44],
}

const w = (week: number, tier: Tier, track: Track, title: string, days: WeekPlan['days']): WeekPlan => ({
  week, tier, track, title, days,
})

export const CURRICULUM: WeekPlan[] = [
  // Tier 1 Foundations
  w(1, 1, 'linux', 'Meet the terminal', [
    'Terminal orientation and navigation',
    'Files and directories',
    'Reading files: cat, less, head, tail, wc',
    'Getting help: man, --help, which',
    'Absolute vs relative paths and PATH',
  ]),
  w(2, 1, 'linux', 'Own your files', [
    'Permissions and chmod',
    'Users and sudo',
    'Finding things: find and grep',
    'Pipes and redirection',
    'Text tools: sort, uniq, cut, tr, sed basics',
  ]),
  w(3, 1, 'python', 'First Python', [
    'Setup and print',
    'Variables and types with f-strings',
    'Strings',
    'Numbers and input',
    'Conditionals',
  ]),
  w(4, 1, 'python', 'Collections and functions', [
    'Lists',
    'Loops',
    'Dictionaries',
    'Functions',
    'Tuples, sets, list comprehensions',
  ]),
  w(5, 1, 'sql', 'Talk to a database', [
    'What a database is, SQLite basics',
    'CREATE TABLE and INSERT',
    'SELECT, WHERE, ORDER BY, LIMIT',
    'UPDATE and DELETE safely',
    'Filtering: AND, OR, IN, BETWEEN, LIKE, NULL',
  ]),
  w(6, 1, 'linux', 'Inside the machine', [
    'Processes: ps, top, kill, jobs',
    'System info: df, du, free, uname',
    'Package managers: apt',
    'Networking basics: ip, ping, curl, ss',
    'SSH and scp',
  ]),
  w(7, 1, 'python', 'Python that does work', [
    'Reading and writing files',
    'Errors and try/except',
    'Modules and the standard library',
    'Virtual environments and pip',
    'Command-line scripts with argparse',
  ]),
  w(8, 1, 'sql', 'Joining the dots', [
    'Aggregates',
    'GROUP BY and HAVING',
    'Primary and foreign keys',
    'INNER JOIN',
    'LEFT JOIN and multi-table joins',
  ]),
  w(9, 1, 'python', 'Real programs', [
    'Classes',
    'JSON and CSV',
    'subprocess and OS automation',
    'Calling an HTTP API',
    'Mini project: a log parser CLI',
  ]),
  w(10, 1, 'sql', 'Deeper SQL', [
    'Subqueries',
    'Indexes and EXPLAIN',
    'Constraints and ALTER TABLE',
    'Transactions',
    'Python plus sqlite3',
  ]),
  w(11, 1, 'linux', 'Automate the box', [
    'Environment variables and .bashrc',
    'Bash scripting basics',
    'Loops, functions, exit codes',
    'cron and systemd',
    'Logs and troubleshooting',
  ]),
  w(12, 1, 'capstone', 'Server health report', [
    'Bash script gathers system info',
    'Python parses it into SQLite',
    'SQL queries produce the report',
    'Review day',
    'What to learn next',
  ]),

  // Tier 2 Intermediate
  w(13, 2, 'linux', 'Real bash scripting', [
    'Setup check and script structure',
    'Arguments, getopts, usage, exit codes, functions',
    'Conditionals, loops, case, arrays, substitution, arithmetic',
    'Input, here-docs, traps, temp files, debugging',
    'Project: backup.sh',
  ]),
  w(14, 2, 'python', 'OOP in practice', [
    'Classes review, __init__, __repr__ and __str__',
    'Dataclasses',
    'Inheritance vs composition',
    'Properties, class and static methods, dunders',
    'Project: inventory.py',
  ]),
  w(15, 2, 'sql', 'CTEs', [
    'The WITH clause',
    'Chaining several CTEs',
    'Recursive CTEs',
    'CTEs vs subqueries vs views',
    'Project: org chart with a recursive CTE',
  ]),
  w(16, 2, 'linux', 'Users and permissions in depth', [
    '/etc/passwd, /etc/group, useradd, usermod, id',
    'Octal permissions and umask',
    'setuid, setgid, sticky bit',
    'sudoers, least privilege, ACLs',
    'Project: a shared team folder and a sudo rule',
  ]),
  w(17, 2, 'python', 'Testing with pytest', [
    'Why tests, plain assert, how pytest finds tests',
    'Fixtures and parametrize',
    'pytest.raises, tmp_path, monkeypatch',
    'Organizing tests, coverage, red-green-refactor',
    'Project: tests for inventory.py',
  ]),
  w(18, 2, 'sql', 'Window functions', [
    'OVER, ROW_NUMBER, RANK, DENSE_RANK',
    'PARTITION BY',
    'Running totals and frame clauses',
    'LAG, LEAD, NTILE, FIRST_VALUE',
    'Project: sales.db analytics',
  ]),
  w(19, 2, 'linux', 'systemd services', [
    'Units, systemctl, journalctl',
    'Writing a unit file',
    'Timers as the modern cron',
    'Environment files, user services, dependencies',
    'Project: backup.service and backup.timer',
  ]),
  w(20, 2, 'python', 'Logging', [
    'print vs logging and the five levels',
    'Formatters and handlers',
    'dictConfig and per-module loggers',
    'Rotating files and logging exceptions',
    'Project: logging in inventory.py',
  ]),
  w(21, 2, 'sql', 'Schema design and normalization', [
    'Entities, attributes, relationships',
    'First, second, and third normal form',
    'Many-to-many with junction tables',
    'Naming, types, NOT NULL, defaults',
    'Project: a recipe app schema',
  ]),
  w(22, 2, 'linux', 'Networking and firewalls', [
    'IPs, ports, DNS, ip addr, ss',
    'curl in depth, /etc/hosts, dig, traceroute',
    'Firewalls with ufw and nftables',
    'SSH server settings and fail2ban',
    'Project: serve a folder behind ufw',
  ]),
  w(23, 2, 'python', 'Working with APIs', [
    'HTTP basics, requests, status codes',
    'JSON, query parameters, headers, tokens',
    'Pagination, rate limits, timeouts, retries',
    'A client class with a disk cache',
    'Project: a GitHub or weather CLI',
  ]),
  w(24, 2, 'sql', 'Views', [
    'CREATE VIEW and why views exist',
    'Views for reporting, views on views',
    'Updatable views and their limits',
    'Triggers and restricting what an app sees',
    'Project: reporting views in sales.db',
  ]),
  w(25, 2, 'linux', 'Docker basics', [
    'What a container is, installing Docker',
    'docker run flags, exec, logs',
    'A Dockerfile for inventory.py',
    'Docker Compose with two services',
    'Project: containerize inventory.py',
  ]),
  w(26, 2, 'python', 'Packaging', [
    'Modules, packages, imports',
    'pyproject.toml, wheels, entry points',
    'venv, pip install -e, requirements vs lock files',
    'pipx, versioning, TestPyPI',
    'Project: the inventory package',
  ]),
  w(27, 2, 'sql', 'Indexes and query tuning', [
    'B-tree indexes and EXPLAIN QUERY PLAN',
    'Composite, column order, covering indexes',
    'When indexes hurt, ANALYZE',
    'Rewriting slow queries',
    'Project: one million rows and the right index',
  ]),
  w(28, 2, 'python', 'Async basics', [
    'The event loop, async and await',
    'asyncio.gather and tasks',
    'An async HTTP client with httpx',
    'When async is the wrong tool',
    'Project: an async URL checker',
  ]),

  // Tier 3 Advanced
  w(29, 3, 'python', 'Type hints and mypy', [
    'Basic annotations',
    'Optional, Union, generics, TypedDict',
    'Protocol, TypeVar, Callable',
    'mypy setup and strict mode',
    'Project: mypy --strict on inventory',
  ]),
  w(30, 3, 'linux', 'Server hardening', [
    'Threat model and unattended-upgrades',
    'SSH lockdown and fail2ban',
    'Firewall review, unused services, lynis',
    'sudo logging, auditd, secrets, backups',
    'Project: harden the box',
  ]),
  w(31, 3, 'sql', 'PostgreSQL', [
    'Postgres vs SQLite, Postgres in Docker',
    'psql, roles, databases, URLs',
    'Postgres types and RETURNING',
    'pg_dump, restore, psycopg',
    'Project: inventory on Postgres',
  ]),
  w(32, 3, 'python', 'Concurrency', [
    'Threads vs processes vs async, the GIL',
    'ThreadPoolExecutor',
    'multiprocessing and Pool',
    'Queues, locks, race conditions',
    'Project: a log processor three ways',
  ]),
  w(33, 3, 'linux', 'Monitoring', [
    'What to watch: htop, vmstat, iostat, uptime',
    'journald in depth and logrotate',
    'Prometheus and node_exporter in Docker',
    'Grafana dashboards and alerts',
    'Project: a monitoring stack',
  ]),
  w(34, 3, 'sql', 'Migrations', [
    'Why schema changes need version control',
    'Hand-written up and down files',
    'Alembic setup with autogenerate',
    'Safe migrations',
    'Project: Alembic for inventory',
  ]),
  w(35, 3, 'python', 'CI with GitHub Actions', [
    'git recap, branches, pull requests',
    'A workflow that runs pytest',
    'Matrix, caching, ruff and mypy',
    'Artifacts, badges, secrets, releases',
    'Project: inventory with working CI',
  ]),
  w(36, 3, 'linux', 'Ansible automation', [
    'Inventory, ad hoc commands, ping',
    'Playbooks, tasks, core modules',
    'Variables, templates, handlers',
    'Roles, idempotency, check mode, Vault',
    'Project: a hardening playbook',
  ]),
  w(37, 3, 'sql', 'Data modeling for a real app', [
    'Requirements to entities',
    'Keys, constraints, enums, soft deletes',
    'Audit columns and jsonb',
    'Access patterns and seed data',
    'Project: the capstone schema',
  ]),
  w(38, 3, 'python', 'Build a complete tool', [
    'Choose the shape and write a scope',
    'Layout, settings, data access layer',
    'Endpoints with validation and errors',
    'Tests, types, packaging, README',
    'Project: Statuscraft v0.1',
  ]),
  w(39, 3, 'linux', 'Troubleshooting drills', [
    'A method, and the disk-full drill',
    'Service-will-not-start drill',
    'Network drills',
    'Timer, permission, OOM, dmesg drills',
    'Project: fix four faults',
  ]),
  w(40, 3, 'sql', 'Performance analysis', [
    'EXPLAIN ANALYZE and plan trees',
    'Index types and pg_stat_statements',
    'VACUUM, bloat, statistics',
    'Pooling, slow query log, pgbench',
    'Project: fix the two slowest queries',
  ]),
  w(41, 3, 'capstone', 'Statuscraft: plan and provision', [
    'Scope and architecture README',
    'Provision the box with Ansible',
    'Postgres with Compose and migrations',
    'The collector script',
    'Collector on a systemd timer',
  ]),
  w(42, 3, 'capstone', 'Statuscraft: build the app', [
    '/status endpoint',
    'HTML status page',
    '/alerts and the down rule',
    'Types, ruff, Dockerfile',
    'CI tests and builds the image',
  ]),
  w(43, 3, 'capstone', 'Statuscraft: deploy and monitor', [
    'Full stack with Compose',
    'Caddy with HTTPS',
    'Grafana dashboard',
    'Nightly backup with restore test',
    'Runbook',
  ]),
  w(44, 3, 'capstone', 'Statuscraft: harden, drill, ship', [
    'Hardening playbook and lynis',
    'Capstone troubleshooting drill',
    'Tag v1.0.0 and release',
    'Review day',
    'What to learn next',
  ]),
]

export const lessonId = (week: number, day: number) => `w${String(week).padStart(2, '0')}d${day}`

export const weekPlan = (week: number) => CURRICULUM.find((p) => p.week === week)

export const tierWeeks = (tier: Tier) => CURRICULUM.filter((p) => p.tier === tier)
