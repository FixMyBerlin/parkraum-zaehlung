import { z } from 'zod'

const categoryCountSchema = z.number().int().nonnegative().nullable()

/**
 * `kleintransporter` and `sonstiges` were added after the first counts were stored,
 * so they default to `null` (not counted): records written before then still parse.
 */
const sideCountSchema = z.object({
  pkw: categoryCountSchema,
  kleintransporter: categoryCountSchema.default(null),
  lkw_bus: categoryCountSchema,
  motorrad: categoryCountSchema,
  sonstiges: categoryCountSchema.default(null),
})

export type SideCount = z.infer<typeof sideCountSchema>

export type CountCategory = keyof SideCount

/** Display order of the vehicle classes, top to bottom in every form and export. */
export const countCategories = [
  'pkw',
  'kleintransporter',
  'lkw_bus',
  'motorrad',
  'sonstiges',
] as const satisfies readonly CountCategory[]

export const countCategoryLabel: Record<CountCategory, string> = {
  pkw: 'Pkw',
  kleintransporter: 'Kleintransporter/-bus',
  lkw_bus: 'Lkw/Bus',
  motorrad: 'Motorrad',
  sonstiges: 'Sonstiges',
}

export const emptySideCount = (): SideCount => ({
  pkw: null,
  kleintransporter: null,
  lkw_bus: null,
  motorrad: null,
  sonstiges: null,
})

export type Side = 'left' | 'right'

/**
 * The count tabs. These keys are stored in the Zähl-Datenbank and prefix the GeoJSON
 * export columns, so they must never be renamed — change `countPeriodLabel` instead.
 * `period_4`/`period_5` are deliberately neutral: their meaning is not decided yet.
 */
export const countPeriods = ['sunday', 'midday', 'evening', 'period_4', 'period_5'] as const

export type CountPeriod = (typeof countPeriods)[number]

export const countPeriodLabel: Record<CountPeriod, string> = {
  sunday: 'Sonntag',
  midday: 'Mittags',
  evening: 'Abends',
  period_4: 'Zeit 4',
  period_5: 'Zeit 5',
}

const periodOccupancySchema = z.object({
  left: sideCountSchema,
  right: sideCountSchema,
})

export type PeriodOccupancy = z.infer<typeof periodOccupancySchema>

export const emptyPeriodOccupancy = (): PeriodOccupancy => ({
  left: emptySideCount(),
  right: emptySideCount(),
})

export const matchStatusSchema = z.enum(['id', 'midpoint', 'manual', 'none'])

export type MatchStatus = z.infer<typeof matchStatusSchema>

/**
 * `imported` covers every count on a file-imported LineString edge (the vast
 * majority, and the historical default). `manual` marks a point the user placed
 * directly on the map where no edge exists — see `src/shared/counts/manual-points.ts`.
 * Not exported: nothing outside this file needs the schema or the type directly,
 * they read `CountRecord['source']` instead.
 */
const countSourceSchema = z.enum(['imported', 'manual'])

export const countRecordSchema = z.object({
  periods: z.object({
    sunday: periodOccupancySchema,
    midday: periodOccupancySchema,
    evening: periodOccupancySchema,
    // Added later: records stored with only the first three periods still parse.
    period_4: periodOccupancySchema.default(emptyPeriodOccupancy),
    period_5: periodOccupancySchema.default(emptyPeriodOccupancy),
  }),
  note: z.string().optional(),
  updated_at: z.string(),
  updated_by: z.string().optional(),
  counted_at: z.string(),
  /** Who first created this record, frozen on every later update (mirrors `counted_at`). */
  created_by: z.string().optional(),
  mid_lat: z.number(),
  mid_lng: z.number(),
  match_id: z.string(),
  match_status: matchStatusSchema,
  source: countSourceSchema.default('imported'),
})

export type CountRecord = z.infer<typeof countRecordSchema>

type EmptyCountExtras = Partial<
  Pick<
    CountRecord,
    'match_id' | 'match_status' | 'mid_lat' | 'mid_lng' | 'counted_at' | 'source' | 'created_by'
  >
>

export function emptyCountRecord(
  updatedAt = new Date().toISOString(),
  extras: EmptyCountExtras = {},
) {
  return {
    periods: {
      sunday: emptyPeriodOccupancy(),
      midday: emptyPeriodOccupancy(),
      evening: emptyPeriodOccupancy(),
      period_4: emptyPeriodOccupancy(),
      period_5: emptyPeriodOccupancy(),
    },
    updated_at: updatedAt,
    counted_at: extras.counted_at ?? updatedAt,
    created_by: extras.created_by,
    match_id: extras.match_id ?? '',
    match_status: extras.match_status ?? 'id',
    mid_lat: extras.mid_lat ?? 0,
    mid_lng: extras.mid_lng ?? 0,
    source: extras.source ?? 'imported',
  }
}

export function isSideCounted(side: SideCount) {
  return countCategories.some((category) => side[category] != null)
}

/** The left/right occupancy for one period. */
export function occupancyFor(record: CountRecord, period: CountPeriod) {
  return record.periods[period]
}

export function isPeriodSideCounted(record: CountRecord, period: CountPeriod, side: Side) {
  return isSideCounted(occupancyFor(record, period)[side])
}

/** True once any period but Sunday has occupancy — Sunday alone never counts as "extra". */
export function hasExtraPeriodData(record: CountRecord | undefined) {
  if (!record) return false
  return countPeriods.some(
    (period) =>
      period !== 'sunday' &&
      (isSideCounted(record.periods[period].left) || isSideCounted(record.periods[period].right)),
  )
}

/**
 * How many sides (0–2) hold a count in `period`. Completeness, the uncounted filter
 * and the map colouring all read one period at a time: the tab being counted.
 */
export function countedSides(record: CountRecord | undefined, period: CountPeriod) {
  if (!record) return 0
  const leftCounted = isSideCounted(record.periods[period].left)
  const rightCounted = isSideCounted(record.periods[period].right)
  if (leftCounted && rightCounted) return 2
  return leftCounted || rightCounted ? 1 : 0
}

export const countsFileSchema = z.object({
  dataset: z.string().min(1),
  records: z.record(z.string(), countRecordSchema),
})

export type CountsFile = z.infer<typeof countsFileSchema>
