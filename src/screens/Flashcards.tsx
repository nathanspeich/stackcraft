import { TRACK_LABEL } from '../content/curriculum'
import type { Track } from '../content/types'
import { dueCards, useStore } from '../store/useStore'
import { Card, PageTitle, TrackPill } from '../components/ui'

const DECKS: Track[] = ['linux', 'python', 'sql']

export default function Flashcards() {
  const state = useStore()
  const due = dueCards(state)
  return (
    <div className="space-y-4">
      <PageTitle sub="Spaced repetition. Rate each card Again, Good, or Easy.">Flashcards</PageTitle>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Due today</p>
            <p className="font-display text-4xl font-extrabold">{due}</p>
          </div>
          <span className="text-4xl" aria-hidden>🃏</span>
        </div>
        <p className="mt-3 text-sm text-muted">Card decks are generated from the lessons and arrive in build phase 5. Reviews earn 2 XP each and count toward your streak.</p>
      </Card>
      <ul className="space-y-2">
        {DECKS.map((t) => (
          <li key={t}>
            <Card track={t} className="flex items-center justify-between py-3">
              <div>
                <TrackPill track={t} />
                <p className="mt-1 font-semibold">{TRACK_LABEL[t]} deck</p>
              </div>
              <span className="font-mono text-sm text-muted">0 cards</span>
            </Card>
          </li>
        ))}
        <li>
          <Card className="flex items-center justify-between py-3">
            <p className="font-semibold">Mixed deck</p>
            <span className="font-mono text-sm text-muted">0 cards</span>
          </Card>
        </li>
      </ul>
    </div>
  )
}
