import { z } from 'zod'
import { loerrachMapFallback } from '@/config/app.const'
import { parseMapParam, serializeMapParam, type MapParam } from '@/shared/map/map-param'

const mapParamFallback: MapParam = loerrachMapFallback

const optionalFlag = z
  .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.boolean()])
  .optional()
  .transform((value) => value === true || value === '1' || value === 'true')

export const indexSearchSchema = z.object({
  map: z
    .string()
    .optional()
    .transform((value) => parseMapParam(value ?? '') ?? mapParamFallback)
    .transform((value) => serializeMapParam(value)),
  dataset: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    }),
  edge: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    }),
  edges: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    }),
  uncounted: optionalFlag.catch(false),
  parkings: optionalFlag.catch(false),
})

export type IndexSearch = z.infer<typeof indexSearchSchema>

export function searchMapParam(search: Pick<IndexSearch, 'map'>): MapParam {
  return parseMapParam(search.map) ?? mapParamFallback
}

export function serializeIndexSearchMap(map: MapParam) {
  return serializeMapParam(map)
}
