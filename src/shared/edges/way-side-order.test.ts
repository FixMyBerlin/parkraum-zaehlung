import type { Position } from 'geojson'
import { describe, expect, test } from 'vitest'
import { dominantEdgeBearing, screenOrderedSides } from './way-side-order'

const eastbound: Position[] = [
  [13.45, 52.474],
  [13.454, 52.474],
]
const northbound: Position[] = [
  [13.45, 52.47],
  [13.45, 52.48],
]

describe('dominantEdgeBearing', () => {
  test('returns north for a northbound line', () => {
    expect(dominantEdgeBearing(northbound)).toBeCloseTo(0, 0)
  })

  test('returns east for an eastbound line', () => {
    expect(dominantEdgeBearing(eastbound)).toBeCloseTo(90, 0)
  })

  test('uses longest runs and ignores short curve segments', () => {
    const coordinates: Position[] = [
      [13.45, 52.474],
      [13.451, 52.474],
      [13.452, 52.4741],
      [13.453, 52.4742],
      [13.454, 52.4742],
    ]
    const bearingDeg = dominantEdgeBearing(coordinates)
    expect(bearingDeg).toBeGreaterThan(80)
    expect(bearingDeg).toBeLessThan(100)
  })

  test('falls back to 0 for degenerate geometry', () => {
    expect(dominantEdgeBearing([[13.45, 52.474]])).toBe(0)
    expect(
      dominantEdgeBearing([
        [13.45, 52.474],
        [13.45, 52.474],
      ]),
    ).toBe(0)
  })
})

describe('screenOrderedSides', () => {
  test('north-up map: northbound way keeps the OSM left side on screen-left', () => {
    expect(screenOrderedSides(northbound, 0)).toEqual(['left', 'right'])
  })

  test('north-up map: southbound way puts the OSM right side on screen-left', () => {
    const southbound: Position[] = [...northbound].reverse()
    expect(screenOrderedSides(southbound, 0)).toEqual(['right', 'left'])
  })

  test('north-up map: eastbound way puts the northern (upper) side first', () => {
    expect(screenOrderedSides(eastbound, 0)).toEqual(['left', 'right'])
  })

  test('north-up map: westbound way puts the northern (upper) side first', () => {
    const westbound: Position[] = [...eastbound].reverse()
    expect(screenOrderedSides(westbound, 0)).toEqual(['right', 'left'])
  })

  test('rotating the map by 180° flips the column order', () => {
    expect(screenOrderedSides(northbound, 180)).toEqual(['right', 'left'])
    expect(screenOrderedSides(eastbound, 180)).toEqual(['right', 'left'])
  })

  test('rotating the map so the way runs up the screen keeps the way-relative order', () => {
    // Map rotated to put the eastbound way at the top of the screen pointing up.
    expect(screenOrderedSides(eastbound, 90)).toEqual(['left', 'right'])
  })
})
