import { cx } from '../lib/cx'

export default function StreakFlame({ days, frozen, size = 'md' }: { days: number; frozen?: boolean; size?: 'md' | 'lg' }) {
  const lit = days > 0
  return (
    <div className="flex items-center gap-2">
      <span
        className={cx('inline-block', lit && 'anim-flame', size === 'lg' ? 'text-4xl' : 'text-2xl', !lit && 'grayscale opacity-50')}
        role="img"
        aria-label={lit ? `${days} day streak` : 'No streak yet'}
      >
        {frozen ? '🧊' : '🔥'}
      </span>
      <div className="leading-tight">
        <div className={cx('font-display font-extrabold', size === 'lg' ? 'text-3xl' : 'text-xl')}>{days}</div>
        <div className="text-xs text-muted">{days === 1 ? 'day streak' : 'day streak'}{frozen ? ', frozen' : ''}</div>
      </div>
    </div>
  )
}
