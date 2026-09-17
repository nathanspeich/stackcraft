import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { TRACK_LABEL, TIER_LABEL } from '../content/curriculum'
import type { Tier, Track } from '../content/types'

import { cx } from '../lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'track'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-color hover:brightness-110',
  secondary: 'bg-surface-2 text-text hover:brightness-110 border border-border',
  ghost: 'bg-transparent text-muted hover:text-text',
  danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
  track: 'bg-track text-on-color hover:brightness-110',
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 font-semibold min-h-[48px] select-none transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={cx(buttonBase, variants[variant], className)} {...props} />
}

export function LinkButton({ to, variant = 'primary', className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx(buttonBase, variants[variant], className)}>
      {children}
    </Link>
  )
}

export function Card({ className, children, track }: { className?: string; children: ReactNode; track?: Track }) {
  return (
    <section data-track={track} className={cx('rounded-3xl bg-surface border border-border p-4 sm:p-5', className)}>
      {children}
    </section>
  )
}

export function TrackPill({ track, className }: { track: Track; className?: string }) {
  return (
    <span data-track={track} className={cx('inline-flex items-center gap-1.5 rounded-full bg-track/15 px-2.5 py-1 text-xs font-semibold text-track', className)}>
      <span className="size-1.5 rounded-full bg-track" />
      {TRACK_LABEL[track]}
    </span>
  )
}

export function TierMarker({ tier }: { tier: Tier }) {
  return <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">Tier {tier} · {TIER_LABEL[tier]}</span>
}

export function ProgressBar({ value, className, colorClass = 'bg-accent' }: { value: number; className?: string; colorClass?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className={cx('h-2.5 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </header>
  )
}

