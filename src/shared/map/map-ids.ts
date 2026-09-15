export const MAIN_MAP_ID = 'mainMap'

export const EDGES_SOURCE_ID = 'counting-edges'
export const EDGES_LAYER_ID = 'counting-edges-line'
export const EDGES_LEFT_LAYER_ID = 'counting-edges-left'
export const EDGES_RIGHT_LAYER_ID = 'counting-edges-right'
export const EDGES_ARROWS_LAYER_ID = 'counting-edges-arrows'
export const EDGES_SELECTED_LAYER_ID = 'counting-edges-selected'
export const EDGES_ID_LABELS_LAYER_ID = 'counting-edges-id-labels'
export const MATCH_POINT_SOURCE_ID = 'count-match-point'
export const MATCH_POINT_LAYER_ID = 'count-match-point-circle'

// Three-line partner clusters, drawn instead of EDGES_LEFT/RIGHT_LAYER_ID whenever an
// edge has midday or evening data (`has_extra_periods`). One layer per side per period
// so each can be filtered independently — a period with no data on that side is a gap.
export const EDGES_LEFT_PERIOD_LAYER_ID = {
  sunday: 'counting-edges-left-sunday',
  midday: 'counting-edges-left-midday',
  evening: 'counting-edges-left-evening',
} as const

export const EDGES_RIGHT_PERIOD_LAYER_ID = {
  sunday: 'counting-edges-right-sunday',
  midday: 'counting-edges-right-midday',
  evening: 'counting-edges-right-evening',
} as const

export const EDGES_LEFT_PERIOD_LAYER_IDS = Object.values(EDGES_LEFT_PERIOD_LAYER_ID)

export const EDGES_RIGHT_PERIOD_LAYER_IDS = Object.values(EDGES_RIGHT_PERIOD_LAYER_ID)

export const PARKINGS_SOURCE_ID = 'tilda-parkings'
export const PARKINGS_LAYER_ID = 'tilda-parkings-line'

// Manually placed count points (no edge). Kept mounted with an empty FeatureCollection
// when there are none, and rendered after the edge layers so they stack on top.
export const MANUAL_POINTS_SOURCE_ID = 'manual-points'
export const MANUAL_POINTS_SELECTED_LAYER_ID = 'manual-points-selected'
export const MANUAL_POINTS_HALO_LAYER_ID = 'manual-points-halo'
export const MANUAL_POINTS_CORE_LAYER_ID = 'manual-points-core'

/** Both the halo and the core are clickable — the halo is the generous hit target. */
export const interactiveManualPointLayerIds = [
  MANUAL_POINTS_HALO_LAYER_ID,
  MANUAL_POINTS_CORE_LAYER_ID,
] as const

export const BACKGROUND_SOURCE_ID = 'eli-background'
export const BACKGROUND_LAYER_ID = 'eli-background'

export const interactiveEdgeLayerIds = [
  EDGES_LAYER_ID,
  EDGES_LEFT_LAYER_ID,
  EDGES_RIGHT_LAYER_ID,
  ...EDGES_LEFT_PERIOD_LAYER_IDS,
  ...EDGES_RIGHT_PERIOD_LAYER_IDS,
] as const
