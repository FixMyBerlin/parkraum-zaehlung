import { describe, expect, it } from 'vitest'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { mergeCountsIntoEdges } from './export-counts'
import { emptyCountRecord } from './schema'

const collection: CountingEdgesGeoJSON = {
  type: 'FeatureCollection',
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
      properties: {
        id: 'ce-1',
        way_ids: [1],
        name: 'Test',
      },
    },
  ],
}

describe('mergeCountsIntoEdges', () => {
  it('copies left/right category fields onto matching features', () => {
    const record = {
      ...emptyCountRecord('2026-09-08T00:00:00.000Z'),
      left: { pkw: 3, motorrad: 1, lkw_bus: null },
    }
    const merged = mergeCountsIntoEdges(collection, { 'ce-1': record })
    expect(merged.features[0]?.properties).toMatchObject({
      left_pkw: 3,
      left_motorrad: 1,
      counted_sides: 1,
    })
  })
})
