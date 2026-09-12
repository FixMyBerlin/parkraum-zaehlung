import { countedSides, type CountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

export const appSteps = ['dataset', 'count', 'export'] as const

export type AppStep = (typeof appSteps)[number]

export const appStepLabels: Record<AppStep, { label: string }> = {
  dataset: { label: 'Datensatz' },
  count: { label: 'Zählen' },
  export: { label: 'Export' },
}

export function resolveStep(search: { step?: AppStep; dataset?: string }): AppStep {
  if (search.step) return search.step
  if (search.dataset) return 'count'
  return 'dataset'
}

export function edgeCountProgress(
  edges: CountingEdgesGeoJSON,
  records: Record<string, CountRecord>,
) {
  const total = edges.features.length
  const counted = edges.features.filter(
    (feature) => countedSides(records[feature.properties.id]) === 2,
  ).length
  return { counted, total }
}

type StepDescriptionArgs = {
  step: AppStep
  dataset?: string
  edges?: CountingEdgesGeoJSON
  records?: Record<string, CountRecord>
  remoteCount?: number
}

function countLabel(count: number) {
  return count === 1 ? '1 Zählung' : `${count} Zählungen`
}

export function stepDescription({
  step,
  dataset,
  edges,
  records = {},
  remoteCount = 0,
}: StepDescriptionArgs) {
  switch (step) {
    case 'dataset':
      return dataset || 'Kein Datensatz'
    case 'count':
      if (edges) {
        const { counted, total } = edgeCountProgress(edges, records)
        return `${counted}/${total} Kanten`
      }
      if (dataset && remoteCount > 0) return `${remoteCount} in der Zähl-Datenbank`
      return 'Keine Kanten'
    case 'export':
      if (dataset) return countLabel(Object.keys(records).length)
      return 'Kein Datensatz'
  }
}

type StepStatusArgs = {
  step: AppStep
  current: AppStep
  dataset?: string
}

export function stepStatus({
  step,
  current,
  dataset,
}: StepStatusArgs): 'complete' | 'current' | 'upcoming' {
  if (step === current) return 'current'
  if (step === 'dataset') return dataset ? 'complete' : 'upcoming'
  return 'upcoming'
}
