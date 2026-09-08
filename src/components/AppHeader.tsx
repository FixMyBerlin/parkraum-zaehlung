import { useQuery } from '@tanstack/react-query'
import { AuthButton } from '@/components/AuthButton'
import { ProgressSummary } from '@/components/ProgressSummary'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { Route } from '@/routes/index'
import { loadDataset } from '@/shared/datasets/dataset-idb'

export function AppHeader() {
  const dataset = Route.useSearch({ select: (search) => search.dataset })
  const edgesQuery = useQuery({
    queryKey: ['dataset', dataset],
    queryFn: () => loadDataset(dataset!),
    enabled: Boolean(dataset),
  })
  const countsQuery = useQuery({
    queryKey: countsQueryKey(dataset ?? ''),
    queryFn: () => countStore.list(dataset!),
    enabled: Boolean(dataset),
  })

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-4 py-2">
      <div>
        <h1 className="text-sm font-semibold tracking-wide text-slate-100">Parkraum-Zählung</h1>
        <p className="text-xs text-slate-400">
          {dataset ? `Datensatz ${dataset}` : 'Kanten-GeoJSON importieren'}
        </p>
      </div>
      <ProgressSummary edges={edgesQuery.data?.collection} records={countsQuery.data ?? {}} />
      <AuthButton />
    </header>
  )
}
