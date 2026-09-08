import { newerWins, type CountStore } from './count-store'
import { countRecordSchema, type CountRecord } from './schema'

function countsStorageKey(dataset: string) {
  return `pz:counts:${dataset}`
}

function readMap(dataset: string): Record<string, CountRecord> {
  const raw = localStorage.getItem(countsStorageKey(dataset))
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return {}
    const out: Record<string, CountRecord> = {}
    for (const [edgeId, value] of Object.entries(parsed)) {
      const record = countRecordSchema.safeParse(value)
      if (record.success) out[edgeId] = record.data
    }
    return out
  } catch {
    return {}
  }
}

function writeMap(dataset: string, records: Record<string, CountRecord>) {
  localStorage.setItem(countsStorageKey(dataset), JSON.stringify(records))
}

export function createLocalStorageCountStore(): CountStore {
  return {
    async list(dataset) {
      return readMap(dataset)
    },
    async get(dataset, edgeId) {
      return readMap(dataset)[edgeId]
    },
    async put(dataset, edgeId, record) {
      const next = { ...readMap(dataset), [edgeId]: record }
      writeMap(dataset, next)
      return record
    },
    async remove(dataset, edgeId) {
      const next = { ...readMap(dataset) }
      delete next[edgeId]
      writeMap(dataset, next)
    },
    async merge(dataset, incoming) {
      const next = newerWins(readMap(dataset), incoming)
      writeMap(dataset, next)
      return next
    },
  }
}
