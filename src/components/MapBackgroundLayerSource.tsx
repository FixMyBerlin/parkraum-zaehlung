import type { EliLayer } from '@osm-editor-kit/maplibre-editor-layer-index/react'
import { useEffect, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import {
  backgroundRasterLayerProps,
  backgroundRasterSourceSpec,
  hydrateBackgroundLayer,
} from '@/shared/map/background-layer'
import {
  BACKGROUND_LAYER_ID,
  BACKGROUND_SOURCE_ID,
  MAIN_MAP_ID,
  PARKINGS_LAYER_ID,
} from '@/shared/map/map-ids'

/**
 * Optional ELI raster imagery above the default OpenFreeMap Positron style and
 * below the TILDA-Parkraum / counting-edges overlays. Never changes react-map-gl's
 * `mapStyle` — this only adds a pixel overlay when a `?bg=` slug is selected.
 */
export function MapBackgroundLayerSource({
  backgroundLayerId,
}: {
  backgroundLayerId: string | null
}) {
  const [resolved, setResolved] = useState<{ id: string; layer: EliLayer } | null>(null)
  const maps = useMap()
  const map = maps[MAIN_MAP_ID]

  useEffect(
    function hydrateSelectedBackgroundLayer() {
      if (backgroundLayerId == null) return

      let cancelled = false
      void hydrateBackgroundLayer(backgroundLayerId).then((hydrated) => {
        if (cancelled || hydrated == null) return
        setResolved({ id: backgroundLayerId, layer: hydrated })
      })
      return () => {
        cancelled = true
      }
    },
    [backgroundLayerId],
  )

  const layer =
    backgroundLayerId != null && resolved?.id === backgroundLayerId ? resolved.layer : null

  // Safety net: `beforeId={PARKINGS_LAYER_ID}` below asks react-map-gl to insert the ELI
  // layer just under parkings, but MapLibre's `addLayer` silently drops that positioning
  // (fires an 'error' event and no-ops) if the parkings layer does not exist on the style
  // yet at the moment this layer is created. That should not normally happen — parkings
  // is mounted unconditionally in `CountingMap`, and ELI only mounts once hydration
  // resolves, well after initial mount — but re-assert the order defensively on every
  // style change so a race can never leave the background imagery covering the overlays.
  useEffect(
    function keepBackgroundBelowParkings() {
      if (!map || layer == null) return
      const maplibreMap = map.getMap()

      function reorder() {
        const order = maplibreMap.getStyle()?.layers
        if (!order) return
        const backgroundIndex = order.findIndex((l) => l.id === BACKGROUND_LAYER_ID)
        const parkingsIndex = order.findIndex((l) => l.id === PARKINGS_LAYER_ID)
        if (backgroundIndex === -1 || parkingsIndex === -1) return
        if (backgroundIndex > parkingsIndex) {
          maplibreMap.moveLayer(BACKGROUND_LAYER_ID, PARKINGS_LAYER_ID)
        }
      }

      reorder()
      maplibreMap.on('styledata', reorder)
      return () => {
        maplibreMap.off('styledata', reorder)
      }
    },
    [map, layer],
  )

  if (layer == null) return null

  return (
    <>
      <Source id={BACKGROUND_SOURCE_ID} {...backgroundRasterSourceSpec(layer)} />
      <Layer {...backgroundRasterLayerProps(layer)} beforeId={PARKINGS_LAYER_ID} />
    </>
  )
}
