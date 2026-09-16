import { InformationCircleIcon, PlusIcon } from '@heroicons/react/20/solid'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useState } from 'react'
import { MatchEdgesPanel, stayOnDatasetAfterMatch } from '@/components/MatchEdgesPanel'
import { MotionCollapse } from '@/components/shared/motion/MotionCollapse'
import { persistMatchWrites } from '@/components/shared/use-assign-match'
import { useOsmAuth } from '@/components/shared/use-osm-auth'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Fieldset, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { SidebarDivider } from '@/components/ui/sidebar'
import { Code, Text, TextLink } from '@/components/ui/text'
import { sampleEdgesGithubUrl, sampleEdgesRemapUrl } from '@/config/app.const'
import { Route } from '@/routes/index'
import {
  countStore,
  countsQueryKey,
  datasetSummariesQueryKey,
  projectMetaQueryKey,
} from '@/shared/counts/counts-query'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import { edgeMatchInputs, matchCountsToEdges } from '@/shared/counts/match-counts'
import type { CountRecord } from '@/shared/counts/schema'
import { listDatasets, loadDataset, saveDataset } from '@/shared/datasets/dataset-idb'
import { buildDatasetInventory, datasetInventoryCopy } from '@/shared/datasets/inventory'
import { parseEdgesText } from '@/shared/edges/parse-edges'
import { isValidDatasetName, type CountingEdgesGeoJSON } from '@/shared/edges/schema'
import { ignorePasswordManagerProps } from '@/shared/form-ignore-password-manager'

const filePickerLabelClassName =
  'relative isolate inline-flex cursor-pointer items-baseline justify-center rounded-lg border border-zinc-950/10 px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 font-semibold text-zinc-950 hover:bg-zinc-950/2.5 dark:border-white/15 dark:text-white dark:hover:bg-white/5'

const infoIconButtonClassName =
  'rounded-full text-zinc-400 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

const projectNameHelp =
  'Der Projektname ist der Schlüssel für alle Zählungen dieses Kartierprojekts und kann später nicht geändert werden. Empfehlung: ein kurzer Slug ohne Datum, z. B. loerrach. Gleicher Name = gleiches Projekt, auch wenn du die Kanten später neu hochlädst.'

const invalidProjectNameMessage =
  'Projektname: 3–60 Zeichen, nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. loerrach).'

async function matchAfterEdgesLoaded(
  name: string,
  collection: CountingEdgesGeoJSON,
  authenticated: boolean,
) {
  try {
    const records = await countStore.list(name)
    const result = matchCountsToEdges(records, edgeMatchInputs(collection))
    if (authenticated) {
      try {
        await persistMatchWrites(name, result.writes)
      } catch {
        // Keep the review UI even if auto-writes could not be stored yet.
      }
    }
    const stay = stayOnDatasetAfterMatch(
      result.unresolved.length,
      result.writes.length,
      authenticated,
    )
    return {
      stay,
      match: stay ? result.unresolved[0]?.originalId : undefined,
    }
  } catch {
    return { stay: false as const, match: undefined }
  }
}

