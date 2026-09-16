import type { ExpressionSpecification } from 'maplibre-gl'
import type { CountPeriod } from '@/shared/counts/schema'

export const EDGE_SIDE_LINE_COLOR = {
  left: '#38bdf8',
  right: '#fb7185',
} as const

/** The grey line drawn on the edge itself, under the two side lines. */
export const EDGE_LINE_WIDTH = 4

export const EDGE_SIDE_LINE_WIDTH = 3
export const EDGE_SIDE_LINE_WIDTH_ACTIVE = 12
export const EDGE_SIDE_LINE_OFFSET = 6

/**
 * Offsets for the three-line partner cluster (`has_extra_periods`), one line per
 * period per side: Sunday closest to the edge, evening furthest out. Left offsets
 * are negated by the caller so the cluster mirrors left/right around the edge.
 */
export const EDGE_SIDE_CLUSTER_OFFSET: Record<CountPeriod, number> = {
  sunday: 3,
  midday: 6,
  evening: 9,
}

type HoveredSide = 'left' | 'right' | 'center' | null

export function edgeSideLineWidth(
  side: 'left' | 'right',
  args: {
    hoveredEdgeId: string | null
    hoveredSide: HoveredSide
    focusedCountSide: 'left' | 'right' | null
    selectedEdgeId: string | undefined
  },
): number | ExpressionSpecification {
  const highlightedId =
    args.hoveredSide === side && args.hoveredEdgeId
      ? args.hoveredEdgeId
      : args.focusedCountSide === side && args.selectedEdgeId
        ? args.selectedEdgeId
        : null
  if (!highlightedId) return EDGE_SIDE_LINE_WIDTH
  return [
    'case',
    ['==', ['get', 'id'], highlightedId],
    EDGE_SIDE_LINE_WIDTH_ACTIVE,
    EDGE_SIDE_LINE_WIDTH,
  ]
}
