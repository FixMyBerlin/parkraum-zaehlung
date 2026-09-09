import { expect, test } from 'vitest'
import {
  EDGE_SIDE_LINE_WIDTH,
  EDGE_SIDE_LINE_WIDTH_ACTIVE,
  edgeSideLineWidth,
} from './edge-side-style'

const idle = {
  hoveredEdgeId: null,
  hoveredSide: null,
  focusedCountSide: null,
  selectedEdgeId: undefined,
} as const

test('keeps the default width when nothing is hovered or focused', () => {
  expect(edgeSideLineWidth('left', idle)).toBe(EDGE_SIDE_LINE_WIDTH)
  expect(edgeSideLineWidth('right', idle)).toBe(EDGE_SIDE_LINE_WIDTH)
})

test('thickens only the hovered edge on that side', () => {
  expect(
    edgeSideLineWidth('left', {
      ...idle,
      hoveredEdgeId: 'edge-a',
      hoveredSide: 'left',
    }),
  ).toEqual([
    'case',
    ['==', ['get', 'id'], 'edge-a'],
    EDGE_SIDE_LINE_WIDTH_ACTIVE,
    EDGE_SIDE_LINE_WIDTH,
  ])
  expect(
    edgeSideLineWidth('right', {
      ...idle,
      hoveredEdgeId: 'edge-a',
      hoveredSide: 'left',
    }),
  ).toBe(EDGE_SIDE_LINE_WIDTH)
})

test('thickens the selected edge while a count input on that side is focused', () => {
  expect(
    edgeSideLineWidth('right', {
      ...idle,
      focusedCountSide: 'right',
      selectedEdgeId: 'edge-b',
    }),
  ).toEqual([
    'case',
    ['==', ['get', 'id'], 'edge-b'],
    EDGE_SIDE_LINE_WIDTH_ACTIVE,
    EDGE_SIDE_LINE_WIDTH,
  ])
})

test('map hover on a side wins over the form focus for that side', () => {
  expect(
    edgeSideLineWidth('left', {
      hoveredEdgeId: 'hovered',
      hoveredSide: 'left',
      focusedCountSide: 'left',
      selectedEdgeId: 'selected',
    }),
  ).toEqual([
    'case',
    ['==', ['get', 'id'], 'hovered'],
    EDGE_SIDE_LINE_WIDTH_ACTIVE,
    EDGE_SIDE_LINE_WIDTH,
  ])
})
