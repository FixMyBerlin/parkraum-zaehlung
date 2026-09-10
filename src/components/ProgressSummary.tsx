import { Callout } from '@/components/ui/callout'
import { countedSides } from '@/shared/counts/schema'
import type { CountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

type ProgressSummaryProps = {
  dataset?: string
  edges?: CountingEdgesGeoJSON
  records?: Record<string, CountRecord>
}

function edgeCountProgress(edges: CountingEdgesGeoJSON, records: Record<string, CountRecord>) {
  const total = edges.features.length
  const counted = edges.features.filter(
    (feature) => countedSides(records[feature.properties.id]) === 2,
  ).length
  return { counted, total }
}

export function DatasetHeadline({ dataset, edges, records = {} }: ProgressSummaryProps) {
  if (!edges) {
    return (
      <p className="truncate text-xs/5 text-zinc-400">
        {dataset ? `Datensatz ${dataset}` : 'Kanten-GeoJSON importieren'}
      </p>
    )
  }
  const { counted, total } = edgeCountProgress(edges, records)
  return (
    <p className="truncate text-xs/5 text-zinc-400" data-testid="progress-summary">
      {dataset ? `Datensatz ${dataset} · ` : null}
      {counted}/{total} Kanten
    </p>
  )
}

export function ProgressSummary({ edges }: ProgressSummaryProps) {
  if (!edges) {
    return (
      <Callout className="mt-3" title="Noch keine Kanten geladen">
        Datei unten importieren, um zu zählen.
      </Callout>
    )
  }
  return null
}
