import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Checkbox, CheckboxField } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <Subheading>Kanten</Subheading>
        <CheckboxField>
          <Checkbox
            checked={uncounted}
            onChange={(checked) =>
              void navigate({
                search: (previous) => ({ ...previous, uncounted: checked }),
                replace: true,
              })
            }
          />
          <Label>nur ungezählt</Label>
        </CheckboxField>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
        {features.map((feature) => {
          const sides = countedSides(records[feature.properties.id])
          const selected = feature.properties.id === selectedId
          return (
            <li key={feature.properties.id}>
              <Button
                plain
                type="button"
                data-testid={`edge-list-${feature.properties.id}`}
                className={cn('w-full', selected && 'bg-white/10 text-sky-200')}
                onClick={() =>
                  void navigate({
                    search: (previous) => ({ ...previous, edge: feature.properties.id }),
                    replace: true,
                  })
                }
              >
                <span className="flex w-full items-baseline justify-between gap-2 text-left">
                  <span>{feature.properties.name ?? feature.properties.id}</span>
                  <span className="text-zinc-500">{sides}/2</span>
                </span>
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
