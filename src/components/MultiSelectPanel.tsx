import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveCountPeriod } from '@/components/count-period-store'
import { CountPeriodToggle } from '@/components/CountPeriodToggle'
import {
  useMultiSelectActions,
  useMultiSelectedEdgeIds,
} from '@/components/shared/multi-select-store'
import { useOsmAuth } from '@/components/shared/use-osm-auth'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Route } from '@/routes/index'
import {
  allCountsQueryKey,
  countsQueryKey,
  countStore,
  datasetSummariesQueryKey,
} from '@/shared/counts/counts-query'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import { originalIdForEdge, recordForEdge } from '@/shared/counts/match-counts'
import { countedSides, countPeriodLabel, type CountRecord } from '@/shared/counts/schema'
import { zeroFilledRecord } from '@/shared/counts/zero-fill'
import { loadDataset } from '@/shared/datasets/dataset-idb'

/**
 * Shown instead of the count form while several edges are picked with Shift+click.
 * Its one bulk action enters 0 for every still-open side of the picked edges in the
 * active count tab — for roundabouts and complex junctions where nothing is parked.
 */
export function MultiSelectPanel() {
  const queryClient = useQueryClient()
  const { dataset } = Route.useSearch()
  const auth = useOsmAuth()
  const activePeriod = useActiveCountPeriod()
  const edgeIds = useMultiSelectedEdgeIds()
  const { toggleEdge, clear } = useMultiSelectActions()

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
  const records = countsQuery.data ?? {}
  const edges = (edgesQuery.data?.collection.features ?? []).filter((feature) =>
    edgeIds.includes(feature.properties.id),
  )
  const openEdges = edges.filter(
    (feature) => countedSides(recordForEdge(records, feature.properties.id), activePeriod) < 2,
  )

  const zeroMutation = useMutation({
    mutationFn: async () => {
      if (!dataset) return {}
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      const written: Record<string, CountRecord> = {}
      for (const feature of openEdges) {
        const edgeId = feature.properties.id
        const record = zeroFilledRecord({
          existing: recordForEdge(records, edgeId),
          period: activePeriod,
          edgeId,
          coordinates: feature.geometry.coordinates,
          updatedBy: auth.displayName,
        })
        if (!record) continue
        const kvEdgeId = originalIdForEdge(records, edgeId) ?? edgeId
        written[kvEdgeId] = await countStore.put(dataset, kvEdgeId, record)
      }
      return written
    },
    // Also after a failure halfway through: the edges written so far must show up.
    onSettled: async () => {
      if (!dataset) return
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
      void queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
      void queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
    },
    onSuccess: () => clear(),
  })

  return (
    <section data-testid="multi-select-panel">
      <Subheading>Mehrfachauswahl</Subheading>
      <Text className="mt-1">
        {edges.length} {edges.length === 1 ? 'Kante' : 'Kanten'} gewählt. Mit Umschalt+Klick weitere
        Kanten hinzufügen oder entfernen.
      </Text>
      <div className="mt-3 space-y-3">
        <CountPeriodToggle />
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {edges.map((feature) => (
            <li
              key={feature.properties.id}
              className="flex items-baseline justify-between gap-2 px-1 text-zinc-950 dark:text-white"
            >
              <span className="truncate">{feature.properties.name ?? feature.properties.id}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="text-zinc-500">
                  {countedSides(recordForEdge(records, feature.properties.id), activePeriod)}/2
                </span>
                <button
                  type="button"
                  className="cursor-pointer text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                  aria-label="Aus Auswahl entfernen"
                  onClick={() => toggleEdge(feature.properties.id)}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
        <Text>
          Trägt bei {openEdges.length} {openEdges.length === 1 ? 'Kante' : 'Kanten'} für „
          {countPeriodLabel[activePeriod]}“ auf jeder noch offenen Seite 0 in allen Kategorien ein.
          Vorhandene Werte bleiben unverändert.
        </Text>
        {!auth.authenticated ? <Callout>{osmLoginRequiredMessage}</Callout> : null}
        {zeroMutation.isError ? (
          <Callout tone="error">
            {zeroMutation.error instanceof Error
              ? zeroMutation.error.message
              : 'Speichern fehlgeschlagen'}
          </Callout>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            color="sky"
            data-testid="multi-select-zero"
            disabled={!auth.authenticated || openEdges.length === 0 || zeroMutation.isPending}
            onClick={() => zeroMutation.mutate()}
          >
            Überall 0 eintragen
          </Button>
          <Button type="button" plain data-testid="multi-select-clear" onClick={() => clear()}>
            Auswahl aufheben
          </Button>
        </div>
      </div>
    </section>
  )
}
