import { edgesCollectionSchema, slugifyDatasetName, type CountingEdgesGeoJSON } from './schema'

export type ParsedEdges = {
  collection: CountingEdgesGeoJSON
  dataset: string
  needsDatasetName: boolean
}

function withoutUnlocatedFeatures(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) return raw
  const collection = raw as { features?: unknown }
  if (!Array.isArray(collection.features)) return raw
  return {
    ...collection,
    features: collection.features.filter((feature) => {
      if (typeof feature !== 'object' || feature == null || Array.isArray(feature)) return true
      const geometry = (feature as { geometry?: { type?: unknown } }).geometry
      return geometry?.type === 'LineString'
    }),
  }
}

export function parseEdgesJson(raw: unknown, fallbackDataset?: string) {
  const parsed = edgesCollectionSchema.parse(withoutUnlocatedFeatures(raw))
  const fromMeta = parsed.metadata?.dataset?.trim()
  const dataset = fallbackDataset ?? (fromMeta ? slugifyDatasetName(fromMeta) : undefined)
  if (!dataset) {
    return {
      collection: parsed,
      dataset: '',
      needsDatasetName: true,
    }
  }
  return {
    collection: {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        dataset,
      },
    },
    dataset,
    needsDatasetName: false,
  }
}

export function parseEdgesText(text: string, fallbackDataset?: string) {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Datei ist kein gültiges JSON.')
  }
  return parseEdgesJson(json, fallbackDataset)
}
