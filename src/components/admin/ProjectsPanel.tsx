import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useOsmAuth } from '@/components/shared/use-osm-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Text } from '@/components/ui/text'
import { isSuperAdmin } from '@/config/super-admins.const'
import type { RawCountEntry } from '@/shared/counts/count-store'
import {
  allCountsQueryKey,
  countsQueryKey,
  countStore,
  datasetSummariesQueryKey,
  projectMetaQueryKey,
} from '@/shared/counts/counts-query'
import {
  deleteAllRawEntries,
  removeRawEntries,
  renameKvDataset,
} from '@/shared/counts/dataset-admin'
import { deleteDataset, listDatasets, renameDataset } from '@/shared/datasets/dataset-idb'
import { isValidDatasetName } from '@/shared/edges/schema'
import { ignorePasswordManagerProps } from '@/shared/form-ignore-password-manager'

const rawEntriesQueryKey = (dataset: string) => ['raw-count-entries', dataset] as const

type ProjectRow = {
  dataset: string
  totalCount: number
  validCount: number
  invalidCount: number
  hasLocalEdges: boolean
}

async function invalidateProjectQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  names: string[],
) {
  await queryClient.invalidateQueries({ queryKey: ['datasets'] })
  await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
  await queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
  await queryClient.invalidateQueries({ queryKey: projectMetaQueryKey })
  for (const name of names) {
    await queryClient.invalidateQueries({ queryKey: ['dataset', name] })
    await queryClient.invalidateQueries({ queryKey: countsQueryKey(name) })
    await queryClient.invalidateQueries({ queryKey: rawEntriesQueryKey(name) })
  }
}

function InvalidEntriesList({ dataset, entries }: { dataset: string; entries: RawCountEntry[] }) {
  const queryClient = useQueryClient()
  const removeOne = useMutation({
    mutationFn: (edgeId: string) => removeRawEntries(countStore, dataset, [edgeId]),
    onSuccess: () => invalidateProjectQueries(queryClient, [dataset]),
  })
  const removeAll = useMutation({
    mutationFn: () =>
      removeRawEntries(
        countStore,
        dataset,
        entries.map((entry) => entry.edgeId),
      ),
    onSuccess: () => invalidateProjectQueries(queryClient, [dataset]),
  })

  if (entries.length === 0) {
    return <Text className="text-zinc-400">Keine ungültigen Einträge.</Text>
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-2 text-xs text-zinc-400"
            data-testid={`project-invalid-entry-${dataset}-${entry.edgeId}`}
          >
            <span className="truncate">{entry.edgeId}</span>
            <Button
              plain
              type="button"
              data-testid={`project-invalid-remove-${dataset}-${entry.edgeId}`}
              onClick={() => removeOne.mutate(entry.edgeId)}
            >
              Löschen
            </Button>
          </li>
        ))}
      </ul>
      <Button
        outline
        type="button"
        data-testid={`project-invalid-remove-all-${dataset}`}
        onClick={() => removeAll.mutate()}
      >
        Alle {entries.length} ungültigen Einträge löschen
      </Button>
    </div>
  )
}

