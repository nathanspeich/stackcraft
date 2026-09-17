# Build spec: "Stackcraft"

A fun, game-like app to teach me Python, Linux, and SQL from beginner level through running a real self-hosted service. Must work equally well on my phone and laptop. Read this whole file, then build it in the phases at the bottom. Ask me questions only when a decision would be hard to reverse.

The curriculum has three tiers:

- Tier 1 Foundations, weeks 1 to 12: everything runs inside the app.
- Tier 2 Intermediate, weeks 13 to 28: lessons still run in the app, but every week ends with a small project done in a Linux VM on my MacBook that the app verifies by asking me to paste output.
- Tier 3 Advanced, weeks 29 to 44: same pattern, ending in a capstone service that I run in that same VM. No second computer is needed.

Tier 1 is built first (phases 1 to 5). Tiers 2 and 3 are added later (phases 6 and 7), but their content is fully written in this spec so nothing is a placeholder.

## Who I am
Beginner in all three. My computer is a MacBook. I know cd, ls, cp, mkdir and little else. No Python or SQL experience. I want about 15 to 20 minutes a day, 5 days a week. Tier 1 takes 12 weeks. The full three-tier path takes 44 weeks. Real-machine project days in Tiers 2 and 3 can run 30 to 45 minutes, and that is fine.

## Product goals
1. Feels like a game, not a textbook. Progress should be visible and satisfying.
2. Practice inside the app. I should not need to leave the app to run code in Tier 1. In Tiers 2 and 3, leaving the app for the real machine is the point of project days, and the app still checks my work.
3. Phone first. Everything usable one-handed on a phone screen; also comfortable on a laptop.
4. Zero backend. All progress saved on the device. Installable as a PWA and works offline after first load.
5. Easy to extend. Lessons are data files, not hardcoded React.

## Stack
- Vite + React + TypeScript
- Tailwind CSS
- PWA via vite-plugin-pwa (installable on Android and desktop Chrome, offline cache)
- State: Zustand with persist middleware to localStorage (progress, XP, streak, flashcard schedule, pasted project evidence)
- Python runner: Pyodide loaded lazily from CDN only when a Python lesson opens
- SQL runner: sql.js (SQLite in WebAssembly), each lesson seeds its own small database. Use a sql.js build with window function support (SQLite 3.25 or newer) so Tier 2 window function lessons run in the app.
- Linux runner: a simulated shell with an in-memory virtual filesystem. Support at minimum: pwd, ls (-l -a), cd, mkdir (-p), touch, cp (-r), mv, rm (-r), cat, head, tail, echo, grep (-i -n -r), find (-name), wc, sort, uniq, cut, chmod, chown (display only), whoami, man (short built-in pages), history, clear, pipes, > and >> redirection, tab completion, and up-arrow history. Later lessons can add ps, kill, env, export, and a tiny bash script interpreter for variables, if, and for loops. Tier 2 extends the interpreter (see Real-machine tasks below).
- Deploy: GitHub Pages or Vercel, whichever is simpler, so I can open it on my phone. Set up a GitHub repo with a deploy workflow.

## Core screens
1. Home (Today): today's quest (next incomplete lesson), streak flame, XP bar toward next level, a "Review cards" button showing how many flashcards are due, and a small map of the current tier showing where I am.
2. Lesson: short concept (under 150 words), one worked example, then a hands-on task run in the in-app runner with automatic checking, then a 3-question quick check. Completing it awards XP. Big "Continue" buttons at the bottom, thumb reachable. Real-machine project lessons swap the in-app runner for a paste-verified checklist (see Real-machine tasks).
3. Flashcards: spaced repetition (simple SM-2 or Leitner). Swipe or tap: Again / Good / Easy. Decks per track plus a mixed deck. Tier 2 and 3 cards join the same decks, tagged by tier, and are only introduced once that tier is unlocked.
4. Map: the full 44-week plan grouped into three tiers, weeks and days, with locks that open in order (allow skipping ahead via a small "unlock" link so I am never blocked). Tiers 2 and 3 are collapsed until Tier 1 is complete, but can be expanded and unlocked early with the same link.
5. Profile: level, XP, streak, badges grouped by tier, per-track mastery percentage, project evidence log (what I pasted, by lesson), reset button.

