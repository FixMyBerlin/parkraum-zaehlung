import { create } from 'zustand'
import type { CountPeriod } from '@/shared/counts/schema'

/**
 * Which count period (Sunday/midday/evening) the map form and the admin form
 * currently show. Shared between both so switching one switches the other.
 * Survives edge changes and form remounts — it lives outside the form's
 * `key={...}` lifecycle on purpose.
 */
interface CountPeriodStore {
  activePeriod: CountPeriod
  actions: {
    setActivePeriod: (period: CountPeriod) => void
  }
}

const useCountPeriodStore = create<CountPeriodStore>()((set) => ({
  activePeriod: 'sunday',
  actions: {
    setActivePeriod: (activePeriod) =>
      set((state) => (state.activePeriod === activePeriod ? state : { activePeriod })),
  },
}))

export const useActiveCountPeriod = () => useCountPeriodStore((state) => state.activePeriod)
export const useCountPeriodActions = () => useCountPeriodStore((state) => state.actions)

/**
 * Exposed for unit tests only (`getState`/`setState`, not the hook-call signature) —
 * components must use the selector hooks above instead of subscribing to the whole store.
 */
export const countPeriodStoreForTests: Pick<typeof useCountPeriodStore, 'getState' | 'setState'> =
  useCountPeriodStore
