import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useId } from 'react'
import { CountGrid } from '@/components/CountGrid'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Text, TextLink } from '@/components/ui/text'
import {
  allCountsQueryKey,
  countsQueryKey,
  countStore,
  datasetSummariesQueryKey,
} from '@/features/counts/counts-query'
import { useOsmAuth } from '@/features/osm/use-osm-auth'
import { Route } from '@/routes/index'
import { countRecordFromFormData } from '@/shared/counts/count-from-form'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import { originalIdForEdge, recordForEdge } from '@/shared/counts/match-counts'
import { type CountRecord } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

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
  const records = countsQuery.data ?? {}
  const saved = edgeId ? recordForEdge(records, edgeId) : undefined
  const kvEdgeId = edgeId ? (originalIdForEdge(records, edgeId) ?? edgeId) : undefined

  const saveMutation = useMutation({
    mutationFn: async (record: CountRecord) => {
      if (!dataset || !kvEdgeId) throw new Error('missing')
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      return countStore.put(dataset, kvEdgeId, record)
    },
    onSuccess: async () => {
      if (!dataset) return
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
      await queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
    },
  })
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!dataset || !kvEdgeId) return
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      await countStore.remove(dataset, kvEdgeId)
    },
    onSuccess: async () => {
      if (!dataset) return
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
      await queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
    },
  })

  if (!dataset) return null
  if (!edgeId || !edge) {
    return (
      <section>
        <Subheading>Zählung</Subheading>
        <Callout className="mt-2" title="Keine Kante gewählt">
          Kante auf der Karte oder in der Liste wählen.
        </Callout>
      </section>
    )
  }

  const selectedEdge = edge
  const properties = selectedEdge.properties
  const disabledSides = {
    left: properties.parking_left === 'no',
    right: properties.parking_right === 'no',
  }

  function saveFromForm(form: HTMLFormElement) {
    saveMutation.mutate(
      countRecordFromFormData(new FormData(form), {
        updatedBy: auth.displayName,
        edgeId,
        coordinates: selectedEdge.geometry.coordinates,
        existing: saved,
      }),
    )
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
        {properties.way_ids.length > 0 ? ' · ' : null}
        {properties.way_ids.map((wayId, index) => (
          <span key={wayId}>
            {index > 0 ? ', ' : null}
            <TextLink
              href={`https://www.openstreetmap.org/way/${wayId}`}
              target="_blank"
              rel="noreferrer"
            >
              way/{wayId}
            </TextLink>
          </span>
        ))}
      </Text>
      <form
        key={`${edgeId}-${saved?.updated_at ?? 'new'}`}
        className="mt-3 space-y-3"
        onSubmit={handleSubmit}
        data-testid="count-form"
      >
        <CountGrid
          formId={formId}
          coordinates={selectedEdge.geometry.coordinates}
          disabledSides={disabledSides}
          capacity={{ left: properties.capacity_left, right: properties.capacity_right }}
          saved={saved}
        />
        <Field>
          <Label>Notiz</Label>
          <Input name="note" defaultValue={saved?.note ?? ''} autoComplete="off" />
        </Field>
        {!auth.authenticated ? <Callout>{osmLoginRequiredMessage}</Callout> : null}
        {saveMutation.isError ? (
          <Callout tone="error">
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'Speichern fehlgeschlagen'}
          </Callout>
        ) : null}
        {clearMutation.isError ? (
          <Callout tone="error">
            {clearMutation.error instanceof Error
              ? clearMutation.error.message
              : 'Löschen fehlgeschlagen'}
          </Callout>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
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
              data-testid="delete-count"
              disabled={!auth.authenticated}
              onClick={() => {
                if (!window.confirm('Zählung für diese Kante löschen?')) return
                clearMutation.mutate()
              }}
            >
              Löschen
            </Button>
          </div>
          <Button
            type="button"
            plain
            onClick={() =>
              void navigate({
                search: (previous) => ({ ...previous, edge: undefined }),
                replace: true,
              })
            }
          >
            Schließen
          </Button>
        </div>
      </form>
    </section>
  )
}
