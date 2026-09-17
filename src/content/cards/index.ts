import type { Card, Track } from '../types'
import { LINUX_CARDS } from './linux'
import { PYTHON_CARDS } from './python'
import { SQL_CARDS } from './sql'

/** Every flashcard, all tiers. Tier 2 and 3 decks are appended in later build phases. */
export const ALL_CARDS: Card[] = [...LINUX_CARDS, ...PYTHON_CARDS, ...SQL_CARDS]
export const CARD_BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]))
export const cardsForTrack = (track: Track) => ALL_CARDS.filter((c) => c.track === track)
