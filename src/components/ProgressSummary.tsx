import { Callout } from '@/components/ui/callout'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

type ProgressSummaryProps = {
  dataset?: string
  edges?: CountingEdgesGeoJSON
  remoteCount?: number
}

export function ProgressSummary({ edges, dataset, remoteCount = 0 }: ProgressSummaryProps) {
  if (edges) return null
  if (dataset && remoteCount > 0) {
    return (
      <Callout title="Nur in der Zähl-Datenbank">
        {remoteCount} Zählungen. Kanten-Datei im Schritt Datensatz importieren.
      </Callout>
    )
  }
  return (
    <Callout title="Noch keine Kanten geladen">
      Kanten-Datei im Schritt Datensatz importieren.
    </Callout>
  )
}
