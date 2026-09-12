import { useQuery } from '@tanstack/react-query'
import { useMatch, useNavigate, useRouterState } from '@tanstack/react-router'
import type { StepNavItem } from '@/components/StepNav'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
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
  const navigate = useNavigate()
  const indexMatch = useMatch({ from: '/', shouldThrow: false })
  const isDataPage = useRouterState({
    select: (state) => state.location.pathname === '/data',
  })
  const dataset = indexMatch?.search.dataset
  const current = isDataPage ? undefined : resolveStep(indexMatch?.search ?? {})

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
      to: '/',
      search: indexMatch ? { ...indexMatch.search, step: id } : { step: id },
      replace: !isDataPage,
    })
  }

  return {
    dataset,
    current,
    edges,
    records,
    remoteCount,
    hasLocalEdges,
    steps,
    goToStep,
    isDataPage,
  }
}
