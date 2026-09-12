import type { DatasetSummary } from '@/shared/counts/count-store'
import { datasetOverlap, type DatasetOverlap } from '@/shared/counts/dataset-overlap'
import { assignedMatchIds } from '@/shared/counts/match-counts'
import type { CountRecord } from '@/shared/counts/schema'
import type { StoredDataset } from './dataset-idb'

export type DatasetInventoryRow = {
  dataset: string
  local: boolean
  remoteEntryCount: number
  localEdgeCount: number | null
  overlap: DatasetOverlap | null
}

export function buildDatasetInventory(
  local: StoredDataset[],
  summaries: DatasetSummary[],
  countsByDataset: Record<string, Record<string, CountRecord> | undefined>,
) {
  const localByName = new Map(local.map((item) => [item.dataset, item]))
  const remoteByName = new Map(summaries.map((item) => [item.dataset, item.entryCount]))
  const names = [...new Set([...localByName.keys(), ...remoteByName.keys()])].sort((a, b) =>
    a.localeCompare(b),
  )

  return names.map((dataset) => {
    const stored = localByName.get(dataset)
    const remoteEntryCount = remoteByName.get(dataset) ?? 0
    if (!stored) {
      return {
        dataset,
        local: false,
        remoteEntryCount,
        localEdgeCount: null,
        overlap: null,
      }
    }
    const edgeIds = stored.collection.features.map((feature) => feature.properties.id)
    const records = countsByDataset[dataset]
    return {
      dataset,
      local: true,
      remoteEntryCount,
      localEdgeCount: edgeIds.length,
      overlap: records ? datasetOverlap(edgeIds, assignedMatchIds(records)) : null,
    }
  })
}

export function datasetInventoryCopy(row: DatasetInventoryRow) {
  if (!row.local) {
    return `${row.remoteEntryCount} Zählungen in der Zähl-Datenbank. Keine Kanten in diesem Browser — Datei importieren, um abzugleichen.`
  }
  if (!row.overlap) {
    return `${row.localEdgeCount} Kanten lokal. Zählungen werden geladen …`
  }
  if (row.overlap.matched === 0 && row.remoteEntryCount === 0) {
    return `${row.localEdgeCount} Kanten lokal. Noch keine Zählungen in der Zähl-Datenbank.`
  }
  const totalEdges = row.localEdgeCount ?? 0
  const matchedLine = `Treffer ${row.overlap.matched}/${totalEdges} (${row.overlap.matchedPercent} %). Ohne Zählung: ${row.overlap.edgesWithoutCount} Kanten.`
  const orphan =
    row.overlap.countsWithoutEdge > 0 ? ` Ohne Zuordnung: ${row.overlap.countsWithoutEdge}.` : ''
  return `Zähl-Datenbank: ${row.remoteEntryCount} Zählungen. Kanten hochgeladen: ${totalEdges}. ${matchedLine}${orphan}`
}
