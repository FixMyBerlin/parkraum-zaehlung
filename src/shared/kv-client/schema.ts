import { z } from 'zod'
import type { KvEntry, KvListResult, KvUser } from './types'

/**
 * Envelope schemas for the KV Worker's responses. `data` is typed via the
 * caller's generic `T` but left unvalidated here: each store already
 * validates its own payload (see `countRecordSchema.safeParse` in
 * `kv-count-store.ts`) and tolerates invalid records per entry. Validating
 * `data` here too would turn that per-entry tolerance into a whole-request
 * failure.
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
