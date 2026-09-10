import { useHotkeys } from '@tanstack/react-hotkeys'
import type { Position } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { useFocusedCountSide, useMapBearing, useMapUiActions } from '@/features/map/map-ui-store'
import { cn } from '@/shared/cn'
import { firstUncountedSide } from '@/shared/counts/focus-side'
import type { CountRecord } from '@/shared/counts/schema'
import { screenOrderedSides } from '@/shared/edges/way-side-order'
import { EDGE_SIDE_LINE_COLOR } from '@/shared/map/edge-side-style'

type Side = 'left' | 'right'

/**
 * One row per category, one column per side. Hotkeys mirror the grid on the
 * keyboard so counting stays a two-finger job: `q`/`w` top, `a`/`s` middle,
 * `y`/`x` bottom (German layout, where `y` sits bottom left).
 */
const categories = [
  { key: 'pkw', label: 'Pkw', hotkeys: ['Q', 'W'] },
  { key: 'motorrad', label: 'Motorrad', hotkeys: ['A', 'S'] },
  { key: 'lkw_bus', label: 'Lkw/Bus', hotkeys: ['Y', 'X'] },
] as const

const sideLabel = { left: 'Links', right: 'Rechts' } as const

const sideHeaderClassName = {
  left: 'border-sky-400 bg-sky-400/25 text-sky-100',
  right: 'border-rose-400 bg-rose-400/25 text-rose-100',
} as const

const sideHeaderActiveClassName = {
  left: 'bg-sky-400/45 ring-1 ring-sky-400/60',
  right: 'bg-rose-400/45 ring-1 ring-rose-400/60',
} as const

const sideInputFocusClassName = {
  left: 'focus-visible:ring-sky-400',
  right: 'focus-visible:ring-rose-400',
} as const

function countInputClassName(side: Side) {
  return cn(
    'min-h-9 w-full rounded-lg border border-zinc-950/10 bg-transparent py-1.5 pr-6 pl-2 text-center text-base/6 tabular-nums text-zinc-950 sm:text-sm/6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:scheme-dark',
    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset',
    sideInputFocusClassName[side],
    'disabled:cursor-not-allowed disabled:opacity-50 dark:disabled:border-white/15 dark:disabled:bg-white/2.5',
    '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]',
  )
}

/**
 * Hotkeys must fire while a count input has focus, so they cannot use the
 * library's `ignoreInputs` guard. Disable them whenever the user is typing in a
 * real text field (the note, the dataset name, …) instead.
 */
function isTextEntryElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  if (!(element instanceof HTMLInputElement)) return false
  return element.type !== 'number'
}

function useTextEntryFocused() {
  const [textEntryFocused, setTextEntryFocused] = useState(false)

  useEffect(function trackTextEntryFocus() {
    const update = () => setTextEntryFocused(isTextEntryElement(document.activeElement))
    update()
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])

  return textEntryFocused
}

export function CountGrid({
  formId,
  coordinates,
  disabledSides,
  capacity,
  saved,
}: {
  formId: string
  coordinates: Position[]
  disabledSides: Record<Side, boolean>
  capacity: Record<Side, number | null | undefined>
  saved: CountRecord | undefined
}) {
  const mapBearing = useMapBearing()
  const focusedCountSide = useFocusedCountSide()
  const { setFocusedCountSide } = useMapUiActions()
  const textEntryFocused = useTextEntryFocused()
  const fieldRefs = useRef(new Map<string, HTMLInputElement>())

  const columns = screenOrderedSides(coordinates, mapBearing)

  function focusField(side: Side, categoryKey: (typeof categories)[number]['key']) {
    const field = fieldRefs.current.get(`${side}_${categoryKey}`)
    if (!field || field.disabled) return
    field.focus()
    field.select()
  }

  useEffect(
    function focusFirstUncountedColumn() {
      const side = firstUncountedSide(columns, disabledSides, saved)
      if (!side) return
      focusField(side, categories[0].key)
    },
    // Runs once per selected edge: the parent remounts this grid by key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useHotkeys(
    categories.flatMap((category) =>
      columns.map((side, columnIndex) => ({
        hotkey: category.hotkeys[columnIndex]!,
        callback: () => focusField(side, category.key),
        options: {
          meta: {
            name: `${category.label} ${sideLabel[side]}`,
            description: `Fokus auf ${category.label} ${sideLabel[side]}`,
          },
        },
      })),
    ),
    { enabled: !textEntryFocused, ignoreInputs: false },
  )

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr>
          <th className="w-20 p-0" />
          {columns.map((side) => (
            <th
              key={side}
              id={`${formId}-${side}`}
              scope="col"
              className={cn(
                'rounded-md border-t-4 px-2 py-1 text-left align-bottom text-sm font-medium',
                sideHeaderClassName[side],
                !disabledSides[side] &&
                  focusedCountSide === side &&
                  sideHeaderActiveClassName[side],
              )}
              style={{ borderTopColor: EDGE_SIDE_LINE_COLOR[side] }}
              data-testid={`count-column-${side}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: EDGE_SIDE_LINE_COLOR[side] }}
                />
                {sideLabel[side]}
              </span>
              <span className="mt-0.5 block text-xs font-normal text-zinc-400">
                {disabledSides[side] ? 'kein Parken' : `Kapazität ${capacity[side] ?? '–'}`}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((category) => (
          <tr key={category.key}>
            <th
              id={`${formId}-${category.key}`}
              scope="row"
              className="py-0.5 pr-2 text-left align-middle text-sm font-medium text-zinc-950 dark:text-white"
            >
              {category.label}
            </th>
            {columns.map((side, columnIndex) => {
              const disabled = disabledSides[side]
              return (
                <td key={side} className="px-1 py-0.5 align-middle">
                  <div className="relative">
                    <input
                      ref={(element) => {
                        const key = `${side}_${category.key}`
                        if (element) fieldRefs.current.set(key, element)
                        else fieldRefs.current.delete(key)
                      }}
                      id={`${formId}-${side}-${category.key}`}
                      name={`${side}_${category.key}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      autoComplete="off"
                      disabled={disabled}
                      defaultValue={saved?.[side][category.key] ?? ''}
                      aria-labelledby={`${formId}-${category.key} ${formId}-${side}`}
                      aria-keyshortcuts={category.hotkeys[columnIndex]!.toLowerCase()}
                      className={countInputClassName(side)}
                      data-testid={`${side}-${category.key}`}
                      onFocus={(event) => {
                        setFocusedCountSide(side)
                        event.currentTarget.select()
                      }}
                    />
                    <kbd
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none absolute inset-y-0 right-1.5 flex items-center font-sans text-[10px] text-zinc-500',
                        disabled && 'opacity-50',
                      )}
                    >
                      {category.hotkeys[columnIndex]}
                    </kbd>
                  </div>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
