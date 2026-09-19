import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'w25d5',
  tier: 2,
  track: 'linux',
  week: 25,
  day: 5,
  title: 'Project: containerize inventory.py',
  badge: 'container-captain',
  concept: `This week's project runs on the real VM: install Docker, wrap the week 14 inventory.py in an image, and keep its JSON file in a volume so the data outlives every container.

The shape is the one from day 3. A five-line Dockerfile on python:3.12-slim, ENTRYPOINT pointing the script at /data/inventory.json, CMD ["list"] as the default. On the host, ~/inventory/data is mounted at /data with -v, so add and list share one file.

Docker works the same on Intel and Apple Silicon Macs inside the Ubuntu VM: apt fetches the right build. Adding yourself to the docker group is optional but saves typing sudo forever.`,
  example: {
    language: 'bash',
    caption: 'The whole flow, once the Dockerfile exists',
    code: `cd ~/inventory
docker build -t inventory .
docker run --rm -v "$PWD/data:/data" inventory add Widget 3
docker run --rm -v "$PWD/data:/data" inventory list
cat data/inventory.json`,
  },
  task: {
    kind: 'real',
    intro: 'Everything here happens inside the VM: open it with  multipass shell stackcraft. You will install Docker, build an image from your week 14 inventory.py, and run it with a volume for the JSON file. The app only reads what you paste.\n\nStep 1 installs Docker and adds your user to the docker group, so the later commands work without sudo. If you skip the group, put sudo in front of every docker command.\n\nStep 2 writes the Dockerfile and builds the image. Step 3 adds items and lists them from inside a container, with the data landing in ~/inventory/data on the VM.',
    steps: [
      {
        instruction: 'Install Docker from Ubuntu\'s repository, then let your user talk to the engine without sudo. The group change only applies to new logins, so leave the VM with exit and open it again with multipass shell stackcraft. Then paste the version line.',
        command: `sudo apt update
sudo apt install -y docker.io
sudo usermod -aG docker $USER
exit
# back on the Mac:
multipass shell stackcraft
docker --version
docker run --rm hello-world | head -3`,
        pasteLabel: 'Paste the output of docker --version',
        check: [{ type: 'regex', pattern: 'Docker version \\d+\\.\\d+', label: 'a line like Docker version 26.1.3' }],
        hint: 'If docker --version says command not found, the apt install did not finish; run it again and read the last lines. If docker run says permission denied on docker.sock, you did not log out and back in after usermod, or you can use sudo docker for now.',
        example: 'Docker version 26.1.3, build 26.1.3-0ubuntu1~24.04.1\n',
      },
      {
        instruction: 'Go to ~/inventory (the week 14 folder) and write the Dockerfile. The block includes a reference inventory.py behind a comment, in case yours went missing: only paste that part if you need it. Build the image and paste the image list.',
        command: `cd ~/inventory
ls inventory.py   # must exist; if not, paste the reference below
cat > Dockerfile <<'EOF'
FROM python:3.12-slim
WORKDIR /app
COPY inventory.py .
ENTRYPOINT ["python", "inventory.py", "--file", "/data/inventory.json"]
CMD ["list"]
EOF
docker build -t inventory .
docker images

# Reference inventory.py (only if you lost the week 14 file):
cat > inventory.py <<'EOF'
import argparse, json
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class Item:
    name: str
    qty: int = 1
    def __str__(self):
        return f"{self.name} x{self.qty}"

class Inventory:
    def __init__(self, path="inventory.json"):
        self.path = Path(path)
        self.items = {}
    def add(self, name, qty=1):
        if name in self.items:
            self.items[name].qty += qty
        else:
            self.items[name] = Item(name, qty)
        return self.items[name]
    def remove(self, name):
        del self.items[name]
    def __len__(self):
        return len(self.items)
    def __iter__(self):
        return iter(sorted(self.items.values(), key=lambda i: i.name))
    def save(self):
        self.path.write_text(json.dumps([asdict(i) for i in self], indent=2) + "\\n")
    @classmethod
    def load(cls, path):
        inv = cls(path)
        if inv.path.exists():
            for row in json.loads(inv.path.read_text()):
                inv.items[row["name"]] = Item(**row)
        return inv

def main():
    p = argparse.ArgumentParser(description="Keep a small inventory in a JSON file")
    p.add_argument("--file", default="inventory.json")
    sub = p.add_subparsers(dest="command", required=True)
    a = sub.add_parser("add"); a.add_argument("name"); a.add_argument("qty", type=int, nargs="?", default=1)
    r = sub.add_parser("remove"); r.add_argument("name")
    sub.add_parser("list")
    args = p.parse_args()
    inv = Inventory.load(args.file)
    if args.command == "add":
        print(f"added {inv.add(args.name, args.qty)}"); inv.save()
    elif args.command == "remove":
        inv.remove(args.name); inv.save(); print(f"removed {args.name}")
    else:
        for item in inv:
            print(item)
        print(f"{len(inv)} item(s)")

if __name__ == "__main__":
    main()
EOF`,
        pasteLabel: 'Paste the output of docker images',
        check: [{ type: 'includes', text: 'inventory' }, { type: 'regex', pattern: '^REPOSITORY\\s+TAG', flags: 'm', label: 'the docker images table header' }],
        hint: 'A build error names the failing line. "COPY failed" means inventory.py is not in the folder you built from, so run the build from ~/inventory with the trailing dot. If the table has no inventory row, the -t inventory tag was missing.',
        example: 'REPOSITORY    TAG         IMAGE ID       CREATED          SIZE\ninventory     latest      8a1f2c3d4e5f   12 seconds ago   131MB\npython        3.12-slim   1c2d3e4f5a6b   3 weeks ago      124MB\nhello-world   latest      d2c94e258dcb   17 months ago    13.3kB\n',
      },
      {
        instruction: 'Run the image with ~/inventory/data mounted at /data. Add Widget and one more item of your choice, then list. The list is the default CMD, so the last command needs no arguments. Paste the output of the list run (the add lines can come along).',
        command: `cd ~/inventory
docker run --rm -v "$PWD/data:/data" inventory add Widget 3
docker run --rm -v "$PWD/data:/data" inventory add Gadget 5
docker run --rm -v "$PWD/data:/data" inventory
cat data/inventory.json`,
        pasteLabel: 'Paste the output of the list run',
        check: [{ type: 'any', of: [{ type: 'includes', text: 'Widget' }, { type: 'regex', pattern: '^\\S+ x\\d+\\s*$', flags: 'm' }], label: 'Widget, or an item line like Gadget x5' }, { type: 'regex', pattern: '\\d+ item\\(s\\)|x\\d+', label: 'the list output of inventory.py' }],
        hint: 'If the list is empty, the add runs wrote somewhere else: every run needs the same -v "$PWD/data:/data" and you must be in ~/inventory each time. A permission error on data/ means Docker created it as root; run sudo chown -R $USER data.',
        example: 'added Widget x3\nadded Gadget x5\nGadget x5\nWidget x3\n2 item(s)\n',
      },
    ],
  },
  quiz: [
    { question: 'Why must you log out and in after usermod -aG docker $USER?', options: ['Docker restarts', 'Group membership is read at login, so the running shell still lacks the group', 'The password changes'], answer: 1, explanation: 'A new login picks up the new group; until then the socket still says permission denied.' },
    { question: 'What happens to inventory.json if you run the image without -v?', options: ['It is written inside the container and lost when --rm removes it', 'It is written to ~/inventory anyway', 'Docker refuses to run'], answer: 0, explanation: 'Without a mount, /data is part of the disposable container filesystem.' },
    { question: 'Why is python:3.12-slim a good base for a small tool?', options: ['It has no Python', 'It is a small Debian with Python and little else, so the image stays around 130 MB', 'It runs faster than full Python'], answer: 1, explanation: 'Smaller images pull faster and have fewer packages to keep patched.' },
  ],
}

export default lesson
