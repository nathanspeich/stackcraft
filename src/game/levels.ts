export const LEVEL_TITLES = [
  'Newbie',
  'Shell Sprout',
  'Script Kiddie',
  'Query Cadet',
  'Loop Wrangler',
  'Root User',
  'Pipeline Plumber',
  'Daemon Tamer',
  'Test Pilot',
  'Window Shopper',
  'Container Captain',
  'Type Whisperer',
  'Playbook Author',
  'Site Reliability Sorcerer',
  'Stack Architect',
]

export const XP_PER_LEVEL_UNIT = 50

/** level = floor(sqrt(XP / 50)) */
export const levelForXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / XP_PER_LEVEL_UNIT))
export const xpForLevel = (level: number) => level * level * XP_PER_LEVEL_UNIT
export const levelTitle = (level: number) => LEVEL_TITLES[level] ?? 'Stackcrafter'

export function levelProgress(xp: number) {
  const level = levelForXp(xp)
  const start = xpForLevel(level)
  const end = xpForLevel(level + 1)
  return { level, title: levelTitle(level), start, end, into: xp - start, span: end - start, pct: (xp - start) / (end - start) }
}
