import type { FeatureCollection, LineString, Point } from 'geojson'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { isEmptyOccupancy } from './count-from-form'
import { isManualRecord } from './manual-points'
import { originalIdForEdge, recordForEdge } from './match-counts'
import { countedSides, countPeriods, type CountRecord } from './schema'

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

/**
 * GeoJSON is a flat, GIS-facing contract: 18 `{period}_{side}_{category}` number-or-null
 * fields (never a nested `periods` object), always all 18 once a feature is counted at all.
 */
function periodExportFields(record: CountRecord) {
  return Object.fromEntries(
    countPeriods.flatMap((period) => {
      const occupancy = record.periods[period]
      return [
        [`${period}_left_pkw`, occupancy.left.pkw],
        [`${period}_left_motorrad`, occupancy.left.motorrad],
        [`${period}_left_lkw_bus`, occupancy.left.lkw_bus],
        [`${period}_right_pkw`, occupancy.right.pkw],
        [`${period}_right_motorrad`, occupancy.right.motorrad],
        [`${period}_right_lkw_bus`, occupancy.right.lkw_bus],
      ]
    }),
  ) as Record<string, number | null>
}

function countExportFields(record: CountRecord, originalEdgeId: string) {
  return {
    ...periodExportFields(record),
    counted_sides: countedSides(record),
    note: record.note,
    counted_at: record.counted_at,
    counted_by: record.updated_by,
    original_edge_id: originalEdgeId,
    match_id: record.match_id,
    match_status: record.match_status,
    mid_lat: record.mid_lat,
    mid_lng: record.mid_lng,
    source: record.source,
    created_by: record.created_by,
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
      // Manual points never match an edge by design, so they always land here too —
      // but they are placed points, not leftovers from a broken/renamed edge, so they
      // get their own two-value status instead of unmatched/unresolved.
      const countStatus: CountStatus = isManualRecord(record)
        ? isEmptyOccupancy(record)
          ? 'uncounted'
          : 'counted'
        : record.match_status === 'none'
          ? 'unmatched'
          : 'unresolved'
      return {
        type: 'Feature' as const,
        id: originalId,
        geometry: midpointPoint(record),
        properties: {
          id: originalId,
          count_status: countStatus,
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
