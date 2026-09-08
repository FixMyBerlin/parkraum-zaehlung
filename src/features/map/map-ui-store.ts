import { create } from 'zustand'

type HoveredSide = 'left' | 'right' | 'center' | null

interface MapUiStore {
  hoveredEdgeId: string | null
  hoveredSide: HoveredSide
  actions: {
    setHover: (edgeId: string | null, side: HoveredSide) => void
  }
}

const useMapUiStore = create<MapUiStore>()((set) => ({
  hoveredEdgeId: null,
  hoveredSide: null,
  actions: {
    setHover: (hoveredEdgeId, hoveredSide) => set({ hoveredEdgeId, hoveredSide }),
  },
}))

export const useHoveredSide = () => useMapUiStore((state) => state.hoveredSide)
export const useMapUiActions = () => useMapUiStore((state) => state.actions)
