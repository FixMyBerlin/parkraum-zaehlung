export type DatasetOverlap = {
  matched: number
  edgesWithoutCount: number
  countsWithoutEdge: number
  matchedPercent: number
}

export function datasetOverlap(edgeIds: string[], recordIds: string[]): DatasetOverlap {
  const edges = new Set(edgeIds)
  const records = new Set(recordIds)

  let matched = 0
  for (const id of edges) {
    if (records.has(id)) matched++
  }

  return {
    matched,
    edgesWithoutCount: edges.size - matched,
    countsWithoutEdge: records.size - matched,
    matchedPercent: edges.size === 0 ? 0 : Math.round((matched / edges.size) * 100),
  }
}
