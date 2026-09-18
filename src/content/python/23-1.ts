import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `import requests

# 1. GET the octocat profile and print the status code


# 2. Print the name and repo count from the JSON


# 3. Ask for a user that does not exist and handle the 404


# 4. A helper that names the status family


def describe(code):
    """Return success, redirect, client error, or server error."""
    return "?"


for code in (200, 301, 404, 503):
    print(code, describe(code))
`

const SOLUTION = `import requests

# 1. GET the octocat profile and print the status code
r = requests.get("https://api.github.com/users/octocat", timeout=5)
print(f"status: {r.status_code}")

# 2. Print the name and repo count from the JSON
data = r.json()
print(f"name: {data['name']}")
print(f"repos: {data['public_repos']}")

# 3. Ask for a user that does not exist and handle the 404
missing = requests.get("https://api.github.com/users/no-such-user-xyz", timeout=5)
if missing.status_code == 404:
    print("not found: no-such-user-xyz")
else:
    print("unexpected:", missing.status_code)

# 4. A helper that names the status family


def describe(code):
    """Return success, redirect, client error, or server error."""
    if 200 <= code < 300:
        return "success"
    if 300 <= code < 400:
        return "redirect"
    if 400 <= code < 500:
        return "client error"
    return "server error"


for code in (200, 301, 404, 503):
    print(code, describe(code))
`

const lesson: Lesson = {
  id: 'w23d1',
  tier: 2,
  track: 'python',
  week: 23,
  day: 1,
  title: 'HTTP basics, requests, status codes',
  concept: `Every web API works the same way underneath. Your program sends a request: a method like GET or POST, a URL, some headers, maybe a body. The server sends back a response: a status code, headers, and a body, usually JSON.

Read the status code before anything else. 2xx means it worked. 3xx means look somewhere else. 4xx means you asked wrong (404 not found, 401 not logged in, 429 too many requests). 5xx means the server broke, not you.

The requests library makes this one line: r = requests.get(url, timeout=5). Then r.status_code, r.ok, r.text, and r.json() give you the pieces. Always pass a timeout, or a dead server can hang your program forever.

In the app a stand-in requests answers a few demo URLs without any network.`,
  example: {
    language: 'python',
    caption: 'One request, then read the status and the JSON body',
    code: `import requests

r = requests.get("https://api.github.com/users/octocat", timeout=5)
print(r.status_code)     # 200
print(r.ok)              # True for any 2xx
data = r.json()          # parse the JSON body into a dict
print(data["login"])     # octocat
if r.status_code == 404:
    print("no such user")`,
  },
  task: {
    kind: 'python',
    instructions: 'Make your first API calls with requests.\n1. GET https://api.github.com/users/octocat with timeout=5 and print  status: 200 .\n2. Parse the body with r.json() and print  name: The Octocat  and  repos: 8  (keys name and public_repos).\n3. GET https://api.github.com/users/no-such-user-xyz. If the status code is 404 print  not found: no-such-user-xyz .\n4. Finish describe(code) so it returns success, redirect, client error, or server error for the 2xx, 3xx, 4xx, and 5xx families. The loop at the bottom prints the four lines.',
    starter: STARTER,
    hints: [
      'r = requests.get("https://api.github.com/users/octocat", timeout=5) then print(f"status: {r.status_code}")',
      'data = r.json() gives a dict: data["name"] and data["public_repos"]',
      'Compare missing.status_code == 404 before touching the body.',
      'if 200 <= code < 300: return "success", and so on for 300, 400, then everything else is a server error.',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /requests\.get\(\s*["']https:\/\/api\.github\.com\/users\/octocat["'][^)]*timeout\s*=/) , 'Step 1: call requests.get on the octocat URL with timeout=5.'],
        [ls[0] === 'status: 200', `Step 1: the first line should be  status: 200  (yours: ${JSON.stringify(ls[0] ?? '')}).`],
        [ls[1] === 'name: The Octocat' && ls[2] === 'repos: 8' && codeHas(r, /\.json\(\)/), 'Step 2: use r.json() and print  name: The Octocat  then  repos: 8 .'],
        [ls[3] === 'not found: no-such-user-xyz' && codeHas(r, /==\s*404|404\s*==/), 'Step 3: fetch the missing user and print  not found: no-such-user-xyz  when status_code == 404.'],
        [ls.slice(4, 8).join('|') === '200 success|301 redirect|404 client error|503 server error', 'Step 4: describe should give 200 success, 301 redirect, 404 client error, 503 server error.'],
      ], 'You can talk to an API and read what it answers.')
    },
  },
  quiz: [
    { question: 'A request comes back with status 503. Whose fault is it, most likely?', options: ['Yours, the URL is wrong', 'The server, 5xx means it failed on its side', 'The network cable'], answer: 1, explanation: '5xx codes are server-side failures; 4xx codes mean the request itself was the problem.' },
    { question: 'Why always pass timeout= to requests.get?', options: ['It makes requests faster', 'Without it a silent server can hang the program forever', 'requests refuses to run without it'], answer: 1, explanation: 'The default is no timeout at all, so a stuck connection waits indefinitely.' },
    { question: 'What does r.json() do?', options: ['Sends JSON to the server', 'Parses the response body from JSON text into Python data', 'Checks that the status is 200'], answer: 1, explanation: 'It is json.loads on the body; check the status code first, since an error page may not be JSON.' },
  ],
}

export default lesson
