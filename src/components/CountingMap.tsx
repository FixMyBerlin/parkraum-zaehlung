import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { MapLayerMouseEvent, MapLibreEvent } from 'maplibre-gl'
import {
  AttributionControl,
  Layer,
  Map,
  Source,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { tildaParkingsTileset, tildaTilesUrl } from '@/config/app.const'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { decorateEdges } from '@/features/edges/decorate-edges'
import {
  useFocusedCountSide,
  useHoveredEdgeId,
  useHoveredSide,
  useMapUiActions,
} from '@/features/map/map-ui-store'
import { Route } from '@/routes/index'
import { loadDataset } from '@/shared/datasets/dataset-idb'
import {
  EDGE_SIDE_LINE_COLOR,
  EDGE_SIDE_LINE_OFFSET,
  edgeSideLineWidth,
} from '@/shared/map/edge-side-style'
import { exposeMainMapForDebugging } from '@/shared/map/expose-main-map'
import {
  EDGES_ARROWS_LAYER_ID,
  EDGES_LAYER_ID,
  EDGES_LEFT_LAYER_ID,
  EDGES_RIGHT_LAYER_ID,
  EDGES_SELECTED_LAYER_ID,
  EDGES_SOURCE_ID,
  MAIN_MAP_ID,
  PARKINGS_LAYER_ID,
  PARKINGS_SOURCE_ID,
  interactiveEdgeLayerIds,
} from '@/shared/map/map-ids'
import { searchMapParam, serializeIndexSearchMap } from '@/shared/routing/search-schema'

const OPENFREEMAP_POSITRON = 'https://tiles.openfreemap.org/styles/positron'

export function CountingMap() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const map = searchMapParam(search)
  const { dataset, edge, uncounted, parkings } = search
  const hoveredEdgeId = useHoveredEdgeId()
  const hoveredSide = useHoveredSide()
  const focusedCountSide = useFocusedCountSide()
  const { setHover } = useMapUiActions()
  const sideLineArgs = {
    hoveredEdgeId,
    hoveredSide,
    focusedCountSide,
    selectedEdgeId: edge,
  }

  const edgesQuery = useQuery({
    queryKey: ['dataset', dataset],
    queryFn: () => loadDataset(dataset!),
    enabled: Boolean(dataset),
  })
  const countsQuery = useQuery({
    queryKey: countsQueryKey(dataset ?? ''),
    queryFn: () => countStore.list(dataset!),
    enabled: Boolean(dataset),
  })

  const geojson =
    edgesQuery.data && decorateEdges(edgesQuery.data.collection, countsQuery.data ?? {}, uncounted)

  function featureIdFromEvent(event: MapLayerMouseEvent) {
    const feature = event.features?.[0]
    const id = feature?.properties?.id
    return typeof id === 'string' ? id : null
  }

  function sideFromLayer(layerId: string | undefined) {
    if (layerId === EDGES_LEFT_LAYER_ID) return 'left' as const
    if (layerId === EDGES_RIGHT_LAYER_ID) return 'right' as const
    return 'center' as const
  }

  return (
    <Map
      id={MAIN_MAP_ID}
      mapStyle={OPENFREEMAP_POSITRON}
      initialViewState={{
        longitude: map.lng,
        latitude: map.lat,
        zoom: map.zoom,
      }}
      style={{ width: '100%', height: '100%' }}
      attributionControl={false}
      cursor={hoveredSide ? 'pointer' : ''}
      interactiveLayerIds={[...interactiveEdgeLayerIds]}
      onLoad={(event: MapLibreEvent) => {
        exposeMainMapForDebugging(event.target)
      }}
      onMoveEnd={(event: ViewStateChangeEvent) => {
        const { latitude, longitude, zoom } = event.viewState
        void navigate({
          search: (previous) => ({
            ...previous,
            map: serializeIndexSearchMap({ zoom, lat: latitude, lng: longitude }),
          }),
          replace: true,
        })
      }}
      onMouseMove={(event: MapLayerMouseEvent) => {
        const id = featureIdFromEvent(event)
        setHover(id, id ? sideFromLayer(event.features?.[0]?.layer?.id) : null)
      }}
      onMouseLeave={() => {
        setHover(null, null)
      }}
      onClick={(event: MapLayerMouseEvent) => {
        const id = featureIdFromEvent(event)
        if (!id) return
        void navigate({
          search: (previous) => ({ ...previous, edge: id }),
        })
      }}
    >
      <AttributionControl compact />
      {parkings && (
        <>
          <Source
            id={PARKINGS_SOURCE_ID}
            type="vector"
            tiles={[`${tildaTilesUrl}/${tildaParkingsTileset}/{z}/{x}/{y}`]}
          />
          <Layer
            id={PARKINGS_LAYER_ID}
            type="line"
            source={PARKINGS_SOURCE_ID}
            source-layer="parkings"
            paint={{
              'line-color': '#f59e0b',
              'line-width': 2,
              'line-opacity': 0.7,
            }}
          />
        </>
      )}
      {geojson && (
        <>
          <Source id={EDGES_SOURCE_ID} type="geojson" data={geojson} promoteId="id" />
          {edge && (
            <Layer
              id={EDGES_SELECTED_LAYER_ID}
              type="line"
              source={EDGES_SOURCE_ID}
              filter={['==', ['get', 'id'], edge]}
              paint={{
                'line-width': 8,
                'line-color': '#f8fafc',
                'line-opacity': 0.35,
              }}
            />
          )}
          <Layer
            id={EDGES_LAYER_ID}
            type="line"
            source={EDGES_SOURCE_ID}
            paint={{
              'line-width': 4,
              'line-color': [
                'match',
                ['get', 'count_state'],
                'full',
                '#22c55e',
                'partial',
                '#eab308',
                '#64748b',
              ],
            }}
          />
          <Layer
            id={EDGES_LEFT_LAYER_ID}
            type="line"
            source={EDGES_SOURCE_ID}
            paint={{
              'line-width': edgeSideLineWidth('left', sideLineArgs),
              'line-offset': -EDGE_SIDE_LINE_OFFSET,
              'line-color': EDGE_SIDE_LINE_COLOR.left,
              'line-opacity': 0.85,
            }}
          />
          <Layer
            id={EDGES_RIGHT_LAYER_ID}
            type="line"
            source={EDGES_SOURCE_ID}
            paint={{
              'line-width': edgeSideLineWidth('right', sideLineArgs),
              'line-offset': EDGE_SIDE_LINE_OFFSET,
              'line-color': EDGE_SIDE_LINE_COLOR.right,
              'line-opacity': 0.85,
            }}
          />
          <Layer
            id={EDGES_ARROWS_LAYER_ID}
            type="symbol"
            source={EDGES_SOURCE_ID}
            layout={{
              'symbol-placement': 'line',
              'symbol-spacing': 80,
              'text-field': '▶',
              'text-size': 12,
              'text-keep-upright': false,
              'text-rotation-alignment': 'map',
              'text-allow-overlap': true,
            }}
            paint={{
              'text-color': '#e2e8f0',
            }}
          />
        </>
      )}
    </Map>
  )
}
