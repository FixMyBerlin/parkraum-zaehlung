import { create } from 'zustand'

/**
 * Edges picked with Shift+click (map or list) for a bulk action, e.g. entering 0 on
 * every arm of a roundabout at once. Separate from the single `edge` search param:
 * while this holds any id, the sidebar shows the bulk panel instead of the count form.
 */
interface MultiSelectStore {
  edgeIds: string[]
  actions: {
    /**
     * Adds or removes `edgeId`. `seedEdgeId` is the edge open in the count form (if
     * any): it joins the selection when the first Shift+click starts one.
     */
    toggleEdge: (edgeId: string, seedEdgeId?: string) => void
    clear: () => void
  }
}

const noEdgeIds: string[] = []

const useMultiSelectStore = create<MultiSelectStore>()((set) => ({
  edgeIds: noEdgeIds,
  actions: {
    toggleEdge: (edgeId, seedEdgeId) =>
      set((state) => {
        if (state.edgeIds.includes(edgeId)) {
          return { edgeIds: state.edgeIds.filter((id) => id !== edgeId) }
        }
        const seed =
          state.edgeIds.length === 0 && seedEdgeId && seedEdgeId !== edgeId ? [seedEdgeId] : []
        return { edgeIds: [...state.edgeIds, ...seed, edgeId] }
      }),
    clear: () => set((state) => (state.edgeIds.length === 0 ? state : { edgeIds: noEdgeIds })),
  },
}))

export const useMultiSelectedEdgeIds = () => useMultiSelectStore((state) => state.edgeIds)
export const useMultiSelectActions = () => useMultiSelectStore((state) => state.actions)

/** Exposed for unit tests only — components must use the selector hooks above. */
export const multiSelectStoreForTests: Pick<typeof useMultiSelectStore, 'getState' | 'setState'> =
  useMultiSelectStore
