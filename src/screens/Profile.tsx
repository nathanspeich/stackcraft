import { useState } from 'react'
import { TRACK_LABEL, TIER_LABEL } from '../content/curriculum'
import type { Tier, Track } from '../content/types'
import { BADGES } from '../game/badges'
import { levelProgress } from '../game/levels'
import { effectiveStreak } from '../game/streak'
import { today } from '../lib/dates'
import { trackMastery, useStore } from '../store/useStore'
import StreakFlame from '../components/StreakFlame'
import XpBar from '../components/XpBar'
import { Button, Card, PageTitle, ProgressBar, TrackPill } from '../components/ui'
import { cx } from '../lib/cx'

const TRACKS: Track[] = ['linux', 'python', 'sql']
const TRACK_BAR: Record<Track, string> = { linux: 'bg-linux', python: 'bg-python', sql: 'bg-sql', capstone: 'bg-capstone' }

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center"
      >
        <span className={cx('relative block h-8 w-14 rounded-full transition', on ? 'bg-accent' : 'bg-surface-2 border border-border')}>
          <span className={cx('absolute top-1 size-6 rounded-full bg-white shadow transition', on ? 'left-7' : 'left-1')} />
        </span>
      </button>
    </label>
  )
}

export default function Profile() {
  const state = useStore()
  const { setTheme, setSound, resetAll } = state
  const p = levelProgress(state.xp)
  const streak = effectiveStreak(state.streak, today())
  const [confirm, setConfirm] = useState(false)
  const earned = Object.keys(state.badges).length

  return (
    <div className="space-y-4">
      <PageTitle>Profile</PageTitle>

      <Card>
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-accent font-display text-2xl font-extrabold text-on-color">{p.level}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-bold">{p.title}</p>
            <p className="font-mono text-sm text-muted">{state.xp} XP total</p>
          </div>
        </div>
        <div className="mt-4"><XpBar xp={state.xp} compact /></div>
      </Card>

      <Card className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><StreakFlame days={streak.current} frozen={streak.frozen} size="lg" /></div>
        <div className="text-right text-sm">
          <p><span className="font-mono font-bold">{state.streak.longest}</span> <span className="text-muted">longest</span></p>
          <p><span className="font-mono font-bold">{state.streak.freezes}</span> <span className="text-muted">🧊 freezes</span></p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">Track mastery</h2>
        <ul className="space-y-3">
          {TRACKS.map((t) => {
            const m = trackMastery(state, t)
            return (
              <li key={t}>
                <div className="mb-1 flex items-center justify-between">
                  <TrackPill track={t} />
                  <span className="font-mono text-xs text-muted">{m.done}/{m.total} · {Math.round(m.pct * 100)}%</span>
                </div>
                <ProgressBar value={m.pct} colorClass={TRACK_BAR[t]} />
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Badges</h2>
          <span className="font-mono text-xs text-muted">{earned}/{BADGES.length}</span>
        </div>
        {([1, 2, 3] as Tier[]).map((tier) => (
          <div key={tier} className="mb-4 last:mb-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Tier {tier} · {TIER_LABEL[tier]}</p>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {BADGES.filter((b) => b.tier === tier).map((b) => {
                const got = Boolean(state.badges[b.id])
                return (
                  <li key={b.id} title={`${b.name}: ${b.description}`} className={cx('flex flex-col items-center gap-1 rounded-2xl border p-2 text-center', got ? 'border-accent/50 bg-accent/10' : 'border-border opacity-50 grayscale')}>
                    <span className="text-2xl" aria-hidden>{b.emoji}</span>
                    <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{b.name}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-lg font-bold">Project evidence</h2>
        {state.evidence.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. From Tier 2, output you paste for real-machine projects is kept here, by lesson.</p>
        ) : (
          <ul className="space-y-2">
            {state.evidence.map((e, i) => (
              <li key={i} className="rounded-xl bg-surface-2 p-2">
                <p className="text-xs text-muted">{e.lessonId} · step {e.step}{e.skipped ? ' · marked done without paste' : ''}</p>
                <pre className="mt-1 max-h-32 overflow-auto text-xs">{e.pasted}</pre>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-display text-lg font-bold">Settings</h2>
        <Toggle label="Light theme" hint="Dark is the default." on={state.settings.theme === 'light'} onChange={(v) => setTheme(v ? 'light' : 'dark')} />
        <Toggle label="Sound effects" hint="Off by default. Sounds arrive in phase 5." on={state.settings.sound} onChange={setSound} />
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Help</h2>
        <p className="mt-1 text-sm text-muted">The app never talks to your machine. For Tier 2 and 3 projects it only reads what you paste.</p>
        <p className="mt-3 text-sm font-semibold">Reset the VM</p>
        <p className="text-sm text-muted">If the stackcraft VM gets into a bad state, delete it and redo week 13 day 1:</p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-bg p-3 text-xs">multipass delete stackcraft{'\n'}multipass purge</pre>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold text-danger">Reset progress</h2>
        <p className="mt-1 text-sm text-muted">Clears XP, streak, badges, cards, and evidence on this device. Theme and sound settings stay.</p>
        {confirm ? (
          <div className="mt-3 flex gap-2">
            <Button variant="danger" className="flex-1" onClick={() => { resetAll(); setConfirm(false) }}>Yes, reset everything</Button>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="danger" className="mt-3 w-full" onClick={() => setConfirm(true)}>Reset progress</Button>
        )}
      </Card>
      <p className="pb-2 text-center text-xs text-muted">Stackcraft · {TRACK_LABEL.linux}, {TRACK_LABEL.python}, {TRACK_LABEL.sql} · progress is stored only on this device</p>
    </div>
  )
}
