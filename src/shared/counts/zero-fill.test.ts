import { describe, expect, it } from 'vitest'
import { countedSides, emptyCountRecord, emptySideCount } from './schema'
import { zeroFilledRecord } from './zero-fill'

const coordinates = [
  [7.66, 47.61],
  [7.662, 47.612],
]
const zeros = { pkw: 0, kleintransporter: 0, lkw_bus: 0, motorrad: 0, sonstiges: 0 }

describe('zeroFilledRecord', () => {
  it('creates a fully counted record for an edge without a count', () => {
    const record = zeroFilledRecord({
      existing: undefined,
      period: 'midday',
      edgeId: 'ce-1',
      coordinates,
      updatedBy: 'alice',
    })
    expect(record?.periods.midday).toEqual({ left: zeros, right: zeros })
    expect(record?.periods.sunday.left).toEqual(emptySideCount())
    expect(record).toMatchObject({
      match_id: 'ce-1',
      match_status: 'id',
      source: 'imported',
      created_by: 'alice',
      updated_by: 'alice',
    })
    expect(record?.mid_lat).toBeCloseTo(47.611, 3)
    expect(record && countedSides(record, 'midday')).toBe(2)
    expect(record && countedSides(record, 'sunday')).toBe(0)
  })

  it('fills only the side that is still open and keeps everything else', () => {
    const base = emptyCountRecord('2026-10-01T00:00:00.000Z', {
      created_by: 'bob',
      match_id: 'ce-1',
      mid_lat: 1,
      mid_lng: 2,
    })
    const existing = {
      ...base,
      note: 'Baustelle',
      periods: {
        ...base.periods,
        sunday: { left: { ...emptySideCount(), pkw: 4 }, right: emptySideCount() },
      },
    }
    const record = zeroFilledRecord({
      existing,
      period: 'sunday',
      edgeId: 'ce-1',
      coordinates,
      updatedBy: 'alice',
    })
    expect(record?.periods.sunday.left).toEqual({ ...emptySideCount(), pkw: 4 })
    expect(record?.periods.sunday.right).toEqual(zeros)
    expect(record).toMatchObject({
      note: 'Baustelle',
      created_by: 'bob',
      counted_at: '2026-10-01T00:00:00.000Z',
      mid_lat: 1,
      mid_lng: 2,
      updated_by: 'alice',
    })
  })

  it('returns null when both sides are already counted', () => {
    const base = emptyCountRecord()
    const existing = {
      ...base,
      periods: {
        ...base.periods,
        sunday: {
          left: { ...emptySideCount(), pkw: 1 },
          right: { ...emptySideCount(), motorrad: 0 },
        },
      },
    }
    expect(zeroFilledRecord({ existing, period: 'sunday', edgeId: 'ce-1', coordinates })).toBeNull()
  })
})
