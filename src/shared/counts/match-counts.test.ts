import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lineMidpoint } from '@/shared/edges/line-midpoint'
import { parseEdgesJson } from '@/shared/edges/parse-edges'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'
import {
  assignedMatchIds,
  edgeMatchInputs,
  matchCountsToEdges,
  originalIdForEdge,
  recordForEdge,
  type EdgeMatchInput,
} from './match-counts'
import { emptyCountRecord, type MatchStatus } from './schema'

const UPDATED_AT = '2026-09-08T00:00:00.000Z'
const ORIGIN: [number, number] = [7.66, 47.61]
const SEGMENT = 0.00008
/** ~22 m of latitude, outside the 8 m match radius. */
const OUTSIDE_SHIFT = 0.0002
/** ~3 m of latitude, inside the 8 m match radius. */
const INSIDE_SHIFT = 0.00003

function edgeInput(id: string, shiftLat = 0): EdgeMatchInput {
  const lng = ORIGIN[0]
  const lat = ORIGIN[1] + shiftLat
  return {
    id,
    coordinates: [
      [lng, lat],
      [lng + SEGMENT, lat + SEGMENT],
    ],
    name: 'Teststraße',
    highway: 'residential',
  }
}

function recordAt(
  edge: EdgeMatchInput,
  extras: { match_id?: string; match_status?: MatchStatus } = {},
) {
  const mid = lineMidpoint(edge.coordinates)
  return emptyCountRecord(UPDATED_AT, {
    mid_lat: mid.lat,
    mid_lng: mid.lng,
    match_id: extras.match_id ?? '',
    match_status: extras.match_status ?? 'id',
  })
}

describe('matchCountsToEdges', () => {
  it('keeps a record whose key already equals the edge id', () => {
    const edge = edgeInput('ce-old')
    const result = matchCountsToEdges(
      {
        'ce-old': recordAt(edge, { match_id: 'ce-old', match_status: 'id' }),
      },
      [edge],
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      originalId: 'ce-old',
      status: 'id',
      matchId: 'ce-old',
      needsWrite: false,
    })
    expect(result.writes).toHaveLength(0)
  })

  it('rewrites match_id when the record key matches an edge but match_id is wrong', () => {
    const edge = edgeInput('ce-1')
    const result = matchCountsToEdges(
      {
        'ce-1': recordAt(edge, { match_id: 'other', match_status: 'id' }),
      },
      [edge],
    )
    expect(result.rows[0]).toMatchObject({
      originalId: 'ce-1',
      status: 'id',
      matchId: 'ce-1',
      needsWrite: true,
    })
    expect(result.writes).toHaveLength(1)
    expect(result.writes[0]?.record.match_id).toBe('ce-1')
  })

  it('matches a unique nearby midpoint and writes the new id', () => {
    const near = edgeInput('ce-new')
    const far = edgeInput('ce-far', OUTSIDE_SHIFT)
    const result = matchCountsToEdges(
      {
        stale: recordAt(near, { match_id: '', match_status: 'id' }),
      },
      [near, far],
    )
    expect(result.rows[0]).toMatchObject({
      originalId: 'stale',
      status: 'midpoint',
      matchId: 'ce-new',
      needsWrite: true,
    })
    expect(result.writes).toHaveLength(1)
    expect(result.writes[0]).toMatchObject({
      originalId: 'stale',
      record: { match_id: 'ce-new', match_status: 'midpoint' },
    })
  })

  it('leaves a far-away record unresolved with no candidates in radius', () => {
    const edge = edgeInput('ce-1')
    const result = matchCountsToEdges(
      {
        far: emptyCountRecord(UPDATED_AT, {
          mid_lat: 47.8,
          mid_lng: 7.8,
          match_id: '',
          match_status: 'id',
        }),
      },
      [edge],
    )
    expect(result.rows[0]).toMatchObject({
      status: 'unresolved',
      matchId: '',
      needsWrite: false,
    })
    expect(result.rows[0]?.candidates).toEqual([])
  })

  it('does not auto-write when two edges sit within 8 m', () => {
    const first = edgeInput('ce-a')
    const second = edgeInput('ce-b', INSIDE_SHIFT)
    const result = matchCountsToEdges(
      {
        stale: recordAt(first, { match_id: '', match_status: 'id' }),
      },
      [first, second],
    )
    expect(result.rows[0]).toMatchObject({
      status: 'unresolved',
      matchId: '',
      needsWrite: false,
    })
    expect(result.rows[0]?.candidates).toHaveLength(2)
    expect(result.writes).toHaveLength(0)
  })

  it('leaves match_status none alone even when a unique edge is nearby', () => {
    const edge = edgeInput('ce-1')
    const result = matchCountsToEdges(
      {
        stale: recordAt(edge, { match_id: '', match_status: 'none' }),
      },
      [edge],
    )
    expect(result.rows[0]).toMatchObject({
      originalId: 'stale',
      status: 'none',
      matchId: '',
      needsWrite: false,
    })
    expect(result.writes).toHaveLength(0)
  })

  it('leaves a manual match whose match_id is still in the file', () => {
    const edge = edgeInput('ce-1')
    const result = matchCountsToEdges(
      {
        stale: recordAt(edge, { match_id: 'ce-1', match_status: 'manual' }),
      },
      [edge],
    )
    expect(result.rows[0]).toMatchObject({
      originalId: 'stale',
      status: 'manual',
      matchId: 'ce-1',
      needsWrite: false,
    })
    expect(result.writes).toHaveLength(0)
  })

  it('marks two records that share a match_id as conflict and skips auto-writes', () => {
    const shared = edgeInput('ce-shared')
    const result = matchCountsToEdges(
      {
        left: recordAt(shared, { match_id: 'ce-shared', match_status: 'midpoint' }),
        right: recordAt(shared, { match_id: 'ce-shared', match_status: 'id' }),
      },
      [shared],
    )
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((row) => row.status === 'conflict')).toBe(true)
    expect(result.rows.every((row) => row.needsWrite === false)).toBe(true)
    expect(result.writes).toEqual([])
    expect(result.unresolved).toHaveLength(2)
  })
})

