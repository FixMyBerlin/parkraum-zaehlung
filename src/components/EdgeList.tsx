import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { countedSides } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

export function EdgeList() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { dataset, edge: selectedId, uncounted } = Route.useSearch()
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

  if (!dataset || !edgesQuery.data) return null

  const records = countsQuery.data ?? {}
  const features = edgesQuery.data.collection.features.filter((feature) => {
    if (!uncounted) return true
    return countedSides(records[feature.properties.id]) !== 2
  })

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Kanten</h2>
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={uncounted}
            onChange={(event) =>
              void navigate({
                search: (previous) => ({ ...previous, uncounted: event.target.checked }),
              })
            }
          />
          nur ungezählt
        </label>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
        {features.map((feature) => {
          const sides = countedSides(records[feature.properties.id])
          const selected = feature.properties.id === selectedId
          return (
            <li key={feature.properties.id}>
              <button
                type="button"
                data-testid={`edge-list-${feature.properties.id}`}
                className={cn(
                  'w-full rounded px-2 py-1 text-left hover:bg-slate-800',
                  selected && 'bg-slate-800 text-sky-200',
                )}
                onClick={() =>
                  void navigate({
                    search: (previous) => ({ ...previous, edge: feature.properties.id }),
                  })
                }
              >
                <span>{feature.properties.name ?? feature.properties.id}</span>
                <span className="ml-2 text-slate-500">{sides}/2</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
