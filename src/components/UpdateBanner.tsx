import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * Registers the service worker, checks for a new build on every app open and
 * once an hour afterwards, and shows a small banner when a new version is waiting.
 */
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => { registration.update().catch(() => { /* offline */ }) }
      check()
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })

  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-safe" role="status">
      <div className="mt-3 flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-accent/50 bg-surface px-4 py-2 shadow-lg">
        <span className="text-sm font-semibold">Update available</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => updateServiceWorker(true)} className="min-h-[44px] rounded-xl bg-accent px-4 text-sm font-bold text-on-color">
            Tap to reload
          </button>
          <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-[44px] min-w-[44px] rounded-xl text-sm text-muted" aria-label="Dismiss update notice">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
