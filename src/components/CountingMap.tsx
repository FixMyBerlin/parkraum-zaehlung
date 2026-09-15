import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { MapLayerMouseEvent, MapLibreEvent } from 'maplibre-gl'
import { useEffect } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/shared/map/maplibre-worker'
import {
  AttributionControl,
  Layer,
  Map,
  Source,
  useMap,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre'
import { MapBackgroundLayerControl } from '@/components/MapBackgroundLayerControl'
import { MapBackgroundLayerSource } from '@/components/MapBackgroundLayerSource'
import { MapResetNorthPitchButton } from '@/components/MapResetNorthPitchButton'
import {
  useFocusedCountSide,
  useHoveredEdgeId,
  useHoveredSide,
  useMapUiActions,
} from '@/components/shared/map-ui-store'
import { Tooltip } from '@/components/shared/Tooltip/Tooltip'
import { useAssignMatch } from '@/components/shared/use-assign-match'
import { tildaParkingsTileset, tildaTilesUrl } from '@/config/app.const'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { countsQueryKey, countStore } from '@/shared/counts/counts-query'
import { edgeMatchInputs, matchCountsToEdges } from '@/shared/counts/match-counts'
import { countPeriods } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'
import { decorateEdges } from '@/shared/edges/decorate-edges'
import {
  EDGE_SIDE_CLUSTER_OFFSET,
  EDGE_SIDE_LINE_COLOR,
  EDGE_SIDE_LINE_OFFSET,
  edgeSideLineWidth,
} from '@/shared/map/edge-side-style'
import { exposeMainMapForDebugging } from '@/shared/map/expose-main-map'
import {
  EDGES_ARROWS_LAYER_ID,
  EDGES_ID_LABELS_LAYER_ID,
  EDGES_LAYER_ID,
  EDGES_LEFT_LAYER_ID,
  EDGES_LEFT_PERIOD_LAYER_ID,
  EDGES_LEFT_PERIOD_LAYER_IDS,
  EDGES_RIGHT_LAYER_ID,
  EDGES_RIGHT_PERIOD_LAYER_ID,
  EDGES_RIGHT_PERIOD_LAYER_IDS,
  EDGES_SELECTED_LAYER_ID,
  EDGES_SOURCE_ID,
  MAIN_MAP_ID,
  MATCH_POINT_LAYER_ID,
  MATCH_POINT_SOURCE_ID,
  PARKINGS_LAYER_ID,
  PARKINGS_SOURCE_ID,
  interactiveEdgeLayerIds,
} from '@/shared/map/map-ids'
import { resolveStep } from '@/shared/routing/app-step'
import { searchMapParam, serializeIndexSearchMap } from '@/shared/routing/search-schema'

const OPENFREEMAP_POSITRON = 'https://tiles.openfreemap.org/styles/positron'

export function CountingMap() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const map = searchMapParam(search)
  const { dataset, edge, uncounted, parkings, bg, match: matchId } = search
  const currentStep = resolveStep(search)
  const matchMode = currentStep === 'dataset' && Boolean(matchId)
  const { assign } = useAssignMatch(dataset)
  const hoveredEdgeId = useHoveredEdgeId()
  const hoveredSide = useHoveredSide()
  const focusedCountSide = useFocusedCountSide()
  const { setHover, setMapBearing, setMapPitch } = useMapUiActions()
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

  const records = countsQuery.data ?? {}
  const collection = edgesQuery.data?.collection
  const matchResult = collection
    ? matchCountsToEdges(records, edgeMatchInputs(collection))
    : undefined
  const selectedMatch = matchResult?.rows.find((row) => row.originalId === matchId)
  const matchUi = matchMode
    ? {
        candidateIds: new Set(selectedMatch?.candidates.map((candidate) => candidate.id) ?? []),
        selectedCandidateId: edge,
      }
    : undefined
  const geojson = collection && decorateEdges(collection, records, uncounted, matchUi)
  const matchPoint =
    matchMode && selectedMatch
      ? {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [selectedMatch.record.mid_lng, selectedMatch.record.mid_lat],
              },
              properties: {},
            },
          ],
        }
      : undefined

  function featureIdFromEvent(event: MapLayerMouseEvent) {
    const feature = event.features?.[0]
    const id = feature?.properties?.id
    return typeof id === 'string' ? id : null
  }

  function sideFromLayer(layerId: string | undefined) {
    if (!layerId) return 'center' as const
    if (
      layerId === EDGES_LEFT_LAYER_ID ||
      (EDGES_LEFT_PERIOD_LAYER_IDS as readonly string[]).includes(layerId)
    ) {
      return 'left' as const
    }
    if (
      layerId === EDGES_RIGHT_LAYER_ID ||
      (EDGES_RIGHT_PERIOD_LAYER_IDS as readonly string[]).includes(layerId)
    ) {
      return 'right' as const
    }
    return 'center' as const
  }

  return (
    <div className="relative h-full w-full">
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
          setMapBearing(event.target.getBearing())
          setMapPitch(event.target.getPitch())
        }}
        onRotate={(event: ViewStateChangeEvent) => {
          setMapBearing(event.viewState.bearing)
        }}
        onRotateEnd={(event: ViewStateChangeEvent) => {
          setMapBearing(event.viewState.bearing)
        }}
        onPitch={(event: ViewStateChangeEvent) => {
          setMapPitch(event.viewState.pitch)
        }}
        onPitchEnd={(event: ViewStateChangeEvent) => {
          setMapPitch(event.viewState.pitch)
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
          if (matchMode && matchId) {
            assign.mutate({ originalId: matchId, matchId: id, status: 'manual' })
            void navigate({
              search: (previous) => ({ ...previous, edge: id, step: 'dataset' }),
              replace: true,
            })
            return
          }
          void navigate({
            search: (previous) => ({ ...previous, edge: id, step: 'count' }),
            replace: true,
          })
        }}
      >
        {/* Mounted first so its `beforeId={PARKINGS_LAYER_ID}` Layer paints below the
          TILDA-Parkraum and counting-edges overlays; see the safety net inside for what
          happens if the parkings layer does not exist yet when this one is created. */}
        <MapBackgroundLayerSource backgroundLayerId={bg ?? null} />
        <AttributionControl compact />
        {/* Kept mounted and toggled via `visibility` so the layer order stays deterministic;
          MapLibre only requests tiles while the layer is visible. */}
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
          layout={{ visibility: parkings ? 'visible' : 'none' }}
          paint={{
            'line-color': '#f59e0b',
            'line-width': 2,
            'line-opacity': 0.7,
          }}
        />
        {geojson && (
          <>
            <Source id={EDGES_SOURCE_ID} type="geojson" data={geojson} promoteId="id" />
            {/* Highlight stays mounted below the edge lines; selection drives `filter`, because a
              layer that mounts later would be added on top of its siblings. */}
            <Layer
              id={EDGES_SELECTED_LAYER_ID}
              type="line"
              source={EDGES_SOURCE_ID}
              filter={edge ? ['==', ['get', 'id'], edge] : ['literal', false]}
              paint={{
                'line-width': 8,
                'line-color': '#f8fafc',
                'line-opacity': 0.35,
              }}
            />
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
                'line-opacity': matchMode
                  ? ['case', ['boolean', ['get', 'match_candidate'], false], 1, 0.25]
                  : 1,
              }}
            />
            {/* Plain ±6 side lines — the default look, hidden once an edge grows a
              three-line partner cluster below (`has_extra_periods`). */}
            <Layer
              id={EDGES_LEFT_LAYER_ID}
              type="line"
              source={EDGES_SOURCE_ID}
              filter={['!', ['get', 'has_extra_periods']]}
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
              filter={['!', ['get', 'has_extra_periods']]}
              paint={{
                'line-width': edgeSideLineWidth('right', sideLineArgs),
                'line-offset': EDGE_SIDE_LINE_OFFSET,
                'line-color': EDGE_SIDE_LINE_COLOR.right,
                'line-opacity': 0.85,
              }}
            />
            {/* Three-line partner cluster: one layer per side per period, each gated on
              `has_extra_periods` plus that period's own boolean so a period with no data
              on that side leaves a gap instead of drawing a zero-length stub. */}
            {countPeriods.map((period) => (
              <Layer
                key={`left-${period}`}
                id={EDGES_LEFT_PERIOD_LAYER_ID[period]}
                type="line"
                source={EDGES_SOURCE_ID}
                filter={['all', ['get', 'has_extra_periods'], ['get', `left_${period}`]]}
                paint={{
                  'line-width': edgeSideLineWidth('left', sideLineArgs),
                  'line-offset': -EDGE_SIDE_CLUSTER_OFFSET[period],
                  'line-color': EDGE_SIDE_LINE_COLOR.left,
                  'line-opacity': 0.85,
                }}
              />
            ))}
            {countPeriods.map((period) => (
              <Layer
                key={`right-${period}`}
                id={EDGES_RIGHT_PERIOD_LAYER_ID[period]}
                type="line"
                source={EDGES_SOURCE_ID}
                filter={['all', ['get', 'has_extra_periods'], ['get', `right_${period}`]]}
                paint={{
                  'line-width': edgeSideLineWidth('right', sideLineArgs),
                  'line-offset': EDGE_SIDE_CLUSTER_OFFSET[period],
                  'line-color': EDGE_SIDE_LINE_COLOR.right,
                  'line-opacity': 0.85,
                }}
              />
            ))}
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
            <Layer
              id={EDGES_ID_LABELS_LAYER_ID}
              type="symbol"
              source={EDGES_SOURCE_ID}
              layout={{
                visibility: matchMode ? 'visible' : 'none',
                'symbol-placement': 'line-center',
                'text-field': [
                  'concat',
                  ['get', 'id'],
                  [
                    'case',
                    ['all', ['has', 'name'], ['!=', ['to-string', ['get', 'name']], '']],
                    ['concat', '\n', ['to-string', ['get', 'name']]],
                    '',
                  ],
                ],
                'text-size': 11,
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#0f172a',
                'text-halo-color': '#f8fafc',
                'text-halo-width': 1.5,
              }}
            />
          </>
        )}
        {matchPoint ? <Source id={MATCH_POINT_SOURCE_ID} type="geojson" data={matchPoint} /> : null}
        {matchPoint ? (
          <Layer
            id={MATCH_POINT_LAYER_ID}
            type="circle"
            source={MATCH_POINT_SOURCE_ID}
            paint={{
              'circle-radius': 7,
              'circle-color': '#0ea5e9',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#f8fafc',
            }}
          />
        ) : null}
      </Map>
      {selectedMatch ? (
        <FlyToSelectedMatch
          keyId={selectedMatch.originalId}
          lng={selectedMatch.record.mid_lng}
          lat={selectedMatch.record.mid_lat}
        />
      ) : null}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <MapResetNorthPitchButton />
        <MapBackgroundLayerControl bg={bg ?? null} lat={map.lat} lng={map.lng} />
        <ParkingsLayerToggle parkings={parkings} />
      </div>
    </div>
  )
}