function ProjectRowView({
  row,
  allDatasetNames,
  canWriteCounts,
  isDeleteAllowed,
  onRenamed,
}: {
  row: ProjectRow
  allDatasetNames: string[]
  canWriteCounts: boolean
  isDeleteAllowed: boolean
  onRenamed: (oldName: string, newName: string) => void
}) {
  const queryClient = useQueryClient()
  const [showInvalid, setShowInvalid] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(row.dataset)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const rawEntriesQuery = useQuery({
    queryKey: rawEntriesQueryKey(row.dataset),
    queryFn: () => countStore.listRawEntries(row.dataset),
    enabled: showInvalid,
  })
  const invalidEntries = (rawEntriesQuery.data ?? []).filter((entry) => !entry.valid)

  const removeLocalEdges = useMutation({
    mutationFn: () => deleteDataset(row.dataset),
    onSuccess: () => invalidateProjectQueries(queryClient, [row.dataset]),
  })

  const renameMutation = useMutation({
    mutationFn: async (targetName: string) => {
      const outcome = await renameKvDataset(countStore, row.dataset, targetName)
      if (outcome.remainingInvalid > 0) {
        const drop = window.confirm(
          `${outcome.remainingInvalid} ungültige Einträge unter „${row.dataset}“ wurden nicht migriert (sie lassen sich nicht automatisch zuordnen). Diese jetzt löschen?`,
        )
        if (drop) {
          const remaining = await countStore.listRawEntries(row.dataset)
          await removeRawEntries(
            countStore,
            row.dataset,
            remaining.map((entry) => entry.edgeId),
          )
        }
      }
      if (row.hasLocalEdges) await renameDataset(row.dataset, targetName)
      return outcome
    },
    onSuccess: async (outcome, targetName) => {
      await invalidateProjectQueries(queryClient, [row.dataset, targetName])
      setRenaming(false)
      setRenameError(null)
      onRenamed(row.dataset, targetName)
      if (outcome.failed.length > 0) {
        window.alert(
          `${outcome.migrated} Einträge verschoben, ${outcome.failed.length} fehlgeschlagen. „Umbenennen“ erneut ausführen, um die restlichen zu übernehmen.`,
        )
      }
    },
    onError: (error: unknown) => {
      setRenameError(error instanceof Error ? error.message : 'Umbenennen fehlgeschlagen')
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const outcome = await deleteAllRawEntries(countStore, row.dataset)
      if (row.hasLocalEdges) await deleteDataset(row.dataset)
      return outcome
    },
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, [row.dataset])
      setDeleting(false)
      setDeleteConfirmText('')
    },
  })

  function submitRename() {
    const trimmed = newName.trim().toLowerCase()
    if (trimmed === row.dataset) {
      setRenaming(false)
      return
    }
    if (!isValidDatasetName(trimmed)) {
      setRenameError(
        'Projektname: 3–60 Zeichen, nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. loerrach).',
      )
      return
    }
    if (allDatasetNames.includes(trimmed)) {
      setRenameError(`Projekt „${trimmed}“ existiert bereits.`)
      return
    }
    renameMutation.mutate(trimmed)
  }

  return (
    <>
      <TableRow data-testid={`project-row-${row.dataset}`}>
        <TableCell className="font-medium">{row.dataset}</TableCell>
        <TableCell>
          <Badge color={row.invalidCount > 0 ? 'amber' : 'green'}>
            {row.validCount}/{row.totalCount} gültig
          </Badge>
        </TableCell>
        <TableCell>
          <Badge color={row.hasLocalEdges ? 'sky' : 'zinc'}>
            {row.hasLocalEdges ? 'Kanten lokal' : 'keine lokalen Kanten'}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            {row.invalidCount > 0 ? (
              <Button
                plain
                type="button"
                data-testid={`project-show-invalid-${row.dataset}`}
                onClick={() => setShowInvalid((open) => !open)}
              >
                {showInvalid ? 'Ungültige verbergen' : `${row.invalidCount} ungültige anzeigen`}
              </Button>
            ) : null}
            {canWriteCounts ? (
              <Button
                plain
                type="button"
                data-testid={`project-rename-button-${row.dataset}`}
                onClick={() => {
                  setNewName(row.dataset)
                  setRenameError(null)
                  setRenaming((open) => !open)
                }}
              >
                Umbenennen
              </Button>
            ) : null}
            {row.hasLocalEdges ? (
              <Button
                plain
                type="button"
                data-testid={`project-remove-local-edges-${row.dataset}`}
                onClick={() => {
                  if (
                    window.confirm(`Lokale Kanten für „${row.dataset}“ in diesem Browser löschen?`)
                  )
                    removeLocalEdges.mutate()
                }}
              >
                Lokale Kanten entfernen
              </Button>
            ) : null}
            <Button
              plain
              type="button"
              data-testid={`project-delete-button-${row.dataset}`}
              disabled={!isDeleteAllowed}
              title={
                isDeleteAllowed
                  ? undefined
                  : 'Nur Super-Admins können ein Projekt vollständig löschen.'
              }
              onClick={() => {
                setDeleteConfirmText('')
                setDeleting((open) => !open)
              }}
            >
              Projekt löschen
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {showInvalid ? (
        <TableRow data-testid={`project-invalid-list-${row.dataset}`}>
          <TableCell colSpan={4}>
            {rawEntriesQuery.isPending ? (
              <Text>Lade ungültige Einträge…</Text>
            ) : (
              <InvalidEntriesList dataset={row.dataset} entries={invalidEntries} />
            )}
          </TableCell>
        </TableRow>
      ) : null}

      {renaming ? (
        <TableRow>
          <TableCell colSpan={4}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.currentTarget.value)}
                data-testid={`project-rename-input-${row.dataset}`}
                {...ignorePasswordManagerProps}
                className="max-w-64"
              />
              <Button
                type="button"
                color="sky"
                data-testid={`project-rename-confirm-${row.dataset}`}
                disabled={renameMutation.isPending}
                onClick={submitRename}
              >
                Umbenennen bestätigen
              </Button>
              <Button plain type="button" onClick={() => setRenaming(false)}>
                Abbrechen
              </Button>
            </div>
            {renameError ? (
              <Callout className="mt-2" tone="error">
                {renameError}
              </Callout>
            ) : null}
          </TableCell>
        </TableRow>
      ) : null}

      {deleting ? (
        <TableRow>
          <TableCell colSpan={4}>
            <Callout tone="warning" title="Projekt vollständig löschen">
              Entfernt alle {row.totalCount} Einträge (gültig und ungültig) aus der Zähl-Datenbank
              {row.hasLocalEdges ? ' sowie die lokalen Kanten in diesem Browser' : ''}. Das kann
              nicht rückgängig gemacht werden. Zum Bestätigen den Projektnamen eingeben.
            </Callout>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.currentTarget.value)}
                placeholder={row.dataset}
                data-testid={`project-delete-confirm-input-${row.dataset}`}
                {...ignorePasswordManagerProps}
                className="max-w-64"
              />
              <Button
                type="button"
                color="red"
                data-testid={`project-delete-confirm-button-${row.dataset}`}
                disabled={deleteConfirmText !== row.dataset || deleteAllMutation.isPending}
                onClick={() => deleteAllMutation.mutate()}
              >
                Endgültig löschen
              </Button>
              <Button plain type="button" onClick={() => setDeleting(false)}>
                Abbrechen
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

