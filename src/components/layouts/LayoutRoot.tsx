import { Outlet } from '@tanstack/react-router'

export function LayoutRoot() {
  return (
    <div className="h-full w-full">
      <Outlet />
    </div>
  )
}
