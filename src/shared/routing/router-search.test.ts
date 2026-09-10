import { describe, expect, it } from 'vitest'
import { routerSearch } from '@/shared/routing/router-search'
import { indexSearchSchema } from '@/shared/routing/search-schema'

function roundTrip(search: Record<string, unknown>) {
  return indexSearchSchema.parse(routerSearch.parse(routerSearch.stringify(search)))
}

describe('routerSearch', () => {
  it('keeps the map param readable instead of percent-encoding the slashes', () => {
    expect(routerSearch.stringify({ map: '13.5/52.4918/13.4261' })).toBe(
      '?map=13.5/52.4918/13.4261',
    )
  })

  it('round-trips an all-digit edge id as a string', () => {
    // `parseSearch` JSON-parses values, so `edge=12345` comes back as a number.
    expect(roundTrip({ edge: '12345' }).edge).toBe('12345')
  })

  it('round-trips an all-digit dataset slug as a string', () => {
    expect(roundTrip({ dataset: '2026' }).dataset).toBe('2026')
  })

  it('round-trips the flags', () => {
    const search = roundTrip({ parkings: true, uncounted: false })
    expect(search.parkings).toBe(true)
    expect(search.uncounted).toBe(false)
  })
})
