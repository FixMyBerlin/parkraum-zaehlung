import { create } from 'zustand'

type HoveredSide = 'left' | 'right' | 'center' | null
type CountSide = 'left' | 'right'

interface MapUiStore {
  hoveredEdgeId: string | null
  hoveredSide: HoveredSide
  focusedCountSide: CountSide | null
  /** Map rotation in degrees, so the count form can order its side columns left→right on screen. */
  mapBearing: number
  actions: {
    setHover: (edgeId: string | null, side: HoveredSide) => void
    setFocusedCountSide: (side: CountSide | null) => void
    setMapBearing: (bearing: number) => void
  }
}

const useMapUiStore = create<MapUiStore>()((set) => ({
  hoveredEdgeId: null,
  hoveredSide: null,
  focusedCountSide: null,
  mapBearing: 0,
  actions: {
    setHover: (hoveredEdgeId, hoveredSide) => set({ hoveredEdgeId, hoveredSide }),
    setFocusedCountSide: (focusedCountSide) => set({ focusedCountSide }),
    setMapBearing: (mapBearing) => set({ mapBearing }),
  },
}))

export const useHoveredEdgeId = () => useMapUiStore((state) => state.hoveredEdgeId)
export const useHoveredSide = () => useMapUiStore((state) => state.hoveredSide)
export const useFocusedCountSide = () => useMapUiStore((state) => state.focusedCountSide)
export const useMapBearing = () => useMapUiStore((state) => state.mapBearing)
export const useMapUiActions = () => useMapUiStore((state) => state.actions)
