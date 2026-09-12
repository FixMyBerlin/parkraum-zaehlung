import { z } from 'zod'
import type { KvEntry, KvListResult, KvUser } from './types'

/**
 * Envelope schemas for the KV Worker's responses. `data` is typed via the
 * caller's generic `T` but not runtime-checked here: each store already
 * validates its own payload shape (see `countRecordSchema.safeParse` in
 * `kv-count-store.ts`) and tolerates legacy/invalid records per entry. Making
 * this schema also enforce a payload shape would turn that per-entry
 * tolerance into a whole-request failure.
 */
export const kvUserSchema: z.ZodType<KvUser> = z.object({
  osm_uid: z.number(),
  display_name: z.string(),
})

export function kvEntrySchema<T>(): z.ZodType<KvEntry<T>> {
  return z.object({
    id: z.string(),
    data: z.custom<T>(),
    tags: z.array(z.string()),
    version: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    created_by: kvUserSchema,
    updated_by: kvUserSchema,
  })
}

export function kvListResultSchema<T>(): z.ZodType<KvListResult<T>> {
  return z.object({
    items: z.array(kvEntrySchema<T>()),
    next_cursor: z.string().nullable(),
  })
}

export const kvTagsResultSchema = z.object({
  tags: z.array(z.object({ tag: z.string(), count: z.number() })),
})

export const kvMeResultSchema = z.object({
  user: kvUserSchema,
  can_write: z.boolean(),
})
