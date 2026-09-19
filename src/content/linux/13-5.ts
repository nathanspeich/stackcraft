import type { Lesson } from '../types'

const BACKUP_SH = `#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: $0 SOURCE_DIR DEST_DIR" >&2
  exit 1
}

[ "$#" -eq 2 ] || usage
src=$1
dest=$2
[ -d "$src" ] || { echo "error: $src is not a directory" >&2; exit 1; }

mkdir -p "$dest"
stamp=$(date +%F)
archive="$dest/backup-$stamp.tar.gz"

tar -czf "$archive" -C "$(dirname "$src")" "$(basename "$src")"
echo "created $archive"

# keep only the newest 5 backups
ls -1t "$dest"/backup-*.tar.gz | tail -n +6 | while read -r old; do
  rm -f "$old"
  echo "removed $old"
done`

const lesson: Lesson = {
  id: 'w13d5',
  tier: 2,
  track: 'linux',
  week: 13,
  day: 5,
  title: 'Project: backup.sh',
  badge: 'bash-builder',
  concept: `Your first real project: a backup script that you will keep using. backup.sh takes a source folder and a destination, creates a dated tar.gz archive, keeps only the last five backups, and prints a usage message with exit code 1 when called wrongly.

Everything from this week goes in: the safety header, a usage function, argument checks, command substitution for the date, and a pipeline that trims old archives. Week 19 turns this script into a systemd service with a timer.

Write it in the VM with nano (sudo apt install nano if needed) or paste the reference version below, then prove it works by pasting three outputs.`,
  example: {
    language: 'bash',
    caption: 'The trimming pipeline explained',
    code: `# newest first, skip the first 5, delete the rest
ls -1t "$dest"/backup-*.tar.gz | tail -n +6 | while read -r old; do
  rm -f "$old"
done`,
  },
  task: {
    kind: 'real',
    intro: `Work inside the VM (multipass shell stackcraft). Create ~/backup.sh, make it executable, and test it on a small folder. shellcheck is the linter you met yesterday.

The reference script is in the first step. Type it yourself if you want the practice, or paste it with cat and a quoted here-doc so nothing expands.`,
    steps: [
      {
        instruction: 'Install shellcheck, create ~/backup.sh (the reference is below), make it executable, and lint it. A clean shellcheck prints nothing, so the && echo adds a line you can paste.',
        command: `sudo apt update && sudo apt install -y shellcheck
cat > ~/backup.sh <<'EOF'
${BACKUP_SH}
EOF
chmod +x ~/backup.sh
shellcheck ~/backup.sh && echo "no issues"`,
        pasteLabel: 'Paste the output of shellcheck ~/backup.sh && echo "no issues"',
        check: [{ type: 'not', pattern: 'SC\\d{4}', label: 'no SC codes (shellcheck findings)' }, { type: 'includes', text: 'no issues' }],
        hint: 'Every shellcheck finding names a line and an SC code. Fix the line it points at (usually missing double quotes around a variable) and run it again until only "no issues" prints.',
        example: 'no issues\n',
      },
      {
        instruction: 'Make a small folder to back up, run the script against ~/backups, and list the destination. You should see a dated archive.',
        command: `mkdir -p ~/projects/demo && echo "hello" > ~/projects/demo/hello.txt
~/backup.sh ~/projects/demo ~/backups
ls -l ~/backups`,
        pasteLabel: 'Paste the output of ls -l ~/backups',
        check: [{ type: 'regex', pattern: 'backup-\\d{4}-\\d{2}-\\d{2}\\.tar\\.gz', label: 'a file named like backup-2026-09-17.tar.gz' }],
        hint: 'If tar complains about the path, check the -C "$(dirname "$src")" "$(basename "$src")" line: it enters the parent folder and archives just the folder name. Run the script with bash -x ~/backup.sh ... to see each step.',
        example: 'total 4\n-rw-rw-r-- 1 ubuntu ubuntu 158 Sep 17 10:42 backup-2026-09-17.tar.gz\n',
      },
      {
        instruction: 'Run the script with no arguments, then print the exit code on the next line. The usage message should appear and the code should be 1.',
        command: '~/backup.sh\necho $?',
        pasteLabel: 'Paste both the usage line and the exit code',
        check: [{ type: 'includes', text: 'Usage' }, { type: 'regex', pattern: '^1\\s*$', flags: 'm', label: 'a line containing just the exit code 1' }],
        hint: 'The usage function must end with exit 1, and the check [ "$#" -eq 2 ] || usage must come before anything else uses $1. If you see 0, the script did not exit inside usage.',
        example: 'Usage: /home/ubuntu/backup.sh SOURCE_DIR DEST_DIR\n1\n',
      },
    ],
  },
  quiz: [
    { question: 'Why does the script use tar -C "$(dirname "$src")" "$(basename "$src")"?', options: ['To compress faster', 'So the archive contains just the folder name, not the full absolute path', 'Because tar cannot take absolute paths'], answer: 1, explanation: 'Entering the parent first keeps the archive tidy: restoring it recreates demo/, not home/ubuntu/projects/demo/.' },
    { question: 'What does tail -n +6 select?', options: ['The last 6 lines', 'Everything from line 6 onward', 'The first 6 lines'], answer: 1, explanation: 'With ls -1t listing newest first, lines 6 and beyond are the older backups to delete.' },
    { question: 'What should a script do when called with the wrong arguments?', options: ['Guess sensible defaults silently', 'Print a usage message to stderr and exit with a non-zero code', 'Exit 0 so nothing breaks'], answer: 1, explanation: 'A non-zero exit lets other tools, timers, and CI notice the mistake.' },
  ],
}

export default lesson
