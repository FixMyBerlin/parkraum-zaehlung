import { describe, expect, it } from 'vitest'
import {
  countRecordFromFormData,
  isEmptyOccupancy,
  readSideCount,
  sameOccupancy,
  type Occupancy,
} from './count-from-form'
import { emptyCountRecord, emptySideCount } from './schema'

function formData(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const coordinates = [
  [7.66, 47.61],
  [7.661, 47.612],
] as const

describe('countRecordFromFormData', () => {
  it('reads sides, note, author, and location from a new edge', () => {
    const record = countRecordFromFormData(
      formData({
        left_pkw: '4',
        left_motorrad: '',
        left_lkw_bus: '0',
        right_pkw: '2',
        right_motorrad: '1',
        right_lkw_bus: '',
        note: 'Ecke',
      }),
      {
        updatedBy: 'tordans',
        edgeId: 'ce-1',
        coordinates,
      },
    )
    expect(record.left).toEqual({ pkw: 4, motorrad: null, lkw_bus: 0 })
    expect(record.right).toEqual({ pkw: 2, motorrad: 1, lkw_bus: null })
    expect(record.note).toBe('Ecke')
    expect(record.updated_by).toBe('tordans')
    expect(record.updated_at).toEqual(expect.any(String))
    expect(record.counted_at).toBe(record.updated_at)
    expect(record.match_id).toBe('ce-1')
    expect(record.match_status).toBe('id')
    expect(record.mid_lat).toEqual(expect.any(Number))
    expect(record.mid_lng).toEqual(expect.any(Number))
  })

  it('copies midpoint, match, and counted_at from an existing record', () => {
    const existing = emptyCountRecord('2026-01-01T00:00:00.000Z', {
      match_id: 'ce-1',
      match_status: 'midpoint',
      mid_lat: 47.61,
      mid_lng: 7.66,
      counted_at: '2026-01-01T00:00:00.000Z',
    })
    const record = countRecordFromFormData(formData({ note: 'neu' }), {
      existing,
      updatedBy: 'tordans',
    })
    expect(record.note).toBe('neu')
    expect(record.mid_lat).toBe(47.61)
    expect(record.mid_lng).toBe(7.66)
    expect(record.match_id).toBe('ce-1')
    expect(record.match_status).toBe('midpoint')
    expect(record.counted_at).toBe('2026-01-01T00:00:00.000Z')
    expect(record.updated_at).not.toBe('2026-01-01T00:00:00.000Z')
  })

  it('omits an empty note', () => {
    const record = countRecordFromFormData(formData({ note: '' }), {
      edgeId: 'ce-1',
      coordinates,
    })
    expect(record.note).toBeUndefined()
    expect(readSideCount(formData({}), 'left')).toEqual({
      pkw: null,
      motorrad: null,
      lkw_bus: null,
    })
  })
})

function occupancy(overrides: Partial<Occupancy> = {}): Occupancy {
  return {
    left: emptySideCount(),
    right: emptySideCount(),
    note: undefined,
    ...overrides,
  }
}

describe('isEmptyOccupancy', () => {
  it('is empty when both sides and the note are blank', () => {
    expect(isEmptyOccupancy(occupancy())).toBe(true)
    expect(isEmptyOccupancy(occupancy({ note: '' }))).toBe(true)
  })

  it('is not empty once a side has a count', () => {
    expect(isEmptyOccupancy(occupancy({ left: { ...emptySideCount(), pkw: 0 } }))).toBe(false)
  })

  it('is not empty once a note is set', () => {
    expect(isEmptyOccupancy(occupancy({ note: 'Baustelle' }))).toBe(false)
  })
})

describe('sameOccupancy', () => {
  it('treats an undefined note as equal to an empty string', () => {
    expect(sameOccupancy(occupancy({ note: undefined }), occupancy({ note: '' }))).toBe(true)
  })

  it('ignores bookkeeping fields like updated_at/updated_by', () => {
    const a = { ...occupancy(), updated_at: '2026-01-01T00:00:00.000Z', updated_by: 'a' }
    const b = { ...occupancy(), updated_at: '2026-02-02T00:00:00.000Z', updated_by: 'b' }
    expect(sameOccupancy(a, b)).toBe(true)
  })

  it('detects a changed side count', () => {
    const a = occupancy({ left: { ...emptySideCount(), pkw: 1 } })
    const b = occupancy({ left: { ...emptySideCount(), pkw: 2 } })
    expect(sameOccupancy(a, b)).toBe(false)
  })

  it('detects a changed note', () => {
    expect(sameOccupancy(occupancy({ note: 'a' }), occupancy({ note: 'b' }))).toBe(false)
  })
})
