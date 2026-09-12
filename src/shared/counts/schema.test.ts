import { describe, expect, it } from 'vitest'
import { countedSides, emptyCountRecord, countRecordSchema } from './schema'

describe('countedSides', () => {
  it('counts sides that have any category filled', () => {
    expect(countedSides(undefined)).toBe(0)
    const empty = emptyCountRecord()
    expect(countedSides(empty)).toBe(0)
    expect(
      countedSides({
        ...empty,
        left: { pkw: 0, motorrad: null, lkw_bus: null },
      }),
    ).toBe(1)
    expect(
      countedSides({
        ...empty,
        left: { pkw: 1, motorrad: null, lkw_bus: null },
        right: { pkw: null, motorrad: 2, lkw_bus: null },
      }),
    ).toBe(2)
  })
})

describe('countRecordSchema', () => {
  it('rejects occupancy-only payloads without match and midpoint', () => {
    expect(
      countRecordSchema.safeParse({
        left: { pkw: 1, motorrad: null, lkw_bus: null },
        right: { pkw: null, motorrad: null, lkw_bus: null },
        updated_at: '2026-09-08T00:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(countRecordSchema.safeParse(emptyCountRecord()).success).toBe(true)
  })
})
