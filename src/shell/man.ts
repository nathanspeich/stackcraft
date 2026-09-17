// Short built-in manual pages. The first line is the one-line summary used by --help and whatis.
export const MAN: Record<string, string> = {
  pwd: `pwd - print name of current working directory
Usage: pwd
Prints the absolute path of the directory you are in.`,
  ls: `ls - list directory contents
Usage: ls [OPTION]... [FILE]...
  -l   use a long listing format (permissions, owner, size, date)
  -a   do not ignore entries starting with .
  -h   with -l, print sizes like 1K, 2M`,
  cd: `cd - change the working directory
Usage: cd [DIR]
With no DIR, go home. "cd .." goes up one level. "cd -" goes back to the previous directory.`,
  mkdir: `mkdir - make directories
Usage: mkdir [OPTION]... DIRECTORY...
  -p   make parent directories as needed, no error if existing`,
  touch: `touch - change file timestamps, or create an empty file
Usage: touch FILE...`,
  cp: `cp - copy files and directories
Usage: cp [OPTION]... SOURCE DEST
  -r   copy directories recursively`,
  mv: `mv - move (rename) files
Usage: mv SOURCE DEST
Moves SOURCE to DEST. If DEST is a directory, SOURCE is moved inside it.`,
  rm: `rm - remove files or directories
Usage: rm [OPTION]... FILE...
  -r   remove directories and their contents recursively
  -f   ignore nonexistent files, never prompt`,
  rmdir: `rmdir - remove empty directories
Usage: rmdir DIRECTORY...`,
  cat: `cat - concatenate files and print on the standard output
Usage: cat [OPTION]... [FILE]...
  -n   number all output lines`,
  less: `less - view a file one screen at a time
Usage: less FILE
On a real terminal: space for next page, b for back, /text to search, q to quit.`,
  head: `head - output the first part of files
Usage: head [OPTION]... [FILE]...
  -n N   print the first N lines instead of 10`,
  tail: `tail - output the last part of files
Usage: tail [OPTION]... [FILE]...
  -n N   print the last N lines instead of 10
  -f     follow the file as it grows (not simulated)`,
  echo: `echo - display a line of text
Usage: echo [-n] [-e] [STRING]...
  -n   do not output the trailing newline
  -e   enable interpretation of backslash escapes like \\n and \\t`,
  printf: `printf - format and print data
Usage: printf FORMAT [ARGUMENT]...
Supports %s, %d, %% and escapes like \\n.`,
  grep: `grep - print lines that match patterns
Usage: grep [OPTION]... PATTERN [FILE]...
  -i   ignore case
  -n   print line numbers
  -r   search directories recursively
  -v   invert match (print lines that do NOT match)
  -c   count matching lines
  -l   print only file names with matches
  -E   extended regular expressions`,
  find: `find - search for files in a directory hierarchy
Usage: find [PATH...] [EXPRESSION]
  -name PATTERN    file name matches shell pattern (quote it: "*.log")
  -iname PATTERN   like -name but case insensitive
  -type f|d        only files (f) or directories (d)`,
  wc: `wc - print newline, word, and byte counts for each file
Usage: wc [OPTION]... [FILE]...
  -l   lines   -w   words   -c   bytes`,
  sort: `sort - sort lines of text files
Usage: sort [OPTION]... [FILE]...
  -r   reverse   -n   numeric   -u   unique   -k N   sort by field N   -t SEP   field separator`,
  uniq: `uniq - report or omit repeated lines (adjacent only, so sort first)
Usage: uniq [OPTION]... [FILE]
  -c   prefix lines by the number of occurrences
  -d   only print duplicate lines`,
  cut: `cut - remove sections from each line of files
Usage: cut OPTION... [FILE]...
  -d DELIM   use DELIM instead of TAB for field delimiter
  -f LIST    select only these fields, e.g. -f 1,3 or -f 2-4
  -c LIST    select only these characters`,
  tr: `tr - translate or delete characters
Usage: tr [OPTION]... SET1 [SET2]
  -d   delete characters in SET1
Sets can be ranges like a-z or classes like [:upper:].`,
  sed: `sed - stream editor for filtering and transforming text
Usage: sed [OPTION]... SCRIPT [FILE]...
  s/old/new/     replace first match on each line   (add g for all matches, i for ignore case)
  Nd             delete line N       /pat/d   delete matching lines
  -n 'Np'        print only line N   -i       edit the file in place`,
  chmod: `chmod - change file mode bits (permissions)
Usage: chmod MODE FILE...
MODE is octal like 755 or symbolic like u+x, go-w, a=r.`,
  chown: `chown - change file owner and group
Usage: chown OWNER[:GROUP] FILE...
Only root can change ownership, so use sudo.`,
  whoami: `whoami - print effective user name
Usage: whoami`,
  id: `id - print user and group IDs
Usage: id [USER]`,
  man: `man - an interface to the system reference manuals
Usage: man COMMAND
Shows the manual page for COMMAND. On a real system, q quits and / searches.`,
  which: `which - locate a command
Usage: which COMMAND...
Prints the full path of the executable that would run.`,
  history: `history - display the command history list
Usage: history`,
  clear: `clear - clear the terminal screen
Usage: clear`,
  sudo: `sudo - execute a command as another user (root by default)
Usage: sudo COMMAND
Asks for your password on a real system. Simulated here without a prompt.`,
  su: `su - change user ID or become superuser
Usage: su [USER]`,
  ps: `ps - report a snapshot of the current processes
Usage: ps [aux|-ef]
  aux   every process with user, CPU, and memory`,
  top: `top - display Linux processes
Usage: top
Shows a live view on a real system. Press q to quit there. Simulated as a snapshot here.`,
  kill: `kill - send a signal to a process
Usage: kill [-9] PID...
Sends SIGTERM (polite stop) by default, or SIGKILL with -9.`,
  killall: `killall - kill processes by name
Usage: killall NAME`,
  pkill: `pkill - signal processes by name
Usage: pkill NAME`,
  jobs: `jobs - list background jobs of this shell
Usage: jobs`,
  sleep: `sleep - delay for a specified amount of time
Usage: sleep SECONDS`,
  df: `df - report file system disk space usage
Usage: df [-h]
  -h   human readable sizes`,
  du: `du - estimate file space usage
Usage: du [-sh] [FILE]...
  -s   summarize   -h   human readable`,
  free: `free - display amount of free and used memory
Usage: free [-h]`,
  uname: `uname - print system information
Usage: uname [-a] [-r] [-m]
  -a   all   -r   kernel release   -m   machine hardware`,
  uptime: `uptime - tell how long the system has been running
Usage: uptime`,
  hostname: `hostname - show the system's host name
Usage: hostname`,
  date: `date - print the system date and time
Usage: date`,
  apt: `apt - command-line package manager
Usage: sudo apt update | sudo apt install PKG | sudo apt remove PKG | apt list --installed | apt search WORD`,
  'apt-get': `apt-get - APT package handling utility (older interface to apt)
Usage: sudo apt-get update | sudo apt-get install PKG`,
  ip: `ip - show and manipulate routing, devices, and addresses
Usage: ip addr | ip route | ip link`,
  ping: `ping - send ICMP ECHO_REQUEST to network hosts
Usage: ping [-c COUNT] HOST`,
  curl: `curl - transfer a URL
Usage: curl [OPTION]... URL
  -I   fetch headers only   -s   silent   -o FILE   write output to FILE`,
  ss: `ss - investigate sockets
Usage: ss -tulpn
  -t tcp   -u udp   -l listening   -p processes   -n numeric`,
  ssh: `ssh - OpenSSH remote login client
Usage: ssh [USER@]HOST
Opens a shell on another machine. Not simulated: do this on your real machine.`,
  scp: `scp - OpenSSH secure file copy
Usage: scp SOURCE [USER@]HOST:DEST
Copies files over SSH. Not simulated: do this on your real machine.`,
  env: `env - print the environment
Usage: env`,
  printenv: `printenv - print all or part of the environment
Usage: printenv [VARIABLE]`,
  export: `export - set an environment variable for child processes
Usage: export NAME=VALUE`,
  unset: `unset - remove a variable
Usage: unset NAME`,
  source: `source - run a file in the current shell (also written as ".")
Usage: source FILE`,
  bash: `bash - GNU Bourne-Again SHell
Usage: bash SCRIPT [ARGS]... | bash -c COMMAND`,
  sh: `sh - POSIX shell
Usage: sh SCRIPT`,
  test: `test - check file types and compare values (same as [ ])
Usage: [ EXPRESSION ]
  -f FILE   file exists   -d DIR   directory exists   -z STR   string is empty
  STR1 = STR2   equal     N1 -eq N2   numbers equal   -lt -gt -le -ge -ne`,
  exit: `exit - exit the shell with a status
Usage: exit [N]`,
  read: `read - read a line from standard input into a variable
Usage: read VARIABLE`,
  seq: `seq - print a sequence of numbers
Usage: seq LAST | seq FIRST LAST`,
  tee: `tee - read from standard input and write to standard output and files
Usage: COMMAND | tee FILE`,
  xargs: `xargs - build and execute command lines from standard input
Usage: COMMAND | xargs COMMAND2`,
  basename: `basename - strip directory and suffix from filenames
Usage: basename PATH`,
  dirname: `dirname - strip last component from file name
Usage: dirname PATH`,
  tree: `tree - list contents of directories in a tree-like format
Usage: tree [DIR]`,
  crontab: `crontab - maintain crontab files for individual users
Usage: crontab -l | crontab FILE | crontab -r
Each line: minute hour day-of-month month day-of-week command`,
  systemctl: `systemctl - control the systemd system and service manager
Usage: systemctl status|start|stop|restart|enable|disable UNIT | systemctl list-units --type=service`,
  journalctl: `journalctl - query the systemd journal
Usage: journalctl -u UNIT [-n N]`,
  dmesg: `dmesg - print the kernel ring buffer
Usage: dmesg`,
  type: `type - describe how a command name would be interpreted
Usage: type COMMAND`,
  python3: `python3 - the Python programming language interpreter
Usage: python3 [script.py] | python3 --version | python3 -m http.server [PORT]`,
  git: `git - the stupid content tracker
Usage: git COMMAND (covered in Tier 3)`,
  nano: `nano - a small text editor
Not available in this terminal. Use the editor pane above the terminal, or echo with > and >>.`,
  vim: `vim - Vi IMproved, a text editor
Not available in this terminal. Use the editor pane above the terminal.`,
  htop: `htop - interactive process viewer
Usage: htop`,
  tac: `tac - concatenate and print files in reverse
Usage: tac FILE`,
  rev: `rev - reverse lines characterwise
Usage: rev FILE`,
  nl: `nl - number lines of files
Usage: nl FILE`,
  diff: `diff - compare files line by line
Usage: diff FILE1 FILE2`,
  file: `file - determine file type
Usage: file FILE...`,
  stat: `stat - display file status
Usage: stat FILE`,
  wget: `wget - non-interactive network downloader
Usage: wget URL`,
  true: `true - do nothing, successfully (exit status 0)`,
  false: `false - do nothing, unsuccessfully (exit status 1)`,
  alias: `alias - define or display aliases
Usage: alias NAME='COMMAND'`,
  set: `set - set shell options
Usage: set -e   (exit on first error)   set -x   (print commands as they run)`,
  shift: `shift - shift positional parameters left
Usage: shift`,
  return: `return - return from a shell function with a status
Usage: return [N]`,
  exec: `exec - replace the shell with a command`,
  help: `help - list the commands this terminal understands
Usage: help`,
  yes: `yes - output a string repeatedly until killed
Usage: yes`,
  ln: `ln - make links between files
Usage: ln -s TARGET LINK`,
  more: `more - file perusal filter
Usage: more FILE`,
  passwd: `passwd - change user password
Usage: passwd`,
  groups: `groups - print the groups a user is in
Usage: groups [USER]`,
  useradd: `useradd - create a new user
Usage: sudo useradd -m NAME`,
  local: `local - declare a variable local to a function
Usage: local NAME=VALUE`,
}

export const summary = (cmd: string) => MAN[cmd]?.split('\n')[0] ?? ''
