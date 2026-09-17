import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useStore } from '../store/useStore'
import { CardsIcon, HomeIcon, MapIcon, UserIcon } from './icons'
import { cx } from '../lib/cx'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/map', label: 'Map', Icon: MapIcon },
  { to: '/cards', label: 'Cards', Icon: CardsIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
]

export default function Layout() {
  const theme = useStore((s) => s.settings.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f4f5fb')
  }, [theme])

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      {/* Sidebar on wide screens */}
      <aside className="hidden md:flex md:flex-col md:sticky md:top-0 md:h-dvh border-r border-border bg-surface px-4 py-6">
        <NavLink to="/" className="mb-8 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 rounded-lg" />
          <span className="font-display text-xl font-extrabold tracking-tight">Stackcraft</span>
        </NavLink>
        <nav className="flex flex-col gap-1">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition', isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text hover:bg-surface-2/60')
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-muted">Build your stack. One layer a day.</p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-safe md:px-8 md:pb-10">
          <div className="pt-4 md:pt-8">
            <Outlet />
          </div>
        </main>

        {/* Bottom tab bar on phones */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden pb-safe" aria-label="Main">
          <ul className="grid grid-cols-4">
            {tabs.map(({ to, label, Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-accent' : 'text-muted')
                  }
                >
                  <Icon />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
