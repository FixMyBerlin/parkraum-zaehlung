import { describe, expect, it } from 'vitest'
import { haversineMeters, lineMidpoint, MATCH_RADIUS_M, roundCoord } from './line-midpoint'

describe('roundCoord', () => {
  it('rounds to 6 decimal places by default', () => {
    expect(roundCoord(1.23456789)).toBe(1.234568)
  })
})

describe('lineMidpoint', () => {
  it('returns the geographic halfway of a 2-point line, not a bbox centroid', () => {
    expect(
      lineMidpoint([
        [0, 0],
        [0, 0.001],
      ]),
    ).toEqual({ lng: 0, lat: 0.0005 })
  })

  it('returns the rounded point for a zero-length line', () => {
    expect(
      lineMidpoint([
        [7, 47],
        [7, 47],
      ]),
    ).toEqual({ lng: 7, lat: 47 })
  })
})

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters([7.66, 47.61], [7.66, 47.61])).toBe(0)
  })

  it('treats 1 degree of latitude as about 111 km', () => {
    const meters = haversineMeters([0, 0], [0, 1])
    expect(meters / 1000).toBeCloseTo(111, 0)
  })
})

describe('MATCH_RADIUS_M', () => {
  it('is 8 meters', () => {
    expect(MATCH_RADIUS_M).toBe(8)
  })
})
