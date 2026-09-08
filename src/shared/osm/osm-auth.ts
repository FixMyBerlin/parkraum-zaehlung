import { osmAuth } from 'osm-auth'
import {
  isOsmLoginConfigured,
  OSM_AUTH_RETURN_URL_KEY,
  OSM_OAUTH_LAND_FILENAME,
  osmClientId,
} from '@/config/app.const'

type OsmAuthInstance = {
  authenticated: () => boolean
  authenticate: (callback: (error?: unknown) => void) => void
  logout: () => void
  getAccessToken: () => string
  fetch: (path: string, options: { method: 'GET'; prefix?: boolean }) => Promise<Response>
}

export function getOsmOAuthRedirectUrl(
  origin = globalThis.location?.origin ?? '',
  baseUrl = import.meta.env.BASE_URL,
) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${origin}${base}${OSM_OAUTH_LAND_FILENAME}`
}

let auth: OsmAuthInstance | null = null

export function getOsmAuth() {
  if (!isOsmLoginConfigured()) return null
  auth ??= new osmAuth({
    client_id: osmClientId,
    redirect_uri: getOsmOAuthRedirectUrl(),
    scope: 'read_prefs',
    singlepage: true,
  }) as unknown as OsmAuthInstance
  return auth
}

export function getOsmToken() {
  const instance = getOsmAuth()
  if (!instance?.authenticated()) return null
  return instance.getAccessToken() || null
}

function rememberOsmReturnUrl() {
  const { pathname, search, hash } = globalThis.location
  localStorage.setItem(OSM_AUTH_RETURN_URL_KEY, `${pathname}${search}${hash}`)
}

export function loginWithOsm() {
  const instance = getOsmAuth()
  if (!instance) throw new Error('OSM login is not configured (osmClientId).')
  rememberOsmReturnUrl()
  instance.authenticate(() => undefined)
}

export function logoutOsm() {
  getOsmAuth()?.logout()
}

export function completeOsmLoginFromUrl(search: string): Promise<boolean> {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const code = params.get('code')
  if (!code) return Promise.resolve(false)
  const instance = getOsmAuth()
  if (!instance) return Promise.resolve(false)
  return new Promise((resolve, reject) => {
    instance.authenticate((error) => {
      if (error) reject(error)
      else resolve(true)
    })
  })
}
