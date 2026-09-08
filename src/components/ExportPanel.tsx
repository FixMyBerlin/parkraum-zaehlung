import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
      <h2 className="mb-2 text-sm font-semibold">Zählungen</h2>
      <p className="mb-2 text-xs text-slate-400">
        {auth.configured && auth.authenticated
          ? `Gespeichert als ${auth.displayName ?? 'OSM-Nutzer'}`
          : 'Speicherung im Browser (localStorage), bis die KV-API da ist.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
          data-testid="export-json"
          onClick={() => {
            downloadJson(exportFilename('counts', dataset), buildCountsFile(dataset, records))
          }}
        >
          JSON exportieren
        </button>
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
          data-testid="export-geojson"
          onClick={() => {
            downloadJson(
              exportGeojsonFilename(dataset),
              mergeCountsIntoEdges(edgesQuery.data!.collection, records),
            )
          }}
        >
          GeoJSON exportieren
        </button>
        <label className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">
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
