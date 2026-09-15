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

/**
 * Loose shape of a counts export (`countsFileSchema` in `@/shared/counts/schema`),
 * duplicated here (not imported) to keep this module from depending on the counts
 * schema just to detect a misplaced file.
 */
const looseCountsExportShape = z
  .object({ dataset: z.string(), records: z.record(z.string(), z.unknown()) })
  .loose()

function isCountsExportShape(raw: unknown): boolean {
  return looseCountsExportShape.safeParse(raw).success
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** First few zod issue paths, compact, so the UI never has to show raw zod JSON. */
function summarizeIssuePaths(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => (issue.path.length > 0 ? issue.path.join('.') : '(Wurzel)'))
    .join(', ')
}

/** Maps a failed `edgesCollectionSchema.parse` into a readable German message. */
function friendlyEdgesParseError(raw: unknown, error: unknown): Error {
  if (isCountsExportShape(raw)) {
    return new Error(
      'Das ist ein Zählungs-Export (Datei mit „dataset“ und „records“), keine Kanten-Datei. Zählungen werden im Schritt „Export“ importiert.',
    )
  }
  if (!isPlainObject(raw) || raw.type !== 'FeatureCollection') {
    return new Error('Datei ist keine GeoJSON-FeatureCollection mit Kanten (parkings_edges).')
  }
  if (!Array.isArray(raw.features) || raw.features.length === 0) {
    return new Error('Datei enthält keine Kanten (features fehlt oder ist leer).')
  }
  if (error instanceof z.ZodError) {
    return new Error(
      `Kanten-Datei entspricht nicht dem erwarteten Format (Details: ${summarizeIssuePaths(error)}).`,
    )
  }
  return new Error('Kanten-Datei entspricht nicht dem erwarteten Format.')
}

export function parseEdgesJson(raw: unknown, fallbackDataset?: string) {
  let parsed: CountingEdgesGeoJSON
  try {
    parsed = edgesCollectionSchema.parse(withoutUnlocatedFeatures(raw))
  } catch (error) {
    throw friendlyEdgesParseError(raw, error)
  }
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
