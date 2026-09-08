import { describe, expect, it } from 'vitest'
import { countedSides, emptyCountRecord } from './schema'

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