## Game layer
- XP: 20 per lesson, 5 per correct quick-check answer, 2 per flashcard review, bonus 30 for finishing a week. Real-machine project lessons award 40 instead of 20. Finishing a tier awards a 150 bonus. Finishing the Tier 3 capstone awards a 300 bonus.
- Levels: level = floor(sqrt(XP / 50)). Titles per level, kept light and playful:
  0 Newbie, 1 Shell Sprout, 2 Script Kiddie (in the good sense), 3 Query Cadet, 4 Loop Wrangler, 5 Root User, 6 Pipeline Plumber, 7 Daemon Tamer, 8 Test Pilot, 9 Window Shopper (the SQL kind), 10 Container Captain, 11 Type Whisperer, 12 Playbook Author, 13 Site Reliability Sorcerer, 14 Stack Architect, 15 and up: Stackcrafter.
  Rough expectation: Tier 1 ends around level 7, Tier 2 around level 10, Tier 3 around level 13.
- Streak: counts days with at least one lesson or 10 card reviews. One free "streak freeze" earned every 7 days.
- Badges, Tier 1: first lesson, first script, first JOIN, 7-day streak, 30-day streak, each track complete, capstone complete.
- Badges, Tier 2: Bash Builder (first real bash script verified), Test Pilot (first pytest run verified), Window Shopper (first window function lesson), Service Manager (first systemd unit verified), Container Captain (first Docker container verified), Packager (first pipx install verified), 100-day streak, Tier 2 complete.
- Badges, Tier 3: Type Checker (mypy strict passes), Hardened (server hardening project verified), Postgres Pioneer (first Postgres query verified), Pipeline Pilot (first green CI run verified), Playbook Author (first idempotent Ansible run verified), Firewatch (monitoring stack verified), Fixer (all troubleshooting drills done), Self-Hosted (capstone complete), 200-day streak, Tier 3 complete.
- Feedback: a small confetti burst or animated checkmark on lesson completion. Keep motion short and respect prefers-reduced-motion. Tier and capstone completion get a slightly bigger celebration screen with the badge.
- Sound off by default, toggle in profile.

## Design
- Mobile first. Minimum 44px tap targets. Bottom tab bar on phone, left sidebar on wide screens.
- Dark theme by default with a light option. Pick a palette with three track colors (Linux, Python, SQL) used consistently on cards, map, and badges. Tiers are shown with a subtle tier marker (Foundations, Intermediate, Advanced), not a fourth color.
- One display font with personality, one clean body font, one monospace for code. Load from Google Fonts with fallbacks.
- No em dashes anywhere in the UI copy or lesson text. Use commas, periods, or colons.
- Code blocks: syntax highlighted, copy button, horizontally scrollable, never wrap terminal output.
- Paste boxes on project days: large, monospace, with a "Paste from clipboard" button on phone so I can copy on the laptop and paste on the phone if I want.

## Lesson format and storage
Store each lesson as a JSON or TS file under src/content/<track>/<week>-<day>.ts with: id, tier, track, week, day, title, concept, example, task, quiz (3 questions, 3 options each, answer index, one-line explanation). Write real content, not placeholders.

The task field has two shapes:

- In-app task: instructions, starter code, checker. Same as Tier 1.
- Real-machine task (kind "real"): intro, then a list of steps. Each step has an instruction, an optional copyable command, a paste box label, a checker, and a hint shown after a failed check. Checkers are simple pattern tests on the pasted text: regex, "includes", or "line count at least N". The app never talks to my machine; it only reads what I paste. Say this plainly in the UI the first time.

Real-machine tasks also have a small "I did this but cannot paste" link, like the map unlock link, so I am never blocked. It marks the step done with a note in the evidence log and does not count toward badges.

