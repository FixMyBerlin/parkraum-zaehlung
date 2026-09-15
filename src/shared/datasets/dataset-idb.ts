import { del, get, keys, set } from 'idb-keyval'
import { z } from 'zod'
import { edgesCollectionSchema, type CountingEdgesGeoJSON } from '@/shared/edges/schema'

const prefix = 'pz:edges:'

const storedDatasetSchema = z.object({
  dataset: z.string(),
  importedAt: z.string(),
  collection: edgesCollectionSchema,
})

export type StoredDataset = {
  dataset: string
  importedAt: string
  collection: CountingEdgesGeoJSON
}

function keyFor(dataset: string) {
  return `${prefix}${dataset}`
}

/** IndexedDB read: an invalid stored record is treated as absent, same as `undefined`. */
function parseStoredDataset(value: unknown): StoredDataset | undefined {
  if (value === undefined) return undefined
  const parsed = storedDatasetSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

/** `null`, never `undefined` — TanStack Query rejects `undefined` query data. */
function toQueryResult(value: StoredDataset | undefined): StoredDataset | null {
  return value ?? null
}

export async function saveDataset(collection: CountingEdgesGeoJSON, dataset: string) {
  const stored: StoredDataset = {
    dataset,
    importedAt: new Date().toISOString(),
    collection: {
      ...collection,
      metadata: { ...collection.metadata, dataset },
    },
  }
  await set(keyFor(dataset), stored)
  return stored
}

export async function loadDataset(dataset: string): Promise<StoredDataset | null> {
  return toQueryResult(parseStoredDataset(await get(keyFor(dataset))))
}

export async function listDatasets() {
  const allKeys = await keys()
  const datasetKeys = allKeys.filter(
    (key): key is string => typeof key === 'string' && key.startsWith(prefix),
  )
  const stored = await Promise.all(datasetKeys.map((key) => get(key)))
  return stored.map(parseStoredDataset).filter((item): item is StoredDataset => item != null)
}

/** Deletes this browser's local edges for a project. No-op if none are stored. */
export async function deleteDataset(dataset: string) {
  await del(keyFor(dataset))
}

/**
 * Moves the local edges from `oldDataset` to `newDataset` (metadata.dataset updated
 * to match). No-op if `oldDataset` has no local edges. Not atomic: on failure the old
 * entry may remain — safe to re-run.
 */
export async function renameDataset(oldDataset: string, newDataset: string) {
  const stored = await loadDataset(oldDataset)
  if (!stored) return
  await saveDataset(stored.collection, newDataset)
  await del(keyFor(oldDataset))
}
