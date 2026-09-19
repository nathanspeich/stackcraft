import type { Lesson } from '../types'
import { ran, ranWith, steps } from '../checks'
import type { DockerState } from '../../shell/sim/docker'

const lesson: Lesson = {
  id: 'w25d1',
  tier: 2,
  track: 'linux',
  week: 25,
  day: 1,
  title: 'What a container is, installing Docker',
  concept: `A container is a process with its own view of the filesystem, network, and process list, started from an image. An image is a frozen snapshot of files: a tiny Linux userland, a language runtime, your app. It is not a virtual machine: containers share the host kernel, so they start in milliseconds and cost little memory.

Why bother? "Works on my machine" stops being an excuse. The image holds every dependency, so the same thing runs on your laptop, the VM, and a server.

Docker is the tool that builds images and runs containers. On Ubuntu, sudo apt install docker.io installs the engine and starts the dockerd service. Talking to it needs root or membership in the docker group, which is why every command below starts with sudo.`,
  example: {
    language: 'bash',
    caption: 'The first three commands on any new Docker install',
    code: `sudo apt install docker.io
sudo docker --version
sudo docker run hello-world
# Docker looks for the image locally, pulls it, runs it, prints, exits.
sudo docker ps -a      # the stopped container is still there
sudo docker images     # the image stays too`,
  },
  task: {
    kind: 'shell',
    instructions: 'Install Docker on this pretend machine and run your first container.\n1. Install it: sudo apt install docker.io\n2. Check the client works: docker --version\n3. Run the smoke-test image: sudo docker run hello-world\n4. List every container, including stopped ones: sudo docker ps -a\n5. List the images on the machine: sudo docker images\n\nOn the real VM you would also run  sudo usermod -aG docker $USER  and log out and in, so you can drop the sudo. This terminal keeps the sudo.',
    hints: ['Step 1 needs sudo: sudo apt install docker.io', 'docker --version talks to the client only, so it needs no sudo. Everything that talks to the engine does.', 'hello-world is not on the machine yet, so docker run pulls it first. Read the lines it prints: pull, then the greeting.', 'ps shows only running containers. hello-world exits at once, so you need ps -a to see it.'],
    solution: { commands: ['sudo apt install docker.io', 'docker --version', 'sudo docker run hello-world', 'sudo docker ps -a', 'sudo docker images'] },
    check: (r) => {
      const d = r.state?.sims?.docker as DockerState | undefined
      return steps([
        [Boolean(d?.installed), 'Step 1: install Docker with sudo apt install docker.io.'],
        [ranWith(r, /docker\s+--version/, /Docker version \d/), 'Step 2: run docker --version and check it prints a version.'],
        [ranWith(r, /docker\s+run\s+.*hello-world/, /Hello from Docker!/), 'Step 3: run sudo docker run hello-world and read the greeting.'],
        [ranWith(r, /docker\s+ps\s+(-a|--all)/, /hello-world/), 'Step 4: sudo docker ps -a should list the exited hello-world container.'],
        [ranWith(r, /docker\s+(images|image\s+ls)/, /hello-world\s+latest/), 'Step 5: sudo docker images should show the hello-world image.'],
        [ran(r, /docker/), 'Use the docker command for each step.'],
      ], 'Docker is installed and you have run a container. Tomorrow: the flags that make containers useful.')
    },
  },
  quiz: [
    { question: 'What is the difference between an image and a container?', options: ['They are two names for the same thing', 'An image is the frozen snapshot of files; a container is a running (or stopped) process started from it', 'A container is the download, an image is the running copy'], answer: 1, explanation: 'One image can start many containers, the way one program can run as many processes.' },
    { question: 'Why do containers start much faster than virtual machines?', options: ['They share the host kernel instead of booting their own', 'They are compressed', 'They skip the filesystem'], answer: 0, explanation: 'A container is just an isolated process on the same kernel; there is no operating system to boot.' },
    { question: 'Why does docker ps not show the hello-world container?', options: ['It was never created', 'ps lists only running containers, and hello-world exited; use ps -a', 'Images do not appear in ps'], answer: 1, explanation: 'Stopped containers are kept until you rm them; ps -a shows them.' },
  ],
}

export default lesson
