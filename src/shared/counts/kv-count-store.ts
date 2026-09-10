import { KvError, type KvClient } from '@/shared/kv-client'
import { newerWins, type CountStore } from './count-store'
import { countRecordSchema, type CountRecord } from './schema'

export const osmLoginRequiredMessage = 'Zum Speichern mit OSM anmelden'

function entryId(dataset: string, edgeId: string) {
  return `${dataset}/${edgeId}`
}

function rethrowMapped(error: unknown): never {
  if (error instanceof KvError && error.code === 'unauthenticated') {
    throw new Error(osmLoginRequiredMessage)
  }
  throw error
}

export function createKvCountStore(client: KvClient<CountRecord>): CountStore {
  return {
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
        .map(({ tag, count }) => ({ dataset: tag, entryCount: count }))
        .sort((a, b) => a.dataset.localeCompare(b.dataset))
    },
  }
}
