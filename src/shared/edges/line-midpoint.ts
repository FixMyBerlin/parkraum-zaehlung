export const MATCH_RADIUS_M = 8
const COORD_DECIMALS = 6

const EARTH_RADIUS_M = 6_371_000

export function roundCoord(value: number, decimals = COORD_DECIMALS): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function haversineMeters(from: readonly [number, number], to: readonly [number, number]) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(to[1] - from[1])
  const dLng = toRad(to[0] - from[0])
  const lat1 = toRad(from[1])
  const lat2 = toRad(to[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function lineMidpoint(coordinates: ReadonlyArray<ReadonlyArray<number>>): {
  lng: number
  lat: number
} {
  if (coordinates.length < 2) {
    throw new Error('LineString needs at least two positions')
  }
  const points = coordinates.map((pair) => [pair[0] ?? 0, pair[1] ?? 0] as [number, number])
  const lengths: number[] = []
  let total = 0
  for (let index = 1; index < points.length; index++) {
    const length = haversineMeters(points[index - 1]!, points[index]!)
    lengths.push(length)
    total += length
  }
  const first = points[0]!
  if (total === 0) {
    return { lng: roundCoord(first[0]), lat: roundCoord(first[1]) }
  }
  let remaining = total / 2
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length
      const start = points[index]!
      const end = points[index + 1]!
      return {
        lng: roundCoord(start[0] + (end[0] - start[0]) * t),
        lat: roundCoord(start[1] + (end[1] - start[1]) * t),
      }
    }
    remaining -= length
  }
  const last = points[points.length - 1]!
  return { lng: roundCoord(last[0]), lat: roundCoord(last[1]) }
}
