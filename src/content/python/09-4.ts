import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const lesson: Lesson = {
  id: 'w09d4',
  tier: 1,
  track: 'python',
  week: 9,
  day: 4,
  title: 'Calling an HTTP API',
  concept: `Many services expose an API: a web address that returns data instead of a page, usually as JSON. Your program sends a request, reads the response, and uses the data.

The requests library makes this short. r = requests.get(url, params={"city": "Lisbon"}) sends a GET with a query string. r.status_code is the HTTP status: 200 ok, 404 not found, 500 server error. r.ok is True for 2xx. r.json() parses the body into Python objects.

Check the status before trusting the body, and pass timeout=5 so a dead server cannot hang your program. Network calls can fail entirely, so wrap them in try/except requests.exceptions.ConnectionError.

This sandbox has no network, so requests answers from a built-in demo: the weather endpoint knows Lisbon, Seoul, Pune, and Oslo.`,
  example: {
    language: 'python',
    caption: 'Ask, check, use',
    code: `import requests

r = requests.get("https://api.stackcraft.dev/weather", params={"city": "Seoul"}, timeout=5)
print(r.status_code)
if r.ok:
    data = r.json()
    print(f"{data['city']}: {data['temp_c']} C, {data['condition']}")
else:
    print("request failed")`,
  },
  task: {
    kind: 'python',
    instructions: 'Write a function weather(city) that calls https://api.stackcraft.dev/weather with the city as a query parameter and a 5 second timeout.\n1. If the response is ok, return  <city>: <temp_c> C, <condition>  built from the JSON.\n2. Otherwise return  <city>: not found (<status_code>) .\nCall it for Lisbon, Oslo, and Atlantis, printing each result on its own line.\n3. Finally, call requests.get on https://nowhere.invalid inside try/except requests.exceptions.ConnectionError and print  network error  in the except block.',
    starter: 'import requests\n\nBASE = "https://api.stackcraft.dev/weather"\n',
    hints: ['r = requests.get(BASE, params={"city": city}, timeout=5)', 'data = r.json() then f"{data[\'city\']}: {data[\'temp_c\']} C, {data[\'condition\']}"', 'if not r.ok: return f"{city}: not found ({r.status_code})"', 'except requests.exceptions.ConnectionError: print("network error")'],
    solution: { file: 'import requests\n\nBASE = "https://api.stackcraft.dev/weather"\n\ndef weather(city):\n    r = requests.get(BASE, params={"city": city}, timeout=5)\n    if r.ok:\n        data = r.json()\n        return f"{data[\'city\']}: {data[\'temp_c\']} C, {data[\'condition\']}"\n    return f"{city}: not found ({r.status_code})"\n\nfor city in ["Lisbon", "Oslo", "Atlantis"]:\n    print(weather(city))\n\ntry:\n    requests.get("https://nowhere.invalid", timeout=5)\nexcept requests.exceptions.ConnectionError:\n    print("network error")\n' },
    check: (r) => {
      const ls = outLines(r)
      return steps([
        [noError(r), 'Your program raised an unhandled error. Read the last red line.'],
        [codeHas(r, /def\s+weather\s*\(\s*city\s*\)/) && codeHas(r, /params\s*=/) && codeHas(r, /timeout\s*=/), 'Define weather(city) and call requests.get with params= and timeout=.'],
        [ls[0] === 'Lisbon: 24 C, sunny' && ls[1] === 'Oslo: 9 C, windy', 'Lines 1 and 2: Lisbon: 24 C, sunny and Oslo: 9 C, windy, built from r.json().'],
        [ls[2] === 'Atlantis: not found (404)' && codeHas(r, 'status_code'), 'Line 3: Atlantis: not found (404), using r.ok or r.status_code.'],
        [ls[3] === 'network error' && codeHas(r, 'except requests.exceptions.ConnectionError'), 'Line 4: network error from an except requests.exceptions.ConnectionError block.'],
      ], 'Requests sent, statuses checked, JSON used, failure handled.')
    },
  },
  quiz: [
    { question: 'What does r.json() do?', options: ['Sends JSON to the server', 'Parses the response body into Python objects', 'Prints the response'], answer: 1, explanation: 'It decodes the JSON text into dicts, lists, strings, and numbers.' },
    { question: 'Which status code means the resource does not exist?', options: ['200', '404', '500'], answer: 1, explanation: '404 is Not Found. 200 is success, 500 is a server-side error.' },
    { question: 'Why pass timeout= to requests.get?', options: ['To make the request faster', 'So a silent server does not hang the program forever', 'It is required'], answer: 1, explanation: 'Without a timeout, a request can wait indefinitely.' },
  ],
}

export default lesson