Where an in-app runner cannot verify something in Tier 1 (like sudo or systemctl), give a "do this on your real machine" task with a self-check box instead. From Tier 2 onward, use the paste-verified format instead of self-check boxes.

## Real-machine setup
Everything in Tiers 2 and 3 happens on my MacBook. No second laptop, Pi, or VPS.

Because macOS does not have apt, systemd, or ufw, the projects run inside a free Ubuntu virtual machine on the Mac, created with Multipass (from Canonical). Throughout this spec, "the box" and "the VM" mean this Ubuntu VM. My Mac's own Terminal plays the role of "my laptop" for things like SSH and Ansible. Week 13 day 1 is a guided setup lesson: install Multipass with Homebrew, run one command to create a VM named stackcraft with 2 CPUs, 4 GB RAM, and 20 GB disk, open a shell into it with multipass shell stackcraft, and set up SSH keys so the Mac can also reach it with ssh. The lesson ends with a setup check that asks me to paste the output of a few commands run inside the VM (uname -a, python3 --version, git --version, whoami) so the app knows I am ready. Include a "reset the VM" note in the Profile screen help: multipass delete stackcraft, multipass purge, then redo week 13 day 1.

Inside the VM I need sudo, git, python3 (3.11 or newer), pip, and internet access, all of which Ubuntu provides. Docker is installed inside the VM during week 25 and works on both Intel and Apple Silicon Macs. Anything that says "open in a browser" means Safari or Chrome on the Mac pointed at the VM's IP address (multipass list shows it).

Tier 2 also extends the simulated shell interpreter so bash scripting lessons can run in the app: functions, case, while, arrays, $( ), arithmetic with $(( )), getopts, here-docs, exit codes, and set -e. Anything beyond that is a real-machine step.

## Curriculum

### Tier 1 Foundations (60 lessons, 5 per week, weeks 1 to 12)

Week 1 Linux: terminal orientation and navigation; files and directories; reading files (cat, less, head, tail, wc); getting help (man, --help, which); absolute vs relative paths and PATH.
Week 2 Linux: permissions and chmod; users and sudo; finding things (find, grep); pipes and redirection; text tools (sort, uniq, cut, tr, sed basics).
Week 3 Python: setup and print; variables and types with f-strings; strings; numbers and input; conditionals.
Week 4 Python: lists; loops; dictionaries; functions; tuples, sets, list comprehensions.
Week 5 SQL: what a database is, SQLite basics; CREATE TABLE and INSERT; SELECT, WHERE, ORDER BY, LIMIT; UPDATE and DELETE safely; filtering (AND, OR, IN, BETWEEN, LIKE, NULL).
Week 6 Linux: processes (ps, top, kill, jobs); system info (df, du, free, uname); package managers (apt); networking basics (ip, ping, curl, ss); SSH and scp.
Week 7 Python: reading and writing files; errors and try/except; modules and the standard library; virtual environments and pip; command-line scripts with argparse.
Week 8 SQL: aggregates; GROUP BY and HAVING; primary and foreign keys; INNER JOIN; LEFT JOIN and multi-table joins.
Week 9 Python: classes; JSON and CSV; subprocess and OS automation; calling an HTTP API; mini project: a log parser CLI.
Week 10 SQL: subqueries; indexes and EXPLAIN; constraints and ALTER TABLE; transactions; Python plus sqlite3.
Week 11 Linux: environment variables and .bashrc; bash scripting basics; loops, functions, exit codes; cron and systemd; logs and troubleshooting.
Week 12 Capstone: build a "server health report" end to end: a bash script gathers info, a Python script parses it into SQLite, SQL queries produce a report, then a review day and a "what to learn next" day.

Flashcards: about 25 per track, generated from the lessons (command, what it does; concept, definition).

### Tier 2 Intermediate (80 lessons, 5 per week, weeks 13 to 28)

Days 1 to 4 of each week are normal lessons in the same format as Tier 1 and run in the app wherever the runner can handle it. Day 5 is a project on my real machine, verified by pasted output. Projects build on each other: a bash backup script, a Python "inventory" tool, and a sales database grow across the tier. Keep the tone friendly; assume I remember Tier 1 but not much more.

