import type { FeatureCollection, LineString } from 'geojson'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { countedSides, type CountRecord, type CountsFile } from './schema'

export type CountStatus = 'counted' | 'uncounted' | 'orphan'

export type CountsExportGeoJSON = FeatureCollection<
  LineString | null,
  { id: string; count_status: CountStatus } & Record<string, unknown>
> & {
  metadata?: CountingEdgesGeoJSON['metadata']
}

export function buildCountsFile(dataset: string, records: Record<string, CountRecord>): CountsFile {
  return { dataset, records }
}

export function buildAllCountsFile(datasets: Record<string, Record<string, CountRecord>>): {
  datasets: Record<string, CountsFile>
} {
  return {
    datasets: Object.fromEntries(
      Object.entries(datasets).map(([name, records]) => [name, buildCountsFile(name, records)]),
    ),
  }
}

function countExportFields(record: CountRecord) {
  return {
    left_pkw: record.left.pkw,
    left_motorrad: record.left.motorrad,
    left_lkw_bus: record.left.lkw_bus,
    right_pkw: record.right.pkw,
    right_motorrad: record.right.motorrad,
    right_lkw_bus: record.right.lkw_bus,
    counted_sides: countedSides(record),
    note: record.note,
    counted_at: record.updated_at,
    counted_by: record.updated_by,
  }
}

export function mergeCountsIntoEdges(
  collection: CountingEdgesGeoJSON,
  records: Record<string, CountRecord>,
): CountsExportGeoJSON {
  const edgeIds = new Set(collection.features.map((feature) => feature.properties.id))

  const features = collection.features.map((feature) => {
    const record = records[feature.properties.id]
    if (!record) {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          count_status: 'uncounted' as const,
        },
      }
    }
    return {
      ...feature,
      properties: {
        ...feature.properties,
        ...countExportFields(record),
        count_status: 'counted' as const,
      },
    }
  })

  const orphans = Object.entries(records)
    .filter(([edgeId]) => !edgeIds.has(edgeId))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([edgeId, record]) => ({
      type: 'Feature' as const,
      id: edgeId,
      geometry: null,
      properties: {
        id: edgeId,
        count_status: 'orphan' as const,
        ...countExportFields(record),
      },
    }))

  return {
    ...collection,
    features: [...features, ...orphans],
  }
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportFilename(kind: 'counts' | 'edges', dataset: string, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  return `${kind}-${dataset}-${stamp}.json`
}

export function exportGeojsonFilename(dataset: string, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  return `counts-${dataset}-${stamp}.geojson`
}
