// Unit tests for the SM-2 scheduler and the deck helpers.
import assert from 'node:assert/strict'
import { addDays, nextEase, newSchedule, previewIntervals, schedule, MIN_EASE, START_EASE } from '../src/game/sm2'
import { availableCards, deckSummary, dueCardsIn, shuffleForDay } from '../src/game/deck'
import { ALL_CARDS } from '../src/content/cards'
import { readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Lesson } from '../src/content/types'

// Lessons are discovered with import.meta.glob in the app; here read the folders directly.
const LESSON_BY_ID = new Map<string, Lesson>()
for (const dir of ['linux', 'python', 'sql', 'capstone']) {
  for (const f of readdirSync(`src/content/${dir}`).filter((f) => /^\d\d-\d\.ts$/.test(f))) {
    const mod = await import(pathToFileURL(`src/content/${dir}/${f}`).href)
    if (mod.default?.id) LESSON_BY_ID.set(mod.default.id, mod.default)
  }
}

let n = 0
const test = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`) }

const D0 = '2026-09-17'

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-02-28', 2), '2026-03-02')
})

test('a new card is due today with the starting ease', () => {
  const s = newSchedule(D0)
  assert.deepEqual(s, { interval: 0, ease: START_EASE, due: D0, reps: 0 })
})

test('Good follows the SM-2 sequence 1, 6, then interval times ease', () => {
  let s = schedule(undefined, 'good', D0)
  assert.equal(s.interval, 1); assert.equal(s.due, addDays(D0, 1)); assert.equal(s.reps, 1)
  assert.equal(s.ease, 2.5, 'Good keeps the ease unchanged')
  s = schedule(s, 'good', s.due)
  assert.equal(s.interval, 6); assert.equal(s.reps, 2)
  const d2 = s.due
  s = schedule(s, 'good', d2)
  assert.equal(s.interval, 15, '6 * 2.5'); assert.equal(s.due, addDays(d2, 15)); assert.equal(s.reps, 3)
  s = schedule(s, 'good', s.due)
  assert.equal(s.interval, 38, '15 * 2.5 rounded')
})

test('Again resets reps, brings the card back today, and lowers ease down to the floor', () => {
  let s = schedule(undefined, 'good', D0)
  s = schedule(s, 'good', s.due)
  s = schedule(s, 'again', s.due)
  assert.equal(s.interval, 0); assert.equal(s.reps, 0); assert.equal(s.due, addDays(D0, 7), "Again is due the same day it was answered")
  assert.equal(s.ease, 1.96, '2.5 - 0.54')
  for (let i = 0; i < 10; i++) s = schedule(s, 'again', s.due)
  assert.equal(s.ease, MIN_EASE, 'ease never drops below 1.3')
  // After a lapse the card climbs again from 1 day
  s = schedule(s, 'good', s.due)
  assert.equal(s.interval, 1); assert.equal(s.reps, 1)
})

test('Easy grows faster than Good and raises ease', () => {
  const e1 = schedule(undefined, 'easy', D0)
  assert.equal(e1.interval, 4); assert.equal(e1.ease, 2.6)
  const e2 = schedule(e1, 'easy', e1.due)
  assert.equal(e2.interval, 8, '6 days times the easy bonus')
  const e3 = schedule(e2, 'easy', e2.due)
  const g3 = schedule({ ...e2, ease: 2.5 }, 'good', e2.due)
  assert.ok(e3.interval > g3.interval, `easy ${e3.interval} should beat good ${g3.interval}`)
  assert.equal(e3.ease, 2.8)
})

test('nextEase matches the SM-2 formula', () => {
  assert.equal(nextEase(2.5, 'easy'), 2.6)
  assert.equal(nextEase(2.5, 'good'), 2.5)
  assert.equal(nextEase(2.5, 'again'), 1.96)
  assert.equal(nextEase(1.3, 'again'), 1.3)
})

test('intervals always move forward once a card is mature', () => {
  let s = schedule(undefined, 'good', D0)
  for (let i = 0; i < 12; i++) {
    const prev = s.interval
    s = schedule(s, 'good', s.due)
    assert.ok(s.interval > prev, `interval ${s.interval} should grow past ${prev}`)
  }
  assert.ok(s.interval > 365 * 5, 'a dozen Good answers reach multi-year intervals')
})

test('previewIntervals labels the three buttons', () => {
  const p = previewIntervals(undefined, D0)
  assert.deepEqual(p, { again: 'today', good: '1 day', easy: '4 days' })
  const mature = { interval: 100, ease: 2.5, due: D0, reps: 5 }
  assert.equal(previewIntervals(mature, D0).good, '8 mo')
})

test('cards reference real lessons and have unique ids', () => {
  const ids = new Set<string>()
  for (const c of ALL_CARDS) {
    assert.ok(!ids.has(c.id), `duplicate card id ${c.id}`); ids.add(c.id)
    assert.ok(LESSON_BY_ID.has(c.lesson), `${c.id} points at unknown lesson ${c.lesson}`)
    assert.equal(LESSON_BY_ID.get(c.lesson)!.track, c.track, `${c.id} track does not match its lesson`)
    assert.ok(!/—/.test(c.front + c.back), `${c.id} contains an em dash`)
    assert.ok(c.back.split(/\s+/).length <= 30, `${c.id} back is too long`)
  }
  assert.ok(ALL_CARDS.length >= 135, `expected at least 135 cards, got ${ALL_CARDS.length}`)
  for (const t of ['linux', 'python', 'sql'] as const) {
    assert.equal(ALL_CARDS.filter((c) => c.track === t && c.tier === 1).length, 25, `${t} tier 1 deck`)
    assert.equal(ALL_CARDS.filter((c) => c.track === t && c.tier === 2).length, 20, `${t} tier 2 deck`)
  }
  for (const c of ALL_CARDS) assert.equal(LESSON_BY_ID.get(c.lesson)!.tier, c.tier, `${c.id} tier does not match its lesson`)
})

test('cards unlock as lessons complete and due counts follow the schedule', () => {
  const none = { completed: {}, cards: {} }
  assert.equal(availableCards(none).length, 0)
  assert.equal(deckSummary(none, 'mixed', D0).due, 0)
  const first = ALL_CARDS[0]
  const s1 = { completed: { [first.lesson]: { completedAt: '', quizCorrect: 3, quizTotal: 3 } }, cards: {} }
  const avail = availableCards(s1)
  assert.ok(avail.length >= 1 && avail.every((c) => c.lesson === first.lesson))
  assert.equal(dueCardsIn(s1, first.track, D0).length, avail.length, 'new cards are due')
  const reviewed = { ...s1, cards: { [first.id]: schedule(undefined, 'good', D0) } }
  assert.equal(dueCardsIn(reviewed, first.track, D0).length, avail.length - 1, 'a card reviewed today is not due')
  assert.equal(dueCardsIn(reviewed, first.track, addDays(D0, 1)).length, avail.length, 'and is due again tomorrow')
  assert.equal(deckSummary(reviewed, first.track, D0).fresh, avail.length - 1)
})

test('shuffleForDay is a stable permutation', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8]
  const a = shuffleForDay(items, 'seed')
  assert.deepEqual([...a].sort((x, y) => x - y), items)
  assert.deepEqual(shuffleForDay(items, 'seed'), a)
  assert.notDeepEqual(shuffleForDay(items, 'other'), a)
})

console.log(`ALL ${n} SM-2 TESTS PASS`)
