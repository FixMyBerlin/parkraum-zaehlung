import { createCountStore } from '@/shared/counts/create-count-store'
import { getOsmToken } from '@/shared/osm/osm-auth'

export const countStore = createCountStore(getOsmToken)

export const countsQueryKey = (dataset: string) => ['counts', dataset] as const
