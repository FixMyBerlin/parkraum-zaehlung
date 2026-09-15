import { describe, expect, it } from 'vitest'
import { emptyCountRecord, type CountRecord } from '@/shared/counts/schema'
import { decorateEdges } from './decorate-edges'
import type { CountingEdgesGeoJSON } from './schema'

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
      properties: { id: 'ce-1', way_ids: [1] },
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
      properties: { id: 'ce-2', way_ids: [2] },
    },
  ],
}

function recordFor(edgeId: string): CountRecord {
  return { ...emptyCountRecord(), match_id: edgeId, match_status: 'id' }
}

function withSunday(record: CountRecord, left: number | null, right: number | null): CountRecord {
  return {
    ...record,
    periods: {
      ...record.periods,
      sunday: {
        left: { ...record.periods.sunday.left, pkw: left },
        right: { ...record.periods.sunday.right, pkw: right },
      },
    },
  }
}

function withMidday(record: CountRecord, left: number | null): CountRecord {
  return {
    ...record,
    periods: {
      ...record.periods,
      midday: { ...record.periods.midday, left: { ...record.periods.midday.left, pkw: left } },
    },
  }
}

describe('decorateEdges', () => {
  it('sets count_state and counted_sides from Sunday only', () => {
    const record = withSunday(recordFor('ce-1'), 3, null)
    const decorated = decorateEdges(collection, { 'ce-1': record }, false)
    const feature = decorated.features.find((f) => f.properties.id === 'ce-1')
    expect(feature?.properties.count_state).toBe('partial')
    expect(feature?.properties.counted_sides).toBe(1)
  })

  it('reports has_extra_periods only once midday or evening has data', () => {
    const sundayOnly = withSunday(recordFor('ce-1'), 3, 4)
    const withExtra = withMidday(withSunday(recordFor('ce-2'), 1, 1), 2)

    const decorated = decorateEdges(collection, { 'ce-1': sundayOnly, 'ce-2': withExtra }, false)
    const sundayOnlyFeature = decorated.features.find((f) => f.properties.id === 'ce-1')
    const extraFeature = decorated.features.find((f) => f.properties.id === 'ce-2')

    expect(sundayOnlyFeature?.properties.has_extra_periods).toBe(false)
    expect(extraFeature?.properties.has_extra_periods).toBe(true)
  })

  it('sets per-side per-period booleans for the cluster layer filters', () => {
    const record = withMidday(withSunday(recordFor('ce-1'), 3, null), 2)
    const decorated = decorateEdges(collection, { 'ce-1': record }, false)
    const feature = decorated.features.find((f) => f.properties.id === 'ce-1')

    expect(feature?.properties.left_sunday).toBe(true)
    expect(feature?.properties.right_sunday).toBe(false)
    expect(feature?.properties.left_midday).toBe(true)
    expect(feature?.properties.right_midday).toBe(false)
    expect(feature?.properties.left_evening).toBe(false)
    expect(feature?.properties.right_evening).toBe(false)
  })

  it('defaults every flag to false for an uncounted edge', () => {
    const decorated = decorateEdges(collection, {}, false)
    const feature = decorated.features.find((f) => f.properties.id === 'ce-2')
    expect(feature?.properties.has_extra_periods).toBe(false)
    expect(feature?.properties.left_sunday).toBe(false)
    expect(feature?.properties.count_state).toBe('uncounted')
  })

  it('keeps the uncounted-only filter based on Sunday completeness', () => {
    const full = withSunday(recordFor('ce-1'), 3, 4)
    const decorated = decorateEdges(collection, { 'ce-1': full }, true)
    expect(decorated.features.map((f) => f.properties.id)).toEqual(['ce-2'])
  })
})
