import { countedSides } from '@/shared/counts/schema'
import type { CountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

type ProgressSummaryProps = {
  edges?: CountingEdgesGeoJSON
  records: Record<string, CountRecord>
}

export function ProgressSummary({ edges, records }: ProgressSummaryProps) {
  if (!edges) {
    return <p className="text-xs/5 text-zinc-400">Noch keine Kanten geladen</p>
  }
  const total = edges.features.length
  const counted = edges.features.filter(
    (feature) => countedSides(records[feature.properties.id]) === 2,
  ).length
  const metres = edges.features.reduce((sum, feature) => sum + (feature.properties.length ?? 0), 0)
  const countedMetres = edges.features
    .filter((feature) => countedSides(records[feature.properties.id]) === 2)
    .reduce((sum, feature) => sum + (feature.properties.length ?? 0), 0)

  return (
    <p className="text-xs/5 text-zinc-400" data-testid="progress-summary">
      {counted}/{total} Kanten · {Math.round(countedMetres)}/{Math.round(metres)} m
    </p>
  )
}
