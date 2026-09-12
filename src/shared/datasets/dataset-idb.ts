import { get, keys, set } from 'idb-keyval'
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

export async function loadDataset(dataset: string) {
  return parseStoredDataset(await get(keyFor(dataset)))
}

export async function listDatasets() {
  const allKeys = await keys()
  const datasetKeys = allKeys.filter(
    (key): key is string => typeof key === 'string' && key.startsWith(prefix),
  )
  const stored = await Promise.all(datasetKeys.map((key) => get(key)))
  return stored.map(parseStoredDataset).filter((item): item is StoredDataset => item != null)
}
