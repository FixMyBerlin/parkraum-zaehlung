import { create } from 'zustand'

type FlushPendingSave = () => Promise<unknown>
type SaveLocation = (lng: number, lat: number) => Promise<void>

interface ManualPointDragStore {
  pointId: string | null
  flush: FlushPendingSave | null
  saveLocation: SaveLocation | null
  actions: {
    register: (
      pointId: string,
      handlers: { flush: FlushPendingSave; saveLocation: SaveLocation },
    ) => void
    unregister: (pointId: string) => void
  }
}

/**
 * Bridges `EditPanel`'s autosave queue (occupancy debouncer, serialized save order)
 * to `CountingMap`'s draggable Marker for the selected manual point. EditPanel is the
 * only place that owns that queue, so it registers handlers here while a manual point
 * is open; the map calls them to flush a pending occupancy save before a drag starts,
 * then push the new location through the same serialized queue on drop — see the
 * "Move (no extra edit mode)" section of the manual-points plan for why this matters.
 */
const useManualPointDragStore = create<ManualPointDragStore>()((set, get) => ({
  pointId: null,
  flush: null,
  saveLocation: null,
  actions: {
    register: (pointId, handlers) => set({ pointId, ...handlers }),
    unregister: (pointId) => {
      if (get().pointId !== pointId) return
      set({ pointId: null, flush: null, saveLocation: null })
    },
  },
}))

export const useManualPointFlush = () => useManualPointDragStore((state) => state.flush)
export const useManualPointSaveLocation = () =>
  useManualPointDragStore((state) => state.saveLocation)
export const useManualPointDragActions = () => useManualPointDragStore((state) => state.actions)
