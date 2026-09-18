import type { Lesson } from '../types'
import { codeHas, noError, outLines, steps } from '../checks'

const STARTER = `import json
from pathlib import Path

import requests


class CachedClient:
    """Talks to one API and remembers answers on disk."""

    def __init__(self, base_url, cache_dir="cache", timeout=5):
        self.base_url = base_url
        self.cache_dir = Path(cache_dir)
        self.timeout = timeout
        self.hits = 0
        self.misses = 0
        # 1. create the cache directory

    def cache_path(self, path, params):
        # 2. a file name built from the path and the sorted params
        return self.cache_dir / "todo.json"

    def get(self, path, params=None):
        params = params or {}
        # 3. cached? read and return it. Otherwise fetch, save, return
        return {}


client = CachedClient("https://api.stackcraft.dev")
for city in ["Lisbon", "Oslo", "Lisbon"]:
    data = client.get("/weather", {"city": city})
    # 4. print the city and temperature
# 5. print the hit and miss counts
`

const SOLUTION = `import json
from pathlib import Path

import requests


class CachedClient:
    """Talks to one API and remembers answers on disk."""

    def __init__(self, base_url, cache_dir="cache", timeout=5):
        self.base_url = base_url
        self.cache_dir = Path(cache_dir)
        self.timeout = timeout
        self.hits = 0
        self.misses = 0
        # 1. create the cache directory
        self.cache_dir.mkdir(exist_ok=True)

    def cache_path(self, path, params):
        # 2. a file name built from the path and the sorted params
        key = path.strip("/").replace("/", "_")
        for name, value in sorted(params.items()):
            key += f"_{name}-{value}"
        return self.cache_dir / f"{key}.json"

    def get(self, path, params=None):
        params = params or {}
        # 3. cached? read and return it. Otherwise fetch, save, return
        file = self.cache_path(path, params)
        if file.exists():
            self.hits += 1
            return json.loads(file.read_text())
        self.misses += 1
        r = requests.get(self.base_url + path, params=params, timeout=self.timeout)
        r.raise_for_status()
        data = r.json()
        file.write_text(json.dumps(data, indent=2))
        return data


client = CachedClient("https://api.stackcraft.dev")
for city in ["Lisbon", "Oslo", "Lisbon"]:
    data = client.get("/weather", {"city": city})
    # 4. print the city and temperature
    print(f"{data['city']}: {data['temp_c']}C")
# 5. print the hit and miss counts
print(f"hits: {client.hits}, misses: {client.misses}")
`

