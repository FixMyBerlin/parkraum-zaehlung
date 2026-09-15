import { describe, expect, it } from 'vitest'
import { emptyCountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { edgeCountProgress, resolveStep, stepDescription } from '@/shared/routing/app-step'

const edges = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: { id: 'a', way_ids: [1] },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: { id: 'b', way_ids: [2] },
    },
  ],
} as CountingEdgesGeoJSON

describe('resolveStep', () => {
  it('uses an explicit step when set', () => {
    expect(resolveStep({ step: 'export', dataset: 'x' })).toBe('export')
    expect(resolveStep({ step: 'dataset' })).toBe('dataset')
  })

  it('defaults to count when a dataset is set', () => {
    expect(resolveStep({ dataset: 'loerrach' })).toBe('count')
  })

  it('defaults to dataset without a dataset', () => {
    expect(resolveStep({})).toBe('dataset')
  })
})

describe('stepDescription', () => {
  it('describes dataset', () => {
    expect(stepDescription({ step: 'dataset' })).toBe('Kein Datensatz')
    expect(stepDescription({ step: 'dataset', dataset: 'loerrach' })).toBe('loerrach')
  })

  it('describes count from edges, remote records, or empty', () => {
    const empty = emptyCountRecord()
    const records = {
      a: {
        ...empty,
        match_id: 'a',
        periods: {
          ...empty.periods,
          sunday: {
            left: { pkw: 1, motorrad: null, lkw_bus: null },
            right: { pkw: 1, motorrad: null, lkw_bus: null },
          },
        },
      },
    }
    expect(edgeCountProgress(edges, records)).toEqual({ counted: 1, total: 2 })
    expect(stepDescription({ step: 'count', edges, records })).toBe('1/2 Kanten')
    expect(stepDescription({ step: 'count', dataset: 'x', remoteCount: 4 })).toBe(
      '4 in der Zähl-Datenbank',
    )
    expect(stepDescription({ step: 'count' })).toBe('Keine Kanten')
  })

  it('describes export', () => {
    expect(stepDescription({ step: 'export' })).toBe('Kein Datensatz')
    expect(stepDescription({ step: 'export', dataset: 'x', records: {} })).toBe('0 Zählungen')
    expect(
      stepDescription({
        step: 'export',
        dataset: 'x',
        records: { a: emptyCountRecord() },
      }),
    ).toBe('1 Zählung')
  })
})
