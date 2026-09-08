import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useId } from 'react'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { useOsmAuth } from '@/features/osm/use-osm-auth'
import { Route } from '@/routes/index'
import { emptySideCount, type CountRecord, type SideCount } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

const categories = [
  { key: 'pkw', label: 'Pkw' },
  { key: 'motorrad', label: 'Motorrad' },
  { key: 'lkw_bus', label: 'Lkw/Bus' },
] as const

export function EditPanel() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const { dataset, edge: edgeId } = Route.useSearch()
  const auth = useOsmAuth()
  const formId = useId()

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

  const edge = edgesQuery.data?.collection.features.find(
    (feature) => feature.properties.id === edgeId,
  )
  const saved = edgeId ? countsQuery.data?.[edgeId] : undefined

  const saveMutation = useMutation({
    mutationFn: async (record: CountRecord) => {
      if (!dataset || !edgeId) throw new Error('missing')
      return countStore.put(dataset, edgeId, record)
    },
    onSuccess: async () => {
      if (!dataset) return
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
    },
  })
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!dataset || !edgeId) return
      await countStore.remove(dataset, edgeId)
    },
    onSuccess: async () => {
      if (!dataset) return
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
    },
  })

  if (!dataset) return null
  if (!edgeId || !edge) {
    return (
      <section>
        <h2 className="text-sm font-semibold">Zählung</h2>
        <p className="mt-1 text-xs text-slate-400">Kante auf der Karte oder in der Liste wählen.</p>
      </section>
    )
  }

  const properties = edge.properties
  const leftDisabled = properties.parking_left === 'no'
  const rightDisabled = properties.parking_right === 'no'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const noteValue = form.get('note')
    const record: CountRecord = {
      left: readSide(form, 'left'),
      right: readSide(form, 'right'),
      note: typeof noteValue === 'string' && noteValue ? noteValue : undefined,
      updated_at: new Date().toISOString(),
      updated_by: auth.displayName,
    }
    saveMutation.mutate(record)
  }

  return (
    <section>
      <h2 className="text-sm font-semibold">Zählung</h2>
      <p className="mt-1 text-xs text-slate-300" data-testid="selected-edge-name">
        {properties.name ?? properties.id}
      </p>
      <p className="text-xs text-slate-400">
        {properties.highway ?? 'highway?'} ·{' '}
        {properties.length ? `${properties.length} m` : 'ohne Länge'}
      </p>
      <ul className="mt-1 text-xs text-sky-300">
        {properties.way_ids.map((wayId) => (
          <li key={wayId}>
            <a href={`https://www.openstreetmap.org/way/${wayId}`} target="_blank" rel="noreferrer">
              way/{wayId}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-400">
        Kapazität L/R: {properties.capacity_left ?? '–'} / {properties.capacity_right ?? '–'}
      </p>
      <form
        key={`${edgeId}-${saved?.updated_at ?? 'new'}`}
        className="mt-3 space-y-3"
        onSubmit={handleSubmit}
        data-testid="count-form"
      >
        <SideFields
          formId={formId}
          side="left"
          label="Links"
          disabled={leftDisabled}
          values={saved?.left ?? emptySideCount()}
        />
        <SideFields
          formId={formId}
          side="right"
          label="Rechts"
          disabled={rightDisabled}
          values={saved?.right ?? emptySideCount()}
        />
        <label className="block text-xs text-slate-300">
          Notiz
          <input
            name="note"
            defaultValue={saved?.note ?? ''}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500"
            data-testid="save-count"
          >
            Speichern
          </button>
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1 text-xs hover:bg-slate-800"
            onClick={() => clearMutation.mutate()}
          >
            Löschen
          </button>
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1 text-xs hover:bg-slate-800"
            onClick={() =>
              void navigate({ search: (previous) => ({ ...previous, edge: undefined }) })
            }
          >
            Schließen
          </button>
        </div>
      </form>
    </section>
  )
}

function readSide(form: FormData, side: 'left' | 'right'): SideCount {
  const read = (key: keyof SideCount) => {
    const raw = form.get(`${side}_${key}`)
    if (raw == null || raw === '') return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  return {
    pkw: read('pkw'),
    motorrad: read('motorrad'),
    lkw_bus: read('lkw_bus'),
  }
}

function SideFields({
  formId,
  side,
  label,
  disabled,
  values,
}: {
  formId: string
  side: 'left' | 'right'
  label: string
  disabled: boolean
  values: SideCount
}) {
  return (
    <fieldset className={disabled ? 'opacity-50' : undefined}>
      <legend className="text-xs font-medium text-slate-200">{label}</legend>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {categories.map((category) => {
          const inputId = `${formId}-${side}-${category.key}`
          return (
            <label key={category.key} className="text-xs text-slate-400" htmlFor={inputId}>
              {category.label}
              <input
                id={inputId}
                name={`${side}_${category.key}`}
                type="number"
                min={0}
                step={1}
                defaultValue={values[category.key] ?? ''}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                data-testid={`${side}-${category.key}`}
              />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
