import type { Lesson } from '../types'

const REPOS = `cat > ~/apis/repos.py <<'EOF'
"""List a GitHub user's public repositories as a table."""
import argparse
import os
import sys

import requests


def main():
    parser = argparse.ArgumentParser(description="List a GitHub user's repos")
    parser.add_argument("user")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args()

    url = f"https://api.github.com/users/{args.user}/repos"
    params = {"per_page": args.limit, "sort": "updated"}
    headers = {"Accept": "application/vnd.github+json",
               "User-Agent": "stackcraft-repos-cli"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        r = requests.get(url, params=params, headers=headers,
                         timeout=args.timeout)
    except requests.exceptions.Timeout:
        sys.exit(f"error: GitHub did not answer within {args.timeout}s")
    except requests.exceptions.ConnectionError:
        sys.exit("error: could not reach api.github.com (check the network)")

    if r.status_code == 404:
        sys.exit(f"error: no GitHub user called {args.user}")
    if r.status_code == 403 and r.headers.get("X-RateLimit-Remaining") == "0":
        sys.exit("error: rate limited, wait an hour or set GITHUB_TOKEN")
    if not r.ok:
        sys.exit(f"error: GitHub answered {r.status_code}")

    repos = r.json()
    print(f"{'name':<28} {'stars':>6}  {'language':<12} updated")
    print("-" * 60)
    for repo in repos:
        lang = repo["language"] or "-"
        print(f"{repo['name'][:28]:<28} {repo['stargazers_count']:>6}  "
              f"{lang:<12} {repo['updated_at'][:10]}")
    print(f"{len(repos)} repos shown for {args.user}")


if __name__ == "__main__":
    main()
EOF`

const WEATHER = `cat > ~/apis/weather.py <<'EOF'
"""Seven-day forecast for a city, from the free Open-Meteo API."""
import argparse
import sys

import requests

GEO = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST = "https://api.open-meteo.com/v1/forecast"


def fetch(url, params, timeout):
    """GET with a timeout and friendly errors. Exits the program on failure."""
    try:
        r = requests.get(url, params=params, timeout=timeout)
    except requests.exceptions.Timeout:
        sys.exit(f"error: no answer within {timeout}s from {url}")
    except requests.exceptions.ConnectionError:
        sys.exit(f"error: could not reach {url} (check the network)")
    if not r.ok:
        sys.exit(f"error: server answered {r.status_code}")
    return r.json()


def main():
    parser = argparse.ArgumentParser(description="Seven-day forecast")
    parser.add_argument("city")
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args()

    geo = fetch(GEO, {"name": args.city, "count": 1}, args.timeout)
    if not geo.get("results"):
        sys.exit(f"error: no city called {args.city}")
    place = geo["results"][0]
    data = fetch(FORECAST, {
        "latitude": place["latitude"], "longitude": place["longitude"],
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto",
    }, args.timeout)

    daily = data["daily"]
    print(f"Forecast for {place['name']}, {place.get('country', '')}")
    print(f"{'date':<12} {'max':>6} {'min':>6} {'rain mm':>8}")
    print("-" * 36)
    for day, hi, lo, rain in zip(daily["time"], daily["temperature_2m_max"],
                                 daily["temperature_2m_min"],
                                 daily["precipitation_sum"]):
        print(f"{day:<12} {hi:>6.1f} {lo:>6.1f} {rain:>8.1f}")


if __name__ == "__main__":
    main()
EOF`

