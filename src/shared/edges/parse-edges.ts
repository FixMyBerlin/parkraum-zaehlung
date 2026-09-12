import { z } from 'zod'
import { edgesCollectionSchema, slugifyDatasetName, type CountingEdgesGeoJSON } from './schema'

export type ParsedEdges = {
  collection: CountingEdgesGeoJSON
  dataset: string
  needsDatasetName: boolean
}

/**
 * Loose pre-filter shapes: only what's needed to drop non-LineString features
 * before the strict `edgesCollectionSchema.parse()` below runs. `.loose()`
 * (Zod 4's passthrough) keeps every other key untouched, and a feature or
 * geometry that doesn't even match the loose shape is treated the same as
 * one whose `geometry.type` isn't `'LineString'`: dropped, except a
 * non-object feature entry, which is kept so the strict parse reports it.
 */
const rawFeatureCollectionSchema = z.object({ features: z.array(z.unknown()) }).loose()
const looseFeatureSchema = z.object({ geometry: z.unknown().optional() }).loose()
const looseGeometrySchema = z.object({ type: z.unknown() }).loose()

function isLineStringFeature(feature: unknown): boolean {
  const parsedFeature = looseFeatureSchema.safeParse(feature)
  if (!parsedFeature.success) return true
  const parsedGeometry = looseGeometrySchema.safeParse(parsedFeature.data.geometry)
  return parsedGeometry.success && parsedGeometry.data.type === 'LineString'
}

function withoutUnlocatedFeatures(raw: unknown): unknown {
  const parsed = rawFeatureCollectionSchema.safeParse(raw)
  if (!parsed.success) return raw
  return { ...parsed.data, features: parsed.data.features.filter(isLineStringFeature) }
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
