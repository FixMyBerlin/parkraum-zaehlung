import { useAsyncDebouncer } from '@tanstack/react-pacer'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { Position } from 'geojson'
import { type FocusEvent, type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { CountGrid } from '@/components/CountGrid'
import { useManualPointDragActions } from '@/components/shared/manual-point-drag-store'
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
import { isManualCountId, withManualPointLocation } from '@/shared/counts/manual-points'
import { originalIdForEdge, recordForEdge } from '@/shared/counts/match-counts'
import { type CountRecord } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'
import { ignorePasswordManagerProps } from '@/shared/form-ignore-password-manager'

/**
 * A manual point has no LineString to derive left/right columns from, but `CountGrid`
 * needs *some* coordinates to keep `screenOrderedSides` stable — a short east–west
 * dummy segment through the point gives it a fixed, predictable left/right split.
 */
function dummyEastWestSegment(lng: number, lat: number): Position[] {
  const offset = 0.0001
  return [
    [lng - offset, lat],
    [lng + offset, lat],
  ]
}

type PendingSave = {
  dataset: string
  kvEdgeId: string
  record: CountRecord
  hadExistingRecord: boolean
  /**
   * True for an occupancy save (from the form), which must pick up a manual point's
   * latest dragged location instead of the stale `mid_*` baked into `record` at
   * input time. False for the location save itself — it already carries the new
   * coordinates, and refreshing from cache here would just overwrite them with the
   * pre-drag value that's still sitting in the cache.
   */
  refreshLocationFromCache: boolean
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
  const manualRecord = edgeId && !edge && isManualCountId(edgeId) ? records[edgeId] : undefined
  const isManualPoint = Boolean(manualRecord)
  const saved = edge ? recordForEdge(records, edgeId!) : manualRecord
  const kvEdgeId = isManualPoint
    ? edgeId
    : edgeId
      ? (originalIdForEdge(records, edgeId) ?? edgeId)
      : undefined

  // Last occupancy we attempted to send per edge, so unchanged input is skipped and a
  // failed PUT is not retried in a loop (only new input tries again).
  const lastSentRef = useRef<{ kvEdgeId: string; occupancy: Occupancy } | null>(null)
  // Serializes writes: at most one PUT in flight, latest snapshot wins after it settles.
  const savingRef = useRef(false)
  const queuedRef = useRef<PendingSave | null>(null)
  const dragBridgeActions = useManualPointDragActions()

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
      // A manual point's "edge" is the KV entry itself — once it's gone there is
      // nothing left to show, so drop the selection instead of leaving a dead id
      // in the URL (an imported edge count clears but the edge itself stays put).
      if (isManualPoint) {
        void navigate({
          search: (previous) => ({ ...previous, edge: undefined }),
          replace: true,
        })
      }
    },
  })

  async function executeSave(pending: PendingSave) {
    savingRef.current = true
    try {
      // Re-read the latest cached record right before writing: a manual point may
      // have moved (drag) since `pending.record` was built from an input-time
      // snapshot, and an occupancy save must never carry that stale location back
      // over a completed drag. Skipped for the location save itself (see
      // `refreshLocationFromCache`'s doc comment) — it is the one write that must
      // win, not defer to whatever is still cached.
      const latest = pending.refreshLocationFromCache
        ? queryClient.getQueryData<Record<string, CountRecord>>(countsQueryKey(pending.dataset))?.[
            pending.kvEdgeId
          ]
        : undefined
      const record = latest
        ? { ...pending.record, mid_lat: latest.mid_lat, mid_lng: latest.mid_lng }
        : pending.record
      await saveMutation.mutateAsync({ ...pending, record })
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

  useEffect(
    function registerManualPointDragHandlers() {
      if (!isManualPoint || !dataset || !kvEdgeId) return
      const pointId = kvEdgeId
      dragBridgeActions.register(pointId, {
        flush: () => debouncer.flush(),
        saveLocation: async (lng, lat) => {
          const latest =
            queryClient.getQueryData<Record<string, CountRecord>>(countsQueryKey(dataset))?.[
              pointId
            ] ?? saved
          if (!latest) return
          const pending: PendingSave = {
            dataset,
            kvEdgeId: pointId,
            hadExistingRecord: true,
            refreshLocationFromCache: false,
            record: withManualPointLocation(latest, lng, lat, auth.displayName),
          }
          if (savingRef.current) {
            queuedRef.current = pending
            return
          }
          await executeSave(pending)
        },
      })
      return function unregisterManualPointDragHandlers() {
        dragBridgeActions.unregister(pointId)
      }
    },
    // `executeSave` reads `savingRef`/`queuedRef` and closes over `saveMutation`, all
    // stable across renders in spirit (refs, and a mutation object react-query keeps
    // functionally equivalent) — the effect re-registers whenever its own real inputs
    // change instead, which also re-runs it every render since `saved` is fresh each
    // time, keeping the closure's `saved` fallback current without extra bookkeeping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isManualPoint,
      dataset,
      kvEdgeId,
      debouncer,
      queryClient,
      saved,
      auth.displayName,
      dragBridgeActions,
    ],
  )

  if (!dataset) return null
  if (!edgeId || (!edge && !isManualPoint)) {
    return (
      <section>
        <Subheading>Zählung</Subheading>
        <Callout className="mt-2" title="Keine Kante gewählt">
          Kante auf der Karte oder in der Liste wählen.
        </Callout>
      </section>
    )
  }

  const coordinates = edge
    ? edge.geometry.coordinates
    : dummyEastWestSegment(manualRecord!.mid_lng, manualRecord!.mid_lat)
  const disabledSides = edge
    ? { left: edge.properties.parking_left === 'no', right: edge.properties.parking_right === 'no' }
    : { left: false, right: false }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    if (!dataset || !kvEdgeId) return
    const formData = new FormData(event.currentTarget)
    const pending: PendingSave = {
      dataset,
      kvEdgeId,
      hadExistingRecord: Boolean(saved),
      refreshLocationFromCache: true,
      record: edge
        ? countRecordFromFormData(formData, {
            updatedBy: auth.displayName,
            edgeId,
            coordinates: edge.geometry.coordinates,
            existing: saved,
          })
        : countRecordFromFormData(formData, {
            updatedBy: auth.displayName,
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
      {edge ? (
        <>
          <p
            className="mt-1 text-sm/6 text-zinc-950 dark:text-white"
            data-testid="selected-edge-name"
          >
            {edge.properties.name ?? edge.properties.id}
          </p>
          <Text>
            {edge.properties.highway ?? 'highway?'} ·{' '}
            {edge.properties.length ? `${edge.properties.length} m` : 'ohne Länge'}
            {edge.properties.way_ids.length > 0 ? ' · ' : null}
            {edge.properties.way_ids.map((wayId, index) => (
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
        </>
      ) : (
        <>
          <p
            className="mt-1 text-sm/6 text-zinc-950 dark:text-white"
            data-testid="selected-edge-name"
          >
            Manueller Punkt
          </p>
          <Text data-testid="manual-point-meta">
            Erstellt von {manualRecord?.created_by ?? '—'}
            {manualRecord?.counted_at
              ? ` am ${manualRecord.counted_at.replace('T', ' ').slice(0, 19)}`
              : null}
            {manualRecord?.updated_by
              ? ` · zuletzt ${manualRecord.updated_by} (${manualRecord.updated_at.replace('T', ' ').slice(0, 19)})`
              : null}
          </Text>
        </>
      )}
      <form
        key={`${edgeId}-${formResetCount}`}
        className="mt-3 space-y-3"
        onInput={handleFormInput}
        onBlur={handleFormBlur}
        data-testid="count-form"
      >
        <CountGrid
          formId={formId}
          coordinates={coordinates}
          disabledSides={disabledSides}
          capacity={{
            left: edge?.properties.capacity_left,
            right: edge?.properties.capacity_right,
          }}
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
            {...ignorePasswordManagerProps}
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
                const confirmText = isManualPoint
                  ? 'Diesen Punkt und die Zählung löschen?'
                  : 'Zählung für diese Kante löschen?'
                if (!window.confirm(confirmText)) return
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
