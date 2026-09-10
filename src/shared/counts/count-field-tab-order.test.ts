import { describe, expect, test } from 'vitest'
import { countFieldTabOrder } from './count-field-tab-order'

describe('countFieldTabOrder', () => {
  test('walks down the first screen column, then the second', () => {
    expect(countFieldTabOrder(['right', 'left'], { left: false, right: false })).toEqual([
      { side: 'right', key: 'pkw' },
      { side: 'right', key: 'motorrad' },
      { side: 'right', key: 'lkw_bus' },
      { side: 'left', key: 'pkw' },
      { side: 'left', key: 'motorrad' },
      { side: 'left', key: 'lkw_bus' },
    ])
  })

  test('skips a side where parking is not allowed', () => {
    expect(countFieldTabOrder(['right', 'left'], { left: false, right: true })).toEqual([
      { side: 'left', key: 'pkw' },
      { side: 'left', key: 'motorrad' },
      { side: 'left', key: 'lkw_bus' },
    ])
  })
})
