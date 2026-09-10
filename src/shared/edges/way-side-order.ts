import type { Position } from 'geojson'

/**
 * Ported from the parking-lanes editor (`app/src/modes/parking/domain/way-side-order.ts`)
 * so both tools order their left/right controls the same way.
 */

/** Segments shorter than this share of the longest one are curve/jitter noise. */
const MIN_SEGMENT_LENGTH_SHARE = 0.15
/** Below this horizontal separation the two sides sit above each other, not next to each other. */
const SCREEN_AXIS_EPSILON = 0.05
const EARTH_RADIUS_M = 6371008.8

type Side = 'left' | 'right'
export type ScreenOrderedSides = readonly [Side, Side]

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI

function normalizeBearing(degrees: number) {
  const normalized = degrees % 360
  return normalized < 0 ? normalized + 360 : normalized
}

/** Initial great-circle bearing in degrees clockwise from north. */
function segmentBearing(from: Position, to: Position) {
  const fromLat = toRadians(from[1]!)
  const toLat = toRadians(to[1]!)
  const deltaLng = toRadians(to[0]! - from[0]!)
  const y = Math.sin(deltaLng) * Math.cos(toLat)
  const x =
    Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng)
  return toDegrees(Math.atan2(y, x))
}

/** Haversine distance in meters. */
function segmentLength(from: Position, to: Position) {
  const fromLat = toRadians(from[1]!)
  const toLat = toRadians(to[1]!)
  const deltaLat = toLat - fromLat
  const deltaLng = toRadians(to[0]! - from[0]!)
  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/**
 * Length-weighted bearing of the longest straight runs, ignoring short segments
 * from tight curves or node jitter.
 */
export function dominantEdgeBearing(coordinates: Position[]): number {
  if (coordinates.length < 2) return 0

  const segments: { lengthM: number; bearingDeg: number }[] = []
  for (let index = 0; index < coordinates.length - 1; index++) {
    const from = coordinates[index]!
    const to = coordinates[index + 1]!
    const lengthM = segmentLength(from, to)
    if (lengthM < 0.01) continue
    segments.push({ lengthM, bearingDeg: segmentBearing(from, to) })
  }

  if (segments.length === 0) return 0

  const maxLength = Math.max(...segments.map((segment) => segment.lengthM))
  const minLength = maxLength * MIN_SEGMENT_LENGTH_SHARE

  let sumSin = 0
  let sumCos = 0
  let totalWeight = 0

  for (const segment of segments) {
    if (segment.lengthM < minLength) continue
    const rad = toRadians(segment.bearingDeg)
    sumSin += Math.sin(rad) * segment.lengthM
    sumCos += Math.cos(rad) * segment.lengthM
    totalWeight += segment.lengthM
  }

  if (totalWeight < 0.01) return normalizeBearing(segments[0]!.bearingDeg)

  return normalizeBearing(toDegrees(Math.atan2(sumSin, sumCos)))
}

/** Where a side sits on screen, as a unit vector with y growing downwards. */
function outwardScreenPosition(alongBearing: number, side: Side, mapBearing: number) {
  const outwardBearing = side === 'right' ? alongBearing + 90 : alongBearing - 90
  const rad = toRadians(outwardBearing - mapBearing)
  return { x: Math.sin(rad), y: -Math.cos(rad) }
}

/**
 * Order the OSM left/right sides so the first entry is the one the user sees on
 * the left of the map (or on top, for a way running across the screen).
 */
export function screenOrderedSides(coordinates: Position[], mapBearing = 0): ScreenOrderedSides {
  const alongBearing = dominantEdgeBearing(coordinates)
  const leftScreen = outwardScreenPosition(alongBearing, 'left', mapBearing)
  const rightScreen = outwardScreenPosition(alongBearing, 'right', mapBearing)
  const deltaX = leftScreen.x - rightScreen.x

  if (Math.abs(deltaX) > SCREEN_AXIS_EPSILON) {
    return leftScreen.x < rightScreen.x ? ['left', 'right'] : ['right', 'left']
  }

  return leftScreen.y < rightScreen.y ? ['left', 'right'] : ['right', 'left']
}
