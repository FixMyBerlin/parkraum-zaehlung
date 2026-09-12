import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const MIN_SIDEBAR_WIDTH = 280
export const MAX_SIDEBAR_WIDTH = 640
const DEFAULT_WIDTH = 384

interface SidebarWidthStore {
  width: number
  actions: {
    setWidth: (width: number) => void
  }
}

const useSidebarWidthStore = create<SidebarWidthStore>()(
  persist(
    (set) => ({
      width: DEFAULT_WIDTH,
      actions: {
        setWidth: (width) =>
          set((state) => {
            const next = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
            return next === state.width ? state : { width: next }
          }),
      },
    }),
    {
      name: 'parkraum-zaehlung-sidebar-width',
      partialize: (state) => ({ width: state.width }),
    },
  ),
)

export const useSidebarWidth = () => useSidebarWidthStore((state) => state.width)
export const useSidebarWidthActions = () => useSidebarWidthStore((state) => state.actions)
