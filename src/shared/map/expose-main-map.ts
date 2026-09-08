import type { Map as MaplibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    __mainMap?: MaplibreMap
  }
}

export function exposeMainMapForDebugging(map: MaplibreMap) {
  if (!import.meta.env.DEV) return
  window.__mainMap = map
}
