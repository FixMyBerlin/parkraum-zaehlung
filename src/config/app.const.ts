/** Public app config. None of these is a secret — no `.env` files. */

export const OSM_OAUTH_LAND_FILENAME = 'osm-oauth-land.html'
export const OSM_AUTH_RETURN_URL_KEY = '__osmAuthReturnUrl'

/**
 * Non-confidential OSM OAuth 2 app https://www.openstreetmap.org/oauth2/applications/12574
 * Redirect URIs:
 * - `http://127.0.0.1:33478/osm-oauth-land.html`
 * - `https://fixmyberlin.github.io/parkraum-zaehlung/osm-oauth-land.html`
 * Scope: `read_prefs`. Public client id only — never a client secret.
 */
export const osmClientId = 'j4p1-aU0G5a8JiWPMlTBaZhGMN-N-RHTEuO2qdSdyh8'

/** Production key-value Worker. `kvApiKey` is a public project selector (`X-Api-Key`), not an admin secret. */
export const kvBaseUrl = 'https://key-value-store.fixmycity.workers.dev'
export const kvProject = 'parkraum-zaehlung'
export const kvApiKey = 'kv_4930a245426d9f3ea75a524c7b064c0b1d313ac1'

export const tildaTilesUrl = 'https://tiles.tilda-geo.de'
export const tildaParkingsTileset = 'atlas_generalized_parkings,atlas_generalized_parkings_labels'

export const sampleEdgesGithubUrl =
  'https://github.com/FixMyBerlin/parkraum-zaehlung/raw/main/public/fixtures/loerrach-sample.geojson'

export const loerrachMapFallback = { zoom: 15.4, lat: 47.6148, lng: 7.6616 } as const

export function isKvConfigured() {
  return kvBaseUrl.length > 0 && kvApiKey.length > 0
}

export function isOsmLoginConfigured() {
  return osmClientId.length > 0
}
