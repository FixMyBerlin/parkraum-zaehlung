import { MapProvider } from 'react-map-gl/maplibre'
import { CountingMap } from '@/components/CountingMap'
import { AppSidebar } from '@/components/Sidebar'
import { SidebarLayout } from '@/components/SidebarLayout'

export function AppShell() {
  return (
    <MapProvider>
      <SidebarLayout sidebar={<AppSidebar />}>
        <CountingMap />
      </SidebarLayout>
    </MapProvider>
  )
}
