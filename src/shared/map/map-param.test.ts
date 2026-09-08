import { describe, expect, it } from 'vitest'
import { parseMapParam, serializeMapParam } from './map-param'

describe('map-param', () => {
  it('round-trips zoom/lat/lng', () => {
    const parsed = parseMapParam('15.4/47.6148/7.6616')
    expect(parsed).toEqual({ zoom: 15.4, lat: 47.6148, lng: 7.6616 })
    expect(parseMapParam(serializeMapParam(parsed!))).toMatchObject({
      zoom: 15.4,
    })
  })

  it('rejects garbage', () => {
    expect(parseMapParam('nope')).toBeNull()
    expect(parseMapParam('1/99/0')).toBeNull()
  })
})
