import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { MotionCollapse } from '@/components/shared/motion/MotionCollapse'
import { Tooltip } from '@/components/shared/Tooltip/Tooltip'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Checkbox, CheckboxField } from '@/components/ui/checkbox'
import { Field, Fieldset, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Code, Text, TextLink } from '@/components/ui/text'
import { sampleEdgesGithubUrl } from '@/config/app.const'
import {
  countStore,
  countsQueryKey,
  datasetSummariesQueryKey,
} from '@/features/counts/counts-query'
import { Route } from '@/routes/index'
import type { CountRecord } from '@/shared/counts/schema'
import { listDatasets, loadDataset, saveDataset } from '@/shared/datasets/dataset-idb'
import { buildDatasetInventory, datasetInventoryCopy } from '@/shared/datasets/inventory'
import { parseEdgesText } from '@/shared/edges/parse-edges'
import { isValidDatasetName, type CountingEdgesGeoJSON } from '@/shared/edges/schema'

const filePickerLabelClassName =
  'relative isolate inline-flex cursor-pointer items-baseline justify-center rounded-lg border border-zinc-950/10 px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 font-semibold text-zinc-950 hover:bg-zinc-950/2.5 dark:border-white/15 dark:text-white dark:hover:bg-white/5'

const infoIconButtonClassName =
  'rounded-full text-zinc-400 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

const datasetNameHelp =
  'Der Name ist der Schlüssel für alle Zählungen und kann später nicht geändert werden. Empfehlung: <ort>-<jahr>-<monat>, z. B. loerrach-2026-09. Gleicher Name = gleiche Kampagne, auch wenn du die Kanten-Datei später neu hochlädst.'

async function confirmReplaceIfIdsChanged(dataset: string, collection: CountingEdgesGeoJSON) {
  const existing = await loadDataset(dataset)
  if (!existing) return true
  const nextIds = new Set(collection.features.map((feature) => feature.properties.id))
  const records = await countStore.list(dataset)
  const orphaned = Object.keys(records).filter((id) => !nextIds.has(id)).length
  if (orphaned === 0) return true
  return window.confirm(
    `${orphaned} vorhandene Zählungen haben danach keine passende Kante mehr. Trotzdem ersetzen?`,
  )
}

