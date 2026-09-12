import { z } from 'zod'
import { loerrachMapFallback } from '@/config/app.const'
import { parseMapParam, serializeMapParam, type MapParam } from '@/shared/map/map-param'
import type { AppStep } from '@/shared/routing/app-step'

const mapParamFallback: MapParam = loerrachMapFallback

const optionalFlag = z
  .union([
    z.literal('1'),
    z.literal('true'),
    z.literal('0'),
    z.literal('false'),
    z.literal(1),
    z.literal(0),
    z.boolean(),
  ])
  .optional()
  .transform((value) => value === true || value === 1 || value === '1' || value === 'true')

/**
 * `parseSearch` JSON-parses every value, so an all-digit param (`?edge=12345`,
 * a numeric dataset slug) arrives as a number. Coerce it back before the string
 * checks — see `tanstack-router-conventions/router-search-serialization.md`.
 */
const optionalSearchString = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value)))

const optionalTrimmedSearchString = optionalSearchString.transform((value) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
})

export const indexSearchSchema = z.object({
  map: optionalSearchString
    .transform((value) => parseMapParam(value ?? '') ?? mapParamFallback)
    .transform((value) => serializeMapParam(value)),
  dataset: optionalTrimmedSearchString,
  edge: optionalTrimmedSearchString,
  match: optionalTrimmedSearchString,
  uncounted: optionalFlag.catch(false),
  parkings: optionalFlag.catch(false),
  step: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value): AppStep | undefined =>
      value === 'dataset' || value === 'count' || value === 'export' ? value : undefined,
    ),
})

export const dataSearchSchema = z.object({
  dataset: optionalTrimmedSearchString,
  edge: optionalTrimmedSearchString,
  q: optionalTrimmedSearchString,
})

export type IndexSearch = z.infer<typeof indexSearchSchema>
export type DataSearch = z.infer<typeof dataSearchSchema>

export function searchMapParam(search: Pick<IndexSearch, 'map'>): MapParam {
  return parseMapParam(search.map) ?? mapParamFallback
}

export function serializeIndexSearchMap(map: MapParam) {
  return serializeMapParam(map)
}
