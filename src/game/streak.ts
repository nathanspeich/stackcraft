import { daysBetween } from '../lib/dates'

export interface StreakState {
  current: number
  longest: number
  /** Last day (YYYY-MM-DD) that counted toward the streak. */
  lastDate: string | null
  freezes: number
  /** Highest streak length at which a freeze was granted, so each 7-day mark grants once. */
  freezeMilestone: number
}

export const emptyStreak = (): StreakState => ({ current: 0, longest: 0, lastDate: null, freezes: 0, freezeMilestone: 0 })

/** Streak as it stands right now, accounting for a missed day that a freeze could cover. */
export function effectiveStreak(s: StreakState, todayStr: string): { current: number; frozen: boolean } {
  if (!s.lastDate) return { current: 0, frozen: false }
  const gap = daysBetween(s.lastDate, todayStr)
  if (gap <= 1) return { current: s.current, frozen: false }
  if (gap === 2 && s.freezes > 0) return { current: s.current, frozen: true }
  return { current: 0, frozen: false }
}

/** Called once when a day first qualifies (a lesson done, or 10 card reviews). */
export function advanceStreak(s: StreakState, todayStr: string): StreakState {
  if (s.lastDate === todayStr) return s
  let current: number
  let freezes = s.freezes
  if (!s.lastDate) current = 1
  else {
    const gap = daysBetween(s.lastDate, todayStr)
    if (gap === 1) current = s.current + 1
    else if (gap === 2 && freezes > 0) { freezes -= 1; current = s.current + 1 }
    else current = 1
  }
  let freezeMilestone = s.freezeMilestone
  if (current % 7 === 0 && current > freezeMilestone) { freezes += 1; freezeMilestone = current }
  return { current, longest: Math.max(s.longest, current), lastDate: todayStr, freezes, freezeMilestone }
}
