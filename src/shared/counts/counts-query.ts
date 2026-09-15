import { createCountStore } from '@/shared/counts/create-count-store'

export const countStore = createCountStore()

export const countsQueryKey = (dataset: string) => ['counts', dataset] as const

export const allCountsQueryKey = ['counts', 'all'] as const

export const datasetSummariesQueryKey = ['dataset-summaries'] as const

export const projectMetaQueryKey = ['project-meta'] as const