export function DatasetPanel() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const dataset = Route.useSearch({ select: (search) => search.dataset })
  const datasetsQuery = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  })
  const summariesQuery = useQuery({
    queryKey: datasetSummariesQueryKey,
    queryFn: () => countStore.listDatasetSummaries(),
  })
  const projectMetaQuery = useQuery({
    queryKey: projectMetaQueryKey,
    queryFn: () => countStore.listProjectMeta(),
  })
  const localDatasets = datasetsQuery.data ?? []
  const countQueries = useQueries({
    queries: localDatasets.map((item) => ({
      queryKey: countsQueryKey(item.dataset),
      queryFn: () => countStore.list(item.dataset),
    })),
  })
  const countsByDataset: Record<string, Record<string, CountRecord>> = {}
  for (const [index, item] of localDatasets.entries()) {
    const data = countQueries[index]?.data
    if (data) countsByDataset[item.dataset] = data
  }
  const metaOnlyDatasets = (projectMetaQuery.data ?? []).map((meta) => meta.dataset)
  const inventory = buildDatasetInventory(
    localDatasets,
    summariesQuery.data ?? [],
    countsByDataset,
    metaOnlyDatasets,
  )
  const selectedRow = inventory.find((row) => row.dataset === dataset)
  const selectedStored = localDatasets.find((item) => item.dataset === dataset)

  const auth = useOsmAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectNameHelpOpen, setProjectNameHelpOpen] = useState(false)
  const [importHelpOpen, setImportHelpOpen] = useState(false)

  const { mutate: createProject, isPending: createPending } = useMutation({
    mutationFn: async (name: string) => {
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      if (!isValidDatasetName(name)) throw new Error(invalidProjectNameMessage)
      if (inventory.some((row) => row.dataset === name)) {
        throw new Error(`Projekt „${name}“ existiert bereits.`)
      }
      await countStore.putProjectMeta(name, {
        createdAt: new Date().toISOString(),
        createdBy: auth.displayName,
      })
      return name
    },
    onSuccess: async (name) => {
      setCreateOpen(false)
      setNewProjectName('')
      setCreateError(null)
      await queryClient.invalidateQueries({ queryKey: projectMetaQueryKey })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
      // No local edges yet: select the new project and stay on this step.
      await navigate({
        search: (previous) => ({
          ...previous,
          dataset: name,
          edge: undefined,
          match: undefined,
          step: 'dataset',
        }),
        replace: true,
      })
    },
    onError: (caught: unknown) => {
      setCreateError(caught instanceof Error ? caught.message : 'Anlegen fehlgeschlagen')
    },
  })

  const { mutate: importEdges, isPending: importPending } = useMutation({
    mutationFn: async ({ text, name }: { text: string; name: string }) => {
      const parsed = parseEdgesText(text, name)
      const stored = await saveDataset(parsed.collection, name)
      const matched = await matchAfterEdgesLoaded(name, parsed.collection, auth.authenticated)
      return { stored, matched }
    },
    onSuccess: async ({ stored, matched }) => {
      setError(null)
      setPendingText(null)
      await queryClient.invalidateQueries({ queryKey: ['datasets'] })
      await queryClient.invalidateQueries({ queryKey: ['dataset', stored.dataset] })
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(stored.dataset) })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
      await navigate({
        search: (previous) => ({
          ...previous,
          dataset: stored.dataset,
          edge: undefined,
          match: matched.match,
          step: matched.stay ? 'dataset' : 'count',
        }),
        replace: true,
      })
    },
    onError: (caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Import fehlgeschlagen')
    },
  })

  function stageFileText(text: string) {
    if (!dataset) return
    try {
      // Validate only — the mutation re-parses at import time. The selected project's
      // name always wins over anything the file names itself (see `importEdges` below).
      parseEdgesText(text, dataset)
      setPendingText(text)
      setError(null)
    } catch (caught: unknown) {
      setPendingText(null)
      setError(caught instanceof Error ? caught.message : 'Import fehlgeschlagen')
    }
  }

  async function importFromFile(file: File) {
    stageFileText(await file.text())
  }

  function selectRemoteOnlyProject(name: string) {
    void navigate({
      search: (previous) => ({
        ...previous,
        dataset: name,
        edge: undefined,
        match: undefined,
        step: 'dataset',
      }),
      replace: true,
    })
  }

  const importHeadline = !dataset
    ? 'Kanten importieren'
    : selectedRow?.local
      ? `Kanten überschreiben für ${dataset}`
      : `Kanten importieren für ${dataset}`

  return (
    <section>
      <Fieldset>
        <div className="flex items-center justify-between gap-2">
          <Subheading>Projekt auswählen</Subheading>
          <Button
            outline
            type="button"
            aria-label="Neues Projekt anlegen"
            aria-expanded={createOpen}
            aria-controls="create-project-panel"
            data-testid="create-project-toggle"
            onClick={() => setCreateOpen((open) => !open)}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <MotionCollapse open={createOpen}>
          <div id="create-project-panel" className="mt-3">
            {!auth.authenticated ? (
              <Callout>Zum Anlegen eines Projekts mit OSM anmelden.</Callout>
            ) : (
              <Field>
                <div className="flex items-center gap-1.5">
                  <Label>Projektname</Label>
                  <button
                    type="button"
                    className={infoIconButtonClassName}
                    aria-expanded={projectNameHelpOpen}
                    aria-controls="project-name-help"
                    aria-label="Erklärung zum Projektnamen"
                    onClick={() => setProjectNameHelpOpen((open) => !open)}
                  >
                    <InformationCircleIcon className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <MotionCollapse open={projectNameHelpOpen}>
                  <div id="project-name-help" className="pt-2">
                    <Text>{projectNameHelp}</Text>
                  </div>
                </MotionCollapse>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    value={newProjectName}
                    onChange={(event) =>
                      setNewProjectName(event.currentTarget.value.trim().toLowerCase())
                    }
                    placeholder="loerrach"
                    data-testid="dataset-name-input"
                    {...ignorePasswordManagerProps}
                    className="max-w-64"
                  />
                  <Button
                    type="button"
                    color="sky"
                    data-testid="create-project"
                    disabled={!newProjectName || createPending}
                    onClick={() => createProject(newProjectName)}
                  >
                    Anlegen
                  </Button>
                </div>
                {createError ? (
                  <Callout className="mt-2" tone="error">
                    {createError}
                  </Callout>
                ) : null}
              </Field>
            )}
          </div>
        </MotionCollapse>

        {dataset && selectedRow && !selectedRow.local ? (
          <Callout className="mt-3" title="Nur in der Zähl-Datenbank">
            {selectedRow.remoteEntryCount} Zählungen unter {dataset}. Kanten importieren, um zu
            zählen: Eine Kanten-Datei mit dem Projektnamen „{dataset}“ verknüpft sie mit diesen
            Zählungen. Export ist im Schritt Export.
          </Callout>
        ) : null}
        {inventory.length > 0 ? (
          <ul className="mt-3 space-y-1" data-testid="dataset-inventory">
            {inventory.map((row) => {
              const selected = row.dataset === dataset
              return (
                <li key={row.dataset}>
                  <button
                    type="button"
                    data-testid={`dataset-row-${row.dataset}`}
                    className={clsx(
                      'w-full rounded-lg px-3 py-2 text-left text-sm/6',
                      selected
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white',
                    )}
                    onClick={() => {
                      void (async () => {
                        const stored = await loadDataset(row.dataset)
                        if (!stored) {
                          selectRemoteOnlyProject(row.dataset)
                          return
                        }
                        const matched = await matchAfterEdgesLoaded(
                          row.dataset,
                          stored.collection,
                          auth.authenticated,
                        )
                        await queryClient.invalidateQueries({
                          queryKey: countsQueryKey(row.dataset),
                        })
                        await navigate({
                          search: (previous) => ({
                            ...previous,
                            dataset: row.dataset,
                            edge: undefined,
                            match: matched.match,
                            step: matched.stay ? 'dataset' : 'count',
                          }),
                          replace: true,
                        })
                      })()
                    }}
                  >
                    <span className="font-semibold">{row.dataset}</span>
                    <span className="ml-2 text-xs text-zinc-400">
                      {row.local
                        ? `Kanten importiert (${row.localEdgeCount})`
                        : 'Keine Kanten in diesem Browser — auswählen und Kanten importieren'}
                    </span>
                    <span className="mt-0.5 block text-xs/5 text-zinc-400">
                      {datasetInventoryCopy(row)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <Text className="mt-3">Noch kein Projekt. Mit + oben ein neues Projekt anlegen.</Text>
        )}
      </Fieldset>
      {dataset && selectedStored ? (
        <MatchEdgesPanel
          dataset={dataset}
          collection={selectedStored.collection}
          records={countsByDataset[dataset] ?? {}}
        />
      ) : null}
      <SidebarDivider />
      <Fieldset>
        <div className="flex items-center gap-1.5">
          <Subheading>{importHeadline}</Subheading>
          <button
            type="button"
            className={infoIconButtonClassName}
            aria-expanded={importHelpOpen}
            aria-controls="import-help"
            aria-label="Hinweise zum Kantenimport"
            onClick={() => setImportHelpOpen((open) => !open)}
          >
            <InformationCircleIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
        <MotionCollapse open={importHelpOpen}>
          <div id="import-help" className="space-y-2 pt-2">
            <Text>
              Kanten bleiben in diesem Browser. Zählungen liegen in der gemeinsamen Zähl-Datenbank.
              Sie gehören über den Projektnamen und die Kanten-IDs zusammen.
            </Text>
            <Text>
              Die App lädt die Kanten nicht auf einen Server. Bewahre die Kanten-Datei auf, damit du
              oder andere die Zählungen später wieder den Kanten zuordnen können. Der GeoJSON-Export
              enthält die Kanten und kann wieder importiert werden.
            </Text>
            <Text>
              Die Kanten kommen aus TILDA: Region → Export → Straßenkanten (
              <Code>parkings_edges</Code>) als GeoJSON-FeatureCollection (v1).
            </Text>
            <Text>
              <TextLink href={sampleEdgesGithubUrl} target="_blank" rel="noreferrer">
                Testdaten herunterladen (dann hochladen)
              </TextLink>
            </Text>
            <Text>
              Nach dem Zählen dieselbe Kampagne neu zuordnen:{' '}
              <TextLink href={sampleEdgesRemapUrl} target="_blank" rel="noreferrer">
                Testdaten zum Neu-Zuordnen herunterladen
              </TextLink>
              . Gleicher Projektname. Fälle: gleiche ID mit geänderten Kapazitäten; neue ID am
              selben Ort (Mittelpunkt); Kante ohne Partner; neue Kante.
            </Text>
          </div>
        </MotionCollapse>
        {!dataset ? (
          <Text className="mt-3">
            Zuerst oben ein Projekt auswählen oder mit + ein neues anlegen.
          </Text>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label
            className={clsx(filePickerLabelClassName, !dataset && 'pointer-events-none opacity-50')}
          >
            Datei wählen
            <input
              type="file"
              accept=".geojson,application/geo+json,application/json"
              className="sr-only"
              data-testid="edges-file-input"
              disabled={!dataset}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) void importFromFile(file)
              }}
            />
          </label>
          <Button
            type="button"
            color="sky"
            data-testid="import-dataset"
            disabled={!pendingText || !dataset || importPending}
            onClick={() => {
              if (!pendingText || !dataset) return
              if (selectedRow?.local) {
                const confirmed = window.confirm(
                  `Vorhandene lokale Kanten für „${dataset}“ werden ersetzt. Fortfahren?`,
                )
                if (!confirmed) return
              }
              importEdges({ text: pendingText, name: dataset })
            }}
          >
            {selectedRow?.local ? 'Überschreiben' : 'Importieren'}
          </Button>
        </div>
        {pendingText ? (
          <Text className="mt-2">
            Datei gelesen. {selectedRow?.local ? 'Überschreiben' : 'Importieren'} klicken.
          </Text>
        ) : null}
        {error ? (
          <Callout className="mt-4" tone="error">
            {error}
          </Callout>
        ) : null}
      </Fieldset>
    </section>
  )
}
