import { levelProgress } from '../game/levels'
import { ProgressBar } from './ui'

export default function XpBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const p = levelProgress(xp)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="font-display text-lg font-bold">Level {p.level}</span>
          <span className="ml-2 truncate text-sm text-muted">{p.title}</span>
        </div>
        {!compact && <span className="shrink-0 font-mono text-xs text-muted">{p.into} / {p.span} XP</span>}
      </div>
      <ProgressBar value={p.pct} />
      {!compact && <p className="mt-1.5 text-xs text-muted">{p.end - xp} XP to level {p.level + 1}</p>}
    </div>
  )
}
