import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { useOsmAuth } from '@/features/osm/use-osm-auth'
import { Route } from '@/routes/index'
import {
  buildCountsFile,
  downloadJson,
  exportFilename,
  exportGeojsonFilename,
  mergeCountsIntoEdges,
} from '@/shared/counts/export-counts'
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
      const parsed = countsFileSchema.parse(JSON.parse(text))
      return countStore.merge(dataset, parsed.records)
    },
    onSuccess: async () => {
      if (!dataset) return
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
    },
  })

  if (!dataset || !edgesQuery.data) return null

  const records = countsQuery.data ?? {}

  return (
    <section>
      <Subheading className="mb-2">Zählungen</Subheading>
      <Text className="mb-2">
        {auth.configured && auth.authenticated
          ? `Gespeichert als ${auth.displayName ?? 'OSM-Nutzer'}`
          : 'Speicherung im Browser (localStorage), bis die KV-API da ist.'}
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
        <label className={filePickerLabelClassName}>
          JSON importieren
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            data-testid="counts-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              void file.text().then((text) => importCounts.mutate(text))
            }}
          />
        </label>
      </div>
    </section>
  )
}
