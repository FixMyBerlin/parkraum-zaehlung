import { describe, expect, it } from 'vitest'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { buildAllCountsFile, mergeCountsIntoEdges } from './export-counts'
import { emptyCountRecord } from './schema'

const collection: CountingEdgesGeoJSON = {
  type: 'FeatureCollection',
  metadata: { dataset: 'test-ds', schema: 'counting-edges' },
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
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [7.67, 47.62],
          [7.671, 47.622],
        ],
      },
      properties: {
        id: 'ce-2',
        way_ids: [2],
        name: 'Other',
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

  it('marks matching features as counted', () => {
    const record = {
      ...emptyCountRecord('2026-09-08T00:00:00.000Z'),
      left: { pkw: 3, motorrad: 1, lkw_bus: null },
    }
    const merged = mergeCountsIntoEdges(collection, { 'ce-1': record })
    expect(merged.features[0]?.properties.count_status).toBe('counted')
  })

  it('keeps unmatched edges with count_status uncounted and no invented counts', () => {
    const record = emptyCountRecord('2026-09-08T00:00:00.000Z')
    const merged = mergeCountsIntoEdges(collection, { 'ce-1': record })
    const uncounted = merged.features.find((feature) => feature.properties.id === 'ce-2')
    expect(uncounted?.geometry).toEqual(collection.features[1]?.geometry)
    expect(uncounted?.properties).toMatchObject({
      id: 'ce-2',
      count_status: 'uncounted',
      name: 'Other',
    })
    expect(uncounted?.properties).not.toHaveProperty('left_pkw')
    expect(uncounted?.properties).not.toHaveProperty('counted_sides')
  })

  it('appends unmatched counts as null-geometry orphan features', () => {
    const orphan = {
      ...emptyCountRecord('2026-09-08T00:00:00.000Z'),
      left: { pkw: 2, motorrad: null, lkw_bus: 1 },
      note: 'stale id',
    }
    const merged = mergeCountsIntoEdges(collection, { 'ce-orphan': orphan })
    const orphanFeature = merged.features.find((feature) => feature.properties.id === 'ce-orphan')
    expect(merged.features.map((feature) => feature.properties.id)).toEqual([
      'ce-1',
      'ce-2',
      'ce-orphan',
    ])
    expect(orphanFeature).toMatchObject({
      type: 'Feature',
      id: 'ce-orphan',
      geometry: null,
      properties: {
        id: 'ce-orphan',
        count_status: 'orphan',
        left_pkw: 2,
        left_motorrad: null,
        left_lkw_bus: 1,
        counted_sides: 1,
        note: 'stale id',
        counted_at: '2026-09-08T00:00:00.000Z',
      },
    })
  })

  it('preserves collection metadata', () => {
    const merged = mergeCountsIntoEdges(collection, {})
    expect(merged.metadata).toEqual({ dataset: 'test-ds', schema: 'counting-edges' })
  })
})

describe('buildAllCountsFile', () => {
  it('wraps each dataset map with buildCountsFile', () => {
    const a = emptyCountRecord('2026-09-08T00:00:00.000Z')
    const b = emptyCountRecord('2026-09-09T00:00:00.000Z')
    const file = buildAllCountsFile({
      alpha: { 'ce-1': a },
      beta: { 'ce-2': b },
    })
    expect(file).toEqual({
      datasets: {
        alpha: { dataset: 'alpha', records: { 'ce-1': a } },
        beta: { dataset: 'beta', records: { 'ce-2': b } },
      },
    })
  })
})
