import type { Lesson } from '../types'
import { fileContent, ranWith, steps } from '../checks'
import { dockerInstalled, type DockerState } from '../../shell/sim/docker'

/** Compact version of the week 14 inventory.py, so the build context has a real program in it. */
const INVENTORY_PY = `#!/usr/bin/env python3
"""inventory.py: keep a small inventory in a JSON file (week 14)."""
import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path

DATA_FILE = "inventory.json"


@dataclass
class Item:
    name: str
    qty: int = 1

    def __str__(self):
        return f"{self.name} x{self.qty}"


class Inventory:
    def __init__(self, path=DATA_FILE):
        self.path = Path(path)
        self.items = {}

    def add(self, name, qty=1):
        if qty <= 0:
            raise ValueError("quantity must be positive")
        if name in self.items:
            self.items[name].qty += qty
        else:
            self.items[name] = Item(name, qty)
        return self.items[name]

    def remove(self, name, qty=None):
        if name not in self.items:
            raise KeyError(f"no such item: {name}")
        if qty is None or qty >= self.items[name].qty:
            del self.items[name]
        else:
            self.items[name].qty -= qty

    def __len__(self):
        return len(self.items)

    def __iter__(self):
        return iter(sorted(self.items.values(), key=lambda i: i.name))

    def save(self):
        self.path.write_text(json.dumps([asdict(i) for i in self], indent=2) + "\\n")

    @classmethod
    def load(cls, path=DATA_FILE):
        inv = cls(path)
        if inv.path.exists():
            for row in json.loads(inv.path.read_text()):
                inv.items[row["name"]] = Item(**row)
        return inv


def main(argv=None):
    parser = argparse.ArgumentParser(description="Keep a small inventory in a JSON file")
    parser.add_argument("--file", default=DATA_FILE, help="where the data lives")
    sub = parser.add_subparsers(dest="command", required=True)
    p_add = sub.add_parser("add", help="add an item")
    p_add.add_argument("name")
    p_add.add_argument("qty", type=int, nargs="?", default=1)
    p_rm = sub.add_parser("remove", help="remove an item, or part of its quantity")
    p_rm.add_argument("name")
    p_rm.add_argument("qty", type=int, nargs="?")
    sub.add_parser("list", help="list everything")
    args = parser.parse_args(argv)
    inv = Inventory.load(args.file)
    if args.command == "add":
        print(f"added {inv.add(args.name, args.qty)}")
        inv.save()
    elif args.command == "remove":
        inv.remove(args.name, args.qty)
        inv.save()
        print(f"removed {args.name}")
    else:
        for item in inv:
            print(item)
        print(f"{len(inv)} item(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`

