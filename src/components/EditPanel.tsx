import { useAsyncDebouncer } from '@tanstack/react-pacer'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FocusEvent, type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { CountGrid } from '@/components/CountGrid'
import { useOsmAuth } from '@/components/shared/use-osm-auth'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Text, TextLink } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { Route } from '@/routes/index'
import {
  countRecordFromFormData,
  isEmptyOccupancy,
  sameOccupancy,
  type Occupancy,
} from '@/shared/counts/count-from-form'
import {
  allCountsQueryKey,
  countsQueryKey,
  countStore,
  datasetSummariesQueryKey,
} from '@/shared/counts/counts-query'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import { originalIdForEdge, recordForEdge } from '@/shared/counts/match-counts'
import { type CountRecord } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

type PendingSave = {
  dataset: string
  kvEdgeId: string
  record: CountRecord
  hadExistingRecord: boolean
}

export function EditPanel() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: Route.fullPath })
  const { dataset, edge: edgeId } = Route.useSearch()
  const auth = useOsmAuth()
  const formId = useId()
  const [formResetCount, setFormResetCount] = useState(0)

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

  // Last occupancy we attempted to send per edge, so unchanged input is skipped and a
  // failed PUT is not retried in a loop (only new input tries again).
  const lastSentRef = useRef<{ kvEdgeId: string; occupancy: Occupancy } | null>(null)
  // Serializes writes: at most one PUT in flight, latest snapshot wins after it settles.
  const savingRef = useRef(false)
  const queuedRef = useRef<PendingSave | null>(null)

  const saveMutation = useMutation({
    mutationFn: async (pending: PendingSave) =>
      countStore.put(pending.dataset, pending.kvEdgeId, pending.record),
    onSuccess: (record, pending) => {
      queryClient.setQueryData<Record<string, CountRecord>>(
        countsQueryKey(pending.dataset),
        (current) => ({
          ...current,
          [pending.kvEdgeId]: record,
        }),
      )
      void queryClient.invalidateQueries({ queryKey: countsQueryKey(pending.dataset) })
      void queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
      void queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
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
      lastSentRef.current = null
      setFormResetCount((count) => count + 1)
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
      await queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
    },
  })

  async function executeSave(pending: PendingSave) {
    savingRef.current = true
    try {
      await saveMutation.mutateAsync(pending)
    } catch {
      // Surfaced via saveMutation.isError below; do not retry automatically.
    } finally {
      savingRef.current = false
      const queued = queuedRef.current
      queuedRef.current = null
      if (queued) await executeSave(queued)
    }
  }

  async function runSave(pending: PendingSave) {
    if (!auth.authenticated) return
    const occupancy: Occupancy = {
      periods: pending.record.periods,
      note: pending.record.note,
    }
    const last = lastSentRef.current
    if (last && last.kvEdgeId === pending.kvEdgeId && sameOccupancy(last.occupancy, occupancy)) {
      return
    }
    if (!pending.hadExistingRecord && isEmptyOccupancy(occupancy)) return

    lastSentRef.current = { kvEdgeId: pending.kvEdgeId, occupancy }
    if (savingRef.current) {
      queuedRef.current = pending
      return
    }
    await executeSave(pending)
  }

  const debouncer = useAsyncDebouncer(runSave, { wait: 500 })

  useEffect(
    function flushPendingSaveOnEdgeChange() {
      return function flushBeforeEdgeChanges() {
        void debouncer.flush()
      }
    },
    [edgeId, debouncer],
  )

  useEffect(
    function flushPendingSaveOnPageHide() {
      function flushOnPageHide() {
        void debouncer.flush()
      }
      function flushOnVisibilityHidden() {
        if (document.visibilityState === 'hidden') void debouncer.flush()
      }
      window.addEventListener('pagehide', flushOnPageHide)
      document.addEventListener('visibilitychange', flushOnVisibilityHidden)
      return function stopFlushingOnPageHide() {
        window.removeEventListener('pagehide', flushOnPageHide)
        document.removeEventListener('visibilitychange', flushOnVisibilityHidden)
      }
    },
    [debouncer],
  )

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

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    if (!dataset || !kvEdgeId) return
    const pending: PendingSave = {
      dataset,
      kvEdgeId,
      hadExistingRecord: Boolean(saved),
      record: countRecordFromFormData(new FormData(event.currentTarget), {
        updatedBy: auth.displayName,
        edgeId,
        coordinates: selectedEdge.geometry.coordinates,
        existing: saved,
      }),
    }
    void debouncer.maybeExecute(pending)
  }

  function handleFormBlur(event: FocusEvent<HTMLFormElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    void debouncer.flush()
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
        key={`${edgeId}-${formResetCount}`}
        className="mt-3 space-y-3"
        onInput={handleFormInput}
        onBlur={handleFormBlur}
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
          <Textarea
            name="note"
            rows={1}
            resizable={false}
            autoGrow
            defaultValue={saved?.note ?? ''}
            autoComplete="off"
          />
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
              outline
              data-testid="delete-count"
              disabled={!auth.authenticated}
              onClick={() => {
                if (!window.confirm('Zählung für diese Kante löschen?')) return
                debouncer.cancel()
                clearMutation.mutate()
              }}
            >
              Löschen
            </Button>
          </div>
          <Button
            type="button"
            plain
            onClick={() => {
              void debouncer.flush().then(() => {
                void navigate({
                  search: (previous) => ({ ...previous, edge: undefined }),
                  replace: true,
                })
              })
            }}
          >
            Schließen
          </Button>
        </div>
      </form>
    </section>
  )
}
