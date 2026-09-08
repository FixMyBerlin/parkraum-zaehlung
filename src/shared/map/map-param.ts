export type MapParam = {
  zoom: number
  lat: number
  lng: number
}

export function parseMapParam(value: string): MapParam | null {
  const parts = value.split('/')
  if (parts.length !== 3) return null
  const zoom = Number(parts[0])
  const lat = Number(parts[1])
  const lng = Number(parts[2])
  if (![zoom, lat, lng].every(Number.isFinite)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { zoom, lat, lng }
}

/** Zoom-aware rounding so shared URLs stay short. Do not encodeURIComponent the result. */
export function serializeMapParam({ zoom, lat, lng }: MapParam): string {
  const decimals = Math.max(1, Math.min(6, Math.ceil((zoom + 2) / 3)))
  return `${zoom.toFixed(1)}/${lat.toFixed(decimals)}/${lng.toFixed(decimals)}`
}
