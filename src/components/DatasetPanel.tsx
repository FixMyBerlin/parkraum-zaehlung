import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Checkbox, CheckboxField } from '@/components/ui/checkbox'
import { Description, ErrorMessage, Field, Fieldset, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Code, Text, TextLink } from '@/components/ui/text'
import { sampleEdgesGithubUrl } from '@/config/app.const'
import { Route } from '@/routes/index'
import { listDatasets, saveDataset } from '@/shared/datasets/dataset-idb'
import { parseEdgesText } from '@/shared/edges/parse-edges'
import { slugifyDatasetName } from '@/shared/edges/schema'

const filePickerLabelClassName =
  'relative isolate inline-flex cursor-pointer items-baseline justify-center rounded-lg border border-zinc-950/10 px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 font-semibold text-zinc-950 hover:bg-zinc-950/2.5 dark:border-white/15 dark:text-white dark:hover:bg-white/5'

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
        replace: true,
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

  useEffect(
    function importEdgesFromSearchUrl() {
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
    },
    [edgesUrl, dataset, importMutation],
  )

  return (
    <section className="space-y-4">
      <Fieldset>
        <Subheading>Kanten importieren</Subheading>
        <Text>
          Die Datei kommt aus TILDA: Region → Export → Straßenkanten (<Code>parkings_edges</Code>)
          als GeoJSON-FeatureCollection (v1).
        </Text>
        <Text>
          <TextLink href={sampleEdgesGithubUrl} target="_blank" rel="noreferrer">
            Testdaten herunterladen (dann hochladen)
          </TextLink>
        </Text>
        <Field>
          <Label>
            Name, falls die Datei kein <Code>metadata.dataset</Code> hat
          </Label>
          <Input
            value={pendingName}
            onChange={(event) => setPendingName(event.target.value)}
            placeholder="loerrach-2026-09"
          />
        </Field>
        <div className="mt-4">
          <label className={filePickerLabelClassName}>
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
        </div>
        {error ? (
          <Field>
            <ErrorMessage>{error}</ErrorMessage>
          </Field>
        ) : null}
      </Fieldset>
      <CheckboxField>
        <Checkbox
          checked={parkings}
          onChange={(checked) =>
            void navigate({
              search: (previous) => ({ ...previous, parkings: checked }),
              replace: true,
            })
          }
        />
        <Label>TILDA-Parkraum als Kontext</Label>
        <Description>
          Blendet die von TILDA kartierten Parkstände auf der Karte ein. So siehst du beim Zählen,
          wo laut TILDA Parkraum liegt — als Orientierung, nicht als Zählgrundlage.
        </Description>
      </CheckboxField>
      {datasetsQuery.data && datasetsQuery.data.length > 0 && (
        <Field>
          <Label>Gespeicherte Datensätze</Label>
          <Select
            value={dataset ?? ''}
            onChange={(event) => {
              const next = event.target.value || undefined
              void navigate({
                search: (previous) => ({ ...previous, dataset: next, edge: undefined }),
                replace: true,
              })
            }}
          >
            <option value="">— wählen —</option>
            {datasetsQuery.data.map((item) => (
              <option key={item.dataset} value={item.dataset}>
                {item.dataset}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </section>
  )
}
