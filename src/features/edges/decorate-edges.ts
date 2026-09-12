import { recordForEdge } from '@/shared/counts/match-counts'
import { countedSides, type CountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

type EdgeCountState = 'uncounted' | 'partial' | 'full'

export type DecorateMatchUi = {
  candidateIds: ReadonlySet<string>
  selectedCandidateId?: string
}

export function decorateEdges(
  collection: CountingEdgesGeoJSON,
  records: Record<string, CountRecord>,
  uncountedOnly: boolean,
  matchUi?: DecorateMatchUi,
): CountingEdgesGeoJSON {
  const features = collection.features.map((feature) => {
    const sides = countedSides(recordForEdge(records, feature.properties.id))
    const countState: EdgeCountState = sides === 0 ? 'uncounted' : sides === 2 ? 'full' : 'partial'
    const isCandidate = matchUi?.candidateIds.has(feature.properties.id) ?? false
    return {
      ...feature,
      id: feature.properties.id,
      properties: {
        ...feature.properties,
        count_state: countState,
        counted_sides: sides,
        match_candidate: isCandidate,
        match_selected: matchUi?.selectedCandidateId === feature.properties.id,
      },
    }
  })
  return {
    ...collection,
    features: uncountedOnly
      ? features.filter((feature) => feature.properties.count_state !== 'full')
      : features,
  }
}