Week 13 Linux, real bash scripting: setup check plus script structure (shebang, set -euo pipefail, variables, quoting rules); arguments, getopts, usage messages, exit codes, functions; conditionals, loops over files, case, arrays, command substitution, arithmetic; reading input, here-docs, traps, temp files, debugging with bash -x and shellcheck.
Project: backup.sh. Takes a source folder and a destination, creates a dated tar.gz, keeps only the last 5 backups, prints a usage message and exits 1 on bad arguments. Paste: shellcheck output (checker: no lines containing "SC" error codes, or the text "no issues"), ls of the destination (checker: regex for a name like backup-2026-09-17.tar.gz), and the output of running it with no arguments followed by echo $? (checker: includes "Usage" and a line equal to 1).

Week 14 Python, OOP in practice: classes review, __init__, methods, __repr__ and __str__; dataclasses and why they save typing; inheritance vs composition, and when a plain function is better than a class; properties, class methods, static methods, and dunder methods like __eq__ and __len__.
Project: inventory.py. A small tool with Item and Inventory classes that saves to a JSON file, with add, remove, and list commands using argparse. Paste: output of python3 inventory.py add "Widget" 3 then list (checker: includes "Widget" and "3"), and cat of the JSON file (checker: valid-looking JSON containing "Widget").

Week 15 SQL, CTEs: the WITH clause, naming a subquery so the query reads top to bottom; chaining several CTEs; recursive CTEs for number sequences and hierarchies like an org chart; CTEs vs subqueries vs views, and choosing for readability.
Project: install the sqlite3 command-line tool, create org.db with an employees table that has a manager_id, load 10 rows from a provided script, and write a recursive CTE that prints each person with their depth in the tree. Paste: sqlite3 --version (checker: regex for a version number), and the query output (checker: at least 10 lines and includes a depth of 0 and a depth of 2).

Week 16 Linux, users and permissions in depth: /etc/passwd, /etc/group, useradd, usermod, groups, id; permission bits in octal, umask, default permissions on new files; setuid, setgid, and the sticky bit, with shared team directories as the example; sudoers, visudo, least privilege, and ACLs with getfacl and setfacl.
Project: create a group called team, a user called deploy in that group, a shared folder /srv/team with the setgid bit so new files belong to the group, and a sudo rule that lets deploy run only systemctl restart. Paste: getent group team (checker: includes "team" and "deploy"), ls -ld /srv/team (checker: regex for drwxrws), and sudo -l -U deploy (checker: includes "systemctl").

Week 17 Python, testing with pytest: why tests, plain assert, how pytest finds tests; fixtures and parametrize; testing errors with pytest.raises, tmp_path, and a first look at monkeypatch; organizing a tests folder, coverage, and the red-green-refactor loop. In-app days use a small built-in assert runner that mimics pytest output; the real pytest runs on day 5.
Project: add tests to inventory.py covering add, remove, and saving to a temp file, then run them with coverage. Paste: pytest -v output (checker: regex for "passed" and no "failed"), and pytest --cov output (checker: includes "TOTAL" and a percentage).

Week 18 SQL, window functions: OVER and ROW_NUMBER, RANK, DENSE_RANK; PARTITION BY for per-group numbering; running totals and moving averages with frame clauses; LAG, LEAD, NTILE, FIRST_VALUE. All run in the app with a seeded sales table.
Project: create sales.db on my machine with a provided script (customers, products, sales), then write three queries: top 3 products per month, a running total of revenue by day, and month-over-month change with LAG. Paste each result (checkers: header row present, at least 3 lines, and for the LAG query at least one negative or positive change value).

Week 19 Linux, systemd services: units, systemctl status, start, stop, enable, and reading journalctl; writing a unit file for a script with Restart, User, and WantedBy; timers as the modern cron; environment files, user-level services, dependencies with After and Requires, and reading a failed unit.
Project: turn backup.sh into backup.service with a daily backup.timer. Paste: systemctl status backup.timer (checker: includes "active"), systemctl list-timers (checker: includes "backup.timer"), and journalctl -u backup.service -n 5 (checker: at least 1 line mentioning backup).

