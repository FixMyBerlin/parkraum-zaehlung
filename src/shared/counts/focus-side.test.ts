import { describe, expect, test } from 'vitest'
import { firstUncountedSide } from './focus-side'
import { emptyCountRecord, type CountPeriod, type CountRecord } from './schema'

const nothingDisabled = { left: false, right: false }
const sunday: CountPeriod = 'sunday'

function recordWith(
  counted: Partial<Record<'left' | 'right', number>>,
  period: CountPeriod = 'sunday',
): CountRecord {
  const record: CountRecord = emptyCountRecord()
  if (counted.left != null) record.periods[period].left.pkw = counted.left
  if (counted.right != null) record.periods[period].right.pkw = counted.right
  return record
}

describe('firstUncountedSide', () => {
  test('picks the first screen column when nothing is counted yet', () => {
    expect(firstUncountedSide(['right', 'left'], nothingDisabled, undefined, sunday)).toBe('right')
    expect(firstUncountedSide(['left', 'right'], nothingDisabled, undefined, sunday)).toBe('left')
  })

  test('skips a column that already has values', () => {
    expect(
      firstUncountedSide(['left', 'right'], nothingDisabled, recordWith({ left: 7 }), sunday),
    ).toBe('right')
    expect(
      firstUncountedSide(['right', 'left'], nothingDisabled, recordWith({ right: 7 }), sunday),
    ).toBe('left')
  })

  test('a zero count still counts as counted', () => {
    expect(
      firstUncountedSide(['left', 'right'], nothingDisabled, recordWith({ left: 0 }), sunday),
    ).toBe('right')
  })

  test('falls back to the first column once both sides are counted', () => {
    const both = recordWith({ left: 3, right: 4 })
    expect(firstUncountedSide(['right', 'left'], nothingDisabled, both, sunday)).toBe('right')
  })

  test('skips a side where parking is not allowed', () => {
    expect(
      firstUncountedSide(['right', 'left'], { left: false, right: true }, undefined, sunday),
    ).toBe('left')
  })

  test('prefers an uncounted countable side over a counted first column', () => {
    expect(
      firstUncountedSide(
        ['left', 'right'],
        { left: false, right: false },
        recordWith({ left: 2 }),
        sunday,
      ),
    ).toBe('right')
  })

  test('returns null when neither side allows parking', () => {
    expect(
      firstUncountedSide(['left', 'right'], { left: true, right: true }, undefined, sunday),
    ).toBeNull()
  })

  test('reads only the given period, ignoring counts in the others', () => {
    const record = recordWith({ left: 5 }, 'sunday')
    // Sunday has a left count, but midday is still fully empty.
    expect(firstUncountedSide(['left', 'right'], nothingDisabled, record, 'midday')).toBe('left')
    expect(firstUncountedSide(['left', 'right'], nothingDisabled, record, 'sunday')).toBe('right')
  })
})
