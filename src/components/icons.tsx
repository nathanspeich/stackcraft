const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const HomeIcon = () => (
  <svg {...base} aria-hidden><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></svg>
)
export const MapIcon = () => (
  <svg {...base} aria-hidden><path d="M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z" /><path d="M9 4v14M15 6v14" /></svg>
)
export const CardsIcon = () => (
  <svg {...base} aria-hidden><rect x="3" y="6" width="14" height="12" rx="2" /><path d="M7 4h12a2 2 0 0 1 2 2v10" /></svg>
)
export const UserIcon = () => (
  <svg {...base} aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
export const LockIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size} aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
)
export const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size} strokeWidth={3} aria-hidden><path d="M5 12l5 5L20 7" /></svg>
)
export const PlayIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size} fill="currentColor" stroke="none" aria-hidden><path d="M7 5v14l12-7z" /></svg>
)
export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg {...base} width={18} height={18} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}><path d="M6 9l6 6 6-6" /></svg>
)
export const CopyIcon = () => (
  <svg {...base} width={16} height={16} aria-hidden><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
)
