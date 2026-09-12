import { useNavigate } from '@tanstack/react-router'
import { useAssignMatch } from '@/components/shared/use-assign-match'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Fieldset } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { SidebarDivider } from '@/components/ui/sidebar'
import { Text } from '@/components/ui/text'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import {
  edgeMatchInputs,
  matchCountsToEdges,
  type CountMatchRow,
} from '@/shared/counts/match-counts'
import type { CountRecord } from '@/shared/counts/schema'
import type { CountingEdgesGeoJSON } from '@/shared/edges/schema'

const statusCopy: Record<CountMatchRow['status'], string> = {
  id: 'per ID',
  midpoint: 'per Mittelpunkt',
  manual: 'manuell',
  none: 'kein Match',
  unresolved: 'offen',
  conflict: 'Konflikt',
}

type Props = {
  dataset: string
  collection: CountingEdgesGeoJSON
  records: Record<string, CountRecord>
}

export function MatchEdgesPanel({ dataset, collection, records }: Props) {
  const navigate = useNavigate({ from: Route.fullPath })
  const { match: selectedId, edge: candidateId } = Route.useSearch()
  const { assign, saveAuto, authenticated } = useAssignMatch(dataset)
  const result = matchCountsToEdges(records, edgeMatchInputs(collection))
  const hasWork =
    result.unresolved.length > 0 || result.writes.length > 0 || result.summary.none > 0
  if (!hasWork) return null

  const selected = result.rows.find((row) => row.originalId === selectedId)

  function selectRow(originalId: string) {
    void navigate({
      search: (previous) => ({ ...previous, match: originalId, edge: undefined, step: 'dataset' }),
      replace: true,
    })
  }

  return (
    <>
      <SidebarDivider />
      <Fieldset data-testid="match-edges-panel">
        <Subheading>Kanten zuordnen</Subheading>
        <Text className="mt-2">
          Per ID: {result.summary.id}. Per Mittelpunkt: {result.summary.midpoint}. Manuell:{' '}
          {result.summary.manual}. Offen: {result.summary.unresolved}. Konflikt:{' '}
          {result.summary.conflict}. Kein Match: {result.summary.none}.
        </Text>
        {!authenticated ? <Callout className="mt-3">{osmLoginRequiredMessage}</Callout> : null}
        {assign.isError ? (
          <Callout className="mt-3" tone="error">
            {assign.error instanceof Error ? assign.error.message : 'Zuordnung fehlgeschlagen'}
          </Callout>
        ) : null}
        {result.writes.length > 0 ? (
          <Button
            type="button"
            color="sky"
            className="mt-3"
            data-testid="save-auto-matches"
            disabled={!authenticated || saveAuto.isPending}
            onClick={() => saveAuto.mutate(result.writes)}
          >
            Automatische Treffer speichern ({result.writes.length})
          </Button>
        ) : null}
        <ul className="mt-3 space-y-1">
          {result.unresolved.map((row) => {
            const selectedRow = row.originalId === selectedId
            return (
              <li key={row.originalId}>
                <button
                  type="button"
                  data-testid={`match-row-${row.originalId}`}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left text-sm/6',
                    selectedRow ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5',
                  )}
                  onClick={() => selectRow(row.originalId)}
                >
                  <span className="font-semibold break-all">{row.originalId}</span>
                  <span className="ml-2 text-xs text-zinc-400">{statusCopy[row.status]}</span>
                  <span className="mt-0.5 block text-xs/5 text-zinc-400">
                    {row.candidates.length === 0
                      ? 'Kein Kandidat im Umkreis von 8 m.'
                      : row.candidates
                          .map(
                            (candidate) =>
                              `${candidate.id}${candidate.name ? ` (${candidate.name})` : ''} · ${candidate.distanceM.toFixed(1)} m`,
                          )
                          .join(' · ')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {selected ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.candidates.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                outline
                data-testid={`match-assign-${candidate.id}`}
                disabled={!authenticated || assign.isPending}
                onClick={() =>
                  assign.mutate({
                    originalId: selected.originalId,
                    matchId: candidate.id,
                    status: 'manual',
                  })
                }
              >
                {candidate.id} zuordnen
              </Button>
            ))}
            {candidateId &&
            !selected.candidates.some((candidate) => candidate.id === candidateId) ? (
              <Button
                type="button"
                outline
                disabled={!authenticated || assign.isPending}
                onClick={() =>
                  assign.mutate({
                    originalId: selected.originalId,
                    matchId: candidateId,
                    status: 'manual',
                  })
                }
              >
                {candidateId} zuordnen
              </Button>
            ) : null}
            <Button
              type="button"
              outline
              data-testid="match-none"
              disabled={!authenticated || assign.isPending}
              onClick={() =>
                assign.mutate({
                  originalId: selected.originalId,
                  matchId: '',
                  status: 'none',
                })
              }
            >
              Kein Match
            </Button>
          </div>
        ) : null}
        {result.unresolved.length === 0 ? (
          <Button
            type="button"
            color="sky"
            className="mt-4"
            data-testid="match-continue-count"
            onClick={() =>
              void navigate({
                search: (previous) => ({
                  ...previous,
                  step: 'count',
                  match: undefined,
                }),
                replace: true,
              })
            }
          >
            Weiter zum Zählen
          </Button>
        ) : null}
      </Fieldset>
    </>
  )
}

export function stayOnDatasetAfterMatch(
  unresolvedCount: number,
  pendingWrites: number,
  authenticated: boolean,
) {
  return unresolvedCount > 0 || (!authenticated && pendingWrites > 0)
}
