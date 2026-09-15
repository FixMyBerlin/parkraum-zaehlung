import {
  getLayerHydrated,
  getRasterLayerSpec,
  getRasterSourceSpec,
  type EliLayer,
} from '@osm-editor-kit/maplibre-editor-layer-index/react'
import { BACKGROUND_LAYER_ID, BACKGROUND_SOURCE_ID } from './map-ids'

/**
 * Hydrate an ELI slug (`?bg=…`) into a renderable layer. Returns `null` for an
 * unknown slug or a hydration failure (offline, ELI outage) so callers can fall
 * back to the default Positron style silently instead of crashing.
 */
export async function hydrateBackgroundLayer(id: string): Promise<EliLayer | null> {
  try {
    const layer = await getLayerHydrated(id)
    return layer ?? null
  } catch {
    return null
  }
}

export function backgroundRasterSourceSpec(layer: EliLayer) {
  return getRasterSourceSpec(layer)
}

/** Drop the style-layer `maxzoom` so MapLibre overzooms past ELI's native tile zooms instead of hiding the layer. */
export function backgroundRasterLayerProps(layer: EliLayer) {
  const { maxzoom: _maxzoom, ...rest } = getRasterLayerSpec(layer, {
    id: BACKGROUND_LAYER_ID,
    source: BACKGROUND_SOURCE_ID,
    paint: { 'raster-opacity': 1 },
  })
  return rest
}
