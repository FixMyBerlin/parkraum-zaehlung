type Side = 'left' | 'right'

const categoryKeys = ['pkw', 'motorrad', 'lkw_bus'] as const

export type CountCategoryKey = (typeof categoryKeys)[number]

/**
 * Tab walks down one street side (Pkw → Motorrad → Lkw/Bus), then the other
 * screen column.
 */
export function countFieldTabOrder(columns: readonly Side[]) {
  return columns.flatMap((side) => categoryKeys.map((key) => ({ side, key })))
}
