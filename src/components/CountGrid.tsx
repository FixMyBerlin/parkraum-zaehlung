import type { Position } from 'geojson'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import {
  periodFlags,
  useActiveCountPeriod,
  useCountPeriodActions,
} from '@/components/count-period-store'
import { CountPeriodToggle } from '@/components/CountPeriodToggle'
import { useMapBearing, useMapUiActions } from '@/components/shared/map-ui-store'
import { cn } from '@/shared/cn'
import { countFieldTabOrder } from '@/shared/counts/count-field-tab-order'
import { firstUncountedSide } from '@/shared/counts/focus-side'
import {
  countCategories,
  countCategoryLabel,
  countPeriods,
  isPeriodSideCounted,
  type CountCategory,
  type CountPeriod,
  type CountRecord,
  type Side,
} from '@/shared/counts/schema'
import { screenOrderedSides } from '@/shared/edges/way-side-order'
import { ignorePasswordManagerProps } from '@/shared/form-ignore-password-manager'
import { EDGE_SIDE_LINE_COLOR } from '@/shared/map/edge-side-style'

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
    'min-h-9 w-full rounded-lg border px-2 py-1.5 text-center text-base/6 tabular-nums text-zinc-950 sm:text-sm/6 dark:text-white dark:scheme-dark',
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
  const { setPeriodHasData, resetPeriodHasData } = useCountPeriodActions()
  const fieldRefs = useRef(new Map<string, HTMLInputElement>())
  // The side+category last focused by the user, kept across period switches so
  // pressing a tab shortcut (or clicking a segment) returns focus to the same cell instead
  // of jumping to the first uncounted field. Reset to null on every edge (a new
  // `CountGrid` instance, since the parent remounts this by key).
  const lastFocusedFieldRef = useRef<{
    side: Side
    categoryKey: CountCategory
  } | null>(null)

  const columns = screenOrderedSides(coordinates, mapBearing)

  function fieldKey(period: CountPeriod, side: Side, categoryKey: CountCategory) {
    return `${period}_${side}_${categoryKey}`
  }

  function focusField(period: CountPeriod, side: Side, categoryKey: CountCategory) {
    const field = fieldRefs.current.get(fieldKey(period, side, categoryKey))
    if (!field || field.disabled) return
    field.focus()
    field.select()
  }

  function handleCountInputTab(
    event: KeyboardEvent<HTMLInputElement>,
    side: Side,
    categoryKey: CountCategory,
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

  /** Does any of the period's inputs currently hold a value, read live from the DOM? */
  function periodHasAnyInputValue(period: CountPeriod) {
    return (['left', 'right'] as const).some((side) =>
      countCategories.some((category) => {
        const field = fieldRefs.current.get(fieldKey(period, side, category))
        return Boolean(field && field.value !== '')
      }),
    )
  }

  function handleCountInputChange(period: CountPeriod) {
    setPeriodHasData(period, periodHasAnyInputValue(period))
  }

  function periodSavedHasData(period: CountPeriod) {
    if (!saved) return false
    return isPeriodSideCounted(saved, period, 'left') || isPeriodSideCounted(saved, period, 'right')
  }

  useEffect(
    function seedPeriodDataIndicatorFromSaved() {
      // Runs once per mounted edge only — this seeds the toggle's data indicator from
      // the last saved state; live typing updates it via `handleCountInputChange`.
      resetPeriodHasData(periodFlags(periodSavedHasData))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(
    function focusFirstUncountedColumnForActivePeriod() {
      // Drop the previous highlight first: on a fully counted column nothing takes
      // focus, so the map would keep thickening a side nobody is editing.
      setFocusedCountSide(null)
      const lastFocused = lastFocusedFieldRef.current
      if (lastFocused) {
        // A count input was focused before this switch (hotkey/segment click): keep
        // editing the same cell in the newly active period instead of jumping around.
        focusField(activePeriod, lastFocused.side, lastFocused.categoryKey)
        return
      }
      // Fresh edge mount, nothing focused yet: fall back to the first uncounted field.
      const side = firstUncountedSide(columns, disabledSides, saved, activePeriod)
      if (!side) return
      focusField(activePeriod, side, countCategories[0])
    },
    // Fires once per selected edge (a new edge remounts this grid by key, so the
    // effect runs with whatever period is active) and again whenever the toggle
    // switches `activePeriod` on the same edge — by design, not on every `saved`
    // update from autosave, which would steal focus back mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePeriod],
  )

  return (
    <div className="space-y-2">
      <CountPeriodToggle />
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-36 p-0" />
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
            {countCategories.map((category) => (
              <tr key={category}>
                <th
                  id={`${formId}-${period}-${category}`}
                  scope="row"
                  className="py-0.5 pr-2 text-left align-middle text-sm font-medium text-zinc-950 dark:text-white"
                >
                  {countCategoryLabel[category]}
                </th>
                {columns.map((side) => {
                  return (
                    <td key={side} className="px-1 py-0.5 align-middle">
                      <div className="relative">
                        <input
                          ref={(element) => {
                            const key = fieldKey(period, side, category)
                            if (element) fieldRefs.current.set(key, element)
                            else fieldRefs.current.delete(key)
                          }}
                          id={`${formId}-${period}-${side}-${category}`}
                          name={`${period}_${side}_${category}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          {...ignorePasswordManagerProps}
                          defaultValue={saved?.periods[period][side][category] ?? ''}
                          aria-labelledby={`${formId}-${period}-${category} ${formId}-${side}`}
                          tabIndex={period === activePeriod ? undefined : -1}
                          className={countInputClassName(side)}
                          data-testid={`${period}-${side}-${category}`}
                          onKeyDown={(event) => handleCountInputTab(event, side, category)}
                          onChange={() => handleCountInputChange(period)}
                          onFocus={(event) => {
                            lastFocusedFieldRef.current = { side, categoryKey: category }
                            setFocusedCountSide(side)
                            event.currentTarget.select()
                          }}
                        />
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
