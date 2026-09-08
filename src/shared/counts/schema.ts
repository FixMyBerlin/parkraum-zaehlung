import { z } from 'zod'

const sideCountSchema = z.object({
  pkw: z.number().int().nonnegative().nullable(),
  motorrad: z.number().int().nonnegative().nullable(),
  lkw_bus: z.number().int().nonnegative().nullable(),
})

export type SideCount = z.infer<typeof sideCountSchema>

export const emptySideCount = (): SideCount => ({
  pkw: null,
  motorrad: null,
  lkw_bus: null,
})

export const countRecordSchema = z.object({
  left: sideCountSchema,
  right: sideCountSchema,
  note: z.string().optional(),
  updated_at: z.string(),
  updated_by: z.string().optional(),
})

export type CountRecord = z.infer<typeof countRecordSchema>

export function emptyCountRecord(updatedAt = new Date().toISOString()): CountRecord {
  return {
    left: emptySideCount(),
    right: emptySideCount(),
    updated_at: updatedAt,
  }
}

function isSideCounted(side: SideCount) {
  return side.pkw != null || side.motorrad != null || side.lkw_bus != null
}

export function countedSides(record: CountRecord | undefined): 0 | 1 | 2 {
  if (!record) return 0
  return ((isSideCounted(record.left) ? 1 : 0) + (isSideCounted(record.right) ? 1 : 0)) as 0 | 1 | 2
}

export const countsFileSchema = z.object({
  dataset: z.string().min(1),
  records: z.record(z.string(), countRecordSchema),
})

export type CountsFile = z.infer<typeof countsFileSchema>
