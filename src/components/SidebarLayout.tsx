import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  useSidebarWidth,
  useSidebarWidthActions,
} from '@/features/layout/sidebar-width-store'
import { cn } from '@/shared/cn'

type SidebarLayoutProps = {
  header: (opts: { onOpenSidebar: () => void }) => ReactNode
  sidebar: ReactNode
  children: ReactNode
}

export function SidebarLayout({ header, sidebar, children }: SidebarLayoutProps) {
  const sidebarWidth = useSidebarWidth()
  const { setWidth } = useSidebarWidthActions()
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950">
      {header({ onOpenSidebar: () => setShowSidebar(true) })}
      <div className="relative isolate flex min-h-0 flex-1">
        <aside
          className="relative hidden h-full min-h-0 shrink-0 bg-zinc-900 lg:flex lg:flex-col"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {sidebar}
          </div>
          <SidebarResizeHandle width={sidebarWidth} setWidth={setWidth} />
        </aside>

        <Dialog open={showSidebar} onClose={setShowSidebar} className="relative z-50 lg:hidden">
          <DialogBackdrop
            transition
            className="fixed inset-0 bg-zinc-950/80 transition data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
          />
          <div className="fixed inset-0 flex">
            <DialogPanel
              transition
              className="relative flex w-full max-w-sm flex-1 transform transition duration-300 ease-in-out data-closed:-translate-x-full"
            >
              <div className="flex h-full w-full flex-col bg-zinc-900 ring-1 ring-white/10">
                <div className="flex justify-end px-3 pt-3">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
                    aria-label="Seitenleiste schließen"
                    onClick={() => setShowSidebar(false)}
                  >
                    <XMarkIcon className="size-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">{sidebar}</div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        <main className="relative min-h-0 min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

type SidebarResizeHandleProps = {
  width: number
  setWidth: (width: number) => void
}

function SidebarResizeHandle({ width, setWidth }: SidebarResizeHandleProps) {
  const dragRef = useRef({ startWidth: width, startX: 0 })

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startWidth: width, startX: event.clientX }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const { startWidth, startX } = dragRef.current
    setWidth(startWidth + (event.clientX - startX))
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setWidth(width - 16)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setWidth(width + 16)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setWidth(MIN_SIDEBAR_WIDTH)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setWidth(MAX_SIDEBAR_WIDTH)
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={width}
      aria-label="Seitenleiste verbreitern"
      tabIndex={0}
      className={cn(
        'absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none select-none',
        'bg-transparent hover:bg-white/20 active:bg-white/20',
        'focus:outline-none focus-visible:bg-white/20',
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  )
}