function FlyToSelectedMatch({ keyId, lng, lat }: { keyId: string; lng: number; lat: number }) {
  const maps = useMap()
  useEffect(
    function flyToSelectedMatch() {
      const map = maps[MAIN_MAP_ID]
      if (!map) return
      map.flyTo({ center: [lng, lat], zoom: 18, duration: 700 })
    },
    [maps, keyId, lng, lat],
  )
  return null
}

function ParkingsLayerToggle({ parkings }: { parkings: boolean }) {
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <Tooltip text="Blendet die von TILDA kartierten Parkstände auf der Karte ein. Orientierung beim Zählen, nicht die Zählgrundlage.">
      <button
        type="button"
        aria-pressed={parkings}
        aria-label="TILDA-Parkraum als Kontext"
        className={cn(
          'rounded-lg px-3 py-2 text-xs font-medium shadow-lg ring-1',
          parkings
            ? 'bg-amber-500 text-zinc-950 ring-amber-300'
            : 'bg-zinc-900/90 text-white ring-white/10 hover:bg-zinc-800',
        )}
        onClick={() =>
          void navigate({
            search: (previous) => ({ ...previous, parkings: !parkings }),
            replace: true,
          })
        }
      >
        TILDA-Parkraum
      </button>
    </Tooltip>
  )
}
