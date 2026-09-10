type Side = 'left' | 'right'

const categoryKeys = ['pkw', 'motorrad', 'lkw_bus'] as const

export type CountCategoryKey = (typeof categoryKeys)[number]

/**
 * Tab walks down one street side (Pkw → Motorrad → Lkw/Bus), then the other
 * screen column. Disabled parking sides are skipped.
 */
export function countFieldTabOrder(
  columns: readonly Side[],
  disabledSides: Record<Side, boolean>,
): Array<{ side: Side; key: CountCategoryKey }> {
  return columns.flatMap((side) =>
    disabledSides[side] ? [] : categoryKeys.map((key) => ({ side, key })),
  )
}