Week 20 Python, logging: print vs logging and the five levels; formatters and handlers for console and file; dictConfig and per-module loggers with getLogger(__name__); rotating files, logging exceptions with exc_info, and what is worth logging.
Project: add logging to inventory.py with a console handler at INFO and a RotatingFileHandler at DEBUG, plus a --log-level flag. Paste: output of running with --log-level DEBUG (checker: includes "DEBUG"), and tail of the log file (checker: regex for a timestamp and a level name).

Week 21 SQL, schema design and normalization: entities, attributes, and relationships with a sketch; first, second, and third normal form in plain words with a messy spreadsheet as the example; many-to-many with junction tables; naming, choosing types, NOT NULL, defaults, and when denormalizing is okay.
Project: design and create a schema for a small recipe app (recipes, ingredients, recipe_ingredients, tags) in SQLite with foreign keys enabled, insert sample data, and write one join that lists ingredients for a recipe. Paste: .schema output (checker: includes "recipe_ingredients" and "REFERENCES"), and the join result (checker: at least 3 lines).

Week 22 Linux, networking and firewalls: IP addresses, ports, DNS, ip addr, ss -tulpn; curl in depth, /etc/hosts, dig, traceroute; firewalls with ufw and what nftables is doing underneath; SSH server settings, key-based login, and an introduction to fail2ban.
Project: run python3 -m http.server 8000 on my machine, allow port 8000 with ufw while keeping SSH allowed, and confirm it from Safari on the Mac using the VM's IP, or with curl. Paste: sudo ufw status (checker: includes "8000" and "ALLOW"), ss -tulpn | grep 8000 (checker: includes "LISTEN"), and curl -I http://localhost:8000 (checker: includes "200").

Week 23 Python, working with APIs: HTTP basics, the requests library, status codes; JSON responses, query parameters, headers, and keeping tokens in environment variables; pagination, rate limits, timeouts, and retries; a small client class that caches responses to disk. In-app days use provided JSON strings so no network is needed; real requests happen on day 5.
Project: a CLI that fetches the public GitHub API for a user's repos (or the Open-Meteo weather API, my choice) and prints a clean table, with a timeout and a friendly error on failure. Paste: pip show requests (checker: includes "Name: requests"), and the program output (checker: at least 3 lines and no traceback).

Week 24 SQL, views: CREATE VIEW and why views exist; views for reporting and layering views on views; updatable views and their limits, dropping and recreating views; a first look at triggers and using views to simplify or restrict what an app sees.
Project: add three reporting views to sales.db (monthly_revenue, top_customers, low_stock) and query them. Paste: .schema output (checker: includes "CREATE VIEW" at least 3 times), and one view query result (checker: at least 3 lines).

Week 25 Linux, Docker basics: what a container is, installing Docker, hello-world, images vs containers; docker run flags for ports, volumes, names, plus exec and logs; writing a Dockerfile for inventory.py; Docker Compose with two services and a shared network, using Postgres as a preview of Tier 3.
Project: containerize inventory.py with a volume for the JSON file. Paste: docker --version (checker: regex for a version), docker images (checker: includes "inventory"), and docker run output for the list command (checker: includes "Widget" or the items I added).

Week 26 Python, packaging: modules, packages, __init__.py, absolute and relative imports; pyproject.toml, building a wheel, and console script entry points; venv, pip install -e, requirements files vs lock files; pipx, versioning, and publishing to TestPyPI.
Project: turn inventory.py into a package called inventory with an inventory command, install it with pipx, and run it from any folder. Paste: pip show inventory or pipx list (checker: includes "inventory"), which inventory (checker: a path ending in inventory), and inventory --help (checker: includes "usage").