const lesson: Lesson = {
  id: 'w23d5',
  tier: 2,
  track: 'python',
  week: 23,
  day: 5,
  title: 'Project: a GitHub or weather CLI',
  concept: `This week's project makes real requests from the VM. You choose the API: GitHub's public API lists any user's repositories, and Open-Meteo gives a seven-day forecast for any city. Neither needs a token.

The shape is the same either way, and it is the shape of every API tool. Parse arguments with argparse, including a --timeout. Build the URL and params. Make the request inside try/except so a timeout or a dead network prints one friendly line instead of a traceback. Check the status code and explain a 404 in words. Only then read the JSON and print a table with f-string widths.

pip goes into a virtual environment: Ubuntu protects its system Python, and a venv is a private package folder for this project. Week 26 goes deeper.`,
  example: {
    language: 'python',
    caption: 'A request with a friendly error instead of a traceback',
    code: `try:
    r = requests.get(url, params=params, timeout=args.timeout)
except requests.exceptions.Timeout:
    sys.exit(f"error: no answer within {args.timeout}s")
except requests.exceptions.ConnectionError:
    sys.exit("error: could not reach the server")
if r.status_code == 404:
    sys.exit(f"error: no GitHub user called {args.user}")
r.raise_for_status()
for repo in r.json():
    print(f"{repo['name']:<28} {repo['stargazers_count']:>6}")`,
  },
  task: {
    kind: 'real',
    intro: `Build a command-line tool that calls a public API for real and prints a clean table. Pick one: repos.py lists a GitHub user's repositories, or weather.py prints a seven-day forecast from Open-Meteo. Both reference programs are provided below; type them in, read them, and change something (the columns, the sort, the default limit) so they are yours.

This is done inside the VM: open it with multipass shell stackcraft. The VM has internet access, so requests go to the real servers. The app never talks to the VM; it only reads what you paste.

Install requests into a virtual environment in ~/apis first. Then run your tool once for the table, and once more in a way that fails on purpose, to prove the friendly error works.`,
    steps: [
      {
        instruction: 'Inside the VM, create a project folder with a virtual environment and install requests into it. The venv keeps this project\'s packages separate from Ubuntu\'s own Python. Paste the output of pip show requests.',
        command: `multipass shell stackcraft
sudo apt install -y python3-venv
mkdir -p ~/apis && cd ~/apis
python3 -m venv .venv
source .venv/bin/activate
pip install requests
pip show requests`,
        pasteLabel: 'Paste the output of pip show requests',
        check: [
          { type: 'includes', text: 'Name: requests' },
          { type: 'regex', pattern: 'Version:\\s*\\d+\\.\\d+', label: 'a Version: line' },
        ],
        hint: 'If pip says "externally-managed-environment", the venv is not active: run source .venv/bin/activate and try again (the prompt shows (.venv) when it worked). If python3 -m venv fails, install python3-venv with apt first.',
        example: `Name: requests
Version: 2.32.3
Summary: Python HTTP for Humans.
Home-page: https://requests.readthedocs.io
Author: Kenneth Reitz
Author-email: me@kennethreitz.org
License: Apache-2.0
Location: /home/ubuntu/apis/.venv/lib/python3.12/site-packages
Requires: certifi, charset-normalizer, idna, urllib3
Required-by:`,
      },
      {
        instruction: 'Write your tool in ~/apis. Choose repos.py (GitHub) or weather.py (Open-Meteo); the complete reference for both is in the command block, pick one. Run it with the venv active and paste the table it prints. It should have a header, at least a few rows, and no traceback.',
        command: `${REPOS}

${WEATHER}

# then run ONE of these:
python3 repos.py octocat --limit 5
python3 weather.py Lisbon`,
        pasteLabel: 'Paste the output of your program',
        check: [
          { type: 'lines', atLeast: 3 },
          { type: 'not', pattern: 'Traceback', label: 'no traceback in the output' },
          { type: 'regex', pattern: '\\d', label: 'at least one number in the table' },
        ],
        hint: 'A traceback means the program crashed: read its last line. ModuleNotFoundError: requests means the venv is not active. A 403 from GitHub means the hourly unauthenticated limit is used up; wait or export GITHUB_TOKEN. For weather.py, check the city spelling.',
        example: `name                          stars  language     updated
------------------------------------------------------------
Spoon-Knife                   12922  HTML         2026-09-16
Hello-World                    2789  -            2026-09-15
octocat.github.io               412  CSS          2026-09-10
git-consortium                  170  -            2026-08-30
hello-worId                      89  -            2026-08-02
5 repos shown for octocat`,
      },
      {
        instruction: 'Now make it fail on purpose and check that the error is a single friendly line, not a traceback. Either use a tiny timeout, or ask for a user or city that does not exist. Paste what your program printed.',
        command: `python3 repos.py octocat --timeout 0.001
python3 repos.py no-such-user-xyz-12345
# or, for weather.py:
python3 weather.py Lisbon --timeout 0.001
python3 weather.py Atlantisxyz`,
        pasteLabel: 'Paste the error line your program printed',
        check: [
          { type: 'regex', pattern: 'error|timed out|did not answer|could not reach|no answer', flags: 'i', label: 'a friendly error line' },
          { type: 'not', pattern: 'Traceback', label: 'no traceback' },
        ],
        hint: 'If you see a traceback, the request is not inside try/except, or you are catching the wrong exception class. The timeout raises requests.exceptions.Timeout and a dead network raises requests.exceptions.ConnectionError. A 404 is not an exception at all: check r.status_code.',
        example: 'error: GitHub did not answer within 0.001s',
      },
    ],
  },
  quiz: [
    { question: 'Why does the project put the request inside try/except?', options: ['requests refuses to run otherwise', 'So a timeout or network failure prints one clear line instead of a traceback', 'To make the request faster'], answer: 1, explanation: 'Users of a tool should see what went wrong in words, not a stack of Python frames.' },
    { question: 'What does sys.exit("error: ...") do compared with print?', options: ['Prints the message to stderr and exits with status 1', 'Prints in red', 'Nothing different'], answer: 0, explanation: 'A non-zero exit status lets shell scripts notice the failure, and stderr keeps it out of piped output.' },
    { question: 'Why install requests into a venv instead of the system Python?', options: ['Ubuntu manages its own Python packages, and a venv keeps project packages separate from them', 'requests only works in a venv', 'Venvs are faster'], answer: 0, explanation: 'Modern Ubuntu blocks pip installs into the system Python for good reason; a venv is the clean way.' },
  ],
}

export default lesson
