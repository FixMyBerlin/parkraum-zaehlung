import { MapProvider } from 'react-map-gl/maplibre'
import { AppHeader } from '@/components/AppHeader'
import { CountingMap } from '@/components/CountingMap'
import { useAppStepNav } from '@/components/shared/use-app-step-nav'
import { AppSidebar } from '@/components/Sidebar'
import { SidebarLayout } from '@/components/SidebarLayout'

export function AppShell() {
  const { steps, goToStep } = useAppStepNav()

  return (
    <MapProvider>
      <SidebarLayout
        header={({ onOpenSidebar }) => (
          <AppHeader steps={steps} onSelect={goToStep} onOpenSidebar={onOpenSidebar} />
        )}
        sidebar={<AppSidebar />}
      >
        <CountingMap />
      </SidebarLayout>
    </MapProvider>
  )
}