Week 27 SQL, indexes and query tuning: how a B-tree index works in plain terms, EXPLAIN QUERY PLAN; composite indexes, column order, covering indexes; when indexes hurt, write cost, ANALYZE; rewriting slow queries: avoid SELECT *, avoid functions on indexed columns, spot the N+1 pattern.
Project: use a provided Python script to fill sales.db with one million rows, time a query with .timer on, add the right index, and time it again. Paste: EXPLAIN QUERY PLAN before (checker: includes "SCAN") and after (checker: includes "SEARCH" and "USING INDEX"), and both timings (checker: two lines matching "Run Time").

Week 28 Python, async basics: sync vs async, the event loop, async and await; asyncio.gather and tasks; an async HTTP client with httpx, fetching many URLs at once; when async is the wrong tool, mixing with threads, and common mistakes like forgetting await. Pyodide supports asyncio, so days 1 to 2 run in the app.
Project: an async URL checker that reads a list of URLs from a file, checks them concurrently with a limit of 10 at a time, and prints status and elapsed time per URL plus a total. Paste: the program output (checker: at least 5 lines with a status code and a total time line). Completing this lesson completes Tier 2.

Flashcards: about 20 more per track, generated from the Tier 2 lessons.

### Tier 3 Advanced (80 lessons, 5 per week, weeks 29 to 44)

Same pattern: days 1 to 4 are lessons, day 5 is a verified real-machine project. Weeks 29 to 40 cover the advanced topics. Weeks 41 to 44 are the capstone, where every day is a verified project step. Tier 3 keeps using the stackcraft VM as "the box", reached from the Mac over SSH (see Real-machine setup). Keep explaining the why in plain words; advanced does not mean terse.

Week 29 Python, type hints and mypy: basic annotations and why they help editors and readers; Optional, Union, list and dict generics, TypedDict; Protocol, TypeVar, and Callable; mypy setup, strict mode, and adding types to an existing project gradually.
Project: fully type the inventory package and make mypy --strict pass. Paste: mypy --strict src output (checker: includes "Success" and "no issues"), and pytest output (checker: includes "passed").

Week 30 Linux, server hardening: a simple threat model, keeping packages updated, unattended-upgrades; SSH lockdown with keys only, no root login, and fail2ban; reviewing the firewall, removing unused services, a first scan with lynis; sudo logging, basic auditd rules, file permissions on secrets, and backups as part of security.
Project: harden the real box. Paste: sudo sshd -T | grep -Ei 'passwordauthentication|permitrootlogin' (checker: includes "passwordauthentication no" and "permitrootlogin no"), sudo ufw status verbose (checker: includes "Status: active" and "22"), and sudo fail2ban-client status sshd (checker: includes "Currently banned").

Week 31 SQL, PostgreSQL: Postgres vs SQLite and running Postgres in Docker; psql meta commands, roles, databases, and connecting with a URL; Postgres types (identity columns, timestamptz, jsonb, arrays) and RETURNING; pg_dump, restore, and connecting from Python with psycopg.
Project: move the inventory data into Postgres running in Docker on the real box, with a dedicated role and database, and point the inventory package at it via a DATABASE_URL environment variable. Paste: psql --version (checker: regex for a version), \dt output (checker: includes "items"), and SELECT count(*) FROM items (checker: a number greater than 0).

Week 32 Python, concurrency: threads vs processes vs async, and the GIL in plain terms; ThreadPoolExecutor for I/O-bound work; multiprocessing and Pool for CPU-bound work; queues, locks, a live race condition demo, and how to choose.
Project: a log processor that counts status codes across many large log files (provided generator script) three ways: single-threaded, thread pool, process pool, printing timings for each. Paste: the output (checker: three lines matching "seconds" and identical counts across all three).

Week 33 Linux, monitoring: what to watch (CPU, memory, disk, load) with htop, vmstat, iostat, and uptime; journald in depth and logrotate; Prometheus and node_exporter in Docker; Grafana dashboards, a first alert rule, and simple uptime checks.
Project: run node_exporter, Prometheus, and Grafana with Docker Compose on the real box, and build a dashboard with CPU, memory, and disk panels. Paste: curl -s localhost:9100/metrics | head (checker: includes "node_"), docker compose ps (checker: includes "prometheus" and "grafana" as running), and the dashboard JSON export snippet (checker: includes "panels").

