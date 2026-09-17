import type { Tier } from '../content/types'

export interface Badge {
  id: string
  tier: Tier
  name: string
  description: string
  emoji: string
}

export const BADGES: Badge[] = [
  { id: 'first-lesson', tier: 1, name: 'First Step', description: 'Finish your first lesson.', emoji: '🌱' },
  { id: 'first-script', tier: 1, name: 'First Script', description: 'Run your first script.', emoji: '📜' },
  { id: 'first-join', tier: 1, name: 'First JOIN', description: 'Join two tables together.', emoji: '🔗' },
  { id: 'streak-7', tier: 1, name: 'One Week Strong', description: 'Keep a 7-day streak.', emoji: '🔥' },
  { id: 'streak-30', tier: 1, name: 'Monthly Flame', description: 'Keep a 30-day streak.', emoji: '🌋' },
  { id: 'track-linux-1', tier: 1, name: 'Shell Master', description: 'Complete every Tier 1 Linux lesson.', emoji: '🐧' },
  { id: 'track-python-1', tier: 1, name: 'Snake Charmer', description: 'Complete every Tier 1 Python lesson.', emoji: '🐍' },
  { id: 'track-sql-1', tier: 1, name: 'Table Turner', description: 'Complete every Tier 1 SQL lesson.', emoji: '🗄️' },
  { id: 'capstone-1', tier: 1, name: 'Health Reporter', description: 'Complete the Tier 1 capstone.', emoji: '🏁' },

  { id: 'bash-builder', tier: 2, name: 'Bash Builder', description: 'First real bash script verified.', emoji: '🔨' },
  { id: 'test-pilot', tier: 2, name: 'Test Pilot', description: 'First pytest run verified.', emoji: '🧪' },
  { id: 'window-shopper', tier: 2, name: 'Window Shopper', description: 'First window function lesson.', emoji: '🪟' },
  { id: 'service-manager', tier: 2, name: 'Service Manager', description: 'First systemd unit verified.', emoji: '⚙️' },
  { id: 'container-captain', tier: 2, name: 'Container Captain', description: 'First Docker container verified.', emoji: '🐳' },
  { id: 'packager', tier: 2, name: 'Packager', description: 'First pipx install verified.', emoji: '📦' },
  { id: 'streak-100', tier: 2, name: 'Century', description: 'Keep a 100-day streak.', emoji: '💯' },
  { id: 'tier-2', tier: 2, name: 'Intermediate', description: 'Complete Tier 2.', emoji: '🥈' },

  { id: 'type-checker', tier: 3, name: 'Type Checker', description: 'mypy strict passes.', emoji: '🔍' },
  { id: 'hardened', tier: 3, name: 'Hardened', description: 'Server hardening project verified.', emoji: '🛡️' },
  { id: 'postgres-pioneer', tier: 3, name: 'Postgres Pioneer', description: 'First Postgres query verified.', emoji: '🐘' },
  { id: 'pipeline-pilot', tier: 3, name: 'Pipeline Pilot', description: 'First green CI run verified.', emoji: '✅' },
  { id: 'playbook-author', tier: 3, name: 'Playbook Author', description: 'First idempotent Ansible run verified.', emoji: '📕' },
  { id: 'firewatch', tier: 3, name: 'Firewatch', description: 'Monitoring stack verified.', emoji: '🔭' },
  { id: 'fixer', tier: 3, name: 'Fixer', description: 'All troubleshooting drills done.', emoji: '🔧' },
  { id: 'self-hosted', tier: 3, name: 'Self-Hosted', description: 'Capstone complete.', emoji: '🏠' },
  { id: 'streak-200', tier: 3, name: 'Marathon', description: 'Keep a 200-day streak.', emoji: '🏃' },
  { id: 'tier-3', tier: 3, name: 'Stackcrafter', description: 'Complete Tier 3.', emoji: '🥇' },
]

export const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]))
