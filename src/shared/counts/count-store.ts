import type { CountRecord } from './schema'

export type DatasetSummary = { dataset: string; entryCount: number }

export type CountStoreEntry = {
  dataset: string
  edgeId: string
  record: CountRecord
}

export type CountStore = {
  list: (dataset: string) => Promise<Record<string, CountRecord>>
  get: (dataset: string, edgeId: string) => Promise<CountRecord | undefined>
  put: (dataset: string, edgeId: string, record: CountRecord) => Promise<CountRecord>
  remove: (dataset: string, edgeId: string) => Promise<void>
  merge: (
    dataset: string,
    incoming: Record<string, CountRecord>,
  ) => Promise<Record<string, CountRecord>>
  listDatasetSummaries: () => Promise<DatasetSummary[]>
  listAll: () => Promise<CountStoreEntry[]>
}

export function newerWins(
  current: Record<string, CountRecord>,
  incoming: Record<string, CountRecord>,
): Record<string, CountRecord> {
  const next = { ...current }
  for (const [edgeId, record] of Object.entries(incoming)) {
    const existing = next[edgeId]
    if (!existing || record.updated_at >= existing.updated_at) {
      next[edgeId] = record
    }
  }
  return next
}
