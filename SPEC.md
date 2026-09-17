# Build spec: "Stackcraft" (working title)

Why Stackcraft: the user is building a stack, layer by layer: shell (Linux), language (Python), database (SQL).

A fun, game-like app to teach me Python, Linux, and SQL from beginner level. Must work equally well on my phone and laptop. Read this whole file, then build it in the phases at the bottom. Ask me questions only when a decision would be hard to reverse.

## Who I am
Beginner in all three. I use Linux casually as a daily driver and know cd, ls, cp, mkdir and little else. No Python or SQL experience. I want about 15 to 20 minutes a day, 5 days a week, for 12 weeks.

## Product goals
1. Feels like a game, not a textbook. Progress should be visible and satisfying.
2. Practice inside the app. I should not need to leave the app to run code.
3. Phone first. Everything usable one-handed on a phone screen; also comfortable on a laptop.
4. Zero backend. All progress saved on the device. Installable as a PWA and works offline after first load.
5. Easy to extend. Lessons are data files, not hardcoded React.

## Stack
- Vite + React + TypeScript
- Tailwind CSS
- PWA via vite-plugin-pwa (installable on Android and desktop Chrome, offline cache)
- State: Zustand with persist middleware to localStorage (progress, XP, streak, flashcard schedule)
- Python runner: Pyodide loaded lazily from CDN only when a Python lesson opens
- SQL runner: sql.js (SQLite in WebAssembly), each lesson seeds its own small database
- Linux runner: a simulated shell with an in-memory virtual filesystem. Support at minimum: pwd, ls (-l -a), cd, mkdir (-p), touch, cp (-r), mv, rm (-r), cat, head, tail, echo, grep (-i -n -r), find (-name), wc, sort, uniq, cut, chmod, chown (display only), whoami, man (short built-in pages), history, clear, pipes, > and >> redirection, tab completion, and up-arrow history. Later lessons can add ps, kill, env, export, and a tiny bash script interpreter for variables, if, and for loops.
- Deploy: GitHub Pages or Vercel, whichever is simpler, so I can open it on my phone. Set up a GitHub repo with a deploy workflow.

## Core screens
1. Home (Today): today's quest (next incomplete lesson), streak flame, XP bar toward next level, a "Review cards" button showing how many flashcards are due, and a small 12-week map showing where I am.
2. Lesson: short concept (under 150 words), one worked example, then a hands-on task run in the in-app runner with automatic checking, then a 3-question quick check. Completing it awards XP. Big "Continue" buttons at the bottom, thumb reachable.
3. Flashcards: spaced repetition (simple SM-2 or Leitner). Swipe or tap: Again / Good / Easy. Decks per track plus a mixed deck.
4. Map: the full 12-week plan, weeks and days, with locks that open in order (allow skipping ahead via a small "unlock" link so I am never blocked).
5. Profile: level, XP, streak, badges, per-track mastery percentage, reset button.

## Game layer
- XP: 20 per lesson, 5 per correct quick-check answer, 2 per flashcard review, bonus 30 for finishing a week.
- Levels: level = floor(sqrt(XP / 50)), titles per level (Newbie, Shell Sprout, Script Kiddie in the good sense, Query Cadet, Root User, etc.). Keep titles light and playful.
- Streak: counts days with at least one lesson or 10 card reviews. One free "streak freeze" earned every 7 days.
- Badges: first lesson, first script, first JOIN, 7-day streak, 30-day streak, each track complete, capstone complete.
- Feedback: a small confetti burst or animated checkmark on lesson completion. Keep motion short and respect prefers-reduced-motion.
- Sound off by default, toggle in profile.

## Design
- Mobile first. Minimum 44px tap targets. Bottom tab bar on phone, left sidebar on wide screens.
- Dark theme by default with a light option. Pick a palette with three track colors (Linux, Python, SQL) used consistently on cards, map, and badges.
- One display font with personality, one clean body font, one monospace for code. Load from Google Fonts with fallbacks.
- No em dashes anywhere in the UI copy or lesson text. Use commas, periods, or colons.
- Code blocks: syntax highlighted, copy button, horizontally scrollable, never wrap terminal output.

## Curriculum (60 lessons, 5 per week)
Store each lesson as a JSON or TS file under src/content/<track>/<week>-<day>.ts with: id, track, week, day, title, concept, example, task (instructions, starter code, checker), quiz (3 questions, 3 options each, answer index, one-line explanation). Write real content, not placeholders.

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

Where an in-app runner cannot verify something (like sudo or systemctl), give a "do this on your real machine" task with a self-check box instead.

## Build phases
1. Scaffold, PWA, theme, navigation, Zustand store, Home and Map with placeholder lessons. Deploy so I can open it on my phone.
2. Linux simulated shell and all 20 Linux lessons.
3. Pyodide runner and all 20 Python lessons.
4. sql.js runner and all 15 SQL lessons.
5. Capstone week, flashcards with spaced repetition, badges, sounds, polish.

After each phase: run the build, test on a 390px wide viewport and a 1280px viewport, commit, deploy, and give me a one-paragraph summary plus the URL.
