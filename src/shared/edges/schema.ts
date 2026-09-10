import type { FeatureCollection, LineString } from 'geojson'
import { z } from 'zod'

const nullableInt = z.number().int().nonnegative().nullable()

const edgePropertiesSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  highway: z.string().nullable().optional(),
  road: z.string().nullable().optional(),
  way_ids: z.array(z.number().int()).min(1),
  way_reversed: z.array(z.boolean()).optional(),
  start_node: z.number().int().optional(),
  end_node: z.number().int().optional(),
  length: z.number().nonnegative().optional(),
  azimuth: z.number().optional(),
  capacity_left: nullableInt.optional(),
  capacity_right: nullableInt.optional(),
  parking_left: z.string().nullable().optional(),
  parking_right: z.string().nullable().optional(),
})

type EdgeProperties = z.infer<typeof edgePropertiesSchema>

const edgesMetadataSchema = z
  .object({
    schema: z.string().optional(),
    dataset: z.string().min(1).optional(),
    region: z.string().optional(),
    generated_at: z.string().optional(),
    source: z.string().optional(),
  })
  .passthrough()

type EdgesMetadata = z.infer<typeof edgesMetadataSchema>

const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()]).rest(z.number())).min(2),
})

const edgeFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: lineStringSchema,
  properties: edgePropertiesSchema,
})

export const edgesCollectionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    metadata: edgesMetadataSchema.optional(),
    features: z.array(edgeFeatureSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>()
    for (const [index, feature] of value.features.entries()) {
      const id = feature.properties.id
      if (ids.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate edge id "${id}"`,
          path: ['features', index, 'properties', 'id'],
        })
      }
      ids.add(id)
      const reversed = feature.properties.way_reversed
      if (reversed && reversed.length !== feature.properties.way_ids.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'way_reversed length must match way_ids',
          path: ['features', index, 'properties', 'way_reversed'],
        })
      }
    }
  })

export type CountingEdgesGeoJSON = FeatureCollection<LineString, EdgeProperties> & {
  metadata?: EdgesMetadata
}

const datasetNamePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidDatasetName(value: string) {
  return value.length >= 3 && value.length <= 60 && datasetNamePattern.test(value)
}

export function slugifyDatasetName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return slug || 'dataset'
}
