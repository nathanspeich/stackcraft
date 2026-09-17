import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'w07d4',
  tier: 1,
  track: 'python',
  week: 7,
  day: 4,
  title: 'Virtual environments and pip',
  concept: `The standard library is big, but the wider world of Python packages is bigger: requests for HTTP, rich for pretty terminals, pytest for tests. pip installs them from PyPI: pip install requests.

Installing everything into the system Python makes a mess, and different projects need different versions. A virtual environment is a private Python for one project. python3 -m venv .venv creates one in a folder called .venv. source .venv/bin/activate switches your shell to it; the prompt shows (.venv). Now pip installs only into that folder. deactivate switches back.

pip freeze > requirements.txt records what you installed so someone else can pip install -r requirements.txt and get the same set. Never commit the .venv folder itself, only the requirements file.`,
  example: {
    language: 'bash',
    caption: 'One project, one environment',
    code: `cd ~/myproject
python3 -m venv .venv
source .venv/bin/activate
(.venv) pip install requests
(.venv) pip list
(.venv) pip freeze > requirements.txt
(.venv) deactivate`,
  },
  task: {
    kind: 'selfcheck',
    instructions: 'This sandbox cannot create real environments or install packages, so do this one on your Mac or in a Linux terminal. It takes about five minutes.',
    steps: [
      'I made a project folder and ran python3 -m venv .venv inside it',
      'I activated it with source .venv/bin/activate and saw (.venv) in my prompt',
      'I ran pip install requests and then pip list showed requests',
      'I ran pip freeze > requirements.txt and looked at the file',
      'I ran deactivate and the (.venv) prefix disappeared',
    ],
  },
  quiz: [
    { question: 'What does python3 -m venv .venv create?', options: ['A backup of Python', 'A private Python environment in the .venv folder', 'A new Python version'], answer: 1, explanation: 'The folder holds its own interpreter link and site-packages, isolated from the system.' },
    { question: 'How do you know a virtual environment is active?', options: ['The prompt shows its name in parentheses', 'pip stops working', 'Python prints a warning'], answer: 0, explanation: 'activate changes PATH and adds (.venv) to the prompt.' },
    { question: 'What is requirements.txt for?', options: ['Listing the packages a project needs so they can be reinstalled', 'Storing the .venv folder', 'Configuring pip'], answer: 0, explanation: 'pip install -r requirements.txt recreates the same set of packages elsewhere.' },
  ],
}

export default lesson
