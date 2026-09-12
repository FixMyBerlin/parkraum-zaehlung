import * as Headless from '@headlessui/react'
import { Link as RouterLink } from '@tanstack/react-router'
import type React from 'react'

/**
 * Catalyst call sites only ever pass a plain string `href` (internal paths,
 * external URLs, `mailto:`, asset links), never a typed TanStack `to` with
 * params/search. TanStack Router's `Link` accepts a plain, non-literal
 * `string` for `to` as an escape hatch: it skips route-path validation but
 * still runs the same detection as a literal `to`, so same-tab clicks on
 * internal-looking paths get client-side navigation while absolute external
 * URLs and non-`_self` targets fall through to normal browser navigation.
 * `href` still means "any string", matching Catalyst's original contract, so
 * no call site needs to change.
 */
export function Link({
  ref,
  href,
  ...props
}: { href: string; ref?: React.Ref<HTMLAnchorElement> } & Omit<
  React.ComponentPropsWithoutRef<'a'>,
  'href'
>) {
  return (
    <Headless.DataInteractive>
      <RouterLink to={href} {...props} ref={ref} />
    </Headless.DataInteractive>
  )
}
