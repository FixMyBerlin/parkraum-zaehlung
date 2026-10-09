import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useActiveCountPeriod } from '@/components/count-period-store'
import {
  useMultiSelectActions,
  useMultiSelectedEdgeIds,
} from '@/components/shared/multi-select-store'
import { Button } from '@/components/ui/button'
import { Checkbox, CheckboxField } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { countsQueryKey, countStore } from '@/shared/counts/counts-query'
import { isManualCountId, isManualRecord } from '@/shared/counts/manual-points'
import { recordForEdge } from '@/shared/counts/match-counts'
import { countedSides } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

export function EdgeList() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { dataset, edge: selectedId, uncounted } = Route.useSearch()
  // "nur ungezählt" and the x/2 badges describe the count tab that is open, not Sunday.
  const activePeriod = useActiveCountPeriod()
  const multiSelectedIds = useMultiSelectedEdgeIds()
  const { toggleEdge, clear: clearMultiSelect } = useMultiSelectActions()
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
    return countedSides(recordForEdge(records, feature.properties.id), activePeriod) !== 2
  })
  // Manual points never count towards edge completeness (`ProgressSummary`, the
  // "nur ungezählt" filter above) — this list is just so they stay reachable without
  // clicking around the map, so it ignores that filter and shows every one of them.
  const manualPoints = Object.entries(records)
    .filter(([, record]) => isManualRecord(record))
    .map(([id, record]) => ({ id, record }))
    .sort((a, b) => a.id.localeCompare(b.id))

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
          const sides = countedSides(recordForEdge(records, feature.properties.id), activePeriod)
          const selected =
            multiSelectedIds.length > 0
              ? multiSelectedIds.includes(feature.properties.id)
              : feature.properties.id === selectedId
          return (
            <li key={feature.properties.id}>
              <Button
                plain
                type="button"
                data-testid={`edge-list-${feature.properties.id}`}
                className={cn('w-full', selected && 'bg-white/10 text-sky-200')}
                onClick={(event) => {
                  // Umschalt+Klick sammelt Kanten für die Mehrfachauswahl.
                  if (event.shiftKey) {
                    toggleEdge(
                      feature.properties.id,
                      selectedId && !isManualCountId(selectedId) ? selectedId : undefined,
                    )
                    void navigate({
                      search: (previous) => ({ ...previous, edge: undefined }),
                      replace: true,
                    })
                    return
                  }
                  clearMultiSelect()
                  void navigate({
                    search: (previous) => ({ ...previous, edge: feature.properties.id }),
                    replace: true,
                  })
                }}
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

      {manualPoints.length > 0 ? (
        <>
          <Subheading className="mt-4">Manuelle Punkte</Subheading>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
            {manualPoints.map(({ id, record }) => {
              const sides = countedSides(record, activePeriod)
              const selected = id === selectedId
              return (
                <li key={id}>
                  <Button
                    plain
                    type="button"
                    data-testid={`manual-point-list-${id}`}
                    className={cn('w-full', selected && 'bg-white/10 text-sky-200')}
                    onClick={() => {
                      clearMultiSelect()
                      void navigate({
                        search: (previous) => ({ ...previous, edge: id }),
                        replace: true,
                      })
                    }}
                  >
                    <span className="flex w-full items-baseline justify-between gap-2 text-left">
                      <span>{record.created_by ? `Punkt · ${record.created_by}` : 'Punkt'}</span>
                      <span className="text-zinc-500">{sides}/2</span>
                    </span>
                  </Button>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}
