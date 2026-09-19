import type { Card, Track } from '../types'
import { LINUX_CARDS } from './linux'
import { PYTHON_CARDS } from './python'
import { SQL_CARDS } from './sql'
import { LINUX_TIER2_CARDS } from './linux-tier2'
import { PYTHON_TIER2_CARDS } from './python-tier2'
import { SQL_TIER2_CARDS } from './sql-tier2'

/** Every flashcard, all tiers. Tier 3 decks are appended in phase 7. Cards join the same decks and unlock with their lesson. */
export const ALL_CARDS: Card[] = [...LINUX_CARDS, ...PYTHON_CARDS, ...SQL_CARDS, ...LINUX_TIER2_CARDS, ...PYTHON_TIER2_CARDS, ...SQL_TIER2_CARDS]
export const CARD_BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]))
export const cardsForTrack = (track: Track) => ALL_CARDS.filter((c) => c.track === track)
