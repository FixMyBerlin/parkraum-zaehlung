import { describe, expect, it } from 'vitest'
import { parseEdgesJson } from './parse-edges'
import { edgesCollectionSchema, slugifyDatasetName } from './schema'

const sample = {
  type: 'FeatureCollection' as const,
  metadata: { dataset: 'Loerrach 2026-09' },
  features: [
    {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [7.66, 47.61],
          [7.661, 47.612],
        ],
      },
      properties: {
        id: 'ce-aaa111bbb222',
        name: 'Basler Straße',
        highway: 'residential',
        way_ids: [1, 2],
        way_reversed: [false, true],
        capacity_left: 8,
        capacity_right: 0,
        parking_left: 'lane',
        parking_right: 'no',
      },
    },
  ],
}

describe('edges schema', () => {
  it('accepts a contract-1 collection and slugs the dataset', () => {
    const parsed = parseEdgesJson(sample)
    expect(parsed.needsDatasetName).toBe(false)
    expect(parsed.dataset).toBe('loerrach-2026-09')
    expect(edgesCollectionSchema.safeParse(sample).success).toBe(true)
  })

  it('asks for a name when metadata.dataset is missing', () => {
    const { metadata: _, ...withoutMeta } = sample
    const parsed = parseEdgesJson(withoutMeta)
    expect(parsed.needsDatasetName).toBe(true)
    expect(parseEdgesJson(withoutMeta, 'manual').dataset).toBe('manual')
  })

  it('rejects duplicate ids and mismatched way_reversed', () => {
    const dup = structuredClone(sample)
    dup.features.push(dup.features[0]!)
    expect(edgesCollectionSchema.safeParse(dup).success).toBe(false)

    const bad = structuredClone(sample)
    bad.features[0]!.properties.way_reversed = [false]
    expect(edgesCollectionSchema.safeParse(bad).success).toBe(false)
  })

  it('slugifies dataset names', () => {
    expect(slugifyDatasetName('  Lörrach Sample!! ')).toBe('loerrach-sample')
    expect(slugifyDatasetName('loerrach-sample')).toBe('loerrach-sample')
  })
})
