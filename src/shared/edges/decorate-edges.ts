import { recordForEdge } from '@/shared/counts/match-counts'
import {
  countedSides,
  countPeriods,
  hasExtraPeriodData,
  isPeriodSideCounted,
  type CountPeriod,
  type CountRecord,
  type Side,
} from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

type EdgeCountState = 'uncounted' | 'partial' | 'full'

export type DecorateMatchUi = {
  candidateIds: ReadonlySet<string>
  selectedCandidateId?: string
}

type PeriodSideFlag = `${Side}_${CountPeriod}`

/** `left_sunday`, `right_period_4`, …: whether that side holds a count in that period. */
function periodSideFlags(record: CountRecord | undefined) {
  return Object.fromEntries(
    countPeriods.flatMap((period) =>
      (['left', 'right'] as const).map((side) => [
        `${side}_${period}`,
        record ? isPeriodSideCounted(record, period, side) : false,
      ]),
    ),
  ) as Record<PeriodSideFlag, boolean>
}

export function decorateEdges(
  collection: CountingEdgesGeoJSON,
  records: Record<string, CountRecord>,
  uncountedOnly: boolean,
  period: CountPeriod,
  matchUi?: DecorateMatchUi,
) {
  const features = collection.features.map((feature) => {
    const record = recordForEdge(records, feature.properties.id)
    // Completeness (and with it the uncounted filter) reads the active period only;
    // the other periods only add the partner-line cluster below.
    const sides = countedSides(record, period)
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
        ...periodSideFlags(record),
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
