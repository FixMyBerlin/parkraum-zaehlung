import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOsmAuth } from '@/components/shared/use-osm-auth'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Route } from '@/routes/index'
import { countStore, countsQueryKey, datasetSummariesQueryKey } from '@/shared/counts/counts-query'
import {
  buildAllCountsFile,
  buildCountsFile,
  downloadJson,
  exportFilename,
  exportGeojsonFilename,
  mergeCountsIntoEdges,
} from '@/shared/counts/export-counts'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import { countsFileSchema } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

const filePickerLabelClassName =
  'relative isolate inline-flex cursor-pointer items-baseline justify-center rounded-lg border border-zinc-950/10 px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 font-semibold text-zinc-950 hover:bg-zinc-950/2.5 dark:border-white/15 dark:text-white dark:hover:bg-white/5'

export function ExportPanel() {
  const queryClient = useQueryClient()
  const dataset = Route.useSearch({ select: (search) => search.dataset })
  const auth = useOsmAuth()
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

  const importCounts = useMutation({
    mutationFn: async (text: string) => {
      if (!dataset) throw new Error('Kein Datensatz gewählt')
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      const parsed = countsFileSchema.parse(JSON.parse(text))
      return countStore.merge(dataset, parsed.records)
    },
    onSuccess: async () => {
      if (!dataset) return
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
    },
  })

  const exportAll = useMutation({
    mutationFn: async () => {
      const summaries = await countStore.listDatasetSummaries()
      const datasets: Record<string, Awaited<ReturnType<typeof countStore.list>>> = {}
      for (const summary of summaries) {
        datasets[summary.dataset] = await countStore.list(summary.dataset)
      }
      return buildAllCountsFile(datasets)
    },
    onSuccess: (file) => {
      downloadJson(exportFilename('counts', 'all'), file)
    },
  })

  if (!dataset) return null

  const records = countsQuery.data ?? {}
  const hasEdges = Boolean(edgesQuery.data)

  return (
    <section>
      <Subheading className="mb-2">Zählungen</Subheading>
      <Text className="mb-2">
        {auth.authenticated
          ? `Gespeichert als ${auth.displayName ?? 'OSM-Nutzer'} in der Zähl-Datenbank`
          : 'Zählungen liegen in der gemeinsamen Zähl-Datenbank. Lesen ist öffentlich; Speichern erfordert OSM-Anmeldung.'}
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          data-testid="export-json"
          onClick={() => {
            downloadJson(exportFilename('counts', dataset), buildCountsFile(dataset, records))
          }}
        >
          JSON exportieren
        </Button>
        {hasEdges ? (
          <Button
            type="button"
            data-testid="export-geojson"
            onClick={() => {
              downloadJson(
                exportGeojsonFilename(dataset),
                mergeCountsIntoEdges(edgesQuery.data!.collection, records),
              )
            }}
          >
            GeoJSON exportieren
          </Button>
        ) : null}
        <Button
          type="button"
          outline
          data-testid="export-all-json"
          disabled={exportAll.isPending}
          onClick={() => exportAll.mutate()}
        >
          Alle Zählungen exportieren
        </Button>
        <label className={filePickerLabelClassName}>
          JSON importieren
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            data-testid="counts-file-input"
            disabled={!auth.authenticated}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (!file) return
              void file.text().then((text) => importCounts.mutate(text))
            }}
          />
        </label>
      </div>
      {importCounts.isError ? (
        <Callout className="mt-2" tone="error">
          {importCounts.error instanceof Error
            ? importCounts.error.message
            : 'Import fehlgeschlagen'}
        </Callout>
      ) : null}
      {exportAll.isError ? (
        <Callout className="mt-2" tone="error">
          {exportAll.error instanceof Error ? exportAll.error.message : 'Export fehlgeschlagen'}
        </Callout>
      ) : null}
    </section>
  )
}
