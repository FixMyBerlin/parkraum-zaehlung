import { describe, expect, it } from 'vitest'
import { emptyCountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import type { StoredDataset } from './dataset-idb'
import { buildDatasetInventory, datasetInventoryCopy } from './inventory'

const collection = (ids: string[]): CountingEdgesGeoJSON => ({
  type: 'FeatureCollection',
  features: ids.map((id) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [7, 47],
        [7.1, 47.1],
      ],
    },
    properties: { id, way_ids: [1] },
  })),
})

function stored(dataset: string, ids: string[]): StoredDataset {
  return {
    dataset,
    importedAt: '2026-09-01T00:00:00.000Z',
    collection: collection(ids),
  }
}

describe('buildDatasetInventory', () => {
  it('unions remote-only, local-only, and both', () => {
    const rows = buildDatasetInventory(
      [stored('local-only', ['a', 'b']), stored('both', ['x', 'y', 'z'])],
      [
        { dataset: 'remote-only', entryCount: 12 },
        { dataset: 'both', entryCount: 2 },
      ],
      {
        both: {
          x: emptyCountRecord(),
          y: emptyCountRecord(),
          stale: emptyCountRecord(),
        },
        'local-only': {},
      },
    )
    expect(rows.map((row) => row.dataset)).toEqual(['both', 'local-only', 'remote-only'])
    expect(rows[0]).toMatchObject({
      dataset: 'both',
      local: true,
      remoteEntryCount: 2,
      overlap: { matched: 2, edgesWithoutCount: 1, countsWithoutEdge: 1, matchedPercent: 67 },
    })
    expect(rows[1]?.overlap).toEqual({
      matched: 0,
      edgesWithoutCount: 2,
      countsWithoutEdge: 0,
      matchedPercent: 0,
    })
    expect(rows[2]).toMatchObject({ local: false, remoteEntryCount: 12, overlap: null })
  })
})

describe('datasetInventoryCopy', () => {
  it('describes a remote-only dataset', () => {
    expect(
      datasetInventoryCopy({
        dataset: 'foo',
        local: false,
        remoteEntryCount: 12,
        localEdgeCount: null,
        overlap: null,
      }),
    ).toContain('12 Zählungen')
  })
})
