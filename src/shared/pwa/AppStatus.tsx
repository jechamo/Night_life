import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { Button } from '@/shared/ui/button'

export function AppStatus() {
  const { appUpdates } = usePlatform()
  const { online, updateAvailable } = useSyncExternalStore(
    appUpdates.subscribe,
    appUpdates.getSnapshot,
  )
  const { t } = useTranslation()
  if (online && !updateAvailable) return null
  return (
    <aside className="fixed inset-x-3 top-[calc(0.75rem+var(--nl-safe-area-top))] z-[60] mx-auto max-w-lg rounded-2xl border border-border bg-surface p-4 shadow-xl">
      <p role="status" className="text-sm text-foreground">
        {t(online ? 'pwa.updateAvailable' : 'pwa.offline')}
      </p>
      {updateAvailable && online && (
        <Button size="sm" className="mt-3" onClick={() => appUpdates.applyUpdate()}>
          {t('pwa.update')}
        </Button>
      )}
    </aside>
  )
}
