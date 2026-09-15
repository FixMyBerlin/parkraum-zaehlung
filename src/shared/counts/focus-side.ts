import {
  isSideCounted,
  type CountPeriod,
  type CountRecord,
  type Side,
} from '@/shared/counts/schema'
import type { ScreenOrderedSides } from '@/shared/edges/way-side-order'

/**
 * Which column the count form should focus when an edge (or the active period)
 * gets selected: the first one in screen order that is countable and still
 * empty **for that period**, so counting a street means "click, type, jump,
 * type". Falls back to the first countable column once both sides hold
 * numbers, and to `null` when neither side allows parking.
 */
export function firstUncountedSide(
  columns: ScreenOrderedSides,
  disabledSides: Record<Side, boolean>,
  record: CountRecord | undefined,
  period: CountPeriod,
): Side | null {
  const countable = columns.filter((side) => !disabledSides[side])
  const uncounted = countable.find(
    (side) => !record || !isSideCounted(record.periods[period][side]),
  )
  return uncounted ?? countable[0] ?? null
}
