import { create } from 'zustand'

type HoveredSide = 'left' | 'right' | 'center' | null
type CountSide = 'left' | 'right'

interface MapUiStore {
  hoveredEdgeId: string | null
  hoveredSide: HoveredSide
  focusedCountSide: CountSide | null
  actions: {
    setHover: (edgeId: string | null, side: HoveredSide) => void
    setFocusedCountSide: (side: CountSide | null) => void
  }
}

const useMapUiStore = create<MapUiStore>()((set) => ({
  hoveredEdgeId: null,
  hoveredSide: null,
  focusedCountSide: null,
  actions: {
    setHover: (hoveredEdgeId, hoveredSide) => set({ hoveredEdgeId, hoveredSide }),
    setFocusedCountSide: (focusedCountSide) => set({ focusedCountSide }),
  },
}))

export const useHoveredEdgeId = () => useMapUiStore((state) => state.hoveredEdgeId)
export const useHoveredSide = () => useMapUiStore((state) => state.hoveredSide)
export const useFocusedCountSide = () => useMapUiStore((state) => state.focusedCountSide)
export const useMapUiActions = () => useMapUiStore((state) => state.actions)