const lesson: Lesson = {
  id: 'w23d4',
  tier: 2,
  track: 'python',
  week: 23,
  day: 4,
  title: 'A client class with a disk cache',
  concept: `After three days of requests.get calls you can see the repetition: the same base URL, headers, timeout, and error checks. A small client class holds those once and gives the rest of the program a clean method like client.get("/weather", {"city": "Oslo"}).

The class is also the natural place for a cache. Many API answers do not change for hours, and every call costs time and rate limit. So: turn the path and parameters into a file name, and before calling the network, check whether that file exists. If it does, read it and return. If not, fetch, save the JSON to the file, return.

Counting hits and misses shows whether the cache helps. The files land in a cache folder you can inspect, and delete when you want fresh data.`,
  example: {
    language: 'python',
    caption: 'Check the disk before the network',
    code: `from pathlib import Path
import json

cache = Path("cache")
cache.mkdir(exist_ok=True)
file = cache / "weather_city-Oslo.json"

if file.exists():
    data = json.loads(file.read_text())     # hit: no request made
else:
    r = requests.get(url, params={"city": "Oslo"}, timeout=5)
    r.raise_for_status()
    data = r.json()
    file.write_text(json.dumps(data, indent=2))   # miss: save for next time`,
  },
  task: {
    kind: 'python',
    instructions: 'Finish CachedClient. The demo endpoint answers /weather?city=<name>.\n1. In __init__ create the cache directory with mkdir(exist_ok=True).\n2. cache_path(path, params) returns cache_dir / "<key>.json" where key is the path without slashes (weather) followed by _name-value for each param in sorted order, so /weather with city Lisbon becomes cache/weather_city-Lisbon.json.\n3. get(path, params=None): if the cache file exists, count a hit and return json.loads of its text. Otherwise count a miss, call requests.get(self.base_url + path, params=params, timeout=self.timeout), call raise_for_status(), save r.json() to the file with json.dumps, and return it.\n4. In the loop print  Lisbon: 24C  (keys city and temp_c).\n5. Finally print  hits: 1, misses: 2 .',
    starter: STARTER,
    hints: [
      'self.cache_dir.mkdir(exist_ok=True)',
      'key = path.strip("/").replace("/", "_") then for name, value in sorted(params.items()): key += f"_{name}-{value}" and return self.cache_dir / f"{key}.json"',
      'file = self.cache_path(path, params); if file.exists(): self.hits += 1; return json.loads(file.read_text())',
      'On a miss: r = requests.get(self.base_url + path, params=params, timeout=self.timeout); r.raise_for_status(); data = r.json(); file.write_text(json.dumps(data, indent=2)); return data',
    ],
    solution: { file: SOLUTION },
    check: (r) => {
      const ls = outLines(r)
      const files = Object.keys(r.fs ?? {})
      const lisbon = files.find((f) => f === 'cache/weather_city-Lisbon.json')
      const oslo = files.find((f) => f === 'cache/weather_city-Oslo.json')
      let valid = false
      try { valid = Boolean(lisbon) && JSON.parse(r.fs?.[lisbon ?? ''] ?? '').temp_c === 24 } catch { valid = false }
      return steps([
        [noError(r), 'Your program raised an error. Read the last red line.'],
        [codeHas(r, /mkdir\(\s*exist_ok\s*=\s*True/), 'Step 1: create the cache directory with self.cache_dir.mkdir(exist_ok=True).'],
        [Boolean(lisbon) && Boolean(oslo), 'Step 2: the cache files should be cache/weather_city-Lisbon.json and cache/weather_city-Oslo.json.'],
        [valid, 'Step 3: the cache file should contain the JSON from the response (temp_c 24 for Lisbon), saved with json.dumps.'],
        [codeHas(r, /raise_for_status\(\)/) && codeHas(r, /timeout\s*=\s*self\.timeout/), 'Step 3: call requests.get with timeout=self.timeout and then r.raise_for_status().'],
        [ls[0] === 'Lisbon: 24C' && ls[1] === 'Oslo: 9C' && ls[2] === 'Lisbon: 24C', `Step 4: expected  Lisbon: 24C ,  Oslo: 9C ,  Lisbon: 24C  (yours: ${JSON.stringify(ls.slice(0, 3))}).`],
        [ls[3] === 'hits: 1, misses: 2', 'Step 5: the last line should be  hits: 1, misses: 2 . The second Lisbon call should come from disk.'],
      ], 'Two network calls instead of three, and the answers are saved in cache/ for next time.')
    },
  },
  quiz: [
    { question: 'Why sort the params when building the cache file name?', options: ['Files must be alphabetical', 'So {"a": 1, "b": 2} and {"b": 2, "a": 1} map to the same file', 'It makes the request faster'], answer: 1, explanation: 'The same question in a different order should hit the same cached answer.' },
    { question: 'What is the main downside of caching API responses?', options: ['Disk space runs out immediately', 'You may serve stale data after the real answer changed', 'JSON cannot be written to files'], answer: 1, explanation: 'A cache trades freshness for speed; real caches add an age limit or a way to clear entries.' },
    { question: 'Why put base_url and timeout in the class instead of every call?', options: ['Classes are faster', 'They are set once, so every method uses the same values and there is one place to change them', 'requests requires a class'], answer: 1, explanation: 'Shared settings belong in one place. That is what the class is for.' },
  ],
}

export default lesson
