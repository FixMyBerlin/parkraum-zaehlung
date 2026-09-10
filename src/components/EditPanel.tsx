import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useId } from 'react'
import { CountGrid } from '@/components/CountGrid'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Text, TextLink } from '@/components/ui/text'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { useMapUiActions } from '@/features/map/map-ui-store'
import { useOsmAuth } from '@/features/osm/use-osm-auth'
import { Route } from '@/routes/index'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import { emptySideCount, type CountRecord, type SideCount } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

export function EditPanel() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const { dataset, edge: edgeId } = Route.useSearch()
  const auth = useOsmAuth()
  const formId = useId()
  const { setFocusedCountSide } = useMapUiActions()

  useEffect(
    function clearFocusedCountSideWhenNoEdge() {
      if (edgeId) return
      setFocusedCountSide(null)
    },
    [edgeId, setFocusedCountSide],
  )

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
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
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
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
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
        <Subheading>Zählung</Subheading>
        <Text className="mt-1">Kante auf der Karte oder in der Liste wählen.</Text>
      </section>
    )
  }

  const properties = edge.properties
  const disabledSides = {
    left: properties.parking_left === 'no',
    right: properties.parking_right === 'no',
  }
  const { left: leftDisabled, right: rightDisabled } = disabledSides

  function saveFromForm(form: HTMLFormElement) {
    const data = new FormData(form)
    const noteValue = data.get('note')
    const record: CountRecord = {
      left: leftDisabled ? emptySideCount() : readSide(data, 'left'),
      right: rightDisabled ? emptySideCount() : readSide(data, 'right'),
      note: typeof noteValue === 'string' && noteValue ? noteValue : undefined,
      updated_at: new Date().toISOString(),
      updated_by: auth.displayName,
    }
    saveMutation.mutate(record)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveFromForm(event.currentTarget)
  }

  return (
    <section>
      <Subheading>Zählung</Subheading>
      <p className="mt-1 text-sm/6 text-zinc-950 dark:text-white" data-testid="selected-edge-name">
        {properties.name ?? properties.id}
      </p>
      <Text>
        {properties.highway ?? 'highway?'} ·{' '}
        {properties.length ? `${properties.length} m` : 'ohne Länge'}
      </Text>
      <ul className="mt-1 text-sm/6 text-sky-300">
        {properties.way_ids.map((wayId) => (
          <li key={wayId}>
            <TextLink
              href={`https://www.openstreetmap.org/way/${wayId}`}
              target="_blank"
              rel="noreferrer"
            >
              way/{wayId}
            </TextLink>
          </li>
        ))}
      </ul>
      <form
        key={`${edgeId}-${saved?.updated_at ?? 'new'}`}
        className="mt-3 space-y-3"
        onSubmit={handleSubmit}
        data-testid="count-form"
      >
        <CountGrid
          formId={formId}
          coordinates={edge.geometry.coordinates}
          disabledSides={disabledSides}
          capacity={{ left: properties.capacity_left, right: properties.capacity_right }}
          saved={saved}
        />
        <Field>
          <Label>Notiz</Label>
          <Input name="note" defaultValue={saved?.note ?? ''} autoComplete="off" />
        </Field>
        {!auth.authenticated ? <Text>{osmLoginRequiredMessage}</Text> : null}
        {saveMutation.isError ? (
          <p className="text-sm/6 text-red-500">
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'Speichern fehlgeschlagen'}
          </p>
        ) : null}
        {clearMutation.isError ? (
          <p className="text-sm/6 text-red-500">
            {clearMutation.error instanceof Error
              ? clearMutation.error.message
              : 'Löschen fehlgeschlagen'}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            color="sky"
            data-testid="save-count"
            disabled={!auth.authenticated}
            onClick={(event) => {
              const form = event.currentTarget.closest('form')
              if (form) saveFromForm(form)
            }}
          >
            Speichern
          </Button>
          <Button
            type="button"
            outline
            disabled={!auth.authenticated}
            onClick={() => clearMutation.mutate()}
          >
            Löschen
          </Button>
          <Button
            type="button"
            plain
            onClick={() =>
              void navigate({ search: (previous) => ({ ...previous, edge: undefined }) })
            }
          >
            Schließen
          </Button>
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
