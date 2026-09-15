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
import {
  countPeriods,
  isSideCounted,
  occupancyFor,
  type PeriodOccupancy,
  type SideCount,
} from '@/shared/counts/schema'

const periodColumnLabel = {
  sunday: 'Sonntag',
  midday: 'Mittags',
  evening: 'Abends',
} as const

function formatSide(side: SideCount) {
  return [side.pkw, side.motorrad, side.lkw_bus]
    .map((value) => (value == null ? '·' : String(value)))
    .join(' / ')
}

function formatPeriod(occupancy: PeriodOccupancy) {
  if (!isSideCounted(occupancy.left) && !isSideCounted(occupancy.right)) return '—'
  return `${formatSide(occupancy.left)} · ${formatSide(occupancy.right)}`
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
          <TableHeader>Herkunft</TableHeader>
          {countPeriods.map((period) => (
            <TableHeader key={period}>{periodColumnLabel[period]}</TableHeader>
          ))}
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
              <TableCell className="max-w-40 truncate text-zinc-400" data-testid="admin-col-source">
                {entry.record.source === 'manual' ? 'manuell' : 'importiert'}
                {entry.record.created_by ? ` · ${entry.record.created_by}` : ''}
              </TableCell>
              {countPeriods.map((period) => (
                <TableCell key={period} className="tabular-nums">
                  {formatPeriod(occupancyFor(entry.record, period))}
                </TableCell>
              ))}
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
