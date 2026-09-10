import { describe, expect, test } from 'vitest'
import { firstUncountedSide } from './focus-side'
import { emptyCountRecord, type CountRecord } from './schema'

const nothingDisabled = { left: false, right: false }

function recordWith(counted: Partial<Record<'left' | 'right', number>>): CountRecord {
  const record = emptyCountRecord()
  if (counted.left != null) record.left.pkw = counted.left
  if (counted.right != null) record.right.pkw = counted.right
  return record
}

describe('firstUncountedSide', () => {
  test('picks the first screen column when nothing is counted yet', () => {
    expect(firstUncountedSide(['right', 'left'], nothingDisabled, undefined)).toBe('right')
    expect(firstUncountedSide(['left', 'right'], nothingDisabled, undefined)).toBe('left')
  })

  test('skips a column that already has values', () => {
    expect(firstUncountedSide(['left', 'right'], nothingDisabled, recordWith({ left: 7 }))).toBe(
      'right',
    )
    expect(firstUncountedSide(['right', 'left'], nothingDisabled, recordWith({ right: 7 }))).toBe(
      'left',
    )
  })

  test('a zero count still counts as counted', () => {
    expect(firstUncountedSide(['left', 'right'], nothingDisabled, recordWith({ left: 0 }))).toBe(
      'right',
    )
  })

  test('falls back to the first column once both sides are counted', () => {
    const both = recordWith({ left: 3, right: 4 })
    expect(firstUncountedSide(['right', 'left'], nothingDisabled, both)).toBe('right')
  })

  test('skips a side where parking is not allowed', () => {
    expect(firstUncountedSide(['right', 'left'], { left: false, right: true }, undefined)).toBe(
      'left',
    )
  })

  test('prefers an uncounted countable side over a counted first column', () => {
    expect(
      firstUncountedSide(['left', 'right'], { left: false, right: false }, recordWith({ left: 2 })),
    ).toBe('right')
  })

  test('returns null when neither side allows parking', () => {
    expect(firstUncountedSide(['left', 'right'], { left: true, right: true }, undefined)).toBeNull()
  })
})
