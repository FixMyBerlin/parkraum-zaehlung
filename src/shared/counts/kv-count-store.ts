import { z } from 'zod'
import { KvError, type KvClient } from '@/shared/kv-client'
import {
  newerWins,
  type CountStore,
  type CountStoreEntry,
  type ProjectMeta,
  type RawCountEntry,
} from './count-store'
import { countRecordSchema, type CountRecord } from './schema'

export const osmLoginRequiredMessage = 'Zum Speichern mit OSM anmelden'

/**
 * Reserved tag for project-meta entries (see `ProjectMeta`). Never a real dataset
 * name's own tag, so entries carrying it are excluded from every count listing.
 */
export const projectMetaTag = 'pz-project-meta'
const metaPrefix = '_meta/'

function entryId(dataset: string, edgeId: string) {
  return `${dataset}/${edgeId}`
}

function metaId(dataset: string) {
  return `${metaPrefix}${dataset}`
}

const projectMetaPayloadSchema = z.object({
  name: z.string(),
  created_at: z.string(),
  created_by: z.string().optional(),
})

function isReservedMetaEntry(id: string, tags: string[]) {
  return id.startsWith(metaPrefix) || tags.includes(projectMetaTag)
}

function rethrowMapped(error: unknown): never {
  if (error instanceof KvError && error.code === 'unauthenticated') {
    throw new Error(osmLoginRequiredMessage)
  }
  throw error
}

export function createKvCountStore(client: KvClient<CountRecord>) {
  const store: CountStore = {
    async list(dataset) {
      const records: Record<string, CountRecord> = {}
      let cursor: string | undefined
      do {
        const page = await client.list({
          tags: [dataset],
          match: 'all',
          limit: 500,
          cursor,
        })
        const prefix = `${dataset}/`
        for (const item of page.items) {
          const record = countRecordSchema.safeParse(item.data)
          const edgeId = item.id.startsWith(prefix) ? item.id.slice(prefix.length) : ''
          if (record.success && edgeId) records[edgeId] = record.data
        }
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      return records
    },
    async get(dataset, edgeId) {
      try {
        const item = await client.get(entryId(dataset, edgeId))
        const record = countRecordSchema.safeParse(item.data)
        return record.success ? record.data : undefined
      } catch (error) {
        if (error instanceof KvError && error.code === 'not_found') return undefined
        throw error
      }
    },
    async put(dataset, edgeId, record) {
      try {
        await client.put(entryId(dataset, edgeId), record, [dataset])
        return record
      } catch (error) {
        rethrowMapped(error)
      }
    },
    async remove(dataset, edgeId) {
      try {
        await client.remove(entryId(dataset, edgeId))
      } catch (error) {
        if (error instanceof KvError && error.code === 'not_found') return
        rethrowMapped(error)
      }
    },
    async merge(dataset, incoming) {
      const current = await this.list(dataset)
      const next = newerWins(current, incoming)
      for (const [id, record] of Object.entries(next)) {
        if (current[id] === record) continue
        await this.put(dataset, id, record)
      }
      return next
    },
    async listDatasetSummaries() {
      const { tags } = await client.tags()
      return tags
        .filter(({ tag }) => tag !== projectMetaTag)
        .map(({ tag, count }) => ({ dataset: tag, entryCount: count }))
        .sort((a, b) => a.dataset.localeCompare(b.dataset))
    },
    async listAll() {
      const entries: CountStoreEntry[] = []
      let cursor: string | undefined
      do {
        const page = await client.list({
          limit: 500,
          cursor,
        })
        for (const item of page.items) {
          if (isReservedMetaEntry(item.id, item.tags)) continue
          const slashIndex = item.id.indexOf('/')
          if (slashIndex <= 0) continue
          const dataset = item.id.slice(0, slashIndex)
          const edgeId = item.id.slice(slashIndex + 1)
          if (!dataset || !edgeId) continue
          const record = countRecordSchema.safeParse(item.data)
          if (!record.success) continue
          entries.push({ dataset, edgeId, record: record.data })
        }
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      return entries
    },
    async listRawEntries(dataset) {
      const raw: RawCountEntry[] = []
      const prefix = `${dataset}/`
      let cursor: string | undefined
      do {
        const page = await client.list({
          tags: [dataset],
          match: 'all',
          limit: 500,
          cursor,
        })
        for (const item of page.items) {
          if (isReservedMetaEntry(item.id, item.tags)) continue
          const edgeId = item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id
          const record = countRecordSchema.safeParse(item.data)
          raw.push({
            id: item.id,
            edgeId,
            valid: record.success,
            record: record.success ? record.data : undefined,
            raw: item.data,
            updatedAt: item.updated_at,
            version: item.version,
          })
        }
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      return raw
    },
    async getProjectMeta(dataset) {
      try {
        const item = await client.get(metaId(dataset))
        const parsed = projectMetaPayloadSchema.safeParse(item.data)
        if (!parsed.success) return undefined
        return { dataset, createdAt: parsed.data.created_at, createdBy: parsed.data.created_by }
      } catch (error) {
        if (error instanceof KvError && error.code === 'not_found') return undefined
        throw error
      }
    },
    async putProjectMeta(dataset, meta) {
      const payload = { name: dataset, created_at: meta.createdAt, created_by: meta.createdBy }
      try {
        // The client is typed for CountRecord; project-meta entries are a deliberately
        // different shape, kept out of counts by the reserved id/tag, not by type.
        await client.put(metaId(dataset), payload as unknown as CountRecord, [projectMetaTag])
      } catch (error) {
        rethrowMapped(error)
      }
      return { dataset, createdAt: meta.createdAt, createdBy: meta.createdBy }
    },
    async removeProjectMeta(dataset) {
      try {
        await client.remove(metaId(dataset))
      } catch (error) {
        if (error instanceof KvError && error.code === 'not_found') return
        rethrowMapped(error)
      }
    },
    async listProjectMeta() {
      const result: ProjectMeta[] = []
      let cursor: string | undefined
      do {
        const page = await client.list({
          tags: [projectMetaTag],
          match: 'all',
          limit: 500,
          cursor,
        })
        for (const item of page.items) {
          if (!item.id.startsWith(metaPrefix)) continue
          const dataset = item.id.slice(metaPrefix.length)
          const parsed = projectMetaPayloadSchema.safeParse(item.data)
          if (!dataset || !parsed.success) continue
          result.push({
            dataset,
            createdAt: parsed.data.created_at,
            createdBy: parsed.data.created_by,
          })
        }
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      return result
    },
  }
  return store
}
