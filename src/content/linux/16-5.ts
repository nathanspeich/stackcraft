import type { Lesson } from '../types'

const RULE = 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart *'

const lesson: Lesson = {
  id: 'w16d5',
  tier: 2,
  track: 'linux',
  week: 16,
  day: 5,
  title: 'Project: a shared team folder and a sudo rule',
  concept: `This week's pieces fit together into one small piece of server setup that real teams do all the time: a group for the people who ship code, a service account called deploy in that group, a shared folder where files automatically belong to the group, and a sudo rule so deploy can restart services and nothing more.

Everything is done inside the VM with the exact commands from days 1 to 4. The order matters a little: the group must exist before the user joins it, and the sudo rule file must be mode 440 before visudo is happy.

The one dangerous step is the sudoers file. Write it with echo and sudo tee, never with a plain editor, and always run sudo visudo -c right after.`,
  example: {
    language: 'bash',
    caption: 'The safe way to add a sudo rule',
    code: `echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart *' \\
  | sudo tee /etc/sudoers.d/deploy
sudo chmod 440 /etc/sudoers.d/deploy
sudo visudo -c
# /etc/sudoers: parsed OK
# /etc/sudoers.d/deploy: parsed OK`,
  },
  task: {
    kind: 'real',
    intro: `This project happens inside the VM. Open Terminal on the Mac and run multipass shell stackcraft first.

You will create a group called team, a user called deploy that belongs to it, a shared folder /srv/team with the setgid bit so every new file inside belongs to the group, and a sudo rule that lets deploy run only systemctl restart. This is the same shape as the day 3 and day 4 exercises, now on a real Ubuntu system.

The app never talks to the VM. Each step tells you what to paste, and simple pattern checks confirm it. If a check fails, read the hint, fix the VM, and paste again.`,
    steps: [
      {
        instruction: 'Create the group, then the user. useradd gets -m for a home folder, -s /bin/bash for a proper shell, and -G team so deploy joins the group right away. Then print the group line to confirm the membership.',
        command: 'sudo groupadd team\nsudo useradd -m -s /bin/bash -G team deploy\ngetent group team',
        pasteLabel: 'Paste the output of getent group team',
        check: [{ type: 'includes', text: 'team', all: ['deploy'] }],
        hint: 'The line should look like team:x:1001:deploy. If deploy is missing after the last colon, add it with sudo usermod -aG team deploy and run getent group team again. If groupadd says the group already exists, that is fine, move on to useradd.',
        example: 'team:x:1001:deploy',
      },
      {
        instruction: 'Make the shared folder. chown root:team hands the folder to the group, and chmod 2775 sets rwxrwxr-x plus the setgid bit, so files created inside inherit the team group. Check it with ls -ld.',
        command: 'sudo mkdir -p /srv/team\nsudo chown root:team /srv/team\nsudo chmod 2775 /srv/team\nls -ld /srv/team',
        pasteLabel: 'Paste the output of ls -ld /srv/team',
        check: [{ type: 'regex', pattern: '^drwxrws', flags: 'm', label: 'a mode starting with drwxrws (setgid on the group)' }],
        hint: 'You want drwxrwsr-x with root team in the owner columns. If you see drwxrwxr-x there is no setgid bit: run sudo chmod 2775 /srv/team again (the 2 in front is the setgid bit). If you see an S instead of s, the group is missing the x bit, which 2775 also fixes.',
        example: 'drwxrwsr-x 2 root team 4096 Sep 18 10:41 /srv/team',
      },
      {
        instruction: 'Add the sudo rule safely. echo writes the one-line rule through sudo tee into a new file under /etc/sudoers.d, chmod 440 gives it the mode sudo expects, and visudo -c checks the syntax of every sudoers file. Only when every file says parsed OK, list what deploy may run.\n\nNever open /etc/sudoers in a normal editor: one typo there and sudo stops working for everyone.',
        command: `echo '${RULE}' | sudo tee /etc/sudoers.d/deploy\nsudo chmod 440 /etc/sudoers.d/deploy\nsudo visudo -c\nsudo -l -U deploy`,
        pasteLabel: 'Paste the output of sudo -l -U deploy',
        check: [{ type: 'includes', text: 'systemctl' }],
        hint: 'The last lines should read "User deploy may run the following commands on stackcraft:" followed by "(root) NOPASSWD: /usr/bin/systemctl restart *". If sudo -l says deploy is not allowed to run sudo, the rule file was not read: check that it is /etc/sudoers.d/deploy with no dot in the name, that sudo visudo -c prints parsed OK for it, and that the rule line matches the command block exactly.',
        example: `Matching Defaults entries for deploy on stackcraft:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin\\:/snap/bin,
    use_pty

User deploy may run the following commands on stackcraft:
    (root) NOPASSWD: /usr/bin/systemctl restart *`,
      },
    ],
  },
  quiz: [
    { question: 'Why chmod 2775 on /srv/team rather than 775?', options: ['To make the folder executable', 'The leading 2 is the setgid bit, so new files inherit the team group', 'To let deploy delete other people\'s files'], answer: 1, explanation: 'Without setgid, a file alice creates belongs to group alice and the rest of the team cannot write it.' },
    { question: 'Which command proves the sudo rule was accepted without logging in as deploy?', options: ['sudo -l -U deploy', 'cat /etc/sudoers', 'id deploy'], answer: 0, explanation: 'sudo -l -U lists another user\'s rules. cat only shows the main file, and id shows groups, not sudo rights.' },
    { question: 'What is the safe order for adding a sudoers.d file?', options: ['Write it, chmod 440, sudo visudo -c', 'Edit /etc/sudoers directly with nano', 'chmod 777 so sudo can read it'], answer: 0, explanation: 'Write the file, set 440, then let visudo -c check the syntax before you rely on it.' },
  ],
}

export default lesson
