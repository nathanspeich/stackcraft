// Which cards a learner can see, and which are due. Pure functions of store state.
import { ALL_CARDS } from '../content/cards'
import type { Card, Track } from '../content/types'
import type { StackcraftState } from '../store/useStore'

export type DeckId = Track | 'mixed'

/** A card unlocks once its source lesson is completed, so decks grow with the map. */
export const isCardAvailable = (s: Pick<StackcraftState, 'completed'>, c: Card) => Boolean(s.completed[c.lesson])

export const availableCards = (s: Pick<StackcraftState, 'completed'>, deck: DeckId = 'mixed') =>
  ALL_CARDS.filter((c) => (deck === 'mixed' || c.track === deck) && isCardAvailable(s, c))

/** Never reviewed, or scheduled for today or earlier. */
export const isDue = (s: Pick<StackcraftState, 'cards'>, c: Card, today: string) => {
  const sched = s.cards[c.id]
  return !sched || sched.due <= today
}

export const dueCardsIn = (s: Pick<StackcraftState, 'completed' | 'cards'>, deck: DeckId, today: string) =>
  availableCards(s, deck).filter((c) => isDue(s, c, today))

export interface DeckSummary {
  id: DeckId
  total: number
  available: number
  due: number
  /** Available cards never reviewed. */
  fresh: number
}

export function deckSummary(s: Pick<StackcraftState, 'completed' | 'cards'>, deck: DeckId, today: string): DeckSummary {
  const all = deck === 'mixed' ? ALL_CARDS : ALL_CARDS.filter((c) => c.track === deck)
  const avail = all.filter((c) => isCardAvailable(s, c))
  return {
    id: deck,
    total: all.length,
    available: avail.length,
    due: avail.filter((c) => isDue(s, c, today)).length,
    fresh: avail.filter((c) => !s.cards[c.id]).length,
  }
}

/** Deterministic shuffle so a session order is stable for a given day and deck. */
export function shuffleForDay<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000 }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}
