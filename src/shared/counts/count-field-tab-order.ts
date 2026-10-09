import { countCategories, type Side } from './schema'

/**
 * Tab walks down one street side (Pkw → … → Sonstiges), then the other
 * screen column.
 */
export function countFieldTabOrder(columns: readonly Side[]) {
  return columns.flatMap((side) => countCategories.map((key) => ({ side, key })))
}
