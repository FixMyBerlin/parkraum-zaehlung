import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/shared/cn'
import type { CountStoreEntry } from '@/shared/counts/count-store'

function formatSide(side: CountStoreEntry['record']['left']) {
  if (side.pkw == null && side.motorrad == null && side.lkw_bus == null) return '—'
  return [side.pkw, side.motorrad, side.lkw_bus]
    .map((value) => (value == null ? '·' : String(value)))
    .join(' / ')
}

type Props = {
  entries: CountStoreEntry[]
  selected?: { dataset: string; edge: string }
  onSelect: (entry: CountStoreEntry) => void
}

export function AdminCountsTable({ entries, selected, onSelect }: Props) {
  return (
    <Table
      className="mt-4 [--gutter:--spacing(4)] lg:[--gutter:--spacing(6)]"
      dense
      striped
      data-testid="admin-counts-table"
    >
      <TableHead>
        <TableRow>
          <TableHeader>Projekt</TableHeader>
          <TableHeader>Kante</TableHeader>
          <TableHeader data-testid="admin-col-match">Zuordnung</TableHeader>
          <TableHeader>Links Pkw / Motorrad / Lkw</TableHeader>
          <TableHeader>Rechts Pkw / Motorrad / Lkw</TableHeader>
          <TableHeader>Notiz</TableHeader>
          <TableHeader>Von</TableHeader>
          <TableHeader>Aktualisiert</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => {
          const isSelected = selected?.dataset === entry.dataset && selected.edge === entry.edgeId
          return (
            <TableRow
              key={`${entry.dataset}/${entry.edgeId}`}
              className={cn(
                'cursor-pointer hover:bg-white/5',
                isSelected && 'bg-sky-500/15 hover:bg-sky-500/20',
              )}
              data-testid={`admin-row-${entry.dataset}-${entry.edgeId}`}
              onClick={() => onSelect(entry)}
            >
              <TableCell className="font-medium">{entry.dataset}</TableCell>
              <TableCell className="max-w-48 truncate text-zinc-400">{entry.edgeId}</TableCell>
              <TableCell className="max-w-40 truncate text-zinc-400">
                {entry.record.match_status}
                {entry.record.match_id ? ` → ${entry.record.match_id}` : ''}
              </TableCell>
              <TableCell className="tabular-nums">{formatSide(entry.record.left)}</TableCell>
              <TableCell className="tabular-nums">{formatSide(entry.record.right)}</TableCell>
              <TableCell className="max-w-40 truncate text-zinc-400">
                {entry.record.note ?? '—'}
              </TableCell>
              <TableCell className="text-zinc-400">{entry.record.updated_by ?? '—'}</TableCell>
              <TableCell className="text-zinc-400">
                {entry.record.updated_at.replace('T', ' ').slice(0, 19)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
