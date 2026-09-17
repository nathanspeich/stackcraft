import { Link } from 'react-router'
import { tierWeeks, lessonId } from '../content/curriculum'
import type { Tier } from '../content/types'
import { isUnlocked, useStore } from '../store/useStore'
import { cx } from '../lib/cx'

/** Compact grid of the tier: one row per week, one dot per day. */
export default function TierMap({ tier, currentId }: { tier: Tier; currentId: string | null }) {
  const state = useStore()
  const weeks = tierWeeks(tier)
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0 sm:grid-cols-3">
      {weeks.map((w) => (
        <Link key={w.week} to={`/map#week-${w.week}`} data-track={w.track} className="flex min-h-[44px] items-center gap-2 rounded-lg px-1 hover:bg-surface-2">
          <span className="w-8 shrink-0 font-mono text-[11px] text-muted">W{w.week}</span>
          <span className="flex gap-1">
            {w.days.map((_, i) => {
              const id = lessonId(w.week, i + 1)
              const done = Boolean(state.completed[id])
              const current = id === currentId
              const open = isUnlocked(state, id)
              return (
                <span
                  key={id}
                  className={cx(
                    'size-3 rounded-full border',
                    done ? 'bg-track border-track' : current ? 'bg-track/30 border-track ring-2 ring-track/40' : open ? 'border-track/70' : 'border-border',
                  )}
                />
              )
            })}
          </span>
        </Link>
      ))}
    </div>
  )
}
