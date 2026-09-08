import { describe, expect, it } from 'vitest'
import { getOsmOAuthRedirectUrl } from './osm-auth'

describe('getOsmOAuthRedirectUrl', () => {
  it('builds the land page under the Vite base', () => {
    expect(getOsmOAuthRedirectUrl('http://127.0.0.1:33478', '/')).toBe(
      'http://127.0.0.1:33478/osm-oauth-land.html',
    )
    expect(getOsmOAuthRedirectUrl('https://fixmyberlin.github.io', '/parkraum-zaehlung/')).toBe(
      'https://fixmyberlin.github.io/parkraum-zaehlung/osm-oauth-land.html',
    )
  })
})
