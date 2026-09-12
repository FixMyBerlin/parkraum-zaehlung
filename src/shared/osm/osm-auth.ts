import { authReady, getAuthToken, isLoggedIn, login, logout } from 'osm-api'
import {
  isOsmLoginConfigured,
  OSM_AUTH_RETURN_URL_KEY,
  OSM_OAUTH_LAND_FILENAME,
  osmClientId,
} from '@/config/app.const'

export function getOsmOAuthRedirectUrl(
  origin = globalThis.location?.origin ?? '',
  baseUrl = import.meta.env.BASE_URL,
) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL(OSM_OAUTH_LAND_FILENAME, new URL(base, origin)).href
}

export async function waitForOsmAuth() {
  await authReady
  return isLoggedIn()
}

function rememberOsmReturnUrl() {
  const { pathname, search, hash } = globalThis.location
  localStorage.setItem(OSM_AUTH_RETURN_URL_KEY, `${pathname}${search}${hash}`)
}

export function loginWithOsm() {
  if (!isOsmLoginConfigured()) {
    throw new Error('OSM login is not configured (osmClientId).')
  }
  rememberOsmReturnUrl()
  void login({
    mode: 'redirect',
    clientId: osmClientId,
    redirectUrl: getOsmOAuthRedirectUrl(),
    scopes: ['read_prefs'],
  })
}

export function getOsmToken() {
  return getAuthToken() ?? null
}

export { logout as logoutOsm }
