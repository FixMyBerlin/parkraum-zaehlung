import { describe, expect, it } from 'vitest'
import { parseEdgesJson, parseEdgesText } from './parse-edges'

const validCollection = {
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
        way_ids: [1, 2],
      },
    },
  ],
}

describe('parseEdgesText', () => {
  it('rejects invalid JSON with a readable message', () => {
    expect(() => parseEdgesText('not json')).toThrow('Datei ist kein gültiges JSON.')
  })
})

describe('parseEdgesJson error mapping', () => {
  it('accepts a valid collection unchanged', () => {
    expect(() => parseEdgesJson(validCollection)).not.toThrow()
  })

  it('detects a counts export and names it as such, not raw zod issues', () => {
    const countsExport = { dataset: 'loerrach', records: { 'edge-1': { note: 'x' } } }
    expect(() => parseEdgesJson(countsExport)).toThrow('Zählungs-Export')
  })

  it('rejects a plain object that is not a FeatureCollection', () => {
    expect(() => parseEdgesJson({ foo: 'bar' })).toThrow(
      'Datei ist keine GeoJSON-FeatureCollection mit Kanten (parkings_edges).',
    )
  })

  it('rejects a non-object payload', () => {
    expect(() => parseEdgesJson('just a string')).toThrow(
      'Datei ist keine GeoJSON-FeatureCollection mit Kanten (parkings_edges).',
    )
  })

  it('rejects a FeatureCollection with no features', () => {
    expect(() => parseEdgesJson({ type: 'FeatureCollection', features: [] })).toThrow(
      'Datei enthält keine Kanten (features fehlt oder ist leer).',
    )
  })

  it('rejects a FeatureCollection missing the features key entirely', () => {
    expect(() => parseEdgesJson({ type: 'FeatureCollection' })).toThrow(
      'Datei enthält keine Kanten (features fehlt oder ist leer).',
    )
  })

  it('falls back to a compact issue summary for shape errors deeper in the file, without raw zod JSON', () => {
    const missingId = structuredClone(validCollection)
    // @ts-expect-error intentionally malformed to trigger an issue deep in the tree
    delete missingId.features[0].properties.id
    let message = ''
    try {
      parseEdgesJson(missingId)
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }
    expect(message).toContain('Kanten-Datei entspricht nicht dem erwarteten Format')
    expect(message).toContain('features.0.properties.id')
    expect(message).not.toContain('"code"')
    expect(message).not.toContain('{')
  })

  it('rejects duplicate edge ids with a compact message', () => {
    const dup = structuredClone(validCollection)
    dup.features.push(dup.features[0]!)
    let message = ''
    try {
      parseEdgesJson(dup)
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }
    expect(message).toContain('Kanten-Datei entspricht nicht dem erwarteten Format')
    expect(message).not.toContain('{')
  })
})
