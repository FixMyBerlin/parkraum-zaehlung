import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Callout } from '@/components/ui/callout'
import { Field, Label } from '@/components/ui/fieldset'
import { Heading, Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Text } from '@/components/ui/text'
import { AdminCountForm } from '@/features/admin/AdminCountForm'
import { AdminCountsTable } from '@/features/admin/AdminCountsTable'
import {
  allCountsQueryKey,
  countStore,
  datasetSummariesQueryKey,
} from '@/features/counts/counts-query'
import type { CountStoreEntry } from '@/shared/counts/count-store'

function matchesQuery(entry: CountStoreEntry, q: string) {
  const haystack = [
    entry.dataset,
    entry.edgeId,
    entry.record.note ?? '',
    entry.record.updated_by ?? '',
    entry.record.match_id,
    entry.record.match_status,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q.toLowerCase())
}

export function AdminCountsPage() {
  const navigate = useNavigate({ from: '/data' })
  const { dataset, edge, q } = useSearch({ from: '/data' })

  const entriesQuery = useQuery({
    queryKey: allCountsQueryKey,
    queryFn: () => countStore.listAll(),
  })
  const summariesQuery = useQuery({
    queryKey: datasetSummariesQueryKey,
    queryFn: () => countStore.listDatasetSummaries(),
  })

  const entries = entriesQuery.data ?? []
  const filtered = entries.filter((entry) => {
    if (dataset && entry.dataset !== dataset) return false
    if (q && !matchesQuery(entry, q)) return false
    return true
  })
  const selected =
    dataset && edge
      ? (filtered.find((entry) => entry.dataset === dataset && entry.edgeId === edge) ??
        entries.find((entry) => entry.dataset === dataset && entry.edgeId === edge))
      : undefined

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-4 py-6 lg:flex-row lg:px-8">
      <div className="min-w-0 flex-1">
        <Heading>Zähl-Datenbank</Heading>
        <Text className="mt-2">
          Alle Zählungen in der gemeinsamen Datenbank. Keine Kanten-Datei nötig.
        </Text>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <Field className="min-w-48">
            <Label>Projekt</Label>
            <Select
              value={dataset ?? ''}
              aria-label="Projekt filtern"
              onChange={(event) => {
                const value = event.currentTarget.value || undefined
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    dataset: value,
                    edge: previous.dataset === value ? previous.edge : undefined,
                  }),
                  replace: true,
                })
              }}
            >
              <option value="">Alle Projekte</option>
              {(summariesQuery.data ?? []).map((row) => (
                <option key={row.dataset} value={row.dataset}>
                  {row.dataset} ({row.entryCount})
                </option>
              ))}
            </Select>
          </Field>
          <Field className="min-w-64 flex-1">
            <Label>Suche</Label>
            <Input
              value={q ?? ''}
              placeholder="Kante, Notiz, Autor…"
              aria-label="Zählungen durchsuchen"
              onChange={(event) => {
                const value = event.currentTarget.value.trim() || undefined
                void navigate({
                  search: (previous) => ({ ...previous, q: value }),
                  replace: true,
                })
              }}
            />
          </Field>
        </div>

        {entriesQuery.isError ? (
          <Callout className="mt-4" tone="error" title="Laden fehlgeschlagen">
            {entriesQuery.error instanceof Error
              ? entriesQuery.error.message
              : 'Zählungen konnten nicht geladen werden.'}
          </Callout>
        ) : null}

        {entriesQuery.isPending ? (
          <Text className="mt-6">Lade Zählungen…</Text>
        ) : filtered.length === 0 ? (
          <Text className="mt-6">Keine Zählungen in dieser Auswahl.</Text>
        ) : (
          <AdminCountsTable
            entries={filtered}
            selected={dataset && edge ? { dataset, edge } : undefined}
            onSelect={(entry) => {
              void navigate({
                search: (previous) => ({
                  ...previous,
                  dataset: entry.dataset,
                  edge: entry.edgeId,
                }),
                replace: true,
              })
            }}
          />
        )}
      </div>

      <aside className="w-full shrink-0 lg:w-96">
        <div className="rounded-lg p-4 ring-1 ring-white/10 lg:sticky lg:top-4">
          {selected ? (
            <AdminCountForm entry={selected} />
          ) : (
            <>
              <Subheading>Keine Zeile gewählt</Subheading>
              <Text className="mt-2">
                Eine Zählung in der Tabelle anklicken, um sie zu bearbeiten.
              </Text>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
