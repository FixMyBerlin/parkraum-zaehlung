import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { StepNavItem } from '@/components/StepNav'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { Route } from '@/routes/index'
import { loadDataset } from '@/shared/datasets/dataset-idb'
import {
  appStepLabels,
  appSteps,
  resolveStep,
  stepDescription,
  stepStatus,
  type AppStep,
} from '@/shared/routing/app-step'

export function useAppStepNav() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch({ select: (s) => ({ dataset: s.dataset, step: s.step }) })
  const dataset = search.dataset
  const current = resolveStep(search)

  const edgesQuery = useQuery({
    queryKey: ['dataset', dataset],
    queryFn: () => loadDataset(dataset!),
    enabled: Boolean(dataset),
  })
  const countsQuery = useQuery({
    queryKey: countsQueryKey(dataset ?? ''),
    queryFn: () => countStore.list(dataset!),
    enabled: Boolean(dataset),
  })
  const hasLocalEdges = Boolean(edgesQuery.data)
  const records = countsQuery.data ?? {}
  const remoteCount = dataset ? Object.keys(records).length : 0
  const edges = edgesQuery.data?.collection

  const steps: StepNavItem[] = appSteps.map((id) => ({
    id,
    label: appStepLabels[id].label,
    description: stepDescription({
      step: id,
      dataset,
      edges,
      records,
      remoteCount,
    }),
    status: stepStatus({
      step: id,
      current,
      dataset,
    }),
  }))

  function goToStep(id: AppStep) {
    void navigate({
      search: (previous) => ({ ...previous, step: id }),
      replace: true,
    })
  }

  return { dataset, current, edges, records, remoteCount, hasLocalEdges, steps, goToStep }
}
