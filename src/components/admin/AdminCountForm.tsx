import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, type FormEvent } from 'react'
import { useActiveCountPeriod, useCountPeriodActions } from '@/components/count-period-store'
import { CountPeriodToggle } from '@/components/CountPeriodToggle'
import { useOsmAuth } from '@/components/shared/use-osm-auth'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/components/ui/description-list'
import { Divider } from '@/components/ui/divider'
import { Field, Fieldset, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { countRecordFromFormData } from '@/shared/counts/count-from-form'
import type { CountStoreEntry } from '@/shared/counts/count-store'
import {
  allCountsQueryKey,
  countsQueryKey,
  countStore,
  datasetSummariesQueryKey,
} from '@/shared/counts/counts-query'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'
import { countPeriods, isPeriodSideCounted, type CountPeriod } from '@/shared/counts/schema'
import { ignorePasswordManagerProps } from '@/shared/form-ignore-password-manager'

const categories = [
  { key: 'pkw', label: 'Pkw' },
  { key: 'motorrad', label: 'Motorrad' },
  { key: 'lkw_bus', label: 'Lkw/Bus' },
] as const

type Props = {
  entry: CountStoreEntry
}

export function AdminCountForm({ entry }: Props) {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: '/data' })
  const auth = useOsmAuth()
  const activePeriod = useActiveCountPeriod()
  const { setPeriodHasData, resetPeriodHasData } = useCountPeriodActions()
  const { dataset, edgeId, record: saved } = entry

  useEffect(
    function seedPeriodDataIndicatorFromSaved() {
      // Runs once per selected row (the form remounts by key on dataset/edgeId/updated_at).
      resetPeriodHasData({
        sunday:
          isPeriodSideCounted(saved, 'sunday', 'left') ||
          isPeriodSideCounted(saved, 'sunday', 'right'),
        midday:
          isPeriodSideCounted(saved, 'midday', 'left') ||
          isPeriodSideCounted(saved, 'midday', 'right'),
        evening:
          isPeriodSideCounted(saved, 'evening', 'left') ||
          isPeriodSideCounted(saved, 'evening', 'right'),
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  function handlePeriodInputChange(form: HTMLFormElement, period: CountPeriod) {
    const inputs = form.querySelectorAll<HTMLInputElement>(`[name^="${period}_"]`)
    setPeriodHasData(
      period,
      [...inputs].some((input) => input.value !== ''),
    )
  }

  const saveMutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      return countStore.put(
        dataset,
        edgeId,
        countRecordFromFormData(new FormData(form), {
          updatedBy: auth.displayName,
          existing: saved,
        }),
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
      await queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
    },
  })
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      await countStore.remove(dataset, edgeId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: countsQueryKey(dataset) })
      await queryClient.invalidateQueries({ queryKey: allCountsQueryKey })
      await queryClient.invalidateQueries({ queryKey: datasetSummariesQueryKey })
      await navigate({
        search: (previous) => ({ ...previous, edge: undefined }),
        replace: true,
      })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveMutation.mutate(event.currentTarget)
  }

  return (
    <form
      key={`${dataset}-${edgeId}-${saved.updated_at}`}
      className="space-y-6"
      onSubmit={handleSubmit}
      data-testid="admin-count-form"
    >
      <div>
        <Subheading>Zählung bearbeiten</Subheading>
        <DescriptionList className="mt-4">
          <DescriptionTerm>Projekt</DescriptionTerm>
          <DescriptionDetails>{dataset}</DescriptionDetails>
          <DescriptionTerm>Kante</DescriptionTerm>
          <DescriptionDetails className="break-all">{edgeId}</DescriptionDetails>
          <DescriptionTerm>Mittelpunkt</DescriptionTerm>
          <DescriptionDetails>
            {saved.mid_lat.toFixed(6)}, {saved.mid_lng.toFixed(6)}
          </DescriptionDetails>
          <DescriptionTerm>Herkunft</DescriptionTerm>
          <DescriptionDetails data-testid="admin-source">
            {saved.source === 'manual' ? 'Manueller Punkt' : 'Importierte Kante'}
          </DescriptionDetails>
          <DescriptionTerm>Erstellt von</DescriptionTerm>
          <DescriptionDetails>
            {saved.created_by ?? '—'}
            {saved.counted_at ? ` · ${saved.counted_at.replace('T', ' ').slice(0, 19)}` : null}
          </DescriptionDetails>
          <DescriptionTerm>Gezählt</DescriptionTerm>
          <DescriptionDetails>{saved.counted_at.replace('T', ' ').slice(0, 19)}</DescriptionDetails>
          <DescriptionTerm>Zuletzt</DescriptionTerm>
          <DescriptionDetails>
            {saved.updated_by ?? '—'}
            {saved.updated_at ? ` · ${saved.updated_at.replace('T', ' ').slice(0, 19)}` : null}
          </DescriptionDetails>
        </DescriptionList>
      </div>

      <Divider soft />

      <Fieldset>
        <div className="mb-4">
          <CountPeriodToggle />
        </div>
        {countPeriods.map((period) => (
          <div
            key={period}
            hidden={period !== activePeriod}
            className="grid grid-cols-2 gap-x-4 gap-y-4"
          >
            <p className="text-sm/6 font-medium text-zinc-400">Links</p>
            <p className="text-sm/6 font-medium text-zinc-400">Rechts</p>
            {categories.map((category) => (
              <div key={category.key} className="contents">
                <Field>
                  <Label>{category.label} links</Label>
                  <Input
                    type="number"
                    min={0}
                    name={`${period}_left_${category.key}`}
                    defaultValue={saved.periods[period].left[category.key] ?? ''}
                    {...ignorePasswordManagerProps}
                    data-testid={`admin-${period}-left-${category.key}`}
                    onChange={(event) => handlePeriodInputChange(event.currentTarget.form!, period)}
                  />
                </Field>
                <Field>
                  <Label>{category.label} rechts</Label>
                  <Input
                    type="number"
                    min={0}
                    name={`${period}_right_${category.key}`}
                    defaultValue={saved.periods[period].right[category.key] ?? ''}
                    {...ignorePasswordManagerProps}
                    data-testid={`admin-${period}-right-${category.key}`}
                    onChange={(event) => handlePeriodInputChange(event.currentTarget.form!, period)}
                  />
                </Field>
              </div>
            ))}
          </div>
        ))}
      </Fieldset>

      <Field>
        <Label>Match-ID</Label>
        <Input name="match_id" defaultValue={saved.match_id} {...ignorePasswordManagerProps} />
      </Field>
      <Field>
        <Label>Match-Status</Label>
        <Select name="match_status" defaultValue={saved.match_status} aria-label="Match-Status">
          <option value="id">id</option>
          <option value="midpoint">midpoint</option>
          <option value="manual">manual</option>
          <option value="none">none</option>
        </Select>
      </Field>

      <Field>
        <Label>Notiz</Label>
        <Textarea
          name="note"
          rows={3}
          defaultValue={saved.note ?? ''}
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
            type="submit"
            color="sky"
            data-testid="admin-save-count"
            disabled={!auth.authenticated}
          >
            Speichern
          </Button>
          <Button
            type="button"
            outline
            data-testid="admin-delete-count"
            disabled={!auth.authenticated}
            onClick={() => {
              const confirmText =
                saved.source === 'manual'
                  ? 'Diesen Punkt und die Zählung löschen?'
                  : 'Zählung für diese Kante löschen?'
              if (!window.confirm(confirmText)) return
              clearMutation.mutate()
            }}
          >
            Löschen
          </Button>
        </div>
        <Link
          to="/"
          search={{ dataset, edge: edgeId, step: 'count' }}
          className="text-sm/6 text-sky-400 hover:text-sky-300"
        >
          Auf der Karte öffnen
        </Link>
      </div>
    </form>
  )
}
