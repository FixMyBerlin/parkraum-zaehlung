import { isSideCounted, type CountRecord } from '@/shared/counts/schema'
import type { ScreenOrderedSides } from '@/shared/edges/way-side-order'

type Side = 'left' | 'right'

/**
 * Which column the count form should focus when an edge gets selected: the
 * first one in screen order that is countable and still empty, so counting a
 * street means "click, type, jump, type". Falls back to the first countable
 * column once both sides hold numbers, and to `null` when neither side allows
 * parking.
 */
export function firstUncountedSide(
  columns: ScreenOrderedSides,
  disabledSides: Record<Side, boolean>,
  record: CountRecord | undefined,
): Side | null {
  const countable = columns.filter((side) => !disabledSides[side])
  const uncounted = countable.find((side) => !record || !isSideCounted(record[side]))
  return uncounted ?? countable[0] ?? null
}