describe('recordForEdge', () => {
  it('finds the record whose match_id is the edge', () => {
    const records = {
      a: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-1',
        match_status: 'id',
      }),
      b: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-2',
        match_status: 'midpoint',
      }),
    }
    expect(recordForEdge(records, 'ce-1')).toBe(records.a)
    expect(recordForEdge(records, 'ce-2')).toBe(records.b)
  })

  it('returns undefined when none or two records share the match_id', () => {
    const one = {
      a: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-1',
        match_status: 'id',
      }),
    }
    expect(recordForEdge(one, 'missing')).toBeUndefined()
    const dup = {
      a: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-1',
        match_status: 'id',
      }),
      b: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-1',
        match_status: 'manual',
      }),
    }
    expect(recordForEdge(dup, 'ce-1')).toBeUndefined()
  })
})

describe('originalIdForEdge / assignedMatchIds', () => {
  it('skips none and empty match_id when listing assigned ids', () => {
    const records = {
      a: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-1',
        match_status: 'id',
      }),
      b: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: '',
        match_status: 'id',
      }),
      c: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-none',
        match_status: 'none',
      }),
      d: emptyCountRecord(UPDATED_AT, {
        mid_lat: 47.61,
        mid_lng: 7.66,
        match_id: 'ce-2',
        match_status: 'manual',
      }),
    }
    expect(originalIdForEdge(records, 'ce-1')).toBe('a')
    expect(originalIdForEdge(records, 'ce-2')).toBe('d')
    expect(originalIdForEdge(records, 'ce-none')).toBeUndefined()
    expect(assignedMatchIds(records)).toEqual(['ce-1', 'ce-2'])
  })
})

describe('loerrach sample remap fixture', () => {
  it('covers id match, midpoint match, no match, and a new edge', () => {
    const sample = parseEdgesJson(
      JSON.parse(readFileSync('public/fixtures/loerrach-sample.geojson', 'utf8')),
    ).collection
    const remap = parseEdgesJson(
      JSON.parse(readFileSync('public/fixtures/loerrach-sample-remap.geojson', 'utf8')),
    ).collection

    const records = Object.fromEntries(
      sample.features.map((feature) => {
        const mid = lineMidpoint(feature.geometry.coordinates)
        return [
          feature.properties.id,
          emptyCountRecord(UPDATED_AT, {
            mid_lat: mid.lat,
            mid_lng: mid.lng,
            match_id: feature.properties.id,
            match_status: 'id',
          }),
        ]
      }),
    )
    const result = matchCountsToEdges(records, edgeMatchInputs(remap))
    const byId = Object.fromEntries(result.rows.map((row) => [row.originalId, row]))

    expect(byId['ce-basler-nord']?.status).toBe('id')
    expect(byId['ce-tumringer']?.status).toBe('id')
    expect(byId['ce-wiesental']?.status).toBe('id')
    expect(byId['ce-wallbrunn']).toMatchObject({
      status: 'midpoint',
      matchId: 'ce-wallbrunn-v2',
      needsWrite: true,
    })
    expect(byId['ce-teich']?.status).toBe('unresolved')
    expect(byId['ce-marktplatz']?.status).toBe('unresolved')
    expect(remap.features.map((feature) => feature.properties.id)).toContain('ce-hebel')
    expect(sample.features.map((feature) => feature.properties.id)).not.toContain('ce-hebel')
  })
})

describe('edgeMatchInputs', () => {
  it('maps a CountingEdgesGeoJSON feature to id, coordinates, name, and highway', () => {
    const collection: CountingEdgesGeoJSON = {
      type: 'FeatureCollection',
      metadata: { dataset: 'test-ds' },
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
            name: 'Basler Straße',
            highway: 'residential',
            way_ids: [1],
          },
        },
      ],
    }
    expect(edgeMatchInputs(collection)).toEqual([
      {
        id: 'ce-1',
        coordinates: [
          [7.66, 47.61],
          [7.661, 47.612],
        ],
        name: 'Basler Straße',
        highway: 'residential',
      },
    ])
  })
})
