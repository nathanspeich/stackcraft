import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LESSONS, LESSON_BY_ID, LESSON_INDEX, lessonsForWeek, lessonsForTrack } from '../content/lessons'
import { TIER_WEEKS } from '../content/curriculum'
import type { Tier, Track } from '../content/types'
import { XP } from '../game/xp'
import { advanceStreak, emptyStreak, type StreakState } from '../game/streak'
import { today } from '../lib/dates'

export interface LessonProgress {
  completedAt: string
  quizCorrect: number
  quizTotal: number
}

export interface CardSchedule {
  /** SM-2 fields, filled in during phase 5. */
  interval: number
  ease: number
  due: string
  reps: number
}

export interface EvidenceEntry {
  lessonId: string
  step: number
  pasted: string
  at: string
  /** True when the step was marked done via the "cannot paste" link. */
  skipped?: boolean
}

export interface Settings {
  theme: 'dark' | 'light'
  sound: boolean
}

export interface StackcraftState {
  xp: number
  completed: Record<string, LessonProgress>
  /** Lessons opened early through the "unlock" link. */
  unlocked: string[]
  weekBonuses: number[]
  tierBonuses: Tier[]
  /** Per-day activity counts, keyed by YYYY-MM-DD. */
  activity: Record<string, { lessons: number; reviews: number }>
  streak: StreakState
  badges: Record<string, string>
  cards: Record<string, CardSchedule>
  evidence: EvidenceEntry[]
  settings: Settings
  /** Lesson id whose completion celebration is pending. */
  lastCompleted: string | null

  completeLesson: (id: string, quizCorrect: number, quizTotal: number) => { gained: number; weekDone: boolean; tierDone: boolean }
  unlockLesson: (id: string) => void
  recordReview: (n?: number) => void
  awardBadge: (id: string) => void
  setTheme: (theme: Settings['theme']) => void
  setSound: (on: boolean) => void
  clearLastCompleted: () => void
  resetAll: () => void
}

const initial = () => ({
  xp: 0,
  completed: {},
  unlocked: [],
  weekBonuses: [],
  tierBonuses: [],
  activity: {},
  streak: emptyStreak(),
  badges: {},
  cards: {},
  evidence: [],
  settings: { theme: 'dark' as const, sound: false },
  lastCompleted: null,
})

export const useStore = create<StackcraftState>()(
  persist(
    (set, get) => ({
      ...initial(),

      completeLesson: (id, quizCorrect, quizTotal) => {
        const lesson = LESSON_BY_ID.get(id)
        if (!lesson) return { gained: 0, weekDone: false, tierDone: false }
        const s = get()
        const alreadyDone = Boolean(s.completed[id])
        const now = new Date().toISOString()
        const day = today()

        let gained = 0
        if (!alreadyDone) {
          gained += lesson.task.kind === 'real' ? XP.realLesson : XP.lesson
          gained += quizCorrect * XP.quizCorrect
        }

        const completed = { ...s.completed, [id]: { completedAt: now, quizCorrect, quizTotal } }

        const weekDone = !s.weekBonuses.includes(lesson.week) && lessonsForWeek(lesson.week).every((l) => completed[l.id])
        if (weekDone) gained += XP.weekBonus

        const [from, to] = TIER_WEEKS[lesson.tier]
        const tierDone =
          !s.tierBonuses.includes(lesson.tier) &&
          LESSONS.filter((l) => l.week >= from && l.week <= to).every((l) => completed[l.id])
        if (tierDone) gained += XP.tierBonus
        if (tierDone && lesson.tier === 3) gained += XP.capstoneBonus

        const act = s.activity[day] ?? { lessons: 0, reviews: 0 }
        const activity = { ...s.activity, [day]: { ...act, lessons: act.lessons + 1 } }
        const streak = act.lessons === 0 && act.reviews < 10 ? advanceStreak(s.streak, day) : s.streak

        const badges = { ...s.badges }
        const earn = (b: string) => { if (!badges[b]) badges[b] = now }
        earn('first-lesson')
        if (streak.current >= 7) earn('streak-7')
        if (streak.current >= 30) earn('streak-30')
        if (streak.current >= 100) earn('streak-100')
        if (streak.current >= 200) earn('streak-200')
        for (const track of ['linux', 'python', 'sql'] as Track[]) {
          if (lessonsForTrack(track).filter((l) => l.tier === 1).every((l) => completed[l.id])) earn(`track-${track}-1`)
        }
        if (lessonsForWeek(12).every((l) => completed[l.id])) earn('capstone-1')
        if (tierDone && lesson.tier === 2) earn('tier-2')
        if (tierDone && lesson.tier === 3) { earn('tier-3'); earn('self-hosted') }

        set({
          xp: s.xp + gained,
          completed,
          weekBonuses: weekDone ? [...s.weekBonuses, lesson.week] : s.weekBonuses,
          tierBonuses: tierDone ? [...s.tierBonuses, lesson.tier] : s.tierBonuses,
          activity,
          streak,
          badges,
          lastCompleted: id,
        })
        return { gained, weekDone, tierDone }
      },

      unlockLesson: (id) => set((s) => (s.unlocked.includes(id) ? s : { unlocked: [...s.unlocked, id] })),

      recordReview: (n = 1) => {
        const s = get()
        const day = today()
        const act = s.activity[day] ?? { lessons: 0, reviews: 0 }
        const reviews = act.reviews + n
        const crossed = act.lessons === 0 && act.reviews < 10 && reviews >= 10
        set({
          xp: s.xp + n * XP.cardReview,
          activity: { ...s.activity, [day]: { ...act, reviews } },
          streak: crossed ? advanceStreak(s.streak, day) : s.streak,
        })
      },

      awardBadge: (id) => set((s) => (s.badges[id] ? s : { badges: { ...s.badges, [id]: new Date().toISOString() } })),
      setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),
      setSound: (sound) => set((s) => ({ settings: { ...s.settings, sound } })),
      clearLastCompleted: () => set({ lastCompleted: null }),
      resetAll: () => set({ ...initial(), settings: get().settings }),
    }),
    { name: 'stackcraft', version: 1 },
  ),
)

/* Derived helpers (pure functions of state) */

export const isCompleted = (s: StackcraftState, id: string) => Boolean(s.completed[id])

/** A lesson is open if it is the first, already done, manually unlocked, or the previous lesson is done. */
export function isUnlocked(s: StackcraftState, id: string): boolean {
  const idx = LESSON_INDEX.get(id)
  if (idx === undefined) return false
  if (idx === 0 || s.completed[id] || s.unlocked.includes(id)) return true
  return Boolean(s.completed[LESSONS[idx - 1].id])
}

export const nextIncomplete = (s: StackcraftState) => LESSONS.find((l) => !s.completed[l.id]) ?? null

export function tierComplete(s: StackcraftState, tier: Tier) {
  const [from, to] = TIER_WEEKS[tier]
  return LESSONS.filter((l) => l.week >= from && l.week <= to).every((l) => s.completed[l.id])
}

export function trackMastery(s: StackcraftState, track: Track, tier?: Tier) {
  const ls = lessonsForTrack(track).filter((l) => (tier ? l.tier === tier : true))
  const done = ls.filter((l) => s.completed[l.id]).length
  return { done, total: ls.length, pct: ls.length ? done / ls.length : 0 }
}

export function dueCards(s: StackcraftState, day = today()) {
  return Object.values(s.cards).filter((c) => c.due <= day).length
}
