import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import { sampleEdgesUrl } from '@/config/app.const'
import { Route } from '@/routes/index'
import { listDatasets, saveDataset } from '@/shared/datasets/dataset-idb'
import { parseEdgesText } from '@/shared/edges/parse-edges'
import { slugifyDatasetName } from '@/shared/edges/schema'

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
  const [pendingName, setPendingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()

  const importMutation = useMutation({
    mutationFn: async ({ text, name }: { text: string; name?: string }) => {
      const parsed = parseEdgesText(text, name ? slugifyDatasetName(name) : undefined)
      if (parsed.needsDatasetName) {
        setPendingName('')
        throw new Error('needs-name')
      }
      return saveDataset(parsed.collection, parsed.dataset)
    },
    onSuccess: async (stored) => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['datasets'] })
      await queryClient.invalidateQueries({ queryKey: ['dataset', stored.dataset] })
      await navigate({
        search: (previous) => ({ ...previous, dataset: stored.dataset, edge: undefined }),
      })
    },
    onError: (caught: unknown) => {
      if (caught instanceof Error && caught.message === 'needs-name') {
        setError('Datensatzname fehlt. Bitte einen Namen eintragen und erneut importieren.')
        return
      }
      setError(caught instanceof Error ? caught.message : 'Import fehlgeschlagen')
    },
  })

  async function importFromFile(file: File) {
    const text = await file.text()
    importMutation.mutate({ text, name: pendingName || undefined })
  }

  async function loadSample() {
    const response = await fetch(sampleEdgesUrl)
    const text = await response.text()
    importMutation.mutate({ text })
  }

  useEffect(() => {
    if (!edgesUrl || dataset) return
    let cancelled = false
    void fetch(edgesUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Kanten-URL nicht lesbar (${response.status})`)
        return response.text()
      })
      .then((text) => {
        if (cancelled) return
        importMutation.mutate({ text })
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Kanten-URL fehlgeschlagen')
        }
      })
    return () => {
      cancelled = true
    }
    // Import once when `?edges=` is present and no dataset is selected yet.
  }, [edgesUrl, dataset, importMutation])

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Kanten importieren</h2>
      <p className="mb-2 text-xs text-slate-400">
        GeoJSON v1 (FeatureCollection). Testdatensatz für Lörrach liegt bei.
      </p>
      <label className="mb-2 block text-xs text-slate-300" htmlFor={nameId}>
        Name, falls die Datei kein <code>metadata.dataset</code> hat
      </label>
      <input
        id={nameId}
        className="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        value={pendingName}
        onChange={(event) => setPendingName(event.target.value)}
        placeholder="loerrach-2026-09"
      />
      <div className="flex flex-wrap gap-2">
        <label className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">
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
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1 text-xs text-white hover:bg-sky-600"
          data-testid="load-sample"
          onClick={() => void loadSample()}
        >
          Testdatensatz laden
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={parkings}
          onChange={(event) =>
            void navigate({
              search: (previous) => ({ ...previous, parkings: event.target.checked }),
            })
          }
        />
        TILDA-Parkraum als Kontext
      </label>
      {datasetsQuery.data && datasetsQuery.data.length > 0 && (
        <label className="mt-3 block text-xs text-slate-300">
          Gespeicherte Datensätze
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
            value={dataset ?? ''}
            onChange={(event) => {
              const next = event.target.value || undefined
              void navigate({
                search: (previous) => ({ ...previous, dataset: next, edge: undefined }),
              })
            }}
          >
            <option value="">— wählen —</option>
            {datasetsQuery.data.map((item) => (
              <option key={item.dataset} value={item.dataset}>
                {item.dataset}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}
