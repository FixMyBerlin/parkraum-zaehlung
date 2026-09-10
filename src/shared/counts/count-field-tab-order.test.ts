import { describe, expect, test } from 'vitest'
import { countFieldTabOrder } from './count-field-tab-order'

describe('countFieldTabOrder', () => {
  test('walks down the first screen column, then the second', () => {
    expect(countFieldTabOrder(['right', 'left'])).toEqual([
      { side: 'right', key: 'pkw' },
      { side: 'right', key: 'motorrad' },
      { side: 'right', key: 'lkw_bus' },
      { side: 'left', key: 'pkw' },
      { side: 'left', key: 'motorrad' },
      { side: 'left', key: 'lkw_bus' },
    ])
  })
})
