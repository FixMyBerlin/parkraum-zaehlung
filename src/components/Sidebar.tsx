import { DatasetPanel } from '@/components/DatasetPanel'
import { EdgeList } from '@/components/EdgeList'
import { EditPanel } from '@/components/EditPanel'
import { ExportPanel } from '@/components/ExportPanel'
import { ProgressSummary } from '@/components/ProgressSummary'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import {
  Sidebar as SidebarNav,
  SidebarBody,
  SidebarDivider,
  SidebarSection,
} from '@/components/ui/sidebar'
import { useAppStepNav } from '@/features/layout/use-app-step-nav'

export function AppSidebar() {
  const { dataset, current, edges, remoteCount, hasLocalEdges, goToStep } = useAppStepNav()

  return (
    <SidebarNav className="h-full bg-zinc-900">
      <SidebarBody>
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
