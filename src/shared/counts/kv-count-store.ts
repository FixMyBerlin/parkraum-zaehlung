import { newerWins, type CountStore } from './count-store'
import { countRecordSchema, type CountRecord } from './schema'

type KvEntry = {
  id: string
  data: unknown
  tags: string[]
  version: number
}

type KvListResponse = {
  items: KvEntry[]
  next_cursor: string | null
}

type KvCountStoreOptions = {
  baseUrl: string
  project: string
  apiKey: string
  getOsmToken: () => string | null
}

function entryId(dataset: string, edgeId: string) {
  return `${dataset}/${edgeId}`
}

export function createKvCountStore(options: KvCountStoreOptions): CountStore {
  async function request(path: string, init: RequestInit = {}) {
    const token = options.getOsmToken()
    const headers = new Headers(init.headers)
    headers.set('X-Api-Key', options.apiKey)
    headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${options.baseUrl}${path}`, { ...init, headers })
    if (!response.ok) {
      throw new Error(`KV request failed (${response.status})`)
    }
    if (response.status === 204) return undefined
    return response.json()
  }

  return {
    async list(dataset) {
      const records: Record<string, CountRecord> = {}
      let cursor: string | undefined
      do {
        const query = new URLSearchParams({ tag: dataset, match: 'all', limit: '500' })
        if (cursor) query.set('cursor', cursor)
        const page = (await request(
          `/v1/projects/${options.project}/entries?${query}`,
        )) as KvListResponse
        for (const item of page.items) {
          const record = countRecordSchema.safeParse(item.data)
          const edgeId = item.id.slice(dataset.length + 1)
          if (record.success && edgeId) records[edgeId] = record.data
        }
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      return records
    },
    async get(dataset, edgeId) {
      try {
        const item = (await request(
          `/v1/projects/${options.project}/entries/${encodeURIComponent(entryId(dataset, edgeId))}`,
        )) as KvEntry
        const record = countRecordSchema.safeParse(item.data)
        return record.success ? record.data : undefined
      } catch {
        return undefined
      }
    },
    async put(dataset, edgeId, record) {
      await request(
        `/v1/projects/${options.project}/entries/${encodeURIComponent(entryId(dataset, edgeId))}`,
        {
          method: 'PUT',
          body: JSON.stringify({ data: record, tags: [dataset] }),
        },
      )
      return record
    },
    async remove(dataset, edgeId) {
      await request(
        `/v1/projects/${options.project}/entries/${encodeURIComponent(entryId(dataset, edgeId))}`,
        { method: 'DELETE' },
      )
    },
    async merge(dataset, incoming) {
      const current = await this.list(dataset)
      const next = newerWins(current, incoming)
      for (const [edgeId, record] of Object.entries(next)) {
        if (current[edgeId] === record) continue
        await this.put(dataset, edgeId, record)
      }
      return next
    },
  }
}
