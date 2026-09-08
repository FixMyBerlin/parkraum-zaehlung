import { edgesCollectionSchema, slugifyDatasetName, type CountingEdgesGeoJSON } from './schema'

export type ParsedEdges = {
  collection: CountingEdgesGeoJSON
  dataset: string
  needsDatasetName: boolean
}

export function parseEdgesJson(raw: unknown, fallbackDataset?: string): ParsedEdges {
  const parsed = edgesCollectionSchema.parse(raw)
  const fromMeta = parsed.metadata?.dataset?.trim()
  const dataset = fromMeta ? slugifyDatasetName(fromMeta) : fallbackDataset
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

export function parseEdgesText(text: string, fallbackDataset?: string): ParsedEdges {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Datei ist kein gültiges JSON.')
  }
  return parseEdgesJson(json, fallbackDataset)
}
