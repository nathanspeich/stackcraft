import { Link } from 'react-router'
import { TIER_LABEL, TIER_WEEKS, weekPlan } from '../content/curriculum'
import { LESSONS } from '../content/lessons'
import { effectiveStreak } from '../game/streak'
import { today } from '../lib/dates'
import { dueCards, nextIncomplete, useStore } from '../store/useStore'
import StreakFlame from '../components/StreakFlame'
import TierMap from '../components/TierMap'
import XpBar from '../components/XpBar'
import { Card, LinkButton, TierMarker, TrackPill } from '../components/ui'
import { CardsIcon, PlayIcon } from '../components/icons'

export default function Home() {
  const state = useStore()
  const next = nextIncomplete(state)
  const streak = effectiveStreak(state.streak, today())
  const due = dueCards(state)
  const doneCount = Object.keys(state.completed).length
  const tier = next?.tier ?? 3
  const [tierFrom, tierTo] = TIER_WEEKS[tier]
  const tierLessons = LESSONS.filter((l) => l.week >= tierFrom && l.week <= tierTo)
  const tierDone = tierLessons.filter((l) => state.completed[l.id]).length
  const week = next ? weekPlan(next.week) : undefined
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{greeting}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Today's quest</h1>
        </div>
        <StreakFlame days={streak.current} frozen={streak.frozen} />
      </header>

      {next ? (
        <Card track={next.track} className="relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-track" aria-hidden />
          <div className="flex items-center gap-2">
            <TrackPill track={next.track} />
            <span className="text-xs text-muted">Week {next.week} · Day {next.day}</span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold leading-tight">{next.title}</h2>
          {week && <p className="mt-1 text-sm text-muted">{week.title}</p>}
          <LinkButton to={`/lesson/${next.id}`} variant="track" className="mt-5 w-full">
            <PlayIcon />
            {state.completed[next.id] ? 'Replay lesson' : doneCount === 0 ? 'Start your first lesson' : 'Start lesson'}
          </LinkButton>
        </Card>
      ) : (
        <Card>
          <h2 className="font-display text-2xl font-bold">You finished everything.</h2>
          <p className="mt-1 text-muted">All 220 lessons done. Review your cards or replay any lesson from the map.</p>
        </Card>
      )}

      <Card>
        <XpBar xp={state.xp} />
      </Card>

      <Link to="/cards" className="flex min-h-[56px] items-center justify-between rounded-3xl border border-border bg-surface px-5 hover:bg-surface-2">
        <span className="flex items-center gap-3 font-semibold">
          <CardsIcon />
          Review cards
        </span>
        <span className="rounded-full bg-surface-2 px-3 py-1 font-mono text-sm">{due} due</span>
      </Link>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <TierMarker tier={tier} />
            <h3 className="font-display text-lg font-bold">{TIER_LABEL[tier]} map</h3>
          </div>
          <Link to="/map" className="inline-flex min-h-[44px] items-center px-2 -mr-2 text-sm font-semibold text-accent">Full map</Link>
        </div>
        <TierMap tier={tier} currentId={next?.id ?? null} />
        <p className="mt-3 text-xs text-muted">{tierDone} of {tierLessons.length} {TIER_LABEL[tier]} lessons done</p>
      </Card>
    </div>
  )
}
