// SM-2 spaced repetition, the algorithm Anki is built on, reduced to three buttons.
//
//   Again: you did not remember. The card comes back today and its ease drops.
//   Good:  you remembered with effort. The interval grows by the ease factor.
//   Easy:  you knew it cold. The interval grows faster and the ease rises.
//
// Pure functions of (schedule, grade, today) so the scheduler can be unit tested.
import type { CardSchedule } from '../store/useStore'

export type Grade = 'again' | 'good' | 'easy'

/** SM-2 quality scores behind each button (0 to 5 in the original). */
const QUALITY: Record<Grade, number> = { again: 1, good: 4, easy: 5 }
export const MIN_EASE = 1.3
export const START_EASE = 2.5
/** Anki's easy bonus: an Easy answer grows the interval this much more than Good. */
const EASY_BONUS = 1.3

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** A card that has never been reviewed: due now. */
export const newSchedule = (today: string): CardSchedule => ({ interval: 0, ease: START_EASE, due: today, reps: 0 })

/** Ease update from SM-2: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), floored at 1.3. */
export function nextEase(ease: number, grade: Grade): number {
  const q = QUALITY[grade]
  const next = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  return Math.round(Math.max(MIN_EASE, next) * 100) / 100
}

/**
 * Schedule the next review.
 * Again resets the repetition count and brings the card back today (interval 0).
 * Good follows SM-2: 1 day, then 6 days, then interval times ease.
 * Easy starts at 4 days and multiplies by ease times the easy bonus after that.
 */
export function schedule(prev: CardSchedule | undefined, grade: Grade, today: string): CardSchedule {
  const s = prev ?? newSchedule(today)
  const ease = nextEase(s.ease, grade)
  if (grade === 'again') return { interval: 0, ease, due: today, reps: 0 }
  const reps = s.reps + 1
  let interval: number
  if (reps === 1) interval = grade === 'easy' ? 4 : 1
  else if (reps === 2) interval = grade === 'easy' ? Math.round(6 * EASY_BONUS) : 6
  else interval = Math.max(s.interval + 1, Math.round(s.interval * ease * (grade === 'easy' ? EASY_BONUS : 1)))
  return { interval, ease, due: addDays(today, interval), reps }
}

/** Preview of what each button would do, for the labels under Again / Good / Easy. */
export function previewIntervals(prev: CardSchedule | undefined, today: string): Record<Grade, string> {
  const label = (n: number) => (n === 0 ? 'today' : n === 1 ? '1 day' : n < 30 ? `${n} days` : n < 365 ? `${Math.round(n / 30)} mo` : `${(n / 365).toFixed(1)} yr`)
  return {
    again: label(schedule(prev, 'again', today).interval),
    good: label(schedule(prev, 'good', today).interval),
    easy: label(schedule(prev, 'easy', today).interval),
  }
}
