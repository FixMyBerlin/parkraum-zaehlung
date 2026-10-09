import { describe, expect, it } from 'vitest'
import { countedSides, countRecordSchema, emptyCountRecord, emptySideCount } from './schema'

describe('countedSides', () => {
  it('counts sides that have any category filled, for the given period only', () => {
    expect(countedSides(undefined, 'sunday')).toBe(0)
    const empty = emptyCountRecord()
    expect(countedSides(empty, 'sunday')).toBe(0)
    expect(
      countedSides(
        {
          ...empty,
          periods: {
            ...empty.periods,
            sunday: {
              left: { ...emptySideCount(), pkw: 0, motorrad: null, lkw_bus: null },
              right: empty.periods.sunday.right,
            },
          },
        },
        'sunday',
      ),
    ).toBe(1)
    expect(
      countedSides(
        {
          ...empty,
          periods: {
            ...empty.periods,
            sunday: {
              left: { ...emptySideCount(), pkw: 1, motorrad: null, lkw_bus: null },
              right: { ...emptySideCount(), pkw: null, motorrad: 2, lkw_bus: null },
            },
          },
        },
        'sunday',
      ),
    ).toBe(2)
    expect(
      countedSides(
        {
          ...empty,
          periods: {
            ...empty.periods,
            midday: {
              left: { ...emptySideCount(), pkw: 1, motorrad: null, lkw_bus: null },
              right: empty.periods.midday.right,
            },
          },
        },
        'sunday',
      ),
    ).toBe(0)
  })
})

describe('countRecordSchema', () => {
  it('rejects the old flat left/right payload', () => {
    expect(
      countRecordSchema.safeParse({
        left: { pkw: 1, motorrad: null, lkw_bus: null },
        right: { pkw: null, motorrad: null, lkw_bus: null },
        updated_at: '2026-09-08T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects an occupancy-only payload without match and midpoint', () => {
    expect(
      countRecordSchema.safeParse({
        periods: emptyCountRecord().periods,
        updated_at: '2026-09-08T00:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(countRecordSchema.safeParse(emptyCountRecord()).success).toBe(true)
  })

  it('defaults source to imported when the field is missing, so old KV/JSON data still parses', () => {
    const { source: _source, ...withoutSource } = emptyCountRecord()
    const result = countRecordSchema.safeParse(withoutSource)
    expect(result.success).toBe(true)
    expect(result.success && result.data.source).toBe('imported')
  })

  it('accepts an explicit manual source and an optional created_by', () => {
    const result = countRecordSchema.safeParse(
      emptyCountRecord(undefined, { source: 'manual', created_by: 'alice' }),
    )
    expect(result.success).toBe(true)
    expect(result.success && result.data.source).toBe('manual')
    expect(result.success && result.data.created_by).toBe('alice')
  })

  it('parses a record stored before the extra categories and periods existed', () => {
    // Verbatim shape of the production Zähl-Datenbank entries (three periods, three categories).
    const side = (pkw: number | null) => ({ pkw, motorrad: null, lkw_bus: null })
    const result = countRecordSchema.safeParse({
      periods: {
        sunday: { left: side(0), right: side(3) },
        midday: { left: side(2), right: side(null) },
        evening: { left: side(null), right: side(null) },
      },
      updated_at: '2026-10-05T10:14:49.094Z',
      updated_by: 'fmc_Mlvln',
      counted_at: '2026-10-05T09:47:41.674Z',
      created_by: 'fmc_Mlvln',
      source: 'imported',
      mid_lat: 47.595996,
      mid_lng: 7.653429,
      match_id: '30830552-352850304',
      match_status: 'id',
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.periods.sunday.right).toEqual({ ...emptySideCount(), pkw: 3 })
    expect(result.data.periods.midday.left).toEqual({ ...emptySideCount(), pkw: 2 })
    expect(result.data.periods.period_4).toEqual({
      left: emptySideCount(),
      right: emptySideCount(),
    })
    expect(countedSides(result.data, 'sunday')).toBe(2)
    expect(countedSides(result.data, 'midday')).toBe(1)
    expect(countedSides(result.data, 'period_5')).toBe(0)
  })

  it('keeps the new categories and periods on a round trip', () => {
    const empty = emptyCountRecord()
    const record = {
      ...empty,
      periods: {
        ...empty.periods,
        period_4: {
          left: { ...emptySideCount(), kleintransporter: 2, sonstiges: 1 },
          right: emptySideCount(),
        },
      },
    }
    const result = countRecordSchema.safeParse(JSON.parse(JSON.stringify(record)))
    expect(result.success && result.data.periods.period_4.left.kleintransporter).toBe(2)
    expect(result.success && result.data.periods.period_4.left.sonstiges).toBe(1)
  })
})
