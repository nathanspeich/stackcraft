import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { CURRICULUM, TIER_LABEL, TIER_WEEKS, lessonId, tierWeeks, type WeekPlan } from '../content/curriculum'
import { LESSONS } from '../content/lessons'
import type { Tier } from '../content/types'
import { isUnlocked, nextIncomplete, tierComplete, useStore } from '../store/useStore'
import { CheckIcon, ChevronIcon, LockIcon, PlayIcon } from '../components/icons'
import { Card, PageTitle, TrackPill } from '../components/ui'
import { cx } from '../lib/cx'

function WeekCard({ plan, currentId }: { plan: WeekPlan; currentId: string | null }) {
  const state = useStore()
  const unlock = useStore((s) => s.unlockLesson)
  const doneDays = plan.days.filter((_, i) => state.completed[lessonId(plan.week, i + 1)]).length
  const weekDone = doneDays === 5
  return (
    <Card track={plan.track} className="relative overflow-hidden" >
      <div id={`week-${plan.week}`} className="absolute -top-20" aria-hidden />
      <div className="absolute inset-y-0 left-0 w-1.5 bg-track" aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">Week {plan.week}</span>
            <TrackPill track={plan.track} />
          </div>
          <h3 className="mt-1 font-display text-lg font-bold leading-tight">{plan.title}</h3>
        </div>
        <span className={cx('shrink-0 rounded-full px-2.5 py-1 font-mono text-xs', weekDone ? 'bg-track text-on-color' : 'bg-surface-2 text-muted')}>{doneDays}/5</span>
      </div>
      <ol className="mt-3 divide-y divide-border">
        {plan.days.map((title, i) => {
          const id = lessonId(plan.week, i + 1)
          const done = Boolean(state.completed[id])
          const open = isUnlocked(state, id)
          const current = id === currentId
          const isProject = plan.tier > 1 && i === 4
          const row = (
            <>
              <span
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                  done ? 'bg-track border-track text-on-color' : current ? 'border-track text-track' : open ? 'border-border text-muted' : 'border-border text-muted/60',
                )}
              >
                {done ? <CheckIcon size={14} /> : current ? <PlayIcon size={12} /> : open ? i + 1 : <LockIcon size={13} />}
              </span>
              <span className={cx('min-w-0 flex-1 text-sm', !open && 'text-muted')}>
                <span className="block truncate">{title}</span>
                {isProject && <span className="text-[11px] text-muted">Real machine project</span>}
              </span>
            </>
          )
          return (
            <li key={id} className="flex min-h-[48px] items-center gap-3 py-1.5">
              {open ? (
                <Link to={`/lesson/${id}`} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-xl px-1 -mx-1 hover:bg-surface-2">
                  {row}
                </Link>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-1 -mx-1">{row}</div>
                  <button type="button" onClick={() => unlock(id)} className="min-h-[44px] min-w-[44px] shrink-0 px-2 text-xs font-semibold text-accent">
                    unlock
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function TierSection({ tier, currentId, defaultOpen }: { tier: Tier; currentId: string | null; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const state = useStore()
  const [from, to] = TIER_WEEKS[tier]
  const lessons = LESSONS.filter((l) => l.week >= from && l.week <= to)
  const done = lessons.filter((l) => state.completed[l.id]).length
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[48px] w-full items-center justify-between rounded-2xl px-1 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tier {tier} · Weeks {from} to {to}</span>
          <span className="block font-display text-2xl font-extrabold tracking-tight">{TIER_LABEL[tier]}</span>
        </span>
        <span className="flex items-center gap-3 text-muted">
          <span className="font-mono text-xs">{done}/{lessons.length}</span>
          <ChevronIcon open={open} />
        </span>
      </button>
      {open ? (
        <div className="space-y-3">
          {tierWeeks(tier).map((p) => <WeekCard key={p.week} plan={p} currentId={currentId} />)}
        </div>
      ) : (
        <p className="px-1 text-sm text-muted">
          {tier > 1 && !tierComplete(state, (tier - 1) as Tier)
            ? `Opens after Tier ${tier - 1}. Expand to look ahead or unlock early.`
            : 'Collapsed. Tap to expand.'}
        </p>
      )}
    </section>
  )
}

export default function MapScreen() {
  const state = useStore()
  const current = nextIncomplete(state)
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const t1Done = tierComplete(state, 1)
  const t2Done = tierComplete(state, 2)
  const currentTier = current?.tier ?? 3
  return (
    <div className="space-y-8">
      <PageTitle sub={`${CURRICULUM.length} weeks, ${LESSONS.length} lessons, three tiers. Locks open in order, or use unlock to skip ahead.`}>Map</PageTitle>
      <TierSection tier={1} currentId={current?.id ?? null} defaultOpen={currentTier === 1 || !t1Done} />
      <TierSection tier={2} currentId={current?.id ?? null} defaultOpen={t1Done && (currentTier === 2 || !t2Done)} />
      <TierSection tier={3} currentId={current?.id ?? null} defaultOpen={t2Done} />
    </div>
  )
}
