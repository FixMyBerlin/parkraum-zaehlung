import type { FeatureCollection, LineString, Point } from 'geojson'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { originalIdForEdge, recordForEdge } from './match-counts'
import { countedSides, type CountRecord } from './schema'

export type CountStatus = 'counted' | 'uncounted' | 'unmatched' | 'unresolved'

export type CountsExportGeoJSON = FeatureCollection<
  LineString | Point,
  { id: string; count_status: CountStatus } & Record<string, unknown>
> & {
  metadata?: CountingEdgesGeoJSON['metadata']
}

export function buildCountsFile(dataset: string, records: Record<string, CountRecord>) {
  return { dataset, records }
}

export function buildAllCountsFile(datasets: Record<string, Record<string, CountRecord>>) {
  return {
    datasets: Object.fromEntries(
      Object.entries(datasets).map(([name, records]) => [name, buildCountsFile(name, records)]),
    ),
  }
}

function countExportFields(record: CountRecord, originalEdgeId: string) {
  return {
    left_pkw: record.left.pkw,
    left_motorrad: record.left.motorrad,
    left_lkw_bus: record.left.lkw_bus,
    right_pkw: record.right.pkw,
    right_motorrad: record.right.motorrad,
    right_lkw_bus: record.right.lkw_bus,
    counted_sides: countedSides(record),
    note: record.note,
    counted_at: record.counted_at,
    counted_by: record.updated_by,
    original_edge_id: originalEdgeId,
    match_id: record.match_id,
    match_status: record.match_status,
    mid_lat: record.mid_lat,
    mid_lng: record.mid_lng,
  }
}

function midpointPoint(record: CountRecord) {
  const point: Point = {
    type: 'Point',
    coordinates: [record.mid_lng, record.mid_lat],
  }
  return point
}

export function mergeCountsIntoEdges(
  collection: CountingEdgesGeoJSON,
  records: Record<string, CountRecord>,
) {
  const usedOriginalIds = new Set<string>()

  const features = collection.features.map((feature) => {
    const originalId = originalIdForEdge(records, feature.properties.id)
    const record = recordForEdge(records, feature.properties.id)
    if (!record || !originalId) {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          count_status: 'uncounted' as const,
        },
      }
    }
    usedOriginalIds.add(originalId)
    return {
      ...feature,
      properties: {
        ...feature.properties,
        ...countExportFields(record, originalId),
        count_status: 'counted' as const,
      },
    }
  })

  const leftover = Object.entries(records)
    .filter(([originalId]) => !usedOriginalIds.has(originalId))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([originalId, record]) => {
      const unmatched = record.match_status === 'none'
      return {
        type: 'Feature' as const,
        id: originalId,
        geometry: midpointPoint(record),
        properties: {
          id: originalId,
          count_status: unmatched ? ('unmatched' as const) : ('unresolved' as const),
          ...countExportFields(record, originalId),
        },
      }
    })

  return {
    ...collection,
    features: [...features, ...leftover],
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
