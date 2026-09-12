import { createFileRoute } from '@tanstack/react-router'
import { AppHeader } from '@/components/AppHeader'
import { AdminCountsPage } from '@/features/admin/AdminCountsPage'
import { useAppStepNav } from '@/features/layout/use-app-step-nav'
import { dataSearchSchema } from '@/shared/routing/search-schema'

export const Route = createFileRoute('/data')({
  validateSearch: dataSearchSchema,
  component: DataPage,
})

function DataPage() {
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
