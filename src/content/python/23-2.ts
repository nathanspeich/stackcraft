import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `import os
import requests

# In real life you would run: export WEATHER_TOKEN=... in the shell.
# The app has no shell, so we plant the variable here instead.
os.environ.setdefault("WEATHER_TOKEN", "demo-token-42")

BASE = "https://api.stackcraft.dev/weather"

# 1. Read the token from the environment and build the headers


# 2. Print an auth line without showing the token


# 3. Fetch each city with params= and print its weather
for city in ["Lisbon", "Seoul", "Atlantis"]:
    pass
`

const SOLUTION = `import os
import requests

# In real life you would run: export WEATHER_TOKEN=... in the shell.
# The app has no shell, so we plant the variable here instead.
os.environ.setdefault("WEATHER_TOKEN", "demo-token-42")

BASE = "https://api.stackcraft.dev/weather"

# 1. Read the token from the environment and build the headers
token = os.environ.get("WEATHER_TOKEN")
headers = {"Accept": "application/json"}
if token:
    headers["Authorization"] = f"Bearer {token}"

# 2. Print an auth line without showing the token
if token:
    print("auth: bearer token loaded")
else:
    print("auth: none (set WEATHER_TOKEN)")

# 3. Fetch each city with params= and print its weather
for city in ["Lisbon", "Seoul", "Atlantis"]:
    r = requests.get(BASE, params={"city": city}, headers=headers, timeout=5)
    data = r.json()
    if r.status_code == 200:
        print(f"{city}: {data['temp_c']}C {data['condition']} (humidity {data['humidity']}%)")
    else:
        print(f"{city}: error {r.status_code} {data['error']}")
`

const lesson: Lesson = {
  id: 'w23d2',
  tier: 2,
  track: 'python',
  week: 23,
  day: 2,
  title: 'JSON, query parameters, headers, tokens',
  concept: `Most API responses are JSON, and r.json() turns them into dicts and lists you already know how to walk. Check the status code first: an error response often has a different shape, like {"error": "..."}.

Query parameters are the part of a URL after the question mark, like ?city=Lisbon&units=metric. Do not glue them together by hand. Pass params={"city": city} and requests encodes spaces and odd characters correctly.

Headers carry metadata: Accept says what format you want, User-Agent says who is asking, Authorization carries your token, usually as Bearer <token>.

Tokens are passwords. Never paste them into code that goes into git. Put them in an environment variable and read them with os.environ.get("NAME"), which returns None when the variable is missing so you can print a helpful message instead of crashing.`,
  example: {
    language: 'python',
    caption: 'Query parameters and a token from the environment',
    code: `import os
import requests

token = os.environ.get("GITHUB_TOKEN")     # None if not exported
headers = {"Accept": "application/vnd.github+json"}
if token:
    headers["Authorization"] = f"Bearer {token}"

r = requests.get("https://api.github.com/search/repositories",
                 params={"q": "language:python", "per_page": 5},
                 headers=headers, timeout=5)
print(r.status_code, len(r.json()["items"]))`,
  },
  task: {
    kind: 'python',
    instructions: 'Fetch weather for three cities from the demo endpoint in BASE.\n1. Read the token with os.environ.get("WEATHER_TOKEN"). Build a headers dict with Accept: application/json and, when the token is set, Authorization: Bearer <token>.\n2. Print  auth: bearer token loaded  if the token is set, otherwise  auth: none (set WEATHER_TOKEN) . Never print the token itself.\n3. In the loop, call requests.get(BASE, params={"city": city}, headers=headers, timeout=5). When the status is 200 print  Lisbon: 24C sunny (humidity 55%)  using the temp_c, condition, and humidity keys.\n4. Otherwise print  Atlantis: error 404 unknown city: Atlantis  using the status code and the error key of the JSON.',
    starter: STARTER,
    hints: [
      'token = os.environ.get("WEATHER_TOKEN") then headers = {"Accept": "application/json"} and headers["Authorization"] = f"Bearer {token}" inside an if token:',
      'Print a fixed message, not the token: print("auth: bearer token loaded")',
      'r = requests.get(BASE, params={"city": city}, headers=headers, timeout=5); data = r.json()',
      'print(f"{city}: {data[\'temp_c\']}C {data[\'condition\']} (humidity {data[\'humidity\']}%)") and in the else branch data["error"]',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /os\.environ\.get\(\s*["']WEATHER_TOKEN["']/) && codeHas(r, /Bearer/), 'Step 1: read the token with os.environ.get("WEATHER_TOKEN") and put Bearer <token> in an Authorization header.'],
        [ls[0] === 'auth: bearer token loaded' && !r.output.includes('demo-token-42'), 'Step 2: the first line should be  auth: bearer token loaded  and the token itself must not appear in the output.'],
        [codeHas(r, /params\s*=\s*\{\s*["']city["']/) && codeHas(r, /headers\s*=\s*headers/), 'Step 3: call requests.get with params={"city": city} and headers=headers.'],
        [ls[1] === 'Lisbon: 24C sunny (humidity 55%)' && ls[2] === 'Seoul: 18C cloudy (humidity 70%)', `Step 3: expected  Lisbon: 24C sunny (humidity 55%)  then the Seoul line (yours: ${JSON.stringify(ls[1] ?? '')}).`],
        [ls[3] === 'Atlantis: error 404 unknown city: Atlantis', 'Step 4: the Atlantis line should be  Atlantis: error 404 unknown city: Atlantis .'],
      ], 'Parameters, headers, and a secret kept out of the code. That is how real clients are written.')
    },
  },
  quiz: [
    { question: 'Why pass params={"q": "new york"} instead of adding ?q=new york to the URL yourself?', options: ['It is shorter', 'requests encodes spaces and special characters correctly', 'URLs cannot contain question marks'], answer: 1, explanation: 'Hand-built query strings break on spaces, ampersands, and non-ASCII text; params= handles the encoding.' },
    { question: 'Where should an API token live?', options: ['In a constant at the top of the script', 'In an environment variable read with os.environ.get', 'In the README'], answer: 1, explanation: 'Environment variables keep secrets out of source code and out of git.' },
    { question: 'os.environ.get("KEY") when KEY is not set returns what?', options: ['An empty string', 'None', 'It raises KeyError'], answer: 1, explanation: 'get returns None (or a default you pass); os.environ["KEY"] is the version that raises.' },
  ],
}

export default lesson