export function ProjectsPanel() {
  const auth = useOsmAuth()
  const navigate = useNavigate({ from: '/data' })
  const { dataset: currentDataset } = useSearch({ from: '/data' })

  const localDatasetsQuery = useQuery({ queryKey: ['datasets'], queryFn: listDatasets })
  const summariesQuery = useQuery({
    queryKey: datasetSummariesQueryKey,
    queryFn: () => countStore.listDatasetSummaries(),
  })
  const projectMetaQuery = useQuery({
    queryKey: projectMetaQueryKey,
    queryFn: () => countStore.listProjectMeta(),
  })
  const localDatasets = localDatasetsQuery.data ?? []
  const summaries = summariesQuery.data ?? []
  const metaOnlyDatasets = (projectMetaQuery.data ?? []).map((meta) => meta.dataset)
  const allDatasetNames = [
    ...new Set([
      ...localDatasets.map((item) => item.dataset),
      ...summaries.map((s) => s.dataset),
      ...metaOnlyDatasets,
    ]),
  ].sort((a, b) => a.localeCompare(b))

  const validCountQueries = useQueries({
    queries: allDatasetNames.map((name) => ({
      queryKey: countsQueryKey(name),
      queryFn: () => countStore.list(name),
    })),
  })

  const rows: ProjectRow[] = allDatasetNames.map((name, index) => {
    const totalCount = summaries.find((s) => s.dataset === name)?.entryCount ?? 0
    const validCount = Object.keys(validCountQueries[index]?.data ?? {}).length
    return {
      dataset: name,
      totalCount,
      validCount,
      invalidCount: Math.max(0, totalCount - validCount),
      hasLocalEdges: localDatasets.some((item) => item.dataset === name),
    }
  })

  // Any authenticated user with write access may rename or clean up invalid entries;
  // the KV server enforces write access on every call regardless of this UI gate.
  const canWriteCounts = Boolean(auth.authenticated && auth.canWrite)
  // UI-only guard on top of write access — see `isSuperAdmin`'s doc comment.
  const isDeleteAllowed = Boolean(auth.authenticated && isSuperAdmin(auth.displayName))

  function handleRenamed(oldName: string, newName: string) {
    if (currentDataset === oldName) {
      void navigate({ search: (previous) => ({ ...previous, dataset: newName }), replace: true })
    }
  }

  return (
    <section className="mt-8">
      <Subheading>Projekte</Subheading>
      <Text className="mt-1">
        Alle Projekte aus der Zähl-Datenbank und diesem Browser. Umbenennen und Aufräumen ungültiger
        Einträge stehen jedem angemeldeten Benutzer mit Schreibrechten offen; das vollständige
        Löschen eines Projekts ist Super-Admins vorbehalten.
      </Text>
      {!auth.authenticated ? (
        <Callout className="mt-3">
          Zum Umbenennen oder Aufräumen von Projekten mit OSM anmelden.
        </Callout>
      ) : null}
      {rows.length === 0 ? (
        <Text className="mt-4">Noch kein Projekt.</Text>
      ) : (
        <Table
          className="mt-4 [--gutter:--spacing(4)] lg:[--gutter:--spacing(6)]"
          dense
          striped
          data-testid="projects-table"
        >
          <TableHead>
            <TableRow>
              <TableHeader>Projekt</TableHeader>
              <TableHeader>Einträge</TableHeader>
              <TableHeader>Kanten</TableHeader>
              <TableHeader>Aktionen</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <ProjectRowView
                key={row.dataset}
                row={row}
                allDatasetNames={allDatasetNames.filter((name) => name !== row.dataset)}
                canWriteCounts={canWriteCounts}
                isDeleteAllowed={isDeleteAllowed}
                onRenamed={handleRenamed}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
