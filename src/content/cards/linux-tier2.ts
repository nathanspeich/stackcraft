import type { Card } from '../types'

const c = (n: number, lesson: string, front: string, back: string): Card => ({ id: `linux-${n}`, track: 'linux', tier: 2, lesson, front, back })

/** Tier 2 Linux cards, unlocked lesson by lesson from week 13 onward. */
export const LINUX_TIER2_CARDS: Card[] = [
  c(26, 'w13d1', 'set -euo pipefail', 'The safety header: exit on any failure, treat unset variables as errors, and make a pipeline fail if any part fails.'),
  c(27, 'w13d1', 'multipass shell stackcraft', 'Opens a shell inside the Ubuntu VM on your Mac. multipass list shows its IP and state.'),
  c(28, 'w13d2', 'getopts "vf:" opt', 'Parses flags in a loop. Each letter lands in $opt; a letter followed by a colon takes a value in $OPTARG.'),
  c(29, 'w13d2', 'shift $((OPTIND - 1))', 'Drops the flags getopts consumed so $1 becomes the first plain argument.'),
  c(30, 'w13d3', 'case "$x" in a|b) ... ;; *) ... ;; esac', 'Matches one value against glob patterns. Each branch ends with ;; and the whole thing ends with esac.'),
  c(31, 'w13d3', '"${files[@]}" and ${#files[@]}', 'Every element of an array, safely quoted, and the number of elements.'),
  c(32, 'w13d4', "trap 'rm -rf \"$tmp\"' EXIT", 'Runs the command when the script exits, even after an error. Single quotes delay the expansion until it runs.'),
  c(33, 'w13d4', 'bash -x script.sh', 'Runs the script printing every command before it executes, prefixed with +. The quickest way to see where it goes wrong.'),
  c(34, 'w16d1', 'usermod -aG docker alice', 'Appends alice to the docker group. Without -a, -G replaces all her extra groups.'),
  c(35, 'w16d2', 'umask 022', 'Bits removed from new files and directories. 022 gives 644 files and 755 directories by default.'),
  c(36, 'w16d3', 'chmod 2775 /srv/team (setgid on a directory)', 'New files inside inherit the directory group instead of the creator primary group. Shows as s in the group execute slot.'),
  c(37, 'w16d4', 'sudo -l -U deploy', 'Lists what deploy may run with sudo. Rules live in /etc/sudoers and /etc/sudoers.d, checked with visudo -c.'),
  c(38, 'w19d1', 'journalctl -u backup.service -n 20', 'Shows the last 20 log lines of one unit. Add -f on a real box to follow, -xe for detail after a failure.'),
  c(39, 'w19d2', '[Install] WantedBy=multi-user.target', 'The section that lets systemctl enable work: the unit starts at boot as part of the normal multi-user system.'),
  c(40, 'w19d3', 'systemctl list-timers', 'Shows every timer with its next and last run. A .timer activates the .service of the same name.'),
  c(41, 'w19d4', 'After=network-online.target', 'Ordering: start this unit after the network is up. Requires= adds a hard dependency, After= only sets the order.'),
  c(42, 'w22d1', 'ss -tulpn', 'Lists TCP and UDP listening sockets with the process behind each port. The first thing to run when a port seems taken or closed.'),
  c(43, 'w22d3', 'sudo ufw allow 8000/tcp', 'Opens a port in the firewall. Allow OpenSSH before ufw enable or you lock yourself out.'),
  c(44, 'w25d2', 'docker run -d -p 8080:80 --name web nginx', 'Detached container named web, host port 8080 forwarded to container port 80. docker logs web shows its output.'),
  c(45, 'w25d4', 'docker compose up -d', 'Starts every service in compose.yaml on a shared network. docker compose ps lists them, down stops and removes them.'),
]
