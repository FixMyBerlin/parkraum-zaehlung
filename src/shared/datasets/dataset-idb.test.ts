import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { deleteDataset, listDatasets, loadDataset, renameDataset, saveDataset } from './dataset-idb'

const sampleCollection: CountingEdgesGeoJSON = {
  type: 'FeatureCollection',
  metadata: { dataset: 'placeholder' },
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [7.66, 47.61],
          [7.661, 47.612],
        ],
      },
      properties: { id: 'edge-1', way_ids: [1] },
    },
  ],
}

beforeEach(async () => {
  // Reset the fake IndexedDB between tests since idb-keyval caches a module-level connection.
  indexedDB = new IDBFactory()
})

describe('loadDataset', () => {
  it('returns null (not undefined) when nothing is stored locally', async () => {
    const result = await loadDataset('does-not-exist')
    expect(result).toBeNull()
  })

  it('returns the stored dataset once saved', async () => {
    await saveDataset(sampleCollection, 'alpha')
    const result = await loadDataset('alpha')
    expect(result?.dataset).toBe('alpha')
    expect(result?.collection.metadata?.dataset).toBe('alpha')
  })
})

describe('deleteDataset', () => {
  it('removes a stored dataset', async () => {
    await saveDataset(sampleCollection, 'alpha')
    await deleteDataset('alpha')
    expect(await loadDataset('alpha')).toBeNull()
  })

  it('is a no-op when nothing is stored', async () => {
    await expect(deleteDataset('never-stored')).resolves.toBeUndefined()
  })
})

describe('renameDataset', () => {
  it('moves the local edges to the new name and drops the old key', async () => {
    await saveDataset(sampleCollection, 'old-name')
    await renameDataset('old-name', 'new-name')

    expect(await loadDataset('old-name')).toBeNull()
    const renamed = await loadDataset('new-name')
    expect(renamed?.dataset).toBe('new-name')
    expect(renamed?.collection.metadata?.dataset).toBe('new-name')
    expect(renamed?.collection.features).toHaveLength(1)
  })

  it('is a no-op when the old dataset has no local edges', async () => {
    await renameDataset('missing', 'also-missing')
    expect(await loadDataset('missing')).toBeNull()
    expect(await loadDataset('also-missing')).toBeNull()
  })

  it('leaves other datasets listed after a rename', async () => {
    await saveDataset(sampleCollection, 'old-name')
    await saveDataset(sampleCollection, 'untouched')
    await renameDataset('old-name', 'new-name')

    const names = (await listDatasets()).map((item) => item.dataset).sort()
    expect(names).toEqual(['new-name', 'untouched'])
  })
})
