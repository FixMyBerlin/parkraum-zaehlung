/** Public app config. None of these is a secret — no `.env` files. */

export const OSM_OAUTH_LAND_FILENAME = 'osm-oauth-land.html'
export const OSM_AUTH_RETURN_URL_KEY = '__osmAuthReturnUrl'

/**
 * Register a non-confidential OSM OAuth 2 app with redirect URIs:
 * - `http://127.0.0.1:33478/osm-oauth-land.html`
 * - `https://fixmyberlin.github.io/parkraum-zaehlung/osm-oauth-land.html`
 * Scope: `read_prefs`. Paste the public client id here.
 */
export const osmClientId = ''

/** Empty until the Cloudflare KV API exists. Counts stay in localStorage. */
export const kvBaseUrl = ''
export const kvProject = 'parkraum-zaehlung'
export const kvApiKey = ''

export const tildaTilesUrl = 'https://tiles.tilda-geo.de'
export const tildaParkingsTileset = 'atlas_generalized_parkings,atlas_generalized_parkings_labels'

export const sampleEdgesUrl = `${import.meta.env.BASE_URL}fixtures/loerrach-sample.geojson`

export const loerrachMapFallback = { zoom: 15.4, lat: 47.6148, lng: 7.6616 } as const

export function isKvConfigured() {
  return kvBaseUrl.length > 0 && kvApiKey.length > 0
}

export function isOsmLoginConfigured() {
  return osmClientId.length > 0
}
