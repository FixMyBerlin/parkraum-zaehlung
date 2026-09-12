import { AdminCountsPage } from '@/components/admin/AdminCountsPage'
import { AppHeader } from '@/components/AppHeader'
import { useAppStepNav } from '@/components/shared/use-app-step-nav'

export function DataPage() {
  const { steps, goToStep } = useAppStepNav()

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950">
      <AppHeader steps={steps} onSelect={goToStep} dataPage />
      <main className="min-h-0 flex-1 overflow-auto">
        <AdminCountsPage />
      </main>
    </div>
  )
}