export function DatasetPanel() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const dataset = Route.useSearch({ select: (search) => search.dataset })
  const parkings = Route.useSearch({ select: (search) => search.parkings })
  const edgesUrl = Route.useSearch({ select: (search) => search.edges })
  const datasetsQuery = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  })
  const summariesQuery = useQuery({
    queryKey: datasetSummariesQueryKey,
    queryFn: () => countStore.listDatasetSummaries(),
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
  const inventory = buildDatasetInventory(localDatasets, summariesQuery.data ?? [], countsByDataset)
  const selectedRow = inventory.find((row) => row.dataset === dataset)

  const [pendingName, setPendingName] = useState('')
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importHelpOpen, setImportHelpOpen] = useState(true)

  const { mutate: importEdges, isPending: importPending } = useMutation({
    mutationFn: async ({ text, name }: { text: string; name: string }) => {
      if (!isValidDatasetName(name)) {
        throw new Error(
          'Datensatzname: 3–60 Zeichen, nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. loerrach-2026-09).',
        )
      }
      const parsed = parseEdgesText(text, name)
      const confirmed = await confirmReplaceIfIdsChanged(name, parsed.collection)
      if (!confirmed) throw new Error('cancelled')
      return saveDataset(parsed.collection, name)
    },
    onSuccess: async (stored) => {
      setError(null)
      setPendingText(null)
      await queryClient.invalidateQueries({ queryKey: ['datasets'] })
      await queryClient.invalidateQueries({ queryKey: ['dataset', stored.dataset] })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
      await navigate({
        search: (previous) => ({ ...previous, dataset: stored.dataset, edge: undefined }),
        replace: true,
      })
    },
    onError: (caught: unknown) => {
      if (caught instanceof Error && caught.message === 'cancelled') return
      setError(caught instanceof Error ? caught.message : 'Import fehlgeschlagen')
    },
  })

  function stageFileText(text: string) {
    try {
      const parsed = parseEdgesText(text)
      const suggested = parsed.dataset
      setPendingText(text)
      if (suggested) setPendingName(suggested)
      setError(null)
      setImportHelpOpen(true)
    } catch (caught: unknown) {
      setPendingText(null)
      setError(caught instanceof Error ? caught.message : 'Import fehlgeschlagen')
    }
  }

  async function importFromFile(file: File) {
    stageFileText(await file.text())
  }

  useEffect(
    function stageEdgesFromSearchUrl() {
      if (!edgesUrl || dataset) return
      let cancelled = false
      void fetch(edgesUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`Kanten-URL nicht lesbar (${response.status})`)
          return response.text()
        })
        .then((text) => {
          if (cancelled) return
          try {
            const parsed = parseEdgesText(text)
            setPendingText(text)
            if (parsed.dataset) setPendingName(parsed.dataset)
            setError(null)
            setImportHelpOpen(true)
          } catch (caught: unknown) {
            setPendingText(null)
            setError(caught instanceof Error ? caught.message : 'Import fehlgeschlagen')
          }
        })
        .catch((caught: unknown) => {
          if (!cancelled) {
            setError(caught instanceof Error ? caught.message : 'Kanten-URL fehlgeschlagen')
          }
        })
      return () => {
        cancelled = true
      }
    },
    [edgesUrl, dataset],
  )

  return (
    <section className="space-y-4">
      {dataset && selectedRow && !selectedRow.local ? (
        <Callout title="Nur in der Zähl-Datenbank">
          {selectedRow.remoteEntryCount} Zählungen unter {dataset}. Kanten-Datei importieren, um zu
          zählen. JSON-Export der Zählungen ist oben möglich.
        </Callout>
      ) : null}
      <Fieldset>
        <div className="flex items-center gap-1.5">
          <Subheading>Kanten importieren</Subheading>
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
              Kanten liegen als Datei in deinem Browser. Zählungen liegen in der gemeinsamen
              Zähl-Datenbank. Beide gehören über den Datensatz-Namen und die Kanten-IDs zusammen.
            </Text>
            <Text>
              Die App lädt diese Datei nicht hoch. Bewahre sie auf (oder lege sie unter einer URL ab
              und nutze <Code>edges</Code> in der Adresse), damit du oder andere die Zählungen
              später wieder den Kanten zuordnen können. Der GeoJSON-Export enthält die Kanten und
              kann wieder importiert werden.
            </Text>
            <Text>
              Die Datei kommt aus TILDA: Region → Export → Straßenkanten (
              <Code>parkings_edges</Code>) als GeoJSON-FeatureCollection (v1).
            </Text>
            <Text>
              <TextLink href={sampleEdgesGithubUrl} target="_blank" rel="noreferrer">
                Testdaten herunterladen (dann hochladen)
              </TextLink>
            </Text>
            <Text>{datasetNameHelp}</Text>
          </div>
        </MotionCollapse>
        <Field className="mt-4">
          <Label>Datensatzname</Label>
          <Input
            value={pendingName}
            onChange={(event) => setPendingName(event.target.value.trim().toLowerCase())}
            placeholder="loerrach-2026-09"
            data-testid="dataset-name-input"
            autoComplete="off"
          />
        </Field>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className={filePickerLabelClassName}>
            Datei wählen
            <input
              type="file"
              accept=".geojson,application/geo+json,application/json"
              className="sr-only"
              data-testid="edges-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importFromFile(file)
              }}
            />
          </label>
          <Button
            type="button"
            color="sky"
            data-testid="import-dataset"
            disabled={!pendingText || importPending}
            onClick={() => {
              if (!pendingText) return
              importEdges({ text: pendingText, name: pendingName })
            }}
          >
            Importieren
          </Button>
        </div>
        {pendingText ? (
          <Text className="mt-2">Datei gelesen. Namen prüfen und Importieren klicken.</Text>
        ) : null}
        {error ? (
          <Callout className="mt-4" tone="error">
            {error}
          </Callout>
        ) : null}
      </Fieldset>
      <CheckboxField>
        <Checkbox
          checked={parkings}
          onChange={(checked) =>
            void navigate({
              search: (previous) => ({ ...previous, parkings: checked }),
              replace: true,
            })
          }
        />
        <div data-slot="label" className="flex items-center gap-1.5">
          <Label>TILDA-Parkraum als Kontext</Label>
          <Tooltip text="Blendet die von TILDA kartierten Parkstände auf der Karte ein. So siehst du beim Zählen, wo laut TILDA Parkraum liegt — als Orientierung, nicht als Zählgrundlage.">
            <button
              type="button"
              className={infoIconButtonClassName}
              aria-label="Erklärung zu TILDA-Parkraum als Kontext"
            >
              <InformationCircleIcon className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </CheckboxField>
      {inventory.length > 0 ? (
        <Fieldset>
          <Subheading>Datensätze</Subheading>
          <ul className="mt-2 space-y-1" data-testid="dataset-inventory">
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
                    onClick={() =>
                      void navigate({
                        search: (previous) => ({
                          ...previous,
                          dataset: row.dataset,
                          edge: undefined,
                        }),
                        replace: true,
                      })
                    }
                  >
                    <span className="font-semibold">{row.dataset}</span>
                    <span className="ml-2 text-xs text-zinc-400">
                      {row.local && row.remoteEntryCount > 0
                        ? 'beide'
                        : row.local
                          ? 'lokal'
                          : 'Zähl-Datenbank'}
                    </span>
                    <span className="mt-0.5 block text-xs/5 text-zinc-400">
                      {datasetInventoryCopy(row)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Fieldset>
      ) : null}
    </section>
  )
}
