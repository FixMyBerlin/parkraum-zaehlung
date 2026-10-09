import { create } from 'zustand'
import { countPeriods, type CountPeriod } from '@/shared/counts/schema'

/**
 * Which count period (one of the count tabs) the map form and the admin form
 * currently show. Shared between both so switching one switches the other.
 * Survives edge changes and form remounts — it lives outside the form's
 * `key={...}` lifecycle on purpose.
 */
type PeriodHasData = Record<CountPeriod, boolean>

/** One flag per count period, e.g. to seed `resetPeriodHasData` from a saved record. */
export function periodFlags(hasData: (period: CountPeriod) => boolean) {
  return Object.fromEntries(
    countPeriods.map((period) => [period, hasData(period)]),
  ) as PeriodHasData
}

const emptyPeriodHasData = periodFlags(() => false)

interface CountPeriodStore {
  activePeriod: CountPeriod
  /**
   * Whether each period has any counted value on the currently open edge, kept live
   * by `CountGrid` (from its inputs, not just `saved`) so the toggle can show a data
   * indicator per segment even before autosave has written anything.
   */
  periodHasData: PeriodHasData
  actions: {
    setActivePeriod: (period: CountPeriod) => void
    setPeriodHasData: (period: CountPeriod, hasData: boolean) => void
    /** Re-seeds every flag at once — called once per edge, from `saved`. */
    resetPeriodHasData: (periodHasData: PeriodHasData) => void
  }
}

const useCountPeriodStore = create<CountPeriodStore>()((set) => ({
  activePeriod: 'sunday',
  periodHasData: emptyPeriodHasData,
  actions: {
    setActivePeriod: (activePeriod) =>
      set((state) => (state.activePeriod === activePeriod ? state : { activePeriod })),
    setPeriodHasData: (period, hasData) =>
      set((state) =>
        state.periodHasData[period] === hasData
          ? state
          : { periodHasData: { ...state.periodHasData, [period]: hasData } },
      ),
    resetPeriodHasData: (periodHasData) => set({ periodHasData }),
  },
}))

export const useActiveCountPeriod = () => useCountPeriodStore((state) => state.activePeriod)
export const useCountPeriodHasData = () => useCountPeriodStore((state) => state.periodHasData)
export const useCountPeriodActions = () => useCountPeriodStore((state) => state.actions)

/**
 * Exposed for unit tests only (`getState`/`setState`, not the hook-call signature) —
 * components must use the selector hooks above instead of subscribing to the whole store.
 */
export const countPeriodStoreForTests: Pick<typeof useCountPeriodStore, 'getState' | 'setState'> =
  useCountPeriodStore
