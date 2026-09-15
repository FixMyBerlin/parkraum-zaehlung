import { useHotkeys } from '@tanstack/react-hotkeys'
import type { Position } from 'geojson'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useActiveCountPeriod } from '@/components/count-period-store'
import { CountPeriodToggle } from '@/components/CountPeriodToggle'
import { useMapBearing, useMapUiActions } from '@/components/shared/map-ui-store'
import { cn } from '@/shared/cn'
import { countFieldTabOrder } from '@/shared/counts/count-field-tab-order'
import { firstUncountedSide } from '@/shared/counts/focus-side'
import { countPeriods, type CountPeriod, type CountRecord } from '@/shared/counts/schema'
import { useTextEntryFocused } from '@/shared/dom/text-entry-focus'
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

const sideInputClassName = {
  left: 'border-sky-400/70 bg-sky-400/10 ring-1 ring-inset ring-sky-400/40 dark:border-sky-400/50 dark:bg-sky-400/10',
  right:
    'border-rose-400/70 bg-rose-400/10 ring-1 ring-inset ring-rose-400/40 dark:border-rose-400/50 dark:bg-rose-400/10',
} as const

const sideInputFocusClassName = {
  left: 'focus-visible:bg-sky-400/20 focus-visible:ring-2 focus-visible:ring-sky-400',
  right: 'focus-visible:bg-rose-400/20 focus-visible:ring-2 focus-visible:ring-rose-400',
} as const

function countInputClassName(side: Side) {
  return cn(
    'min-h-9 w-full rounded-lg border py-1.5 pr-6 pl-2 text-center text-base/6 tabular-nums text-zinc-950 sm:text-sm/6 dark:text-white dark:scheme-dark',
    'focus:outline-hidden',
    sideInputClassName[side],
    sideInputFocusClassName[side],
    'disabled:cursor-not-allowed disabled:opacity-50 dark:disabled:bg-white/2.5',
    '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]',
  )
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
  const { setFocusedCountSide } = useMapUiActions()
  const activePeriod = useActiveCountPeriod()
  const textEntryFocused = useTextEntryFocused()
  const fieldRefs = useRef(new Map<string, HTMLInputElement>())

  const columns = screenOrderedSides(coordinates, mapBearing)

  function fieldKey(
    period: CountPeriod,
    side: Side,
    categoryKey: (typeof categories)[number]['key'],
  ) {
    return `${period}_${side}_${categoryKey}`
  }

  function focusField(
    period: CountPeriod,
    side: Side,
    categoryKey: (typeof categories)[number]['key'],
  ) {
    const field = fieldRefs.current.get(fieldKey(period, side, categoryKey))
    if (!field || field.disabled) return
    field.focus()
    field.select()
  }

  function handleCountInputTab(
    event: KeyboardEvent<HTMLInputElement>,
    side: Side,
    categoryKey: (typeof categories)[number]['key'],
  ) {
    if (event.key !== 'Tab') return
    const order = countFieldTabOrder(columns)
    const index = order.findIndex((field) => field.side === side && field.key === categoryKey)
    if (index < 0) return
    const next = event.shiftKey ? order[index - 1] : order[index + 1]
    if (!next) return
    event.preventDefault()
    focusField(activePeriod, next.side, next.key)
  }

  useEffect(
    function focusFirstUncountedColumnForActivePeriod() {
      // Drop the previous highlight first: on a fully counted column nothing takes
      // focus, so the map would keep thickening a side nobody is editing.
      setFocusedCountSide(null)
      const side = firstUncountedSide(columns, disabledSides, saved, activePeriod)
      if (!side) return
      focusField(activePeriod, side, categories[0].key)
    },
    // Fires once per selected edge (a new edge remounts this grid by key, so the
    // effect runs with whatever period is active) and again whenever the toggle
    // switches `activePeriod` on the same edge — by design, not on every `saved`
    // update from autosave, which would steal focus back mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePeriod],
  )

  useHotkeys(
    categories.flatMap((category) =>
      columns.map((side, columnIndex) => ({
        hotkey: category.hotkeys[columnIndex]!,
        callback: () => focusField(activePeriod, side, category.key),
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
    <div className="space-y-2">
      <CountPeriodToggle />
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-20 p-0" />
            {columns.map((side) => (
              <th
                key={side}
                id={`${formId}-${side}`}
                scope="col"
                className="px-2 py-1 text-left align-bottom text-sm font-medium text-zinc-950 dark:text-white"
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
        {countPeriods.map((period) => (
          <tbody key={period} hidden={period !== activePeriod}>
            {categories.map((category) => (
              <tr key={category.key}>
                <th
                  id={`${formId}-${period}-${category.key}`}
                  scope="row"
                  className="py-0.5 pr-2 text-left align-middle text-sm font-medium text-zinc-950 dark:text-white"
                >
                  {category.label}
                </th>
                {columns.map((side, columnIndex) => {
                  return (
                    <td key={side} className="px-1 py-0.5 align-middle">
                      <div className="relative">
                        <input
                          ref={(element) => {
                            const key = fieldKey(period, side, category.key)
                            if (element) fieldRefs.current.set(key, element)
                            else fieldRefs.current.delete(key)
                          }}
                          id={`${formId}-${period}-${side}-${category.key}`}
                          name={`${period}_${side}_${category.key}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          autoComplete="off"
                          defaultValue={saved?.periods[period][side][category.key] ?? ''}
                          aria-labelledby={`${formId}-${period}-${category.key} ${formId}-${side}`}
                          aria-keyshortcuts={
                            period === activePeriod
                              ? category.hotkeys[columnIndex]!.toLowerCase()
                              : undefined
                          }
                          tabIndex={period === activePeriod ? undefined : -1}
                          className={countInputClassName(side)}
                          data-testid={`${period}-${side}-${category.key}`}
                          onKeyDown={(event) => handleCountInputTab(event, side, category.key)}
                          onFocus={(event) => {
                            setFocusedCountSide(side)
                            event.currentTarget.select()
                          }}
                        />
                        {period === activePeriod ? (
                          <kbd
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center font-sans text-[10px] text-zinc-500"
                          >
                            {category.hotkeys[columnIndex]}
                          </kbd>
                        ) : null}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
