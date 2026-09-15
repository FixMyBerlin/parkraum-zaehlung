import { recordForEdge } from '@/shared/counts/match-counts'
import {
  countedSides,
  hasExtraPeriodData,
  isPeriodSideCounted,
  type CountRecord,
} from '@/shared/counts/schema'
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
) {
  const features = collection.features.map((feature) => {
    const record = recordForEdge(records, feature.properties.id)
    // Completeness and the default map style read Sunday only; midday/evening only
    // add the partner-line cluster below.
    const sides = countedSides(record)
    const countState: EdgeCountState = sides === 0 ? 'uncounted' : sides === 2 ? 'full' : 'partial'
    const isCandidate = matchUi?.candidateIds.has(feature.properties.id) ?? false
    return {
      ...feature,
      id: feature.properties.id,
      properties: {
        ...feature.properties,
        count_state: countState,
        counted_sides: sides,
        has_extra_periods: hasExtraPeriodData(record),
        left_sunday: record ? isPeriodSideCounted(record, 'sunday', 'left') : false,
        left_midday: record ? isPeriodSideCounted(record, 'midday', 'left') : false,
        left_evening: record ? isPeriodSideCounted(record, 'evening', 'left') : false,
        right_sunday: record ? isPeriodSideCounted(record, 'sunday', 'right') : false,
        right_midday: record ? isPeriodSideCounted(record, 'midday', 'right') : false,
        right_evening: record ? isPeriodSideCounted(record, 'evening', 'right') : false,
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
