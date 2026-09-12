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

function recordFor(id: string, extras: Parameters<typeof emptyCountRecord>[1] = {}) {
  return {
    ...emptyCountRecord('2026-09-08T00:00:00.000Z', {
      match_id: id,
      match_status: 'id',
      mid_lat: 47.611,
      mid_lng: 7.6605,
      ...extras,
    }),
    left: { pkw: 3, motorrad: 1, lkw_bus: null },
  }
}

describe('mergeCountsIntoEdges', () => {
  it('copies left/right category fields onto matching features', () => {
    const merged = mergeCountsIntoEdges(collection, { 'ce-1': recordFor('ce-1') })
    expect(merged.features[0]?.properties).toMatchObject({
      left_pkw: 3,
      left_motorrad: 1,
      counted_sides: 1,
      original_edge_id: 'ce-1',
      match_id: 'ce-1',
      match_status: 'id',
    })
  })

  it('joins a rematched count via match_id, not the KV key', () => {
    const rematched = recordFor('ce-1', { match_status: 'manual' })
    const merged = mergeCountsIntoEdges(collection, { 'ce-old': rematched })
    expect(merged.features[0]?.properties).toMatchObject({
      id: 'ce-1',
      count_status: 'counted',
      original_edge_id: 'ce-old',
      match_id: 'ce-1',
      match_status: 'manual',
    })
    expect(merged.features.some((feature) => feature.geometry.type === 'Point')).toBe(false)
  })

  it('marks matching features as counted', () => {
    const merged = mergeCountsIntoEdges(collection, { 'ce-1': recordFor('ce-1') })
    expect(merged.features[0]?.properties.count_status).toBe('counted')
  })

  it('keeps unmatched edges with count_status uncounted and no invented counts', () => {
    const merged = mergeCountsIntoEdges(collection, { 'ce-1': recordFor('ce-1') })
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

  it('appends unresolved counts as Point features at the stored midpoint', () => {
    const orphan = {
      ...emptyCountRecord('2026-09-08T00:00:00.000Z', {
        match_id: '',
        match_status: 'id',
        mid_lat: 47.7,
        mid_lng: 7.7,
      }),
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
      geometry: { type: 'Point', coordinates: [7.7, 47.7] },
      properties: {
        id: 'ce-orphan',
        count_status: 'unresolved',
        original_edge_id: 'ce-orphan',
        match_id: '',
        match_status: 'id',
        left_pkw: 2,
        counted_at: '2026-09-08T00:00:00.000Z',
        note: 'stale id',
      },
    })
  })

  it('exports confirmed unmatched counts as unmatched Points', () => {
    const none = emptyCountRecord('2026-09-08T00:00:00.000Z', {
      match_id: '',
      match_status: 'none',
      mid_lat: 47.7,
      mid_lng: 7.7,
    })
    const merged = mergeCountsIntoEdges(collection, { 'ce-gone': none })
    const feature = merged.features.find((item) => item.properties.id === 'ce-gone')
    expect(feature?.properties.count_status).toBe('unmatched')
    expect(feature?.geometry).toEqual({ type: 'Point', coordinates: [7.7, 47.7] })
  })

  it('preserves collection metadata', () => {
    const merged = mergeCountsIntoEdges(collection, {})
    expect(merged.metadata).toEqual({ dataset: 'test-ds', schema: 'counting-edges' })
  })
})

describe('buildAllCountsFile', () => {
  it('wraps each dataset map with buildCountsFile', () => {
    const a = emptyCountRecord('2026-09-08T00:00:00.000Z', { match_id: 'ce-1' })
    const b = emptyCountRecord('2026-09-09T00:00:00.000Z', { match_id: 'ce-2' })
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