Week 34 SQL, migrations: why schema changes need version control; hand-written up and down SQL files with a schema_version table; Alembic setup with autogenerate; safe migrations: adding nullable columns first, backfilling in batches, avoiding long locks.
Project: add Alembic to the inventory package, generate the initial migration from the existing schema, then add a second migration that adds a price column with a backfill. Paste: alembic history (checker: at least 2 revision lines), alembic current (checker: includes "(head)"), and \d items (checker: includes "price").

Week 35 Python, CI with GitHub Actions: git recap, branches, pull requests, and why CI exists; a workflow file that runs pytest on every push; a Python version matrix, caching, and adding ruff and mypy to the run; build artifacts, a status badge in the README, secrets, and a release job that runs on a tag.
Project: push the inventory package to GitHub with a working CI workflow. Paste: git log --oneline -3 (checker: 3 lines with commit hashes), gh run list --limit 3 or the Actions page copied as text (checker: includes "completed" and "success"), and the README badge line (checker: includes "actions/workflows").

Week 36 Linux, Ansible automation: what Ansible is, the inventory file, ad hoc commands, and ping; playbooks, tasks, and core modules like apt, copy, template, and service; variables, Jinja2 templates, and handlers; roles, idempotency, check mode, and Ansible Vault for secrets.
Project: a playbook that applies the week 30 hardening to the VM, run from the Mac's Terminal: packages, SSH config, ufw rules, fail2ban, and a deploy user. Paste: the play recap from the first run (checker: includes "failed=0"), and the recap from a second run (checker: includes "changed=0" and "failed=0").

Week 37 SQL, data modeling for a real app: turning capstone requirements into entities; keys, constraints, enums vs lookup tables, soft deletes; created_at and updated_at, audit columns, and where jsonb is a good fit; letting access patterns drive the design, plus seed data.
Project: create the capstone schema in Postgres through Alembic migrations: hosts, checks, check_results, and alerts, with sensible indexes. Paste: \d hosts and \d check_results (checker: includes "Foreign-key constraints" and "Indexes"), and alembic current (checker: includes "(head)").

Week 38 Python, build a complete tool: choose the shape (a CLI with Typer or a web service with FastAPI; the capstone uses FastAPI, so the lessons lean that way) and write a one-page scope; project layout, settings from environment variables, and a small database access layer; endpoints or commands with validation and clear errors; tests, types, packaging, and a README that someone else could follow.
Project: v0.1 of the capstone service, called Statuscraft: a FastAPI app with a /health endpoint and a /hosts endpoint reading from Postgres, with tests. Paste: curl -s localhost:8000/health (checker: includes "ok"), curl -s localhost:8000/hosts (checker: starts with "[" or "{"), and pytest output (checker: includes "passed").

Week 39 Linux, troubleshooting drills: a method (observe, guess, test, fix, write it down) and a disk-full drill; a service-will-not-start drill using journalctl, permissions, and port conflicts; network drills: broken DNS, blocked port, and high load with stress; broken timer, permission denied, out-of-memory, and reading dmesg.
Project: run the provided break-it.sh on the real box (it safely causes four faults), fix each one, and write a short notes.md with what was wrong and the fix. Paste: the output of the provided check-fixed.sh (checker: four lines including "OK"), and notes.md (checker: at least 4 headings).

Week 40 SQL, performance analysis: EXPLAIN ANALYZE in Postgres and reading a plan tree; index types (btree, gin for jsonb, partial indexes) and pg_stat_statements; VACUUM, bloat, and statistics; connection pooling, the slow query log, and a small load test with pgbench.
Project: load 500k check_results rows with a provided script, find the two slowest capstone queries, and fix them with indexes or rewrites. Paste: EXPLAIN ANALYZE before and after for each query (checker: two pairs, each "after" with a lower "Execution Time" than its "before"), and pg_stat_statements top 5 (checker: at least 5 lines).

