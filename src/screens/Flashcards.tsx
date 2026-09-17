import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CARD_BY_ID } from '../content/cards'
import type { Card as CardData, Track } from '../content/types'
import { deckSummary, dueCardsIn, shuffleForDay, type DeckId } from '../game/deck'
import { addDays, previewIntervals, type Grade } from '../game/sm2'
import { XP } from '../game/xp'
import { today } from '../lib/dates'
import { playSound } from '../lib/sound'
import { useStore } from '../store/useStore'
import { Button, Card, PageTitle, TrackPill } from '../components/ui'
import { cx } from '../lib/cx'

const DECKS: DeckId[] = ['linux', 'python', 'sql', 'mixed']
const DECK_LABEL: Record<DeckId, string> = { linux: 'Linux', python: 'Python', sql: 'SQL', capstone: 'Capstone', mixed: 'Mixed' }
const GRADES: { grade: Grade; label: string; key: string; className: string }[] = [
  { grade: 'again', label: 'Again', key: '1', className: 'bg-danger/15 text-danger border border-danger/40' },
  { grade: 'good', label: 'Good', key: '2', className: 'bg-surface-2 text-text border border-border' },
  { grade: 'easy', label: 'Easy', key: '3', className: 'bg-linux/15 text-linux border border-linux/40' },
]

/** One review session over a queue of due cards. Again sends the card to the back of the queue. */
function Session({ deck, onExit }: { deck: DeckId; onExit: () => void }) {
  const day = today()
  const initial = useMemo(() => shuffleForDay(dueCardsIn(useStore.getState(), deck, day), `${deck}:${day}`).map((c) => c.id), [deck, day])
  const [queue, setQueue] = useState<string[]>(initial)
  const [flipped, setFlipped] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [again, setAgain] = useState(0)
  const rateCard = useStore((s) => s.rateCard)
  const cards = useStore((s) => s.cards)
  const total = initial.length
  const current: CardData | undefined = queue.length ? CARD_BY_ID.get(queue[0]) : undefined
  const done = total - queue.length
  const previews = useMemo(() => (current ? previewIntervals(cards[current.id], day) : null), [current, cards, day])

  const grade = useCallback(
    (g: Grade) => {
      if (!current) return
      const first = !seen.has(current.id)
      rateCard(current.id, g, first)
      setSeen((s) => new Set(s).add(current.id))
      playSound(g === 'again' ? 'wrong' : 'card')
      setFlipped(false)
      setQueue((q) => {
        const rest = q.slice(1)
        if (g === 'again') { setAgain((n) => n + 1); return [...rest, current.id] }
        return rest
      })
    },
    [current, seen, rateCard],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(true) }
      else if (flipped) { const g = GRADES.find((x) => x.key === e.key); if (g) grade(g.grade) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, grade])

  if (!current) {
    return (
      <Card className="text-center">
        <p className="text-4xl" aria-hidden>🎉</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold">Deck reviewed</h2>
        <p className="mt-1 text-muted">
          {seen.size} card{seen.size === 1 ? '' : 's'}, +{seen.size * XP.cardReview} XP{again ? `, ${again} sent back to try again` : ''}.
        </p>
        <p className="mt-1 text-xs text-muted">Good and Easy push a card further out each time. Again brings it back today.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onExit}>Decks</Button>
          <Link to="/" className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-accent px-5 font-semibold text-on-color">Home</Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4" data-track={current.track}>
      <div className="flex items-center justify-between text-sm text-muted">
        <button type="button" onClick={onExit} className="min-h-[44px] -ml-2 px-2 font-semibold">← Decks</button>
        <span className="font-mono">{done} / {total}{queue.length > total - done ? ` (+${queue.length - (total - done)} again)` : ''}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
        <div className="h-full rounded-full bg-track transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setFlipped(true)}
        className={cx('block w-full rounded-3xl border border-border bg-surface p-5 text-left sm:p-6', !flipped && 'cursor-pointer hover:bg-surface-2/40')}
        aria-label={flipped ? 'Card answer' : 'Show answer'}
      >
        <div className="flex items-center justify-between">
          <TrackPill track={current.track} />
          <span className="text-[11px] uppercase tracking-wider text-muted">{cards[current.id] ? `interval ${cards[current.id].interval}d` : 'new'}</span>
        </div>
        <p className="mt-6 min-h-[4rem] font-display text-2xl font-bold leading-snug">{current.front}</p>
        {flipped ? (
          <div className="anim-rise mt-5 border-t border-border pt-4">
            <p className="text-[15px] leading-relaxed">{current.back}</p>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm font-semibold text-muted">Tap to show the answer</p>
        )}
      </button>

      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              type="button"
              onClick={() => grade(g.grade)}
              className={cx('flex min-h-[64px] flex-col items-center justify-center rounded-2xl font-semibold active:scale-[0.98]', g.className)}
            >
              <span>{g.label}</span>
              <span className="text-[11px] font-normal opacity-80">{previews?.[g.grade]}</span>
            </button>
          ))}
        </div>
      ) : (
        <Button variant="track" className="w-full" onClick={() => setFlipped(true)}>Show answer</Button>
      )}
      <p className="hidden text-center text-xs text-muted md:block">Space flips, 1 / 2 / 3 grade</p>
    </div>
  )
}

