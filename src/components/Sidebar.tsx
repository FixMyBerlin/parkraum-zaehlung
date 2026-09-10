import { useQuery } from '@tanstack/react-query'
import { AuthButton } from '@/components/AuthButton'
import { DatasetPanel } from '@/components/DatasetPanel'
import { EdgeList } from '@/components/EdgeList'
import { EditPanel } from '@/components/EditPanel'
import { ExportPanel } from '@/components/ExportPanel'
import { DatasetHeadline, ProgressSummary } from '@/components/ProgressSummary'
import {
  Sidebar as SidebarNav,
  SidebarBody,
  SidebarDivider,
  SidebarFooter,
  SidebarHeader,
  SidebarSection,
} from '@/components/ui/sidebar'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { Route } from '@/routes/index'
import { loadDataset } from '@/shared/datasets/dataset-idb'

export function AppSidebar() {
  const dataset = Route.useSearch({ select: (search) => search.dataset })
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

  return (
    <SidebarNav className="h-full bg-zinc-900">
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
          <div className="min-w-0">
            <h1 className="text-sm/5 font-semibold tracking-wide text-white">Parkraum-Zählung</h1>
            <DatasetHeadline
              dataset={dataset}
              edges={edgesQuery.data?.collection}
              records={countsQuery.data ?? {}}
            />
          </div>
        </div>
        <ProgressSummary edges={edgesQuery.data?.collection} />
      </SidebarHeader>
      <SidebarBody>
        {dataset ? (
          <>
            <SidebarSection>
              <EditPanel />
            </SidebarSection>
            <SidebarDivider />
            <SidebarSection>
              <EdgeList />
            </SidebarSection>
            <SidebarDivider />
            <SidebarSection>
              <ExportPanel />
            </SidebarSection>
            <SidebarDivider />
            <SidebarSection>
              <DatasetPanel />
            </SidebarSection>
          </>
        ) : (
          <SidebarSection>
            <DatasetPanel />
          </SidebarSection>
        )}
      </SidebarBody>
      <SidebarFooter>
        <AuthButton />
      </SidebarFooter>
    </SidebarNav>
  )
}
