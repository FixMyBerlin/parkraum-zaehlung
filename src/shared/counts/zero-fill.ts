import { lineMidpoint } from '@/shared/edges/line-midpoint'
import {
  countCategories,
  emptyCountRecord,
  isSideCounted,
  type CountPeriod,
  type CountRecord,
  type SideCount,
} from './schema'

const zeroSideCount = () =>
  Object.fromEntries(countCategories.map((category) => [category, 0])) as SideCount

type ZeroFillArgs = {
  existing: CountRecord | undefined
  period: CountPeriod
  edgeId: string
  coordinates: ReadonlyArray<ReadonlyArray<number>>
  updatedBy?: string
}

/**
 * "Nothing parked here" for one edge in one period: every side that holds no count
 * yet gets 0 in all categories. Sides that are already counted are never overwritten.
 * Returns `null` when both sides are counted, so the caller can skip the write.
 */
export function zeroFilledRecord({
  existing,
  period,
  edgeId,
  coordinates,
  updatedBy,
}: ZeroFillArgs): CountRecord | null {
  const updatedAt = new Date().toISOString()
  const mid = lineMidpoint(coordinates)
  const base =
    existing ??
    emptyCountRecord(updatedAt, {
      created_by: updatedBy,
      match_id: edgeId,
      match_status: 'id',
      mid_lat: mid.lat,
      mid_lng: mid.lng,
    })
  const occupancy = base.periods[period]
  if (isSideCounted(occupancy.left) && isSideCounted(occupancy.right)) return null
  return {
    ...base,
    periods: {
      ...base.periods,
      [period]: {
        left: isSideCounted(occupancy.left) ? occupancy.left : zeroSideCount(),
        right: isSideCounted(occupancy.right) ? occupancy.right : zeroSideCount(),
      },
    },
    updated_at: updatedAt,
    updated_by: updatedBy,
  }
}
