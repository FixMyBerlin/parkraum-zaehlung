import type { ExpressionSpecification } from 'maplibre-gl'

export const EDGE_SIDE_LINE_COLOR = {
  left: '#38bdf8',
  right: '#fb7185',
} as const

export const EDGE_SIDE_LINE_WIDTH = 3
export const EDGE_SIDE_LINE_WIDTH_ACTIVE = 12
export const EDGE_SIDE_LINE_OFFSET = 6

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
