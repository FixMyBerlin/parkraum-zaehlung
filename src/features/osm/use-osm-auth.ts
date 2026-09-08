import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { isOsmLoginConfigured } from '@/config/app.const'
import {
  completeOsmLoginFromUrl,
  getOsmAuth,
  getOsmToken,
  loginWithOsm,
  logoutOsm,
} from '@/shared/osm/osm-auth'

type OsmUser = {
  displayName: string
}

async function fetchOsmUser(): Promise<OsmUser | null> {
  const auth = getOsmAuth()
  if (!auth?.authenticated()) return null
  const response = await auth.fetch('/api/0.6/user/details.json', { method: 'GET' })
  if (!response.ok) return null
  const payload = (await response.json()) as { user?: { display_name?: string } }
  const displayName = payload.user?.display_name
  return displayName ? { displayName } : null
}

function stripOauthParamsFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export function useOsmAuth() {
  const [authenticated, setAuthenticated] = useState(() => getOsmAuth()?.authenticated() ?? false)

  useEffect(() => {
    if (!window.location.search.includes('code=')) return
    let cancelled = false
    void completeOsmLoginFromUrl(window.location.search).then((completed) => {
      if (cancelled || !completed) return
      setAuthenticated(true)
      stripOauthParamsFromUrl()
    })
    return () => {
      cancelled = true
    }
  }, [])

  const userQuery = useQuery({
    queryKey: ['osm-user'],
    queryFn: fetchOsmUser,
    enabled: isOsmLoginConfigured() && authenticated,
  })

  return {
    configured: isOsmLoginConfigured(),
    authenticated,
    displayName: userQuery.data?.displayName,
    token: getOsmToken(),
    login: () => {
      loginWithOsm()
    },
    logout: () => {
      logoutOsm()
      setAuthenticated(false)
    },
  }
}
