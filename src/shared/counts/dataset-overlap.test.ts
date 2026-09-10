import { describe, expect, it } from 'vitest'
import { datasetOverlap } from './dataset-overlap'

describe('datasetOverlap', () => {
  it('returns zeros when both id lists are empty', () => {
    expect(datasetOverlap([], [])).toEqual({
      matched: 0,
      edgesWithoutCount: 0,
      countsWithoutEdge: 0,
      matchedPercent: 0,
    })
  })

  it('reports full match when every edge has a count', () => {
    expect(datasetOverlap(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual({
      matched: 3,
      edgesWithoutCount: 0,
      countsWithoutEdge: 0,
      matchedPercent: 100,
    })
  })

  it('counts unmatched ids in both directions', () => {
    expect(datasetOverlap(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toEqual({
      matched: 2,
      edgesWithoutCount: 1,
      countsWithoutEdge: 2,
      matchedPercent: 67,
    })
  })

  it('dedupes duplicate ids in both inputs', () => {
    expect(datasetOverlap(['a', 'a', 'b'], ['a', 'a', 'a', 'c'])).toEqual({
      matched: 1,
      edgesWithoutCount: 1,
      countsWithoutEdge: 1,
      matchedPercent: 50,
    })
  })

  it('keeps matchedPercent at 0 when there are no edges but leftover records', () => {
    expect(datasetOverlap([], ['x', 'y'])).toEqual({
      matched: 0,
      edgesWithoutCount: 0,
      countsWithoutEdge: 2,
      matchedPercent: 0,
    })
  })
})
