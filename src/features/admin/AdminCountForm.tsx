import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  allCountsQueryKey,
  countsQueryKey,
  countStore,
  datasetSummariesQueryKey,
} from '@/features/counts/counts-query'
import { useOsmAuth } from '@/features/osm/use-osm-auth'
import { countRecordFromFormData } from '@/shared/counts/count-from-form'
import type { CountStoreEntry } from '@/shared/counts/count-store'
import { osmLoginRequiredMessage } from '@/shared/counts/kv-count-store'

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
  const { dataset, edgeId, record: saved } = entry

  const saveMutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (!auth.authenticated) throw new Error(osmLoginRequiredMessage)
      return countStore.put(
        dataset,
        edgeId,
        countRecordFromFormData(new FormData(form), auth.displayName),
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
          <DescriptionTerm>Zuletzt</DescriptionTerm>
          <DescriptionDetails>
            {saved.updated_by ?? '—'}
            {saved.updated_at ? ` · ${saved.updated_at.replace('T', ' ').slice(0, 19)}` : null}
          </DescriptionDetails>
        </DescriptionList>
      </div>

      <Divider soft />

      <Fieldset>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <p className="text-sm/6 font-medium text-zinc-400">Links</p>
          <p className="text-sm/6 font-medium text-zinc-400">Rechts</p>
          {categories.map((category) => (
            <div key={category.key} className="contents">
              <Field>
                <Label>{category.label} links</Label>
                <Input
                  type="number"
                  min={0}
                  name={`left_${category.key}`}
                  defaultValue={saved.left[category.key] ?? ''}
                  autoComplete="off"
                  data-testid={`admin-left-${category.key}`}
                />
              </Field>
              <Field>
                <Label>{category.label} rechts</Label>
                <Input
                  type="number"
                  min={0}
                  name={`right_${category.key}`}
                  defaultValue={saved.right[category.key] ?? ''}
                  autoComplete="off"
                  data-testid={`admin-right-${category.key}`}
                />
              </Field>
            </div>
          ))}
        </div>
      </Fieldset>

      <Field>
        <Label>Notiz</Label>
        <Textarea name="note" rows={3} defaultValue={saved.note ?? ''} />
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
              if (!window.confirm('Zählung für diese Kante löschen?')) return
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
