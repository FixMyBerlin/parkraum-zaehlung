import { describe, expect, it } from 'vitest'
import { parseEdgesJson } from './parse-edges'
import { edgesCollectionSchema, isValidDatasetName, slugifyDatasetName } from './schema'

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

  it('lets a confirmed name override metadata.dataset', () => {
    const parsed = parseEdgesJson(sample, 'kampagne-2026-09')
    expect(parsed.dataset).toBe('kampagne-2026-09')
    expect(parsed.collection.metadata?.dataset).toBe('kampagne-2026-09')
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

  it('accepts slug dataset names of 3–60 characters', () => {
    expect(isValidDatasetName('loerrach-2026-09')).toBe(true)
    expect(isValidDatasetName('ab')).toBe(false)
    expect(isValidDatasetName('Loerrach')).toBe(false)
    expect(isValidDatasetName('download')).toBe(true)
  })

  it('drops unlocated GeoJSON features before validating edges', () => {
    const withOrphan = {
      ...sample,
      features: [
        ...sample.features,
        {
          type: 'Feature' as const,
          id: 'orphan',
          geometry: null,
          properties: { id: 'orphan', count_status: 'orphan' },
        },
      ],
    }
    const parsed = parseEdgesJson(withOrphan)
    expect(parsed.collection.features).toHaveLength(1)
    expect(parsed.collection.features[0]?.properties.id).toBe('ce-aaa111bbb222')
  })
})
