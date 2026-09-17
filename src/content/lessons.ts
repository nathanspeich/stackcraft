import { CURRICULUM, lessonId } from './curriculum'
import type { Lesson, Track } from './types'

/**
 * Real lessons live in src/content/<track>/<week>-<day>.ts and are picked up
 * automatically here. Any (week, day) without a file gets a placeholder so the
 * Map and Home screens always have the full plan to show.
 */
const modules = import.meta.glob<{ default: Lesson }>('./{linux,python,sql,capstone}/*.ts', { eager: true })

const authored = new Map<string, Lesson>()
for (const mod of Object.values(modules)) {
  const lesson = mod.default
  if (lesson?.id) authored.set(lesson.id, lesson)
}

const PHASE_FOR_TRACK: Record<Track, number> = { linux: 2, python: 3, sql: 4, capstone: 5 }

function placeholder(week: number, day: number, tier: Lesson['tier'], track: Track, title: string): Lesson {
  const phase = tier === 1 ? PHASE_FOR_TRACK[track] : tier === 2 ? 6 : 7
  return {
    id: lessonId(week, day),
    tier,
    track,
    week,
    day,
    title,
    placeholder: true,
    concept:
      `This lesson is on the plan but its content arrives in build phase ${phase}. ` +
      'For now you can mark it done to test the flow, and it will award XP like a real lesson.',
    example: { code: `# ${title}\n# Coming in build phase ${phase}`, language: 'text' },
    task: { kind: 'selfcheck', instructions: 'Placeholder task.', steps: ['I understand this lesson is a placeholder.'] },
    quiz: [],
  }
}

export const LESSONS: Lesson[] = CURRICULUM.flatMap((plan) =>
  plan.days.map((title, i) => {
    const id = lessonId(plan.week, i + 1)
    return authored.get(id) ?? placeholder(plan.week, i + 1, plan.tier, plan.track, title)
  }),
)

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]))
export const LESSON_INDEX = new Map(LESSONS.map((l, i) => [l.id, i]))

export const lessonsForWeek = (week: number) => LESSONS.filter((l) => l.week === week)
export const lessonsForTrack = (track: Track) => LESSONS.filter((l) => l.track === track)
export const nextLesson = (id: string) => LESSONS[(LESSON_INDEX.get(id) ?? -1) + 1]
export const prevLesson = (id: string) => LESSONS[(LESSON_INDEX.get(id) ?? 0) - 1]
