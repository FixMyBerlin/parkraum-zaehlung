import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { countedSides, type CountRecord, type CountsFile } from './schema'

export function buildCountsFile(dataset: string, records: Record<string, CountRecord>): CountsFile {
  return { dataset, records }
}

export function mergeCountsIntoEdges(
  collection: CountingEdgesGeoJSON,
  records: Record<string, CountRecord>,
): CountingEdgesGeoJSON {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      const record = records[feature.properties.id]
      if (!record) return feature
      return {
        ...feature,
        properties: {
          ...feature.properties,
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
        },
      }
    }),
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
