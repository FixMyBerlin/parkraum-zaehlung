import { useHotkeys } from '@tanstack/react-hotkeys'
import { useCountPeriodActions, useActiveCountPeriod } from '@/components/count-period-store'
import { cn } from '@/shared/cn'
import { countPeriods, type CountPeriod } from '@/shared/counts/schema'
import { useTextEntryFocused } from '@/shared/dom/text-entry-focus'

const periodLabel: Record<CountPeriod, string> = {
  sunday: 'Sonntag',
  midday: 'Mittags',
  evening: 'Abends',
}

const periodHotkey = {
  sunday: 'E',
  midday: 'D',
  evening: 'C',
} as const satisfies Record<CountPeriod, string>

/**
 * Segmented Sonntag/Mittags/Abends control shared by the map form and the
 * admin form (both read the same `count-period-store`), with E/D/C shortcuts
 * mirroring the toggle. Switching periods only moves the store's pointer —
 * it never touches form values, so it cannot trigger a save or a remount.
 * (`CountGrid` reacts to the new `activePeriod` with its own effect to move
 * focus, rather than this component reaching into the grid.)
 */
export function CountPeriodToggle() {
  const activePeriod = useActiveCountPeriod()
  const { setActivePeriod } = useCountPeriodActions()
  const textEntryFocused = useTextEntryFocused()

  useHotkeys(
    countPeriods.map((period) => ({
      hotkey: periodHotkey[period],
      callback: () => setActivePeriod(period),
      options: {
        meta: {
          name: periodLabel[period],
          description: `Zeitraum ${periodLabel[period]}`,
        },
      },
    })),
    { enabled: !textEntryFocused, ignoreInputs: false },
  )

  return (
    <div
      role="radiogroup"
      aria-label="Zeitraum"
      className="inline-flex gap-0.5 rounded-lg bg-zinc-950/5 p-0.5 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10"
    >
      {countPeriods.map((period) => (
        <button
          key={period}
          type="button"
          role="radio"
          aria-checked={activePeriod === period}
          aria-keyshortcuts={periodHotkey[period].toLowerCase()}
          data-testid={`period-toggle-${period}`}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium',
            'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-400',
            activePeriod === period
              ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
          )}
          onClick={() => setActivePeriod(period)}
        >
          {periodLabel[period]}
          <kbd
            aria-hidden="true"
            className="rounded border border-current/30 px-1 font-sans text-[10px] opacity-70"
          >
            {periodHotkey[period]}
          </kbd>
        </button>
      ))}
    </div>
  )
}
