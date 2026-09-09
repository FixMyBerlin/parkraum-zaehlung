import { createCountStore } from '@/shared/counts/create-count-store'

export const countStore = createCountStore()

export const countsQueryKey = (dataset: string) => ['counts', dataset] as const
