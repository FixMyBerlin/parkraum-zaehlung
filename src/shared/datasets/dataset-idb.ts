import { get, keys, set } from 'idb-keyval'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

const prefix = 'pz:edges:'

export type StoredDataset = {
  dataset: string
  importedAt: string
  collection: CountingEdgesGeoJSON
}

function keyFor(dataset: string) {
  return `${prefix}${dataset}`
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
  return get<StoredDataset>(keyFor(dataset))
}

export async function listDatasets() {
  const allKeys = await keys()
  const datasetKeys = allKeys.filter(
    (key): key is string => typeof key === 'string' && key.startsWith(prefix),
  )
  const stored = await Promise.all(datasetKeys.map((key) => get<StoredDataset>(key)))
  return stored.filter((item): item is StoredDataset => item != null)
}
