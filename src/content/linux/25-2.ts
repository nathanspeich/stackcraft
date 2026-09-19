import type { Lesson } from '../types'
import { fileContent, ran, ranWith, steps } from '../checks'
import { dockerInstalled, type DockerState } from '../../shell/sim/docker'

const lesson: Lesson = {
  id: 'w25d2',
  tier: 2,
  track: 'linux',
  week: 25,
  day: 2,
  title: 'docker run flags, exec, logs',
  concept: `A container is sealed by default: no ports reachable, no files shared, a random name. Flags on docker run open exactly the doors you choose.

-d runs it in the background and prints its id. --name web gives it a name you can type later. -p 8080:80 publishes container port 80 on host port 8080, so curl localhost:8080 reaches it. -v "$PWD/notes:/notes" mounts a host folder inside the container; files written there survive the container. --rm deletes the container when it exits.

Two commands look inside. docker exec NAME CMD runs a command in a running container. docker logs NAME shows everything its main process printed. Then stop, and rm to clean up.`,
  example: {
    language: 'bash',
    caption: 'One nginx container, opened up on purpose',
    code: `sudo docker run -d --name web -p 8080:80 nginx
curl localhost:8080          # the nginx welcome page
sudo docker exec web ls /usr/share/nginx/html
sudo docker logs web         # startup lines, then your GET
sudo docker stop web
sudo docker rm web`,
  },
  task: {
    kind: 'shell',
    instructions: 'Docker is already installed on this machine.\n1. Start nginx in the background, named web, with container port 80 published on host port 8080.\n2. Fetch the page: curl localhost:8080\n3. Run a command inside it: sudo docker exec web ls /usr/share/nginx/html\n4. Read its output: sudo docker logs web (your GET request should be the last line).\n5. Share a folder: run alpine with --rm and  -v "$PWD/notes:/notes"  and the command  sh -c "echo hello from a container > /notes/hi.txt"  then cat notes/hi.txt on the host.\n6. Stop and remove web.',
    machine: { sims: { docker: dockerInstalled() } },
    hints: ['Step 1: sudo docker run -d --name web -p 8080:80 nginx', 'Step 5: sudo docker run --rm -v "$PWD/notes:/notes" alpine sh -c "echo hello from a container > /notes/hi.txt"', 'The quotes around $PWD/notes:/notes keep the path in one piece even if it has spaces.', 'Step 6: sudo docker stop web, then sudo docker rm web. rm refuses while it is running.'],
    solution: { commands: ['sudo docker run -d --name web -p 8080:80 nginx', 'curl localhost:8080', 'sudo docker exec web ls /usr/share/nginx/html', 'sudo docker logs web', 'sudo docker run --rm -v "$PWD/notes:/notes" alpine sh -c "echo hello from a container > /notes/hi.txt"', 'cat notes/hi.txt', 'sudo docker stop web', 'sudo docker rm web'] },
    check: (r) => {
      const d = r.state?.sims?.docker as DockerState | undefined
      const h = r.history ?? []
      const o = r.outputs ?? []
      const runIdx = h.findIndex((c) => /docker\s+run\b.*--name\s+web\b/.test(c) && /-p\s+8080:80\b/.test(c) && /\bnginx\b/.test(c) && /(^|\s)(-d|--detach)(\s|$)/.test(c))
      const curlOk = h.some((c, i) => i > runIdx && /curl\s+.*localhost:8080/.test(c) && /Welcome to nginx/.test(o[i] ?? ''))
      const execOk = ranWith(r, /docker\s+exec\s+web\s+ls\s+\/usr\/share\/nginx\/html/, /index\.html/)
      const logsOk = ranWith(r, /docker\s+logs\s+web/, /GET \/ HTTP/)
      const volOk = ran(r, /docker\s+run\b.*-v\s+"?\$PWD\/notes:\/notes"?.*\balpine\b/)
      const note = fileContent(r, '/home/learner/notes/hi.txt') ?? ''
      const web = d?.containers.find((c) => c.name === 'web')
      return steps([
        [runIdx >= 0, 'Step 1: sudo docker run -d --name web -p 8080:80 nginx'],
        [curlOk, 'Step 2: curl localhost:8080 should print the nginx welcome page.'],
        [execOk, 'Step 3: sudo docker exec web ls /usr/share/nginx/html should list index.html.'],
        [logsOk, 'Step 4: sudo docker logs web should end with the GET / line from your curl.'],
        [volOk && /hello from a container/.test(note), 'Step 5: run alpine with -v "$PWD/notes:/notes" and write /notes/hi.txt from inside; then notes/hi.txt should exist on the host.'],
        [ranWith(r, /cat\s+notes\/hi\.txt/, /hello from a container/), 'Step 5: cat notes/hi.txt on the host to prove the file came out of the container.'],
        [ran(r, /docker\s+stop\s+web/) && !web, 'Step 6: sudo docker stop web, then sudo docker rm web.'],
      ], 'Ports, volumes, exec, and logs: that is most of what you do with containers day to day.')
    },
  },
  quiz: [
    { question: 'In -p 8080:80, which number is the host port?', options: ['80', '8080', 'Both are host ports'], answer: 1, explanation: 'The format is HOST:CONTAINER. Your browser or curl uses the host side.' },
    { question: 'What does -v "$PWD/notes:/notes" do?', options: ['Copies notes into the image forever', 'Mounts the host folder inside the container, so writes land on the host', 'Creates a network called notes'], answer: 1, explanation: 'A bind mount shares a folder live; the container sees the host files and vice versa.' },
    { question: 'Which command shows what a background container printed?', options: ['docker logs NAME', 'docker exec NAME', 'docker ps'], answer: 0, explanation: 'logs collects the main process output; exec runs a new command inside.' },
  ],
}

export default lesson
