import { z } from 'zod'

const sideCountSchema = z.object({
  pkw: z.number().int().nonnegative().nullable(),
  motorrad: z.number().int().nonnegative().nullable(),
  lkw_bus: z.number().int().nonnegative().nullable(),
})

export type SideCount = z.infer<typeof sideCountSchema>

export const emptySideCount = () => ({
  pkw: null,
  motorrad: null,
  lkw_bus: null,
})

export const matchStatusSchema = z.enum(['id', 'midpoint', 'manual', 'none'])

export type MatchStatus = z.infer<typeof matchStatusSchema>

export const countRecordSchema = z.object({
  left: sideCountSchema,
  right: sideCountSchema,
  note: z.string().optional(),
  updated_at: z.string(),
  updated_by: z.string().optional(),
  counted_at: z.string(),
  mid_lat: z.number(),
  mid_lng: z.number(),
  match_id: z.string(),
  match_status: matchStatusSchema,
})

export type CountRecord = z.infer<typeof countRecordSchema>

type EmptyCountExtras = Partial<
  Pick<CountRecord, 'match_id' | 'match_status' | 'mid_lat' | 'mid_lng' | 'counted_at'>
>

export function emptyCountRecord(
  updatedAt = new Date().toISOString(),
  extras: EmptyCountExtras = {},
) {
  return {
    left: emptySideCount(),
    right: emptySideCount(),
    updated_at: updatedAt,
    counted_at: extras.counted_at ?? updatedAt,
    match_id: extras.match_id ?? '',
    match_status: extras.match_status ?? 'id',
    mid_lat: extras.mid_lat ?? 0,
    mid_lng: extras.mid_lng ?? 0,
  }
}

export function isSideCounted(side: SideCount) {
  return side.pkw != null || side.motorrad != null || side.lkw_bus != null
}

export function countedSides(record: CountRecord | undefined) {
  if (!record) return 0
  const leftCounted = isSideCounted(record.left)
  const rightCounted = isSideCounted(record.right)
  if (leftCounted && rightCounted) return 2
  return leftCounted || rightCounted ? 1 : 0
}

export const countsFileSchema = z.object({
  dataset: z.string().min(1),
  records: z.record(z.string(), countRecordSchema),
})

export type CountsFile = z.infer<typeof countsFileSchema>
