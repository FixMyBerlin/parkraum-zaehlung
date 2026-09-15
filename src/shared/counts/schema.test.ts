import { describe, expect, it } from 'vitest'
import { countedSides, emptyCountRecord, countRecordSchema } from './schema'

describe('countedSides', () => {
  it('counts sides that have any category filled, Sunday only', () => {
    expect(countedSides(undefined)).toBe(0)
    const empty = emptyCountRecord()
    expect(countedSides(empty)).toBe(0)
    expect(
      countedSides({
        ...empty,
        periods: {
          ...empty.periods,
          sunday: {
            left: { pkw: 0, motorrad: null, lkw_bus: null },
            right: empty.periods.sunday.right,
          },
        },
      }),
    ).toBe(1)
    expect(
      countedSides({
        ...empty,
        periods: {
          ...empty.periods,
          sunday: {
            left: { pkw: 1, motorrad: null, lkw_bus: null },
            right: { pkw: null, motorrad: 2, lkw_bus: null },
          },
        },
      }),
    ).toBe(2)
    expect(
      countedSides({
        ...empty,
        periods: {
          ...empty.periods,
          midday: {
            left: { pkw: 1, motorrad: null, lkw_bus: null },
            right: empty.periods.midday.right,
          },
        },
      }),
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
})
