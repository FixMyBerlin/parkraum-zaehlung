export const MAIN_MAP_ID = 'mainMap'

export const EDGES_SOURCE_ID = 'counting-edges'
export const EDGES_LAYER_ID = 'counting-edges-line'
export const EDGES_LEFT_LAYER_ID = 'counting-edges-left'
export const EDGES_RIGHT_LAYER_ID = 'counting-edges-right'
export const EDGES_ARROWS_LAYER_ID = 'counting-edges-arrows'
export const EDGES_SELECTED_LAYER_ID = 'counting-edges-selected'

export const PARKINGS_SOURCE_ID = 'tilda-parkings'
export const PARKINGS_LAYER_ID = 'tilda-parkings-line'

export const interactiveEdgeLayerIds = [
  EDGES_LAYER_ID,
  EDGES_LEFT_LAYER_ID,
  EDGES_RIGHT_LAYER_ID,
] as const
