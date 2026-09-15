import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon, PhotoIcon } from '@heroicons/react/20/solid'
import type { EliCategory, EliLayer } from '@osm-editor-kit/maplibre-editor-layer-index/react'
import { useEditorLayerIndex } from '@osm-editor-kit/maplibre-editor-layer-index/react'
import * as countryCoder from '@rapideditor/country-coder'
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'

const CATEGORY_LABELS: Record<EliCategory, string> = {
  photo: 'Luftbild / Satellit',
  map: 'Karten',
  osmbasedmap: 'OSM-basierte Karten',
  historicmap: 'Historische Karten',
  historicphoto: 'Historische Luftbilder',
  elevation: 'Höhenmodell',
  qa: 'QA',
  other: 'Sonstige',
}

const CATEGORY_ORDER: EliCategory[] = [
  'photo',
  'map',
  'osmbasedmap',
  'historicmap',
  'historicphoto',
  'elevation',
  'qa',
  'other',
]

/** Sentinel value for the default OpenFreeMap Positron option (`bg` omitted from the URL). */
const DEFAULT_OPTION_VALUE = '__default__'

function sortLayers(layers: EliLayer[]): EliLayer[] {
  return [...layers].sort((a, b) => {
    if (a.best !== b.best) return a.best ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Headless UI Listbox to pick an Editor Layer Index background for the current
 * viewport, or fall back to the default OpenFreeMap Positron style. `lat`/`lng`
 * come from the `?map=` search value (only updated on `moveend`), so the country
 * filter does not re-run the ELI query on every pan frame.
 */
export function MapBackgroundLayerControl({
  bg,
  lat,
  lng,
}: {
  bg: string | null
  lat: number
  lng: number
}) {
  const navigate = useNavigate({ from: Route.fullPath })
  const centerCountry = countryCoder.iso1A2Code([lng, lat])

  const { layers, status } = useEditorLayerIndex({
    mapId: MAIN_MAP_ID,
    filter: {
      excludeOverlays: true,
      ...(centerCountry ? { countryCodes: [centerCountry] } : {}),
    },
  })

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: sortLayers(layers.filter((layer) => (layer.category ?? 'other') === category)),
  })).filter((group) => group.items.length > 0)

  const selectedLayer = layers.find((layer) => layer.id === bg)
  const value = bg ?? DEFAULT_OPTION_VALUE

  function handleChange(nextValue: string) {
    const nextBg = nextValue === DEFAULT_OPTION_VALUE ? undefined : nextValue
    void navigate({
      search: (previous) => ({ ...previous, bg: nextBg }),
      replace: true,
    })
  }

  return (
    <Listbox value={value} onChange={handleChange}>
      <ListboxButton
        aria-label="Hintergrundkarte"
        className="flex max-w-44 items-center gap-1.5 rounded-lg bg-zinc-900/90 px-3 py-2 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 hover:bg-zinc-800"
      >
        <PhotoIcon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{selectedLayer ? selectedLayer.name : 'Hintergrundkarte'}</span>
        <ChevronUpDownIcon className="size-4 shrink-0 opacity-70" aria-hidden />
      </ListboxButton>
      <ListboxOptions
        anchor={{ to: 'bottom end', gap: 8, padding: 12 }}
        className="z-50 max-h-[min(24rem,calc(100dvh-5.5rem))] w-[min(20rem,calc(100vw-1.25rem))] rounded-lg bg-zinc-900/95 p-1 text-sm text-white shadow-lg ring-1 ring-white/10"
      >
        <ListboxOption
          value={DEFAULT_OPTION_VALUE}
          className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 data-focus:bg-white/10"
        >
          <CheckIcon
            className={cn('size-4 shrink-0', value === DEFAULT_OPTION_VALUE ? '' : 'opacity-0')}
            aria-hidden
          />
          <span>OpenFreeMap Positron (Standard)</span>
        </ListboxOption>

        {status === 'loading' && groups.length === 0 ? (
          <div className="px-2 py-1.5 text-white/60">Ebenen werden geladen …</div>
        ) : null}

        {groups.map((group) => (
          <div
            key={group.category}
            className="mt-1 border-t border-white/10 pt-1 first:mt-0 first:border-0 first:pt-0"
          >
            <div className="px-2 py-1 text-[11px] font-semibold tracking-wide text-white/50 uppercase">
              {group.label}
            </div>
            {group.items.map((layer) => (
              <ListboxOption
                key={layer.id}
                value={layer.id}
                className="flex cursor-default items-start gap-2 rounded-md px-2 py-1.5 data-focus:bg-white/10"
              >
                <CheckIcon
                  className={cn('mt-0.5 size-4 shrink-0', layer.id === bg ? '' : 'opacity-0')}
                  aria-hidden
                />
                <span className="whitespace-normal">
                  {layer.name}
                  {layer.best ? ' ⭐' : null}
                </span>
              </ListboxOption>
            ))}
          </div>
        ))}

        {status === 'ready' && groups.length === 0 ? (
          <div className="px-2 py-1.5 text-white/60">Keine Luftbild-Ebenen hier</div>
        ) : null}
      </ListboxOptions>
    </Listbox>
  )
}
