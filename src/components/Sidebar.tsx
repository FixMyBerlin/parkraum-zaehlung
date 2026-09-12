import {
  ArrowDownTrayIcon,
  FolderIcon,
  PencilSquareIcon,
  UserIcon,
} from '@heroicons/react/20/solid'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AuthButton } from '@/components/AuthButton'
import { DatasetPanel } from '@/components/DatasetPanel'
import { EdgeList } from '@/components/EdgeList'
import { EditPanel } from '@/components/EditPanel'
import { ExportPanel } from '@/components/ExportPanel'
import { ProgressSummary } from '@/components/ProgressSummary'
import { StepNav, type StepNavItem } from '@/components/StepNav'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import {
  Sidebar as SidebarNav,
  SidebarBody,
  SidebarDivider,
  SidebarHeader,
  SidebarSection,
} from '@/components/ui/sidebar'
import { Text } from '@/components/ui/text'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { useOsmAuth } from '@/features/osm/use-osm-auth'
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

const stepIcons = {
  login: UserIcon,
  dataset: FolderIcon,
  count: PencilSquareIcon,
  export: ArrowDownTrayIcon,
} as const

export function AppSidebar() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch({ select: (s) => ({ dataset: s.dataset, step: s.step }) })
  const dataset = search.dataset
  const current = resolveStep(search)
  const auth = useOsmAuth()
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
    shortLabel: appStepLabels[id].shortLabel,
    description: stepDescription({
      step: id,
      authenticated: auth.authenticated,
      displayName: auth.displayName,
      dataset,
      edges,
      records,
      remoteCount,
    }),
    status: stepStatus({
      step: id,
      current,
      authenticated: auth.authenticated,
      dataset,
    }),
    icon: stepIcons[id],
  }))

  function goToStep(id: AppStep) {
    void navigate({
      search: (previous) => ({ ...previous, step: id }),
      replace: true,
    })
  }

  return (
    <SidebarNav className="h-full bg-zinc-900">
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
          <h1 className="text-sm/5 font-semibold tracking-wide text-white">Parkraum-Zählung</h1>
        </div>
        <div className="-mx-4 mt-4 -mb-4 border-t border-white/5">
          <StepNav steps={steps} onSelect={goToStep} />
        </div>
      </SidebarHeader>
      <SidebarBody>
        {current === 'login' ? (
          <SidebarSection>
            <Text className="mb-3">
              Anmelden ist nur zum Speichern nötig. Import und Karte funktionieren ohne Login.
            </Text>
            <AuthButton />
          </SidebarSection>
        ) : null}
        {current === 'dataset' ? (
          <SidebarSection>
            <DatasetPanel />
          </SidebarSection>
        ) : null}
        {current === 'count' ? (
          !dataset ? (
            <SidebarSection>
              <Callout title="Kein Datensatz">Wähle zuerst einen Datensatz.</Callout>
              <Button
                type="button"
                color="sky"
                className="mt-3"
                onClick={() => goToStep('dataset')}
              >
                Zum Datensatz
              </Button>
            </SidebarSection>
          ) : !hasLocalEdges ? (
            <SidebarSection>
              <ProgressSummary dataset={dataset} edges={edges} remoteCount={remoteCount} />
              <Button
                type="button"
                color="sky"
                className="mt-3"
                onClick={() => goToStep('dataset')}
              >
                Zum Datensatz
              </Button>
            </SidebarSection>
          ) : (
            <>
              <SidebarSection>
                <EditPanel />
              </SidebarSection>
              <SidebarDivider />
              <SidebarSection>
                <EdgeList />
              </SidebarSection>
            </>
          )
        ) : null}
        {current === 'export' ? (
          !dataset ? (
            <SidebarSection>
              <Callout title="Kein Datensatz">Wähle zuerst einen Datensatz.</Callout>
              <Button
                type="button"
                color="sky"
                className="mt-3"
                onClick={() => goToStep('dataset')}
              >
                Zum Datensatz
              </Button>
            </SidebarSection>
          ) : (
            <SidebarSection>
              <ExportPanel />
            </SidebarSection>
          )
        ) : null}
      </SidebarBody>
    </SidebarNav>
  )
}
