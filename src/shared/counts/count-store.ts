import type { CountRecord } from './schema'

export type DatasetSummary = { dataset: string; entryCount: number }

export type CountStoreEntry = {
  dataset: string
  edgeId: string
  record: CountRecord
}

/**
 * One raw KV entry tagged with a dataset, valid or not. Used by the admin project
 * tools (see `dataset-admin.ts`) to surface and clean up legacy/unparseable entries
 * that `list`/`listAll` silently drop.
 */
export type RawCountEntry = {
  id: string
  edgeId: string
  valid: boolean
  record: CountRecord | undefined
  raw: unknown
  updatedAt: string
  version: number
}

/**
 * A project's own metadata, stored as a reserved KV entry (see `projectMetaTag` in
 * `kv-count-store.ts`) so a project can exist — and show up in the project list —
 * before it has any counts. Never tagged with the dataset's own tag, so it never
 * shows up in `list`/`listAll`/`listDatasetSummaries`/`listRawEntries`.
 */
export type ProjectMeta = {
  dataset: string
  createdAt: string
  createdBy?: string
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
  listRawEntries: (dataset: string) => Promise<RawCountEntry[]>
  getProjectMeta: (dataset: string) => Promise<ProjectMeta | undefined>
  putProjectMeta: (
    dataset: string,
    meta: { createdAt: string; createdBy?: string },
  ) => Promise<ProjectMeta>
  removeProjectMeta: (dataset: string) => Promise<void>
  listProjectMeta: () => Promise<ProjectMeta[]>
}

export function newerWins(
  current: Record<string, CountRecord>,
  incoming: Record<string, CountRecord>,
) {
  const next = { ...current }
  for (const [edgeId, record] of Object.entries(incoming)) {
    const existing = next[edgeId]
    if (!existing || record.updated_at >= existing.updated_at) {
      next[edgeId] = record
    }
  }
  return next
}