Weeks 41 to 44 Capstone: Statuscraft, a self-hosted service on the real box. It combines everything: Ansible provisions the box, Postgres stores data, a Python collector runs on a systemd timer, a FastAPI app serves a status page and JSON API, Docker Compose runs the stack, Caddy provides HTTPS, Grafana shows dashboards, CI tests and builds on every push, and the box is hardened and monitored. Every day is a verified project step. The app shows a capstone checklist screen that persists across the four weeks so I can see the whole build at a glance.

Week 41 Plan and provision: write the scope and architecture sketch in a README, and paste it (checker: includes "collector", "api", and "postgres"); run the Ansible playbook against the box and paste the recap (checker: "failed=0"); bring up Postgres with Compose and run the capstone migrations, paste alembic current (checker: "(head)"); write the collector script that pings each host and records a check_result, paste one run (checker: includes "recorded"); install the collector as a systemd timer every 5 minutes, paste systemctl list-timers (checker: includes "collector").

Week 42 Build the app: add /status returning the latest result per host, paste curl output (checker: includes "host" and "status"); add a simple HTML status page with Jinja2 templates, paste curl -s localhost:8000/ | head (checker: includes "<html"); add /alerts and a rule that flags a host down 3 checks in a row, paste a test run (checker: includes "passed"); add types, ruff, and a Dockerfile for the app, paste docker build output (checker: includes "naming to" or "Successfully"); push with CI running tests and building the image, paste the run list (checker: includes "success").

Week 43 Deploy and monitor: run the full stack with Compose on the box, paste docker compose ps (checker: app, postgres, caddy all running); put Caddy in front with HTTPS (local certificate on the LAN is fine, or a real domain), paste curl -Ik https://<box> (checker: includes "200" or "301"); add a Grafana dashboard reading from the Postgres data source, paste the dashboard export snippet (checker: includes "postgres"); add a nightly pg_dump backup timer with a restore test, paste ls of backups and the restore log (checker: a dated .sql.gz name and "restore ok"); write a runbook section in the README for restart, logs, backup, and restore, paste it (checker: includes "restart" and "restore").

Week 44 Harden, drill, and ship: re-run the hardening playbook and lynis, paste the lynis hardening index line (checker: regex for "Hardening index" and a number); run the capstone troubleshooting drill (provided script breaks the collector, the database password, and the firewall), fix all three and paste check-fixed.sh output (checker: three "OK" lines); tag v1.0.0 and let CI publish the release, paste the release URL text and git tag output (checker: includes "v1.0.0"); a review day: re-read the Tier 1 week 12 health report and paste a paragraph comparing it to Statuscraft (checker: at least 80 words); a "what to learn next" day with a short reflection paste (checker: at least 40 words). Completing this lesson completes Tier 3 and awards the Self-Hosted badge.

Flashcards: about 20 more per track, generated from the Tier 3 lessons.

## Build phases
1. Scaffold, PWA, theme, navigation, Zustand store, Home and Map with placeholder lessons. Deploy so I can open it on my phone.
2. Linux simulated shell and all 20 Tier 1 Linux lessons.
3. Pyodide runner and all 20 Tier 1 Python lessons.
4. sql.js runner and all 15 Tier 1 SQL lessons.
5. Capstone week, flashcards with spaced repetition, badges, sounds, polish. This completes Tier 1.
6. Tier 2: the real-machine task type with paste checkers and the evidence log, the extended bash interpreter, the three-tier Map with collapsible tiers, Tier 2 level titles and badges, all 80 Tier 2 lessons, and Tier 2 flashcards. Confirm sql.js window functions work.
7. Tier 3: all 80 Tier 3 lessons including the four capstone weeks and the persistent capstone checklist screen, Tier 3 badges and celebration screens, Tier 3 flashcards, and a final polish pass on everything.

After each phase: run the build, test on a 390px wide viewport and a 1280px viewport, commit, deploy, and give me a one-paragraph summary plus the URL.
