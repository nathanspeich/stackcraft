import { useEffect, useMemo } from 'react'
import { CheckIcon } from './icons'

const COLORS = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#e8ebf5']

/** Deterministic scatter so render stays pure: a tiny hash of the index. */
const noise = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const piece = (i: number) => ({
  left: 20 + noise(i, 1) * 60,
  dx: `${(noise(i, 2) - 0.5) * 160}px`,
  delay: noise(i, 3) * 200,
  color: COLORS[i % COLORS.length],
  size: 6 + noise(i, 4) * 6,
})

/** Short confetti burst with an animated checkmark. Respects prefers-reduced-motion via CSS. */
export default function Celebration({ title, subtitle, onDone }: { title: string; subtitle?: string; onDone?: () => void }) {
  const pieces = useMemo(() => Array.from({ length: 28 }, (_, i) => piece(i)), [])
  useEffect(() => {
    if (!onDone) return
    const t = setTimeout(onDone, 1400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="relative flex flex-col items-center py-6 text-center" aria-live="polite">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece absolute top-4 rounded-sm"
            style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.6, background: p.color, animationDelay: `${p.delay}ms`, ['--dx' as string]: p.dx }}
          />
        ))}
      </div>
      <div className="anim-pop flex size-20 items-center justify-center rounded-full bg-linux text-on-color">
        <CheckIcon size={44} />
      </div>
      <h2 className="anim-rise mt-4 font-display text-2xl font-extrabold">{title}</h2>
      {subtitle && <p className="anim-rise mt-1 text-muted">{subtitle}</p>}
    </div>
  )
}