const lesson: Lesson = {
  id: 'w25d3',
  tier: 2,
  track: 'linux',
  week: 25,
  day: 3,
  title: 'A Dockerfile for inventory.py',
  concept: `A Dockerfile is a recipe for an image, one instruction per line. FROM picks the base image (python:3.12-slim is a small Debian with Python). WORKDIR /app sets the folder later lines and the running container use. COPY inventory.py . copies from the build context (the folder you pass to docker build) into the image. RUN executes a command while building, for example pip install.

ENTRYPOINT and CMD together decide what runs. ENTRYPOINT is the fixed part, CMD the default arguments; anything you type after the image name replaces CMD. So ENTRYPOINT ["python", "inventory.py", "--file", "/data/inventory.json"] plus CMD ["list"] means docker run inventory lists, and docker run inventory add Widget 3 adds.

docker build -t inventory . builds and names it. Each instruction becomes a cached layer, so rebuilds are fast.`,
  example: {
    language: 'text',
    caption: 'A Dockerfile for a small Python tool',
    code: `FROM python:3.12-slim
WORKDIR /app
COPY inventory.py .
ENTRYPOINT ["python", "inventory.py", "--file", "/data/inventory.json"]
CMD ["list"]

# build it, then run it with a folder mounted at /data
#   sudo docker build -t inventory .
#   sudo docker run --rm -v "$PWD/data:/data" inventory add Widget 3`,
  },
  task: {
    kind: 'shell',
    instructions: 'You are in ~/inventory with the week 14 inventory.py. Write the Dockerfile in the editor, then build and run it.\n1. Dockerfile: FROM python:3.12-slim, WORKDIR /app, COPY inventory.py into it, ENTRYPOINT ["python", "inventory.py", "--file", "/data/inventory.json"], CMD ["list"].\n2. Build: sudo docker build -t inventory .\n3. Add an item, mounting a data folder: sudo docker run --rm -v "$PWD/data:/data" inventory add Widget 3\n4. Add  Gadget 5  the same way, then run the image with no command to list (the CMD).\n5. cat data/inventory.json on the host: the JSON survived because /data is a volume.',
    seed: { '/home/learner/inventory/inventory.py': INVENTORY_PY },
    cwd: '/home/learner/inventory',
    file: '/home/learner/inventory/Dockerfile',
    starter: '# Dockerfile for inventory.py\n# 1. base image\n\n# 2. working directory\n\n# 3. copy the script in\n\n# 4. fixed command (ENTRYPOINT) and default arguments (CMD)\n\n',
    machine: { sims: { docker: dockerInstalled() } },
    hints: ['The five lines from the example above are the whole Dockerfile. Instructions are upper case; the JSON form uses double quotes.', 'Build from the folder that holds the Dockerfile: the dot at the end of docker build -t inventory . is the build context.', 'Step 3: sudo docker run --rm -v "$PWD/data:/data" inventory add Widget 3. Docker creates data/ on the host if it is missing.', 'Step 4: the same command with add Gadget 5, then sudo docker run --rm -v "$PWD/data:/data" inventory'],
    solution: {
      file: 'FROM python:3.12-slim\nWORKDIR /app\nCOPY inventory.py .\nENTRYPOINT ["python", "inventory.py", "--file", "/data/inventory.json"]\nCMD ["list"]\n',
      commands: ['sudo docker build -t inventory .', 'sudo docker run --rm -v "$PWD/data:/data" inventory add Widget 3', 'sudo docker run --rm -v "$PWD/data:/data" inventory add Gadget 5', 'sudo docker run --rm -v "$PWD/data:/data" inventory', 'cat data/inventory.json'],
    },
    check: (r) => {
      const df = fileContent(r, '/home/learner/inventory/Dockerfile') ?? ''
      const d = r.state?.sims?.docker as DockerState | undefined
      const img = d?.images.find((i) => i.repo === 'inventory')
      const json = fileContent(r, '/home/learner/inventory/data/inventory.json') ?? ''
      return steps([
        [/^FROM\s+python:3\.12(-slim)?\s*$/m.test(df), 'Step 1: start the Dockerfile with FROM python:3.12-slim.'],
        [/^WORKDIR\s+\/app\s*$/m.test(df), 'Step 1: add WORKDIR /app.'],
        [/^COPY\s+inventory\.py\s+(\.|\/app\/?)\s*$/m.test(df), 'Step 1: add COPY inventory.py . so the script is in the image.'],
        [/^ENTRYPOINT\s+\[\s*"python3?"\s*,\s*"inventory\.py"\s*,\s*"--file"\s*,\s*"\/data\/inventory\.json"\s*\]\s*$/m.test(df), 'Step 1: ENTRYPOINT ["python", "inventory.py", "--file", "/data/inventory.json"] in JSON form.'],
        [/^CMD\s+\[\s*"list"\s*\]\s*$/m.test(df), 'Step 1: CMD ["list"] gives the default command.'],
        [Boolean(img) && img!.layers.some((l) => /^COPY inventory\.py/.test(l)) && Boolean(img!.entrypoint?.includes('--file')), 'Step 2: build the image with sudo docker build -t inventory . (after finishing the Dockerfile).'],
        [ranWith(r, /docker\s+run\b.*-v\s+"?\$PWD\/data:\/data"?\s+inventory\s+add\s+Widget\s+3/, /added Widget x3/), 'Step 3: sudo docker run --rm -v "$PWD/data:/data" inventory add Widget 3 should print: added Widget x3'],
        [ranWith(r, /docker\s+run\b.*inventory\s+add\s+Gadget\s+5/, /added Gadget x5/), 'Step 4: add Gadget 5 the same way.'],
        [ranWith(r, /docker\s+run\b.*-v\s+"?\$PWD\/data:\/data"?\s+inventory\s*$/, /Gadget x5\nWidget x3\n2 item\(s\)/), 'Step 4: run the image with no command; the CMD lists Gadget x5, Widget x3, 2 item(s).'],
        [/Widget/.test(json) && ranWith(r, /cat\s+data\/inventory\.json/, /"Widget"/), 'Step 5: cat data/inventory.json on the host; the volume kept the file.'],
      ], 'Your Python tool now ships as an image, and its data lives outside the container where it belongs.')
    },
  },
  quiz: [
    { question: 'What is the build context in docker build -t inventory . ?', options: ['The image name', 'The folder whose files COPY can see, here the current directory', 'The Dockerfile itself'], answer: 1, explanation: 'COPY paths are relative to the context. A file outside it cannot be copied.' },
    { question: 'With ENTRYPOINT ["python", "app.py"] and CMD ["list"], what runs for docker run img add x 2 ?', options: ['python app.py add x 2', 'python app.py list add x 2', 'add x 2 on its own'], answer: 0, explanation: 'Arguments after the image name replace CMD, and are appended to ENTRYPOINT.' },
    { question: 'Why mount /data instead of writing inventory.json inside the container?', options: ['Containers cannot write files', 'Files inside a container vanish when it is removed; a mounted folder persists on the host', 'It makes the image smaller'], answer: 1, explanation: 'Containers are disposable. Anything worth keeping goes in a volume or bind mount.' },
  ],
}

export default lesson