export default function Flashcards() {
  const completed = useStore((s) => s.completed)
  const cards = useStore((s) => s.cards)
  const [deck, setDeck] = useState<DeckId | null>(null)
  const day = today()
  const summaries = useMemo(() => DECKS.map((d) => deckSummary({ completed, cards }, d, day)), [completed, cards, day])
  const mixed = summaries[summaries.length - 1]
  const nextDue = useMemo(() => {
    const future = Object.values(cards).map((c) => c.due).filter((d) => d > day).sort()
    return future[0]
  }, [cards, day])

  if (deck) return <Session deck={deck} onExit={() => setDeck(null)} />

  return (
    <div className="space-y-4">
      <PageTitle sub="Spaced repetition. Rate each card Again, Good, or Easy and it comes back at the right time.">Flashcards</PageTitle>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Due today</p>
            <p className="font-display text-4xl font-extrabold">{mixed.due}</p>
          </div>
          <span className="text-4xl" aria-hidden>🃏</span>
        </div>
        {mixed.due > 0 ? (
          <Button className="mt-4 w-full" onClick={() => setDeck('mixed')}>Review {mixed.due} due card{mixed.due === 1 ? '' : 's'}</Button>
        ) : mixed.available === 0 ? (
          <p className="mt-3 text-sm text-muted">Cards unlock as you complete lessons: each lesson adds one or two. Finish today's quest to get your first ones.</p>
        ) : (
          <p className="mt-3 text-sm text-muted">All caught up.{nextDue ? ` Next card due ${nextDue === addDays(day, 1) ? 'tomorrow' : `on ${nextDue}`}.` : ''}</p>
        )}
        <p className="mt-3 text-xs text-muted">Each review earns {XP.cardReview} XP. Ten reviews in a day keep your streak alive.</p>
      </Card>
      <ul className="space-y-2">
        {summaries.map((d) => (
          <li key={d.id}>
            <Card track={d.id === 'mixed' ? undefined : (d.id as Track)} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                {d.id !== 'mixed' ? <TrackPill track={d.id as Track} /> : <span className="text-xs font-semibold text-muted">All tracks</span>}
                <p className="mt-1 font-semibold">{DECK_LABEL[d.id]} deck</p>
                <p className="font-mono text-xs text-muted">{d.available} of {d.total} unlocked{d.fresh ? ` · ${d.fresh} new` : ''}</p>
              </div>
              {d.due > 0 ? (
                <Button variant="secondary" className="shrink-0" onClick={() => setDeck(d.id)}>{d.due} due</Button>
              ) : (
                <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 font-mono text-xs text-muted">{d.available ? 'done' : 'locked'}</span>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
