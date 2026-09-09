import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Text, TextLink } from '@/components/ui/text'
import { countsQueryKey, countStore } from '@/features/counts/counts-query'
import { useOsmAuth } from '@/features/osm/use-osm-auth'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { emptySideCount, type CountRecord, type SideCount } from '@/shared/counts/schema'
import { loadDataset } from '@/shared/datasets/dataset-idb'

const categories = [
  { key: 'pkw', label: 'Pkw' },
  { key: 'motorrad', label: 'Motorrad' },
  { key: 'lkw_bus', label: 'Lkw/Bus' },
] as const

const countInputClassName = cn(
  'min-h-9 w-full rounded-lg border border-zinc-950/10 bg-transparent px-2 py-1.5 text-center text-base/6 tabular-nums text-zinc-950 sm:text-sm/6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:scheme-dark',
  'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
  'disabled:cursor-not-allowed disabled:opacity-50 dark:disabled:border-white/15 dark:disabled:bg-white/2.5',
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]',
)

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
        <Subheading>Zählung</Subheading>
        <Text className="mt-1">Kante auf der Karte oder in der Liste wählen.</Text>
      </section>
    )
  }

  const properties = edge.properties
  const leftDisabled = properties.parking_left === 'no'
  const rightDisabled = properties.parking_right === 'no'
  const firstEnabledSide = !leftDisabled ? 'left' : !rightDisabled ? 'right' : null

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
        <Text>
          Kapazität L/R: {properties.capacity_left ?? '–'} / {properties.capacity_right ?? '–'}
        </Text>
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-20 p-0" />
              {categories.map((category) => (
                <th
                  key={category.key}
                  id={`${formId}-${category.key}`}
                  scope="col"
                  className="px-1 pb-1 text-center text-sm font-medium text-zinc-950 dark:text-white"
                >
                  {category.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CountSideRow
              formId={formId}
              side="left"
              label="Links"
              disabled={leftDisabled}
              values={saved?.left ?? emptySideCount()}
              autoFocusCategory={!saved && firstEnabledSide === 'left' ? 'pkw' : null}
            />
            <CountSideRow
              formId={formId}
              side="right"
              label="Rechts"
              disabled={rightDisabled}
              values={saved?.right ?? emptySideCount()}
              autoFocusCategory={!saved && firstEnabledSide === 'right' ? 'pkw' : null}
            />
          </tbody>
        </table>
        <Field>
          <Label>Notiz</Label>
          <Input name="note" defaultValue={saved?.note ?? ''} autoComplete="off" />
        </Field>
        {saveMutation.isError ? (
          <p className="text-sm/6 text-red-500">
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'Speichern fehlgeschlagen'}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            color="sky"
            data-testid="save-count"
            onClick={(event) => {
              const form = event.currentTarget.closest('form')
              if (form) saveFromForm(form)
            }}
          >
            Speichern
          </Button>
          <Button type="button" outline onClick={() => clearMutation.mutate()}>
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

function CountSideRow({
  formId,
  side,
  label,
  disabled,
  values,
  autoFocusCategory,
}: {
  formId: string
  side: 'left' | 'right'
  label: string
  disabled: boolean
  values: SideCount
  autoFocusCategory: (typeof categories)[number]['key'] | null
}) {
  const rowHeaderId = `${formId}-${side}`
  return (
    <tr className={disabled ? 'opacity-50' : undefined}>
      <th
        id={rowHeaderId}
        scope="row"
        className="pr-2 text-left align-middle text-sm font-medium text-zinc-950 dark:text-white"
      >
        {label}
        {disabled ? (
          <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
            kein Parken
          </span>
        ) : null}
      </th>
      {categories.map((category) => {
        const inputId = `${formId}-${side}-${category.key}`
        return (
          <td key={category.key} className="px-1 py-0.5 align-middle">
            <input
              id={inputId}
              name={`${side}_${category.key}`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              autoFocus={autoFocusCategory === category.key}
              defaultValue={values[category.key] ?? ''}
              aria-labelledby={`${rowHeaderId} ${formId}-${category.key}`}
              className={countInputClassName}
              data-testid={`${side}-${category.key}`}
              onFocus={(event) => event.currentTarget.select()}
            />
          </td>
        )
      })}
    </tr>
  )
}
