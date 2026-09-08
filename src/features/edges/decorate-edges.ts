import { countedSides, type CountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

type EdgeCountState = 'uncounted' | 'partial' | 'full'

export function decorateEdges(
  collection: CountingEdgesGeoJSON,
  records: Record<string, CountRecord>,
  uncountedOnly: boolean,
): CountingEdgesGeoJSON {
  const features = collection.features.map((feature) => {
    const sides = countedSides(records[feature.properties.id])
    const countState: EdgeCountState = sides === 0 ? 'uncounted' : sides === 2 ? 'full' : 'partial'
    return {
      ...feature,
      id: feature.properties.id,
      properties: {
        ...feature.properties,
        count_state: countState,
        counted_sides: sides,
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
