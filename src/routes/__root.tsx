import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createRootRoute({
  // Pair with `trailingSlash: 'never'` in main.tsx: keep share URLs canonical.
  beforeLoad: ({ location }) => {
    const { pathname, searchStr, hash } = location
    if (pathname.length <= 1 || !pathname.endsWith('/')) return
    const stripped = pathname.replace(/\/+$/, '') || '/'
    throw redirect({
      href: `${stripped}${searchStr}${hash ? `#${hash}` : ''}`,
      replace: true,
    })
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="h-full w-full">
      <Outlet />
    </div>
  )
}
