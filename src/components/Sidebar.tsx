import { DatasetPanel } from '@/components/DatasetPanel'
import { EdgeList } from '@/components/EdgeList'
import { EditPanel } from '@/components/EditPanel'
import { ExportPanel } from '@/components/ExportPanel'

export function Sidebar() {
  return (
    <aside className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-800 bg-slate-900 p-4">
      <DatasetPanel />
      <ExportPanel />
      <EditPanel />
      <EdgeList />
    </aside>
  )
}
