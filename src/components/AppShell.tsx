import { MapProvider } from 'react-map-gl/maplibre'
import { AppHeader } from '@/components/AppHeader'
import { CountingMap } from '@/components/CountingMap'
import { Sidebar } from '@/components/Sidebar'

export function AppShell() {
  return (
    <MapProvider>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <AppHeader />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="relative min-h-0 min-w-0 flex-1">
            <CountingMap />
          </main>
          <Sidebar />
        </div>
      </div>
    </MapProvider>
  )
}
